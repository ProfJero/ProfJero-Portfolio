// ProfJero Hub — client portal: accounts, bookings, quotes/orders, projects,
// messages and profile. Data lives in the shared Firestore project; the admin
// manages the other side from the portfolio dashboard.
import { $, $$, esc, toast, bootCommon, openModal, closeModal } from "./hub-common.js";
import { firebase } from "./store.js";
import { formatDate, timeAgo, toDate, compact, safeUrl, isEmail, initials, hueFrom } from "./utils.js";
import { STATUS, timeline } from "./status.js";
import { computeTotals, displayStatus, STATUS_LABEL, fmtDay, money as gh } from "./invoice-doc.js";
import { initPWA } from "./pwa.js";
import { mountChat } from "./chat-kit.js";

initPWA({
  app: "portal", scope: "/portal/",
  onIOSHelp: () => openModal("Install the ProfJero app", `<p>On iPhone or iPad, open this page in <b>Safari</b>, tap <b>Share</b> <i class="fa-solid fa-arrow-up-from-bracket"></i>, then <b>Add to Home Screen</b>. The portal then opens like an app, straight to your bookings, quotes and messages.</p>`, { wide: false, pad: true })
});

const STUDIO_NAMES = { "digital-studio": "Digital Studio", "creative-studio": "Creative Studio", "nourish-studio": "Nourish Studio", "agro-studio": "Agro Studio" };
const studioName = x => x.studioName || STUDIO_NAMES[x.studio] || x.studio || "";

bootCommon();
const root = $("#portal-root");
const next = new URLSearchParams(location.search).get("next");
let fb, user, profile = {}, unsub = [];
const data = { bookings: [], orders: [], projects: [], invoices: [], messages: [], thread: null, review: undefined };

const money = n => `GH₵ ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const friendly = e => ({
  "auth/invalid-credential": "Incorrect email or password.", "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "No account with that email.", "auth/email-already-in-use": "An account with this email already exists — sign in instead.",
  "auth/weak-password": "Please use at least 6 characters for your password.", "auth/too-many-requests": "Too many attempts. Please wait and try again.",
  "auth/popup-closed-by-user": "", "auth/operation-not-allowed": "This sign-in method isn't enabled yet. Please contact us.",
  "auth/unauthorized-domain": "This domain isn't authorised for sign-in yet. Please contact us."
}[e?.code] ?? e?.message);

// ======================= AUTH SCREEN =======================
function authScreen(mode = "signin") {
  root.innerHTML = `
  <section class="portal-auth">
    <div class="portal-auth-art">
      <span class="eyebrow on-dark"><i class="fa-regular fa-circle-user"></i> Client portal</span>
      <h1>Everything about your projects, in one place.</h1>
      <ul>
        <li><i class="fa-regular fa-calendar-check"></i> Manage bookings — reschedule or cancel</li>
        <li><i class="fa-solid fa-file-invoice"></i> Review and approve quotes</li>
        <li><i class="fa-solid fa-bars-progress"></i> Follow project progress & milestones</li>
        <li><i class="fa-solid fa-download"></i> Download deliverables & see invoices</li>
        <li><i class="fa-regular fa-comments"></i> Chat directly with the ProfJero team</li>
      </ul>
    </div>
    <div class="portal-auth-card">
      <div class="seg" role="tablist"><button type="button" data-mode="signin" class="${mode === "signin" ? "active" : ""}">Sign in</button><button type="button" data-mode="signup" class="${mode === "signup" ? "active" : ""}">Create account</button></div>
      <button class="btn btn-google btn-block" type="button" id="p-google"><i class="fa-brands fa-google" style="color:#EA4335"></i> Continue with Google</button>
      <div class="divider">or with email</div>
      <form id="p-auth" novalidate>
        ${mode === "signup" ? `<div class="field"><label for="p-name">Full name</label><input id="p-name" autocomplete="name" required maxlength="100"></div>
        <div class="field"><label for="p-phone">Phone / WhatsApp</label><input id="p-phone" type="tel" autocomplete="tel" maxlength="30"></div>` : ""}
        <div class="field"><label for="p-email">Email</label><input id="p-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="p-pass">Password ${mode === "signin" ? '<a href="#" id="p-forgot" class="small" style="float:right">Forgot?</a>' : ""}</label><input id="p-pass" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required minlength="6"></div>
        <button class="btn btn-primary btn-block" type="submit">${mode === "signup" ? "Create my account" : "Sign in"}</button>
      </form>
      <div id="p-msg" class="auth-msg" role="alert" aria-live="assertive" hidden></div>
      <button type="button" class="btn btn-ghost btn-sm btn-block" data-install hidden style="margin-bottom:12px"><i class="fa-solid fa-mobile-screen-button"></i> Install the client portal app</button>
      <p class="small muted">Booked before as a guest? Create an account with the <b>same email</b> and verify it — your earlier bookings and quotes will appear automatically.</p>
    </div>
  </section>`;
  $$(".seg button", root).forEach(b => b.onclick = () => authScreen(b.dataset.mode));
  // Show sign-in feedback: errors in red (and the fields outlined), confirmations in green.
  const say = (text, kind = "error") => {
    const m = $("#p-msg"); if (!m) return;
    m.hidden = !text; m.className = `auth-msg ${kind}`;
    m.innerHTML = text ? `<i class="fa-solid ${kind === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${esc(text)}</span>` : "";
    if (kind === "error" && text) { m.classList.remove("shake"); void m.offsetWidth; m.classList.add("shake"); }
  };
  const markBad = (...ids) => ids.forEach(id => { const el = $(id); if (el) { el.setAttribute("aria-invalid", "true"); el.addEventListener("input", () => { el.removeAttribute("aria-invalid"); say(""); }, { once: true }); } });
  $("#p-google").onclick = async () => {
    try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); }
    catch (e) { const m = friendly(e); if (m) say(m); }
  };
  $("#p-forgot")?.addEventListener("click", async e => {
    e.preventDefault();
    const email = $("#p-email").value.trim();
    if (!isEmail(email)) { say("Enter your email above first."); markBad("#p-email"); return; }
    try { await fb.sendPasswordResetEmail(fb.auth, email); say("Password reset email sent — check your inbox.", "ok"); }
    catch (err) { say(friendly(err)); }
  });
  $("#p-auth").onsubmit = async e => {
    e.preventDefault();
    const email = $("#p-email").value.trim(), pass = $("#p-pass").value;
    const btn = $("button[type=submit]", e.target);
    if (!isEmail(email) || pass.length < 6) { say(!isEmail(email) ? "That email address doesn't look right." : "Your password must be at least 6 characters."); markBad(!isEmail(email) ? "#p-email" : "#p-pass"); return; }
    say("");
    btn.disabled = true;
    try {
      if (mode === "signup") {
        const name = $("#p-name").value.trim(), phone = $("#p-phone").value.trim().slice(0, 30);
        if (name.length < 2) { say("Please enter your name."); markBad("#p-name"); btn.disabled = false; return; }
        const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, pass);
        await fb.updateProfile(cred.user, { displayName: name });
        // The auth listener may already have swapped the form out, so use captured values only.
        await fb.setDoc(fb.doc(fb.db, "users", cred.user.uid), { name, email: email.toLowerCase(), phone, company: "", createdAt: fb.serverTimestamp() }, { merge: true });
        Object.assign(profile, { name, phone });
        fb.sendEmailVerification(cred.user).catch(() => { });
        toast("Welcome! Check your inbox to verify your email.");
      } else {
        await fb.signInWithEmailAndPassword(fb.auth, email, pass);
      }
    } catch (err) {
      say(friendly(err) || "Something went wrong. Please try again.");
      if (/credential|wrong-password|user-not-found|invalid-email/.test(err.code || "")) markBad("#p-email", "#p-pass");
      btn.disabled = false;
    }
  };
}

// ======================= DATA =======================
async function queryMine(col, statuses = null) {
  const out = new Map();
  const add = snap => snap.docs.forEach(d => out.set(d.id, { id: d.id, ...d.data() }));
  const q = w => statuses ? fb.query(fb.collection(fb.db, col), w, fb.where("status", "in", statuses)) : fb.query(fb.collection(fb.db, col), w);
  const tasks = [fb.getDocs(q(fb.where("uid", "==", user.uid))).then(add)];
  if (user.emailVerified && user.email) tasks.push(fb.getDocs(q(fb.where("email", "==", user.email.toLowerCase()))).then(add));
  await Promise.allSettled(tasks);
  return [...out.values()].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}

// Invoices are listed only once sent (drafts stay private), so the query must say so.
const SENT = ["sent", "partial", "paid", "void", "accepted", "declined", "converted"];
async function loadAll() {
  const [bookings, orders, projects, invoices] = await Promise.all([queryMine("bookings"), queryMine("orders"), queryMine("clientProjects"), queryMine("invoices", SENT)]);
  Object.assign(data, { bookings, orders, projects, invoices });
  listenData();
}

// Keep bookings, quotes and projects live so admin updates show up without a reload.
let dataUnsub = [];
function listenData() {
  dataUnsub.forEach(u => u()); dataUnsub = [];
  const KEY = { bookings: "bookings", orders: "orders", clientProjects: "projects", invoices: "invoices" };
  let timer;
  for (const col of Object.keys(KEY)) {
    const parts = {};
    const queries = { uid: fb.where("uid", "==", user.uid) };
    if (user.emailVerified && user.email) queries.email = fb.where("email", "==", user.email.toLowerCase());
    for (const [k, w] of Object.entries(queries)) {
      dataUnsub.push(fb.onSnapshot(col === "invoices" ? fb.query(fb.collection(fb.db, col), w, fb.where("status", "in", SENT)) : fb.query(fb.collection(fb.db, col), w), snap => {
        parts[k] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const merged = new Map(); Object.values(parts).flat().forEach(x => merged.set(x.id, x));
        data[KEY[col]] = [...merged.values()].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
        clearTimeout(timer);
        // Don't repaint over a form the client is typing in.
        timer = setTimeout(() => {
          const pv = $("#pv"), ae = document.activeElement;
          const typing = pv && ae && pv.contains(ae) && ae.matches("input,textarea,select");
          if (user && pv && !typing && !["messages", "profile"].includes(route())) render();
        }, 150);
      }, () => { }));
    }
  }
}

function listenMessages() {
  unsub.forEach(u => u()); unsub = [];
  unsub.push(fb.onSnapshot(fb.doc(fb.db, "reviews", user.uid), snap => {
    const first = data.review === undefined;
    data.review = snap.exists() ? snap.data({ serverTimestamps: "estimate" }) : null;
    if (route() === "review" && (first || !$("#rv-form")?.contains(document.activeElement))) renderReview();
  }, () => { data.review = null; }));
  let prevUnread = null;
  unsub.push(fb.onSnapshot(fb.doc(fb.db, "threads", user.uid), snap => {
    data.thread = snap.exists() ? snap.data() : null;
    const n = data.thread?.unreadClient || 0;
    const b = $("#badge-msg");
    if (b) { b.textContent = n || ""; b.hidden = !n; }
    if (prevUnread !== null && n > prevUnread && route() !== "messages") toast(`New message from ProfJero: “${String(data.thread.lastMessage || "").slice(0, 60)}”`, "info");
    prevUnread = n;
  }, () => { }));
  // While the portal is open, tell the team we're here, so their messages show ✓✓ delivered.
  const beat = () => { if (data.thread && document.visibilityState === "visible") fb.updateDoc(fb.doc(fb.db, "threads", user.uid), { clientSeenAt: fb.serverTimestamp(), clientOnline: true }).catch(() => { }); };
  const hb = setInterval(beat, 60000); setTimeout(beat, 2500);
  unsub.push(() => clearInterval(hb));
}

// ======================= SHELL =======================
const TABS = [
  ["overview", "fa-solid fa-gauge-high", "Overview"], ["bookings", "fa-regular fa-calendar-check", "Bookings"],
  ["orders", "fa-solid fa-file-invoice", "Quotes & orders"], ["invoices", "fa-solid fa-file-invoice-dollar", "Invoices"], ["projects", "fa-solid fa-bars-progress", "Projects"],
  ["messages", "fa-regular fa-comments", "Messages"], ["review", "fa-regular fa-star", "Testimonial"], ["profile", "fa-regular fa-id-card", "Profile"]
];
const route = () => (location.hash.replace(/^#\/?/, "") || "overview").split("/")[0];

function shell() {
  const name = profile.name || user.displayName || user.email;
  root.innerHTML = `
  <div class="portal container">
    <aside class="portal-side">
      <div class="portal-me">${photoTag(myPhoto(), name, 44)}
        <div><strong>${esc(name)}</strong><small>${esc(user.email || "")}</small></div></div>
      <nav>${TABS.map(([k, i, l]) => `<a href="#/${k}" data-tab="${k}"><i class="${i}"></i> ${l}${k === "messages" ? ' <span class="side-badge" id="badge-msg" hidden></span>' : ""}</a>`).join("")}</nav>
      <div class="portal-side-foot">
        <a href="/booking/" class="btn btn-primary btn-sm btn-block"><i class="fa-regular fa-calendar-plus"></i> New booking</a>
        <a href="/creative-studio#products" class="btn btn-ghost btn-sm btn-block"><i class="fa-solid fa-file-invoice"></i> Request a quote</a>
        <button type="button" class="btn btn-ghost btn-sm btn-block" data-install hidden><i class="fa-solid fa-mobile-screen-button"></i> Install the app</button>
        <button type="button" class="btn btn-ghost btn-sm btn-block" id="p-logout"><i class="fa-solid fa-right-from-bracket"></i> Sign out</button>
      </div>
    </aside>
    <section class="portal-view" id="pv" tabindex="-1"></section>
  </div>`;
  $("#p-logout").onclick = async () => { unsub.forEach(u => u()); dataUnsub.forEach(u => u()); dataUnsub = []; await fb.signOut(fb.auth); location.hash = ""; };
  render();
}

function verifyBanner() {
  if (user.emailVerified || !user.email) return "";
  return `<div class="callout warn" style="margin-bottom:18px"><i class="fa-solid fa-envelope-circle-check"></i><div><strong>Please verify your email.</strong> Once verified, bookings and quotes you made as a guest with <b>${esc(user.email)}</b> will appear here. <button class="linklike" id="p-resend">Resend email</button> · <button class="linklike" id="p-reload">I've verified</button></div></div>`;
}

let chatRoom = null;
function render() {
  const r = route();
  if (r !== "messages") { chatRoom?.destroy(); chatRoom = null; }
  document.body.dataset.ptab = r;
  $$(".portal-side nav a").forEach(a => a.classList.toggle("active", a.dataset.tab === r));
  const view = $("#pv");
  ({ overview, bookings: renderBookings, orders: renderOrders, invoices: renderInvoices, projects: renderProjects, messages: renderMessages, review: renderReview, profile: renderProfile }[r] || overview)();
  view.focus({ preventScroll: true });
}
addEventListener("hashchange", () => user && render());

// Verify-email banner buttons (delegated: views re-render the banner on live updates).
root.addEventListener("click", async e => {
  if (!user) return;
  if (e.target.closest("#p-resend")) {
    try { await fb.sendEmailVerification(user); toast("Verification email sent"); } catch (err) { toast(friendly(err) || err.message, "error"); }
  } else if (e.target.closest("#p-reload")) {
    await user.reload(); await user.getIdToken(true);
    if (user.emailVerified) { toast("Email verified!"); await loadAll(); render(); } else toast("Not verified yet — check your inbox.", "info");
  }
});

// Client photo: the one they uploaded, else their Google photo.
const myPhoto = () => profile.photo || user.photoURL || "";
const photoTag = (src, name, size = 88) => src ? `<img class="avatar" src="${esc(src)}" alt="" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px">` : `<span class="avatar avatar-fallback" style="--h:${hueFrom(name)};width:${size}px;height:${size}px;font-size:${size / 2.6}px">${esc(initials(name))}</span>`;
// Square-crop and shrink a chosen image to a small JPEG data URL (≈20–40 KB) that can live in Firestore.
async function squarePhoto(file, size = 320) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Please choose an image file (JPG, PNG or WebP).");
  if (file.size > 15e6) throw new Error("That image is too large. Please choose one under 15 MB.");
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height), c = document.createElement("canvas");
  c.width = c.height = Math.min(size, side);
  c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, c.width, c.height);
  let q = .85, out = c.toDataURL("image/jpeg", q);
  while (out.length > 150000 && q > .4) { q -= .1; out = c.toDataURL("image/jpeg", q); }
  return out;
}
async function savePhoto(photo) {
  await fb.setDoc(fb.doc(fb.db, "users", user.uid), { name: profile.name || user.displayName || user.email, photo, updatedAt: fb.serverTimestamp() }, { merge: true });
  profile.photo = photo;
  if (data.thread) fb.updateDoc(fb.doc(fb.db, "threads", user.uid), { photo }).catch(() => { });
  const me = $(".portal-me .avatar"); if (me) me.outerHTML = photoTag(myPhoto(), profile.name || user.email, 44);
}

const empty = (icon, text, action = "") => `<div class="empty"><i class="${icon}"></i><p>${text}</p>${action}</div>`;

// ======================= OVERVIEW =======================
function overview() {
  const upcoming = data.bookings.filter(b => ["pending", "confirmed"].includes(b.status) && b.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const openQuotes = data.orders.filter(o => ["requested", "quoted", "approved", "in-production", "ready"].includes(o.status));
  const active = data.projects.filter(p => p.status !== "completed");
  const invBalance = data.invoices.filter(i => i.kind !== "quote" && i.status !== "void").reduce((a, i) => a + computeTotals(i).balance, 0);
  const balance = invBalance + data.projects.reduce((a, p) => a + Math.max(0, Number(p.invoice?.total || 0) - Number(p.invoice?.paid || 0)), 0);
  const needs = data.orders.filter(o => o.status === "quoted");
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  $("#pv").innerHTML = `${verifyBanner()}
    <div class="pv-head"><h1>${hello}, ${esc((profile.name || user.displayName || "there").split(" ")[0])} 👋</h1><p>Here's everything happening with your ProfJero Hub services.</p></div>
    ${needs.length ? `<div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-bell"></i><div><b>${needs.length} quote${needs.length > 1 ? "s" : ""} waiting for your approval.</b> <a href="#/orders">Review now →</a></div></div>` : ""}
    <div class="kpis">
      <a class="kpi" href="#/bookings" style="--c:var(--brand)"><i class="fa-regular fa-calendar-check"></i><small>Upcoming bookings</small><strong>${upcoming.length}</strong></a>
      <a class="kpi" href="#/orders" style="--c:#7C3AED"><i class="fa-solid fa-file-invoice"></i><small>Open quotes & orders</small><strong>${openQuotes.length}</strong></a>
      <a class="kpi" href="#/projects" style="--c:var(--green)"><i class="fa-solid fa-bars-progress"></i><small>Active projects</small><strong>${active.length}</strong></a>
      <a class="kpi" href="#/invoices" style="--c:#D97706"><i class="fa-solid fa-wallet"></i><small>Balance due</small><strong>${money(balance)}</strong></a>
    </div>
    <div class="pv-grid">
      <div class="card"><div class="card-head"><h3>Next booking</h3><a class="small" href="#/bookings">All bookings</a></div>
        ${upcoming[0] ? bookingCard(upcoming[0], true) : empty("fa-regular fa-calendar", "No upcoming bookings.", '<a class="btn btn-primary btn-sm" href="/booking/">Book a service</a>')}</div>
      <div class="card"><div class="card-head"><h3>Active projects</h3><a class="small" href="#/projects">All projects</a></div>
        ${active.slice(0, 3).map(p => `<a class="mini-proj" href="#/projects"><div><strong>${esc(p.title)}</strong><small>${esc(studioName(p))} · ${esc(p.nextStep || "In progress")}</small></div><div class="progress"><span style="width:${Number(p.progress) || 0}%"></span></div><b>${Number(p.progress) || 0}%</b></a>`).join("") || empty("fa-solid fa-bars-progress", "Projects we're working on for you will appear here.")}</div>
    </div>
    <div class="card" style="margin-top:18px"><div class="card-head"><h3>Quick actions</h3></div>
      <div class="quick-actions">
        <a href="/booking/"><i class="fa-regular fa-calendar-plus"></i> Book a service</a>
        <a href="/creative-studio#products"><i class="fa-solid fa-gift"></i> Branded products</a>
        <a href="#/messages"><i class="fa-regular fa-comments"></i> Message the team</a>
        <a href="#/review"><i class="fa-regular fa-star"></i> ${data.review ? "Your testimonial" : "Write a testimonial"}</a>
        <a href="https://wa.me/233531207256" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
      </div></div>`;
}

// ======================= BOOKINGS =======================
function bookingCard(b, compactView = false) {
  const canChange = ["pending", "confirmed"].includes(b.status);
  return `<article class="p-item" data-id="${esc(b.id)}" data-col="bookings">
    <header><div><small>${esc(studioName(b))} · ${esc(b.ref || b.id)}</small><h3>${esc(b.service)}</h3>
      <p><i class="fa-regular fa-calendar"></i> ${formatDate(b.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${esc(b.time)} · ${b.mode === "remote" ? "Online" : "In person"}</p></div>
      <span class="status ${esc(b.status)}">${esc(STATUS[b.status]?.[0] || b.status)}</span></header>
    ${compactView ? "" : timeline("bookings", b.status)}
    ${b.adminNote ? `<p class="note"><i class="fa-solid fa-comment-dots"></i> <b>From ProfJero:</b> ${esc(b.adminNote)}</p>` : ""}
    ${b.rescheduleRequest ? `<p class="note"><i class="fa-solid fa-clock-rotate-left"></i> Reschedule requested to ${formatDate(b.rescheduleRequest.date)} at ${esc(b.rescheduleRequest.time)} — awaiting confirmation.</p>` : ""}
    ${compactView || !canChange ? "" : `<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="reschedule"><i class="fa-solid fa-clock-rotate-left"></i> Request new time</button><button class="btn btn-ghost btn-sm danger" data-act="cancel"><i class="fa-solid fa-ban"></i> Cancel booking</button></div>`}
  </article>`;
}
function renderBookings() {
  $("#pv").innerHTML = `${verifyBanner()}<div class="pv-head row"><div><h1>Bookings</h1><p>Your consultations, sessions and site visits.</p></div><a class="btn btn-primary btn-sm" href="/booking/"><i class="fa-regular fa-calendar-plus"></i> New booking</a></div>
    <div class="p-list">${data.bookings.map(b => bookingCard(b)).join("") || empty("fa-regular fa-calendar-check", "No bookings yet.", '<a class="btn btn-primary btn-sm" href="/booking/">Book your first service</a>')}</div>`;
}

// ======================= ORDERS / QUOTES =======================
function orderCard(o) {
  return `<article class="p-item" data-id="${esc(o.id)}" data-col="orders">
    <header><div><small>${esc(o.category || "Quote")} · ${esc(o.ref || o.id)}</small><h3>${esc(o.quantity)} × ${esc(o.product)}</h3>
      <p>${esc([o.method, o.colors && `${o.colors} colours`, o.deadline && `needed by ${formatDate(o.deadline)}`].filter(Boolean).join(" · ") || "Details to be confirmed")}</p></div>
      <span class="status ${esc(o.status)}">${esc(STATUS[o.status]?.[0] || o.status)}</span></header>
    ${timeline("orders", o.status)}
    ${o.quoteAmount ? `<div class="quote-box"><div><small>Quoted price</small><strong>${money(o.quoteAmount)}</strong>${o.quoteNote ? `<p>${esc(o.quoteNote)}</p>` : ""}</div>
      ${o.status === "quoted" ? `<div class="btn-row"><button class="btn btn-primary btn-sm" data-act="approve"><i class="fa-solid fa-check"></i> Approve quote</button><button class="btn btn-ghost btn-sm" data-act="decline">Decline</button></div>` : ""}</div>` : ""}
    ${o.adminNote ? `<p class="note"><i class="fa-solid fa-comment-dots"></i> <b>From ProfJero:</b> ${esc(o.adminNote)}</p>` : ""}
    ${["requested", "quoted"].includes(o.status) ? `<div class="btn-row"><button class="btn btn-ghost btn-sm danger" data-act="cancel-order"><i class="fa-solid fa-ban"></i> Cancel request</button></div>` : ""}
  </article>`;
}
function renderOrders() {
  $("#pv").innerHTML = `${verifyBanner()}<div class="pv-head row"><div><h1>Quotes & orders</h1><p>Branded products and custom requests from the Creative Studio.</p></div><a class="btn btn-primary btn-sm" href="/creative-studio#products"><i class="fa-solid fa-gift"></i> Request a quote</a></div>
    <div class="p-list">${data.orders.map(orderCard).join("") || empty("fa-solid fa-file-invoice", "No quotes or orders yet.", '<a class="btn btn-primary btn-sm" href="/creative-studio#products">Browse branded products</a>')}</div>`;
}

// ======================= INVOICES =======================
function invoiceCard(i) {
  const t = computeTotals(i), st = displayStatus(i), quote = i.kind === "quote";
  return `<article class="p-item inv-card">
    <header><div><small>${quote ? "Quotation" : "Invoice"} · ${esc(i.number || "")}</small><h3>${esc(i.subject || (i.items || [])[0]?.description || "Invoice")}</h3>
      <p class="muted small">Issued ${fmtDay(i.issueDate)}${!quote && i.dueDate ? ` · due ${i.terms === "receipt" ? "on receipt" : fmtDay(i.dueDate)}` : ""}</p></div>
      <span class="inv-pill st-${st}">${STATUS_LABEL[st] || st}</span></header>
    <dl class="inv"><div><dt>Total</dt><dd>${gh(t.total)}</dd></div>${quote ? "" : `<div><dt>Paid</dt><dd>${gh(t.paid)}</dd></div><div><dt>Balance</dt><dd class="${t.balance > 0 ? "due" : "ok"}">${gh(t.balance)}</dd></div>`}</dl>
    <div class="btn-row"><a class="btn btn-primary btn-sm" href="/invoice/?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener"><i class="fa-regular fa-file-lines"></i> View &amp; download</a>${!quote && t.balance > 0 ? '<a class="btn btn-ghost btn-sm" href="#/messages"><i class="fa-regular fa-comments"></i> Ask about this invoice</a>' : ""}</div>
  </article>`;
}
function renderInvoices() {
  const list = data.invoices.filter(i => i.status !== "converted");
  const due = list.filter(i => i.kind !== "quote" && i.status !== "void").reduce((a, i) => a + computeTotals(i).balance, 0);
  $("#pv").innerHTML = `${verifyBanner()}<div class="pv-head"><h1>Invoices</h1><p>Your invoices and quotations from ProfJero. Open one to view, print or download it as a PDF.</p></div>
    ${due > 0 ? `<div class="callout warn" style="margin-bottom:16px"><i class="fa-solid fa-wallet"></i><div>You have <b>${gh(due)}</b> to pay. Payment details (MoMo and bank) are on each invoice. Please use the invoice number as your reference.</div></div>` : ""}
    <div class="p-list">${list.map(invoiceCard).join("") || empty("fa-solid fa-file-invoice-dollar", "No invoices yet. When we send you an invoice or quotation, it appears here.")}</div>`;
}

// ======================= PROJECTS =======================
function renderProjects() {
  $("#pv").innerHTML = `${verifyBanner()}<div class="pv-head"><h1>Projects</h1><p>Progress, milestones, files and invoices for the work we're doing with you.</p></div>
    <div class="p-list">${data.projects.map(p => {
      const total = Number(p.invoice?.total || 0), paid = Number(p.invoice?.paid || 0);
      return `<article class="p-item project">
        <header><div><small>${esc(studioName(p) || "Project")}${p.startDate ? ` · started ${formatDate(p.startDate)}` : ""}</small><h3>${esc(p.title)}</h3>${p.summary ? `<p>${esc(p.summary)}</p>` : ""}</div>
          <span class="status ${esc(p.status || "active")}">${esc(p.status || "active")}</span></header>
        <div class="progress-row"><div class="progress big"><span style="width:${Number(p.progress) || 0}%"></span></div><b>${Number(p.progress) || 0}%</b></div>
        ${p.nextStep ? `<p class="note"><i class="fa-solid fa-forward"></i> <b>Next step:</b> ${esc(p.nextStep)}${p.dueDate ? ` · due ${formatDate(p.dueDate)}` : ""}</p>` : ""}
        <div class="proj-grid">
          ${(p.stages || []).length ? `<div><h4>Milestones</h4><ul class="stages">${p.stages.map(s => `<li class="${s.done ? "done" : ""}"><i class="fa-${s.done ? "solid fa-circle-check" : "regular fa-circle"}"></i> ${esc(s.name)}</li>`).join("")}</ul></div>` : ""}
          ${(p.files || []).length || safeUrl(p.demoUrl) ? `<div><h4>Files & links</h4><ul class="files">${safeUrl(p.demoUrl) ? `<li><a href="${esc(safeUrl(p.demoUrl))}" target="_blank" rel="noopener"><i class="fa-solid fa-display"></i> Preview / live demo</a></li>` : ""}${(p.files || []).map(f => `<li><a href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener"><i class="fa-regular fa-file"></i> ${esc(f.name || "File")}</a></li>`).join("")}</ul></div>` : ""}
          ${data.invoices.some(i => i.projectId === p.id) ? `<div><h4>Invoices</h4><ul class="files">${data.invoices.filter(i => i.projectId === p.id).map(i => `<li><a href="/invoice/?id=${encodeURIComponent(i.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-invoice-dollar"></i> ${esc(i.number)} · ${gh(computeTotals(i).balance)} due</a></li>`).join("")}</ul></div>` : ""}
          ${total ? `<div><h4>Invoice</h4><dl class="inv"><div><dt>Total</dt><dd>${money(total)}</dd></div><div><dt>Paid</dt><dd>${money(paid)}</dd></div><div><dt>Balance</dt><dd class="${total - paid > 0 ? "due" : "ok"}">${money(Math.max(0, total - paid))}</dd></div></dl>
            ${total - paid > 0 ? `<p class="small muted">Pay via Mobile Money or bank transfer — <a href="#/messages">ask us for payment details</a>.</p>` : '<p class="small" style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> Fully paid — thank you!</p>'}</div>` : ""}
        </div>
        ${(p.updates || []).length ? `<div><h4>Updates</h4><ul class="updates">${[...p.updates].reverse().slice(0, 6).map(u => `<li><time>${formatDate(u.date)}</time> ${esc(u.text)}</li>`).join("")}</ul></div>` : ""}
      </article>`;
    }).join("") || empty("fa-solid fa-bars-progress", "No projects yet. When we start working on something for you, you'll follow its progress here.")}</div>`;
}

// ======================= MESSAGES =======================
function renderMessages() {
  if (chatRoom && $("#pv .ck")) return;   // already open (live updates come from the chat itself)
  chatRoom?.destroy();
  $("#pv").innerHTML = `<div class="pv-head chat-head-row"><div><h1>Messages</h1><p>Chat with the ProfJero Hub team. Send photos, documents and voice notes. We usually reply within a few hours (Mon–Sat, 7am–8pm).</p></div></div>
    <div class="portal-chat card"></div>`;
  chatRoom = mountChat($("#pv .portal-chat"), {
    fb, threadId: user.uid, me: "client", toast,
    myName: profile.name || user.displayName || user.email,
    peer: { name: "ProfJero Hub team", sub: "Typically replies within a few hours", avatar: '<img src="/assets/img/brand/mark-192.png" alt="" class="avatar" style="background:#fff;padding:4px">' },
    threadDefaults: { name: (profile.name || user.displayName || user.email || "").slice(0, 100), email: user.email || "", ...(profile.photo ? { photo: profile.photo } : {}) },
    notify: { title: "ProfJero Hub", icon: "/assets/img/brand/app-portal-192.png" }
  });
}

// ======================= PROFILE =======================
// ======================= TESTIMONIAL =======================
const REVIEW_STATUS = {
  pending: ["pending", "fa-regular fa-clock", "Waiting for approval", "Thanks! We'll review it shortly and publish it on our websites."],
  approved: ["confirmed", "fa-solid fa-circle-check", "Published", "Your testimonial is live on ProfJero Hub and the ProfJero portfolio. Thank you!"],
  rejected: ["cancelled", "fa-regular fa-eye-slash", "Not published", "This testimonial isn't on the websites right now. You can edit it and send it again."]
};

function renderReview() {
  const r = data.review || null, verified = user.emailVerified;
  const st = r && REVIEW_STATUS[r.status];
  const rating = Number(r?.rating) || 5;
  const role = r?.role ?? [profile.company].filter(Boolean).join("");
  $("#pv").innerHTML = `${verifyBanner()}<div class="pv-head"><h1>Your testimonial</h1><p>Enjoyed working with us? A few words from you help other people trust ProfJero. Approved testimonials appear in the testimonial carousel on both of our websites.</p></div>
    ${st ? `<div class="callout review-state ${st[0]}"><i class="${st[1]}"></i><div><strong>${st[2]}</strong><br><span>${st[3]}</span></div></div>` : ""}
    <form class="card" id="rv-form" novalidate>
      <fieldset class="field full star-field"${verified ? "" : " disabled"}><legend>Your rating</legend>
        <div class="star-input">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rv-rating" id="rv-r${n}" value="${n}"${n === rating ? " checked" : ""}><label for="rv-r${n}" title="${n} star${n > 1 ? "s" : ""}"><i class="fa-solid fa-star"></i><span class="sr-only">${n} star${n > 1 ? "s" : ""}</span></label>`).join("")}</div></fieldset>
      <div class="form-grid">
        <div class="field"><label for="rv-name">Name to show</label><input id="rv-name" maxlength="80" value="${esc(r?.name || profile.name || user.displayName || "")}" ${verified ? "" : "disabled"}></div>
        <div class="field"><label for="rv-role">Role & organisation <small class="muted">(optional)</small></label><input id="rv-role" maxlength="100" placeholder="e.g. Director, Bright Future School" value="${esc(role)}" ${verified ? "" : "disabled"}></div>
        <div class="field"><label for="rv-studio">Which studio did you work with?</label><select id="rv-studio" ${verified ? "" : "disabled"}><option value="">Choose (optional)</option>${Object.entries(STUDIO_NAMES).map(([k, v]) => `<option value="${k}"${r?.studio === k ? " selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="field full"><label>Your photo <small class="muted">(optional — testimonials with a face are trusted more)</small></label>
          <div class="photo-pick sm" id="rv-photo-box"></div></div>
        <div class="field full"><label for="rv-text">Your testimonial</label><textarea id="rv-text" rows="6" minlength="20" maxlength="700" placeholder="What did we do for you, and what difference did it make?" ${verified ? "" : "disabled"}>${esc(r?.text || "")}</textarea><small class="muted" id="rv-count"></small></div>
      </div>
      <div class="form-foot">${r ? `<button type="button" class="btn btn-ghost btn-sm danger" id="rv-delete"><i class="fa-regular fa-trash-can"></i> Delete</button>` : "<span></span>"}
        <button class="btn btn-primary" type="submit" ${verified ? "" : "disabled"}><i class="fa-solid fa-paper-plane"></i> ${r ? "Update testimonial" : "Submit testimonial"}</button></div>
      ${verified ? "" : '<p class="muted small" style="margin:10px 0 0">Verify your email to write a testimonial.</p>'}
    </form>`;
  // The photo shown with the testimonial: what they used before, else their profile photo.
  let rvPhoto = r ? (r.photo || "") : myPhoto();
  const paintPhoto = () => {
    $("#rv-photo-box").innerHTML = `${photoTag(rvPhoto, $("#rv-name")?.value || profile.name || user.email, 64)}<div class="btn-row">
      <label class="btn btn-ghost btn-sm${verified ? "" : " disabled"}"><i class="fa-solid fa-camera"></i> ${rvPhoto ? "Change" : "Add a photo"}<input type="file" accept="image/*" hidden id="rv-photo-in" ${verified ? "" : "disabled"}></label>
      ${!rvPhoto && myPhoto() ? '<button type="button" class="btn btn-ghost btn-sm" data-rvp="profile">Use my profile photo</button>' : ""}
      ${rvPhoto ? '<button type="button" class="btn btn-ghost btn-sm danger" data-rvp="none"><i class="fa-regular fa-trash-can"></i> Remove</button>' : ""}</div>`;
    $("#rv-photo-in").onchange = async e => {
      try { rvPhoto = await squarePhoto(e.target.files[0]); if (!profile.photo) savePhoto(rvPhoto).catch(() => { }); paintPhoto(); toast("Photo added — remember to save your testimonial", "info"); }
      catch (err) { toast(err.message, "error"); }
    };
  };
  paintPhoto();
  $("#rv-photo-box").addEventListener("click", e => { const b = e.target.closest("[data-rvp]"); if (!b) return; rvPhoto = b.dataset.rvp === "profile" ? myPhoto() : ""; paintPhoto(); });
  const ta = $("#rv-text"), count = () => { $("#rv-count").textContent = `${ta.value.trim().length}/700 · at least 20 characters`; };
  ta.addEventListener("input", count); count();
  $("#rv-delete")?.addEventListener("click", async () => {
    if (!confirm("Delete your testimonial? If it's published, we'll take it down.")) return;
    try { await fb.deleteDoc(fb.doc(fb.db, "reviews", user.uid)); toast("Testimonial deleted"); } catch (err) { toast(friendly(err) || err.message, "error"); }
  });
  $("#rv-form").onsubmit = async e => {
    e.preventDefault();
    const text = ta.value.trim(), name = $("#rv-name").value.trim();
    if (name.length < 2) return toast("Please enter your name", "error");
    if (text.length < 20) return toast("Please write at least 20 characters", "error");
    const btn = $("button[type=submit]", e.target); btn.disabled = true;
    const doc = {
      uid: user.uid, email: user.email, name: name.slice(0, 80), role: $("#rv-role").value.trim().slice(0, 100), text: text.slice(0, 700),
      rating: Number($("input[name=rv-rating]:checked")?.value) || 5, studio: $("#rv-studio").value,
      photo: rvPhoto.length <= 200000 ? rvPhoto : "",
      status: "pending", updatedAt: fb.serverTimestamp()
    };
    // Updates merge so the original createdAt is kept exactly as stored.
    if (!r) doc.createdAt = fb.serverTimestamp();
    try { await fb.setDoc(fb.doc(fb.db, "reviews", user.uid), doc, { merge: !!r }); toast(r ? "Updated — we'll review the changes" : "Thank you! Your testimonial was sent for approval"); document.activeElement?.blur(); renderReview(); }
    catch (err) { toast(friendly(err) || err.message, "error"); btn.disabled = false; }
  };
}

function renderProfile() {
  const n = profile.notify || {};
  $("#pv").innerHTML = `${verifyBanner()}<div class="pv-head"><h1>Profile</h1><p>Keep your details up to date so we can reach you.</p></div>
    <form class="card" id="prof-form" novalidate>
      <div class="photo-pick" id="pf-photo">${photoTag(myPhoto(), profile.name || user.email)}
        <div><strong>Profile photo</strong><p class="muted small">Shown to the ProfJero team in chat and on your testimonial. A clear, friendly face photo works best.</p>
        <div class="btn-row"><label class="btn btn-ghost btn-sm"><i class="fa-solid fa-camera"></i> ${myPhoto() ? "Change photo" : "Upload photo"}<input type="file" accept="image/*" hidden id="pf-photo-in"></label>${profile.photo ? '<button type="button" class="btn btn-ghost btn-sm danger" id="pf-photo-rm"><i class="fa-regular fa-trash-can"></i> Remove</button>' : ""}</div></div></div>
      <div class="form-grid">
      <div class="field"><label for="pf-name">Full name</label><input id="pf-name" maxlength="100" value="${esc(profile.name || user.displayName || "")}"></div>
      <div class="field"><label for="pf-email">Email</label><input id="pf-email" value="${esc(user.email || "")}" disabled></div>
      <div class="field"><label for="pf-phone">Phone / WhatsApp</label><input id="pf-phone" type="tel" maxlength="30" value="${esc(profile.phone || "")}"></div>
      <div class="field"><label for="pf-company">Company / organisation</label><input id="pf-company" maxlength="120" value="${esc(profile.company || "")}"></div>
      <div class="field full"><label>Notifications</label>
        <label class="switch"><input type="checkbox" id="pf-n-email" ${n.email !== false ? "checked" : ""}><span class="track"></span>Email me about bookings, quotes and projects</label>
        <label class="switch" style="margin-top:8px"><input type="checkbox" id="pf-n-wa" ${n.whatsapp !== false ? "checked" : ""}><span class="track"></span>WhatsApp updates are OK</label></div>
    </div><div class="form-foot"><button type="button" class="btn btn-ghost btn-sm" id="pf-reset"><i class="fa-solid fa-key"></i> Change password</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save profile</button></div></form>`;
  $("#pf-photo-in").onchange = async e => {
    try { const p = await squarePhoto(e.target.files[0]); await savePhoto(p); toast("Photo updated"); renderProfile(); }
    catch (err) { toast(err.message, "error"); }
  };
  $("#pf-photo-rm")?.addEventListener("click", async () => { try { await savePhoto(""); toast("Photo removed"); renderProfile(); } catch (err) { toast(err.message, "error"); } });
  $("#pf-reset").onclick = async () => { try { await fb.sendPasswordResetEmail(fb.auth, user.email); toast("Password reset link sent to your email"); } catch (e) { toast(friendly(e), "error"); } };
  $("#prof-form").onsubmit = async e => {
    e.preventDefault();
    const upd = { name: $("#pf-name").value.trim().slice(0, 100) || user.email, email: user.email || "", phone: $("#pf-phone").value.trim().slice(0, 30), company: $("#pf-company").value.trim().slice(0, 120), notify: { email: $("#pf-n-email").checked, whatsapp: $("#pf-n-wa").checked }, updatedAt: fb.serverTimestamp() };
    try { await fb.setDoc(fb.doc(fb.db, "users", user.uid), upd, { merge: true }); profile = { ...profile, ...upd }; if (upd.name !== user.displayName) fb.updateProfile(user, { displayName: upd.name }).catch(() => { }); toast("Profile saved"); shell(); location.hash = "#/profile"; }
    catch (err) { toast("Couldn't save: " + err.message, "error"); }
  };
}

// ======================= ACTIONS =======================
root.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const item = b.closest("[data-id]");
  const col = item.dataset.col, id = item.dataset.id;
  const ref = fb.doc(fb.db, col, id);
  const rec = data[col].find(x => x.id === id);
  try {
    if (b.dataset.act === "cancel") {
      if (!confirm("Cancel this booking?")) return;
      await fb.updateDoc(ref, { status: "cancelled", updatedAt: fb.serverTimestamp() }); rec.status = "cancelled"; toast("Booking cancelled");
    }
    if (b.dataset.act === "reschedule") {
      const body = openModal("Request a new time", `<form id="rs-form"><div class="form-grid"><div class="field"><label for="rs-date">New date</label><input id="rs-date" type="date" min="${new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label for="rs-time">New time</label><input id="rs-time" type="time" min="07:00" max="20:00" required></div><div class="field full"><label for="rs-note">Note</label><input id="rs-note" maxlength="200"></div></div><div class="form-foot"><span></span><button class="btn btn-primary" type="submit">Send request</button></div></form>`, { wide: false, pad: true });
      $("#rs-form", body).onsubmit = async ev => {
        ev.preventDefault();
        const r = { date: $("#rs-date").value, time: $("#rs-time").value, note: $("#rs-note").value.trim().slice(0, 200) };
        if (!r.date || !r.time) return toast("Choose a date and time", "error");
        await fb.updateDoc(ref, { rescheduleRequest: r, updatedAt: fb.serverTimestamp() }); rec.rescheduleRequest = r; closeModal(); toast("Reschedule request sent"); render();
      };
      return;
    }
    if (b.dataset.act === "approve") { await fb.updateDoc(ref, { status: "approved", updatedAt: fb.serverTimestamp() }); rec.status = "approved"; toast("Quote approved — we'll start production"); }
    if (b.dataset.act === "decline") { if (!confirm("Decline this quote?")) return; await fb.updateDoc(ref, { status: "declined", updatedAt: fb.serverTimestamp() }); rec.status = "declined"; toast("Quote declined"); }
    if (b.dataset.act === "cancel-order") { if (!confirm("Cancel this request?")) return; await fb.updateDoc(ref, { status: "cancelled", updatedAt: fb.serverTimestamp() }); rec.status = "cancelled"; toast("Request cancelled"); }
    render();
  } catch (err) { console.error(err); toast("That didn't work: " + (err.code === "permission-denied" ? "this item can no longer be changed." : err.message), "error"); }
});

// ======================= BOOT =======================
(async () => {
  fb = await firebase();
  fb.onAuthStateChanged(fb.auth, async u => {
    unsub.forEach(x => x()); unsub = []; dataUnsub.forEach(x => x()); dataUnsub = [];
    if (!u || u.isAnonymous) { user = null; authScreen(location.hash.includes("signup") ? "signup" : "signin"); return; }
    user = u;
    if (next && /^\/[^/]/.test(next)) { location.href = next; return; }
    root.innerHTML = `<div class="boot-loader"><img src="/assets/img/brand/mark-192.png" alt="" width="56" height="56"></div>`;
    try { const s = await fb.getDoc(fb.doc(fb.db, "users", u.uid)); profile = s.exists() ? s.data() : {}; } catch { profile = {}; }
    if (!profile.name) {
      profile = { name: u.displayName || (u.email || "").split("@")[0], email: u.email || "", phone: "", company: "", createdAt: fb.serverTimestamp() };
      fb.setDoc(fb.doc(fb.db, "users", u.uid), profile, { merge: true }).catch(() => { });
    }
    await loadAll();
    shell();
    listenMessages();
  });
})();
