// Alerts: watches bookings, quotes, invoices, client projects, chats, the inbox and
// client testimonials, and raises an alert when something is due soon, overdue or
// waiting too long. Thresholds are set by the admin (Settings → Alerts) and stored
// in /private/alerts. Shown in the bell, the Alerts page and the dashboard; optional
// desktop notifications and sound while the admin app is open.
import { $, $$, fb, esc, state } from "./core.js";
import { toDate, timeAgo } from "/assets/js/utils.js";

export const DEFAULT_THRESHOLDS = {
  bookingSoonHours: 24, bookingPendingHours: 12,
  quoteResponseHours: 24, quoteFollowUpDays: 3,
  invoiceDueDays: 3, invoiceDraftDays: 2,
  projectDueDays: 7,
  chatReplyMinutes: 30, messageReplyHours: 24, reviewPendingDays: 2
};

export const THRESHOLD_FIELDS = [
  { key: "bookingSoonHours", area: "requests", label: "Remind me before a booking starts", unit: "hours before" },
  { key: "bookingPendingHours", area: "requests", label: "Booking not yet confirmed after", unit: "hours" },
  { key: "quoteResponseHours", area: "requests", label: "Quote request not answered after", unit: "hours" },
  { key: "quoteFollowUpDays", area: "requests", label: "Follow up a sent quote after", unit: "days" },
  { key: "invoiceDueDays", area: "invoices", label: "Invoice due soon", unit: "days before due date" },
  { key: "invoiceDraftDays", area: "invoices", label: "Draft invoice not sent after", unit: "days" },
  { key: "projectDueDays", area: "clients", label: "Client project deadline approaching", unit: "days before" },
  { key: "chatReplyMinutes", area: "chat", label: "Client chat waiting for a reply", unit: "minutes" },
  { key: "messageReplyHours", area: "messages", label: "Contact message not handled after", unit: "hours" },
  { key: "reviewPendingDays", area: "clients", label: "Client testimonial waiting for approval", unit: "days" }
];

const prefs = () => { try { return { desktop: true, sound: true, ...JSON.parse(localStorage.getItem("pj_alert_prefs") || "{}") }; } catch { return { desktop: true, sound: true }; } };
export const getPrefs = prefs;
export function setPrefs(p) { try { localStorage.setItem("pj_alert_prefs", JSON.stringify({ ...prefs(), ...p })); } catch { } }

let thresholds = { ...DEFAULT_THRESHOLDS };
export const getThresholds = () => thresholds;
export async function saveThresholds(t) {
  thresholds = { ...DEFAULT_THRESHOLDS, ...t };
  await fb.setDoc(fb.doc(fb.db, "private", "alerts"), { ...thresholds, updatedAt: fb.serverTimestamp(), updatedBy: state.user.email });
  recompute();
}

// ---- dismiss / snooze (per device) ----
const dismissed = () => { try { return JSON.parse(localStorage.getItem("pj_alert_dismissed") || "{}"); } catch { return {}; } };
export function dismiss(id, ms = 864e5) {
  const d = dismissed(); d[id] = Date.now() + ms;
  Object.keys(d).forEach(k => { if (d[k] < Date.now()) delete d[k]; });
  try { localStorage.setItem("pj_alert_dismissed", JSON.stringify(d)); } catch { }
  recompute();
}

const data = { bookings: [], orders: [], invoices: [], projects: [], threads: [], messages: [], reviews: [] };
let alerts = [], listeners = [], onCount = () => { }, seen = null, timer;
export const getAlerts = () => alerts;
export function onAlerts(cb) { listeners.push(cb); cb(alerts); return () => { listeners = listeners.filter(l => l !== cb); }; }

const H = 36e5, D = 864e5, M = 6e4;
const fmtWhen = d => d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const days = n => `${Math.round(n)} day${Math.round(n) === 1 ? "" : "s"}`;

function compute() {
  const t = thresholds, now = Date.now(), out = [];
  const add = a => out.push(a);
  for (const b of data.bookings) {
    const when = b.date ? new Date(`${b.date}T${/^\d{1,2}:\d{2}/.test(b.time || "") ? b.time.padStart(5, "0") : "09:00"}`) : null;
    const created = toDate(b.createdAt)?.getTime() || now;
    if (b.status === "pending" && now - created > t.bookingPendingHours * H)
      add({ id: `bk-${b.id}-pending`, level: "warning", icon: "fa-regular fa-calendar", area: "requests", title: `Confirm ${b.name}'s booking`, detail: `${b.service} · waiting ${timeAgo(b.createdAt).replace(" ago", "")}`, href: `#/bookings/${b.id}`, at: created });
    if (when && ["pending", "confirmed"].includes(b.status)) {
      const diff = when - now;
      if (diff > 0 && diff < t.bookingSoonHours * H) add({ id: `bk-${b.id}-soon`, level: diff < 2 * H ? "danger" : "info", icon: "fa-solid fa-clock", area: "requests", title: `Booking ${diff < H ? "within the hour" : "coming up"}: ${b.name}`, detail: `${b.service} · ${fmtWhen(when)}`, href: `#/bookings/${b.id}`, at: when.getTime() });
      if (diff < -3 * H && b.status === "confirmed") add({ id: `bk-${b.id}-done`, level: "info", icon: "fa-solid fa-flag-checkered", area: "requests", title: `Mark ${b.name}'s booking as completed?`, detail: `${b.service} was on ${fmtWhen(when)}`, href: `#/bookings/${b.id}`, at: when.getTime() });
    }
  }
  for (const o of data.orders) {
    const created = toDate(o.createdAt)?.getTime() || now, upd = toDate(o.updatedAt)?.getTime() || created;
    if (o.status === "requested" && now - created > t.quoteResponseHours * H)
      add({ id: `or-${o.id}-req`, level: "warning", icon: "fa-solid fa-file-signature", area: "requests", title: `Send a quote to ${o.name}`, detail: `${o.quantity} × ${o.product} · requested ${timeAgo(o.createdAt)}`, href: `#/orders/${o.id}`, at: created });
    if (o.status === "quoted" && now - upd > t.quoteFollowUpDays * D)
      add({ id: `or-${o.id}-follow`, level: "info", icon: "fa-solid fa-reply", area: "requests", title: `Follow up ${o.name}'s quote`, detail: `Sent ${days((now - upd) / D)} ago, no answer yet`, href: `#/orders/${o.id}`, at: upd });
    if (o.deadline && !["delivered", "cancelled", "declined"].includes(o.status)) {
      const dl = new Date(`${o.deadline}T17:00`).getTime();
      if (dl - now < 2 * D) add({ id: `or-${o.id}-deadline`, level: dl < now ? "danger" : "warning", icon: "fa-solid fa-hourglass-half", area: "requests", title: `${dl < now ? "Order deadline passed" : "Order deadline soon"}: ${o.name}`, detail: `${o.product} · needed by ${new Date(dl).toLocaleDateString("en-GB")}`, href: `#/orders/${o.id}`, at: dl });
    }
  }
  for (const i of data.invoices) {
    const balance = (Number(i.total) || 0) - (Number(i.amountPaid) || 0);
    if (i.status === "draft") {
      const created = toDate(i.createdAt)?.getTime() || now;
      if (now - created > t.invoiceDraftDays * D) add({ id: `in-${i.id}-draft`, level: "info", icon: "fa-regular fa-file-lines", area: "invoices", title: `Draft invoice not sent: ${i.clientName || i.email}`, detail: `${i.number || "Draft"} · created ${timeAgo(i.createdAt)}`, href: `#/invoices/${i.id}`, at: created });
      continue;
    }
    if (!["sent", "partial"].includes(i.status) || balance <= 0 || !i.dueDate) continue;
    const due = new Date(`${i.dueDate}T23:59`).getTime();
    if (due < now) add({ id: `in-${i.id}-overdue`, level: "danger", icon: "fa-solid fa-triangle-exclamation", area: "invoices", title: `Invoice overdue: ${i.clientName || i.email}`, detail: `${i.number} · GH₵ ${balance.toLocaleString("en-GH", { minimumFractionDigits: 2 })} unpaid · ${days((now - due) / D)} late`, href: `#/invoices/${i.id}`, at: due });
    else if (due - now < t.invoiceDueDays * D) add({ id: `in-${i.id}-due`, level: "warning", icon: "fa-solid fa-file-invoice-dollar", area: "invoices", title: `Invoice due soon: ${i.clientName || i.email}`, detail: `${i.number} · due ${new Date(due).toLocaleDateString("en-GB")} · GH₵ ${balance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`, href: `#/invoices/${i.id}`, at: due });
  }
  for (const p of data.projects) {
    if (!p.dueDate || ["completed", "cancelled"].includes(p.status)) continue;
    const due = new Date(`${String(p.dueDate).slice(0, 10)}T23:59`).getTime();
    if (due < now) add({ id: `pr-${p.id}-late`, level: "danger", icon: "fa-solid fa-bars-progress", area: "clients", title: `Project past its deadline: ${p.title}`, detail: `${p.clientName || p.email || ""} · ${Number(p.progress) || 0}% done · ${days((now - due) / D)} late`, href: `#/clientProjects/${p.id}`, at: due });
    else if (due - now < t.projectDueDays * D) add({ id: `pr-${p.id}-soon`, level: "warning", icon: "fa-solid fa-bars-progress", area: "clients", title: `Project deadline approaching: ${p.title}`, detail: `Due ${new Date(due).toLocaleDateString("en-GB")} · ${Number(p.progress) || 0}% done`, href: `#/clientProjects/${p.id}`, at: due });
  }
  for (const th of data.threads) {
    const last = toDate(th.lastAt)?.getTime() || now;
    if (th.unreadAdmin > 0 && th.lastFrom === "client" && now - last > t.chatReplyMinutes * M)
      add({ id: `ch-${th.id}-${last}`, level: now - last > 4 * H ? "danger" : "warning", icon: "fa-regular fa-comments", area: "chat", title: `${th.name || th.email} is waiting for a reply`, detail: `“${String(th.lastMessage || "").slice(0, 60)}” · ${timeAgo(th.lastAt)}`, href: `#/chat/${th.id}`, at: last });
  }
  for (const m of data.messages) {
    const at = toDate(m.createdAt)?.getTime() || now;
    if (now - at > t.messageReplyHours * H) add({ id: `ms-${m.id}`, level: "warning", icon: "fa-solid fa-inbox", area: "messages", title: `Unanswered message from ${m.name}`, detail: `${m.subject || m.service || "Enquiry"} · ${timeAgo(m.createdAt)}`, href: `#/messages/${m.id}`, at });
  }
  for (const r of data.reviews) {
    const at = toDate(r.updatedAt || r.createdAt)?.getTime() || now;
    if (now - at > t.reviewPendingDays * D) add({ id: `rv-${r.id}-${at}`, level: "info", icon: "fa-regular fa-star", area: "clients", title: `Approve ${r.name}'s testimonial`, detail: `Waiting ${days((now - at) / D)}`, href: "#/reviews", at });
  }
  const d = dismissed(), rank = { danger: 0, warning: 1, info: 2 };
  return out.filter(a => !(d[a.id] > now)).sort((a, b) => rank[a.level] - rank[b.level] || a.at - b.at);
}

function recompute() {
  alerts = compute();
  onCount(alerts.filter(a => a.level !== "info").length || alerts.length);
  listeners.forEach(l => l(alerts));
  paintBell();
  notifyNew();
}

function notifyNew() {
  const ids = new Set(alerts.map(a => a.id));
  if (seen === null) { seen = ids; return; }               // don't ping for what was already there on load
  const fresh = alerts.filter(a => !seen.has(a.id) && a.level !== "info");
  seen = ids;
  if (!fresh.length) return;
  const p = prefs();
  if (p.sound) beep();
  if (p.desktop && "Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
    const a = fresh[0];
    const n = new Notification(a.title, { body: a.detail + (fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ""), icon: "/assets/img/brand/app-admin-192.png", tag: a.id });
    n.onclick = () => { focus(); location.hash = a.href; n.close(); };
  }
}

let ctx;
function beep() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + .12);
    g.gain.setValueAtTime(.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .35);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .4);
  } catch { }
}

// ---- bell popover ----
const LEVEL = { danger: "Urgent", warning: "Soon", info: "FYI" };
export function alertRow(a, { actions = true } = {}) {
  return `<div class="alert-row lvl-${a.level}" data-alert="${esc(a.id)}">
    <span class="alert-icon"><i class="${a.icon}"></i></span>
    <a class="alert-body" href="${esc(a.href)}"><strong>${esc(a.title)}</strong><small>${esc(a.detail)}</small></a>
    <span class="alert-lvl">${LEVEL[a.level]}</span>
    ${actions ? `<button class="icon-btn sm" type="button" data-snooze="${esc(a.id)}" title="Snooze for a day" aria-label="Snooze for a day"><i class="fa-regular fa-clock"></i></button>` : ""}
  </div>`;
}

function paintBell() {
  const pop = $("#bell-pop");
  if (!pop) return;
  pop.innerHTML = `<div class="bell-head"><strong>Alerts</strong><a href="#/alerts" class="small">See all &amp; settings</a></div>
    <div class="bell-list">${alerts.slice(0, 8).map(a => alertRow(a)).join("") || '<p class="bell-empty"><i class="fa-regular fa-circle-check"></i> All caught up. Nothing needs your attention.</p>'}</div>`;
}

function wireBell() {
  const bell = $("#bell"), pop = $("#bell-pop");
  const close = () => { pop.hidden = true; bell.setAttribute("aria-expanded", "false"); };
  bell.addEventListener("click", e => {
    e.stopPropagation();
    pop.hidden = !pop.hidden; bell.setAttribute("aria-expanded", String(!pop.hidden));
    if (!pop.hidden && prefs().desktop && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => { });
  });
  pop.addEventListener("click", e => {
    const s = e.target.closest("[data-snooze]");
    if (s) { e.stopPropagation(); dismiss(s.dataset.snooze); return; }
    if (e.target.closest("a")) close();
  });
  document.addEventListener("click", e => { if (!pop.hidden && !e.target.closest(".bell-wrap")) close(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) close(); });
}

const unsubs = [];
export async function startAlerts(opts = {}) {
  onCount = opts.onCount || onCount;
  unsubs.splice(0).forEach(f => f());
  wireBell();
  try { const s = await fb.getDoc(fb.doc(fb.db, "private", "alerts")); if (s.exists()) thresholds = { ...DEFAULT_THRESHOLDS, ...s.data() }; } catch { }
  const can = a => state.access.perms.has(a);
  const watch = (key, q) => unsubs.push(fb.onSnapshot(q, snap => { data[key] = snap.docs.map(d => ({ id: d.id, ...d.data() })); recompute(); }, () => { }));
  const col = c => fb.collection(fb.db, c);
  if (can("requests")) {
    watch("bookings", fb.query(col("bookings"), fb.where("status", "in", ["pending", "confirmed"])));
    watch("orders", fb.query(col("orders"), fb.where("status", "in", ["requested", "quoted", "approved", "in-production", "ready"])));
  }
  if (can("invoices")) watch("invoices", fb.query(col("invoices"), fb.where("status", "in", ["draft", "sent", "partial"])));
  if (can("clients")) {
    watch("projects", col("clientProjects"));
    watch("reviews", fb.query(col("reviews"), fb.where("status", "==", "pending")));
  }
  if (can("chat")) watch("threads", fb.query(col("threads"), fb.where("unreadAdmin", ">", 0)));
  if (can("messages")) watch("messages", fb.query(col("messages"), fb.where("status", "==", "new")));
  clearInterval(timer);
  timer = setInterval(recompute, 60000);   // time-based alerts (due soon, waiting too long)
  recompute();
}
