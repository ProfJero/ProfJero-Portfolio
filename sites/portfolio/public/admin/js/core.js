// Shared admin helpers.
import * as fb from "/assets/js/firebase.js";
import { esc } from "/assets/js/utils.js";
export { fb };
export { toast } from "/assets/js/ui.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const state = { user: null, cloudinary: null, unread: 0, access: null };

/** First name for greetings: the admin's own saved name, their Google name, the site owner name, or their email. */
export function firstName() {
  const a = state.access, u = state.user;
  const full = a?.name || u?.displayName || (a?.owner ? state.ownerName : "") || (u?.email || "").split("@")[0];
  return String(full || "").trim().split(/\s+/)[0] || "there";
}
export const can = area => !!state.access?.perms?.has(area);

// ---------- Dialog ----------
const dlg = () => $("#dlg");
let dlgResolve = null;

/**
 * Opens the shared dialog. `actions` = [{label, value, cls}]. Resolves with the
 * clicked action value, or null when dismissed. `onOpen(body)` lets callers wire up content.
 */
export function openDialog({ title, body = "", actions = [{ label: "Close", value: null, cls: "btn-ghost" }], size = "", onOpen } = {}) {
  const d = dlg();
  d.className = "a-dialog " + size;
  $("#dlg-title").textContent = title;
  $("#dlg-body").innerHTML = body;
  $("#dlg-foot").innerHTML = actions.map((a, i) => `<button type="button" class="btn ${a.cls || "btn-primary"}" data-i="${i}">${a.label}</button>`).join("");
  $("#dlg-foot").hidden = !actions.length;
  d.dataset.dirty = "";
  return new Promise(resolve => {
    dlgResolve?.(null);
    dlgResolve = resolve;
    $$("#dlg-foot button").forEach(b => b.onclick = async () => {
      const a = actions[+b.dataset.i];
      if (a.handler) {
        b.disabled = true;
        try { const ok = await a.handler($("#dlg-body")); if (ok === false) { b.disabled = false; return; } }
        catch (e) { b.disabled = false; throw e; }
      }
      closeDialog(a.value);
    });
    if (!d.open) d.showModal();
    onOpen?.($("#dlg-body"));
  });
}
export function closeDialog(value = null) {
  const r = dlgResolve; dlgResolve = null;
  if (dlg().open) dlg().close();
  r?.(value);
}
// Dialogs only close with their close/cancel buttons. Clicking the empty space around
// them never closes (so entries aren't lost by accident), and Esc/close ask first if
// something was typed.
const dlgDirty = () => dlg()?.dataset.dirty === "1";
const askDiscard = () => !dlgDirty() || confirm("Discard what you've entered?");
document.addEventListener("input", e => { if (e.target.closest?.("#dlg-body")) dlg().dataset.dirty = "1"; });
document.addEventListener("click", e => {
  const d = dlg();
  if (!d) return;
  if (e.target.closest("#dlg [data-close]")) { if (askDiscard()) closeDialog(null); return; }
  if (e.target === d) { d.classList.remove("nudge"); void d.offsetWidth; d.classList.add("nudge"); }   // gentle shake: "use the buttons"
});
document.addEventListener("cancel", e => { if (e.target === dlg()) { e.preventDefault(); if (askDiscard()) closeDialog(null); } }, true);

export async function confirmDialog(message, { title = "Are you sure?", ok = "Delete", danger = true } = {}) {
  const v = await openDialog({
    title, size: "narrow",
    body: `<p style="margin:0">${message}</p>`,
    actions: [{ label: "Cancel", value: false, cls: "btn-ghost" }, { label: ok, value: true, cls: danger ? "btn-primary danger-btn" : "btn-primary" }]
  });
  return v === true;
}

// ---------- Formatting ----------
export function fmtDate(v, withTime = false) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
export const num = n => (Number(n) || 0).toLocaleString();

export function emptyState(icon, text, action = "") {
  return `<div class="empty"><i class="${icon}"></i><p>${text}</p>${action}</div>`;
}

// ---------- CSV ----------
export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = v => {
    const s = v?.toDate ? v.toDate().toISOString() : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
  download(filename, csv, "text/csv");
}
export function download(filename, content, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Encrypted settings vault ----------
// Secrets (Cloudinary details) are stored AES-GCM encrypted in /private/integrations,
// with the key kept in a separate admin-only document. They never appear as plain
// text in the database, backups or the Firebase console, and the dashboard shows them
// masked until an admin re-confirms their identity.
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
let vault = null;
async function vaultKey(create = false) {
  if (vault) return vault;
  const ref = fb.doc(fb.db, "private", "vault");
  const snap = await fb.getDoc(ref);
  if (snap.exists()) return (vault = await crypto.subtle.importKey("raw", unb64(snap.data().k), "AES-GCM", false, ["encrypt", "decrypt"]));
  if (!create) throw new Error("No encryption key yet.");
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  await fb.setDoc(ref, { k: b64(await crypto.subtle.exportKey("raw", key)), createdAt: fb.serverTimestamp() });
  return (vault = key);
}
export async function encryptJSON(obj) {
  const key = await vaultKey(true), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}
export async function decryptJSON(enc) {
  const key = await vaultKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(enc.iv) }, key, unb64(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** Asks the signed-in admin to prove it's them (password or Google) before a sensitive action. */
export async function confirmIdentity(reason = "To continue, please confirm it's you.") {
  const u = fb.auth.currentUser;
  if (u.providerData.some(p => p.providerId === "password")) {
    const pass = await promptPassword(reason);
    if (!pass) return false;
    await fb.reauthenticateWithCredential(u, fb.EmailAuthProvider.credential(u.email, pass));
    return true;
  }
  await fb.reauthenticateWithPopup(u, new fb.GoogleAuthProvider());
  return true;
}
function promptPassword(reason) {
  let value = null;
  return openDialog({
    title: "Confirm it's you",
    body: `<p style="margin-top:0">${esc(reason)}</p><div class="f"><label for="cid-pass">Your password</label><input id="cid-pass" class="input" type="password" autocomplete="current-password"></div>`,
    actions: [{ label: "Cancel", value: null, cls: "btn-ghost" }, { label: "Confirm", value: "ok", cls: "btn-primary", handler: body => { value = $("#cid-pass", body).value; if (!value) return false; } }],
    onOpen: body => setTimeout(() => $("#cid-pass", body).focus(), 50)
  }).then(v => v === "ok" ? value : null);
}

// ---------- Cloudinary ----------
export async function cloudinaryConfig(force = false) {
  if (state.cloudinary && !force) return state.cloudinary;
  try {
    const snap = await fb.getDoc(fb.doc(fb.db, "private", "integrations"));
    const d = snap.exists() ? snap.data() : {};
    state.cloudinary = d.enc ? { ...(await decryptJSON(d.enc)), updatedAt: d.updatedAt, updatedBy: d.updatedBy } : d;   // older, unencrypted saves still work
  } catch { state.cloudinary = {}; }
  return state.cloudinary;
}
export async function saveCloudinary(values) {
  const clean = { cloudName: String(values.cloudName || "").trim(), uploadPreset: String(values.uploadPreset || "").trim(), folder: String(values.folder || "").trim() };
  // A full overwrite (no merge) so no plain-text copy is left behind.
  await fb.setDoc(fb.doc(fb.db, "private", "integrations"), { enc: await encryptJSON(clean), configured: !!(clean.cloudName && clean.uploadPreset), updatedAt: fb.serverTimestamp(), updatedBy: state.user.email });
  return cloudinaryConfig(true);
}

/**
 * Uploads a file to Cloudinary with an unsigned preset and records it in the
 * media library. onProgress receives 0–100.
 */
export async function uploadToCloudinary(file, { folder = "", onProgress } = {}) {
  const cfg = await cloudinaryConfig();
  if (!cfg.cloudName || !cfg.uploadPreset) {
    throw new Error("Cloudinary isn't configured yet. Go to Settings → Cloudinary and add your cloud name and unsigned upload preset.");
  }
  const max = 25 * 1024 * 1024;
  if (file.size > max) throw new Error("File is larger than 25 MB.");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", cfg.uploadPreset);
  const f = [cfg.folder, folder].filter(Boolean).join("/");
  if (f) fd.append("folder", f);
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/auto/upload`);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let j = {};
      try { j = JSON.parse(xhr.responseText); } catch { }
      xhr.status < 300 ? resolve(j) : reject(new Error(j.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
  const item = {
    url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type, format: result.format || "",
    width: result.width || 0, height: result.height || 0, bytes: result.bytes || 0,
    name: file.name, createdAt: fb.serverTimestamp(), uploadedBy: state.user?.email || ""
  };
  try { await fb.addDoc(fb.collection(fb.db, "media"), item); } catch { }
  return item;
}

export const fileSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
export { esc };
