// Shared admin helpers.
import * as fb from "/assets/js/firebase.js";
import { esc } from "/assets/js/utils.js";
export { fb };
export { toast } from "/assets/js/ui.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const state = { user: null, cloudinary: null, unread: 0 };

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
document.addEventListener("click", e => {
  const d = dlg();
  if (d && (e.target === d || e.target.closest("#dlg [data-close]"))) closeDialog(null);
});
document.addEventListener("cancel", e => { if (e.target === dlg()) { e.preventDefault(); closeDialog(null); } }, true);

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

// ---------- Cloudinary ----------
export async function cloudinaryConfig(force = false) {
  if (state.cloudinary && !force) return state.cloudinary;
  try {
    const snap = await fb.getDoc(fb.doc(fb.db, "private", "integrations"));
    state.cloudinary = snap.exists() ? snap.data() : {};
  } catch { state.cloudinary = {}; }
  return state.cloudinary;
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
