// ProfJero Hub — booking wizard (writes to the shared "bookings" collection) and tracking.
import { $, $$, esc, toast, bootCommon, makeRef, currentClient, refSuccess } from "./hub-common.js";
import { loadCollection, DEFAULTS, firebase } from "./store.js";
import { isEmail, formatDate, timeAgo, toDate } from "./utils.js";
import { SITE } from "./config.js";
import { STATUS, timeline } from "./status.js";

bootCommon();
const params = new URLSearchParams(location.search);
let studios = DEFAULTS.studios;
const sel = { studio: params.get("studio") || "", service: params.get("service") || params.get("package") || "", mode: "remote", date: "", time: "" };
let step = 1;
let me = null;

// ---------------- Wizard ----------------
const studioOf = () => studios.find(s => s.id === sel.studio);
const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

function renderServices() {
  const s = studioOf();
  if (!s) return;
  const opts = [
    ...(s.services || []).map(x => ({ title: x.title, text: x.text, meta: [x.duration, x.mode].filter(Boolean).join(" · "), icon: x.icon || s.icon })),
    ...(s.packages || []).map(p => ({ title: p.name, text: p.tagline || "", meta: `${p.prefix ? p.prefix + " " : ""}${p.price}${p.period && p.period !== "one-off" ? " " + p.period : ""}`, icon: "fa-solid fa-box-open" })),
    { title: "Free consultation", text: "Not sure yet? Talk to us and we'll recommend the right service.", meta: "30 minutes · free", icon: "fa-regular fa-comments" }
  ];
  $("#wz-services").innerHTML = opts.map(o => `
    <button type="button" class="wz-service${sel.service === o.title ? " selected" : ""}" data-service="${esc(o.title)}" style="--c:${esc(s.color)}">
      <i class="${esc(o.icon)}"></i><div><strong>${esc(o.title)}</strong><span>${esc(o.text)}</span>${o.meta ? `<em>${esc(o.meta)}</em>` : ""}</div><i class="fa-solid fa-circle-check wz-check"></i>
    </button>`).join("");
}

function renderTimes() {
  const d = sel.date ? new Date(sel.date + "T00:00:00") : null;
  const today = new Date().toISOString().slice(0, 10);
  const nowH = new Date().getHours();
  $("#wz-times").innerHTML = TIMES.map(t => {
    const past = sel.date === today && parseInt(t) <= nowH + 1;
    return `<button type="button" class="wz-time${sel.time === t ? " selected" : ""}" data-time="${t}"${!d || past ? " disabled" : ""}>${t}</button>`;
  }).join("");
}

function canContinue(at = step) {
  const step = at;
  if (step === 1) return !!sel.studio;
  if (step === 2) return !!sel.service;
  if (step === 3) return !!sel.date && !!sel.time;
  if (step === 4) return $("#b-name").value.trim().length >= 2 && isEmail($("#b-email").value) && $("#b-phone").value.replace(/\D/g, "").length >= 9;
  return true;
}

// The furthest step the visitor can jump to: every step before it is filled in.
const reachable = () => { let k = 1; while (k < 5 && canContinue(k)) k++; return k; };
function paintSteps(n = step) {
  const far = n === 6 ? 0 : reachable();
  $$(".wz-steps li").forEach(li => {
    const k = +li.dataset.stepLabel, open = k !== n && k <= far;
    li.classList.toggle("active", k === n); li.classList.toggle("done", n === 6 || (k < n && canContinue(k)) || (k > n && k < far));
    li.classList.toggle("can-go", open); li.tabIndex = open ? 0 : -1;
    if (open) { li.setAttribute("role", "button"); li.title = `Go to step ${k}`; } else { li.removeAttribute("role"); li.removeAttribute("title"); }
    if (k === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
}
function go(n) {
  step = n;
  $$(".wz-panel").forEach(p => p.classList.toggle("active", +p.dataset.step === n));
  paintSteps(n);
  $("#wz-back").hidden = n === 1 || n === 6;
  $("#wz-next").hidden = n === 1 || n === 2 || n === 6;
  $("#wz-next").innerHTML = n === 5 ? '<i class="fa-solid fa-check"></i> Confirm booking' : 'Continue <i class="fa-solid fa-arrow-right"></i>';
  if (n === 2) renderServices();
  if (n === 3) {
    const s = studioOf();
    const inPerson = /in-person/i.test(s?.mode || "");
    if (inPerson && sel.mode === "remote" && !sel._modeTouched) { sel.mode = "in-person"; $$('#wz-modes input').forEach(i => i.checked = i.value === "in-person"); }
    renderTimes();
  }
  if (n === 5) review();
  $("#wizard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function review() {
  const s = studioOf();
  $("#wz-review").innerHTML = `
    <dl class="review-list">
      <div><dt>Studio</dt><dd><i class="${esc(s.icon)}" style="color:${esc(s.color)}"></i> ${esc(s.name)}</dd></div>
      <div><dt>Service</dt><dd>${esc(sel.service)}</dd></div>
      <div><dt>When</dt><dd>${formatDate(sel.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at ${esc(sel.time)}</dd></div>
      <div><dt>How</dt><dd>${sel.mode === "remote" ? "Online / phone" : "In person"}</dd></div>
      <div><dt>Name</dt><dd>${esc($("#b-name").value)}</dd></div>
      <div><dt>Contact</dt><dd>${esc($("#b-email").value)} · ${esc($("#b-phone").value)}</dd></div>
      ${$("#b-notes").value.trim() ? `<div class="full"><dt>Notes</dt><dd>${esc($("#b-notes").value.trim())}</dd></div>` : ""}
    </dl>
    <p class="hint-line"><i class="fa-solid fa-shield-halved"></i> We'll confirm by email or WhatsApp. Your details are private.</p>`;
}

async function submit() {
  const btn = $("#wz-next");
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking…';
  const s = studioOf();
  const ref = makeRef("B");
  const data = {
    ref, studio: s.id, studioName: s.name, service: sel.service.slice(0, 120), mode: sel.mode, date: sel.date, time: sel.time,
    name: $("#b-name").value.trim().slice(0, 100), email: $("#b-email").value.trim().toLowerCase().slice(0, 150),
    phone: $("#b-phone").value.trim().slice(0, 30), company: $("#b-company").value.trim().slice(0, 120), notes: $("#b-notes").value.trim().slice(0, 3000),
    uid: me?.uid || null, status: "pending", source: SITE.id
  };
  try {
    const { db, doc, setDoc, serverTimestamp } = await firebase();
    await setDoc(doc(db, "bookings", ref), { ...data, createdAt: serverTimestamp() });
    const start = new Date(`${sel.date}T${sel.time}:00Z`); // Ghana is GMT+0
    const end = new Date(start.getTime() + 60 * 60000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`ProfJero ${s.name}: ${sel.service}`)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(`Booking ${ref} — track at ${SITE.url}/booking/?track=${ref}`)}`;
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ProfJero Hub//Booking//EN\r\nBEGIN:VEVENT\r\nUID:${ref}@profjerohub.pages.dev\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:ProfJero ${s.name}: ${sel.service}\r\nDESCRIPTION:Booking ${ref}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    $("#wz-done").innerHTML = refSuccess(ref, "Booking received!", `We'll confirm your ${esc(sel.service)} booking for ${formatDate(sel.date)} at ${esc(sel.time)} by email or WhatsApp.`, `Hi ProfJero Hub, I just booked ${sel.service} (${ref}) for ${sel.date} at ${sel.time}.`)
      + `<div class="btn-row" style="justify-content:center;margin-top:10px"><a class="btn btn-ghost btn-sm" href="${gcal}" target="_blank" rel="noopener"><i class="fa-brands fa-google"></i> Add to Google Calendar</a><a class="btn btn-ghost btn-sm" download="profjero-${ref}.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}"><i class="fa-regular fa-calendar-plus"></i> Download .ics</a></div>`;
    go(6);
  } catch (e) {
    console.error(e);
    toast("Couldn't save your booking. Please try again or WhatsApp us.", "error", 6000);
    btn.disabled = false; go(5);
  } finally { btn.disabled = false; }
}

$("#wizard").addEventListener("click", e => {
  const st = e.target.closest("[data-studio]");
  if (st) { if (sel.studio !== st.dataset.studio) sel.service = ""; sel.studio = st.dataset.studio; $$(".wz-studio").forEach(b => b.classList.toggle("selected", b === st)); go(2); return; }
  const sv = e.target.closest("[data-service]");
  if (sv) { sel.service = sv.dataset.service; go(3); return; }
  const tm = e.target.closest("[data-time]");
  if (tm && !tm.disabled) { sel.time = tm.dataset.time; renderTimes(); return; }
});
$("#wz-modes").addEventListener("change", e => { sel.mode = e.target.value; sel._modeTouched = true; });
const dateInput = $("#wz-date");
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
dateInput.min = new Date().toISOString().slice(0, 10);
const maxD = new Date(); maxD.setMonth(maxD.getMonth() + 4); dateInput.max = maxD.toISOString().slice(0, 10);
dateInput.addEventListener("change", () => {
  const d = new Date(dateInput.value + "T00:00:00");
  if (d.getDay() === 0) { toast("We're closed on Sundays — please pick another day.", "info"); dateInput.value = ""; sel.date = ""; }
  else sel.date = dateInput.value;
  sel.time = ""; renderTimes();
});
const stepJump = e => {
  const li = e.target.closest(".wz-steps li.can-go"); if (!li) return;
  if (e.type === "keydown" && !["Enter", " "].includes(e.key)) return;
  e.preventDefault(); go(+li.dataset.stepLabel);
  $(".wz-panel.active h2")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
};
$(".wz-steps").addEventListener("click", stepJump);
["input", "change", "click"].forEach(ev => $(".wz-body").addEventListener(ev, () => queueMicrotask(() => paintSteps())));
$(".wz-steps").addEventListener("keydown", stepJump);
$("#wz-back").addEventListener("click", () => go(Math.max(1, step - 1)));
$("#wz-next").addEventListener("click", () => {
  if (!canContinue()) {
    const msg = { 3: "Please choose a date and time.", 4: "Please add your name, a valid email and a phone number." }[step] || "Please make a selection.";
    return toast(msg, "error");
  }
  step === 5 ? submit() : go(step + 1);
});

// ---------------- Tracking ----------------
async function track(ref) {
  ref = ref.trim().toUpperCase();
  const out = $("#track-result");
  if (!/^PJ[BO][A-Z0-9]{6,}$/.test(ref)) { out.innerHTML = `<p class="empty">That doesn't look like a ProfJero reference (it starts with PJB or PJO).</p>`; return; }
  out.innerHTML = `<div class="skeleton" style="height:140px;border-radius:18px"></div>`;
  const col = ref[2] === "B" ? "bookings" : "orders";
  try {
    const { db, doc, getDoc } = await firebase();
    const snap = await getDoc(doc(db, col, ref));
    if (!snap.exists()) throw new Error("missing");
    const d = snap.data();
    out.innerHTML = `
      <article class="track-card">
        <header><div><small>${col === "bookings" ? "Booking" : "Quote / order"} · ${esc(ref)}</small><h3>${esc(col === "bookings" ? d.service : `${d.quantity} × ${d.product}`)}</h3><p>${esc(col === "bookings" ? `${d.studioName || ""} · ${formatDate(d.date)} at ${d.time} · ${d.mode === "remote" ? "Online" : "In person"}` : (d.method || "Branding method to be advised"))}</p></div>
          <span class="status ${esc(d.status)}">${esc(STATUS[d.status]?.[0] || d.status)}</span></header>
        ${timeline(col, d.status)}
        <p class="hint-line"><i class="${STATUS[d.status]?.[1] || "fa-solid fa-circle-info"}"></i> ${esc(STATUS[d.status]?.[2] || "")}${d.quoteAmount && col === "orders" ? ` Quote: <b>GH₵ ${Number(d.quoteAmount).toLocaleString()}</b>.` : ""}${d.adminNote ? ` <br><b>Note from us:</b> ${esc(d.adminNote)}` : ""}</p>
        <small class="muted">Submitted ${timeAgo(toDate(d.createdAt))}</small>
        <div class="btn-row" style="margin-top:14px"><a class="btn btn-primary btn-sm" href="/portal/"><i class="fa-regular fa-circle-user"></i> Manage in client portal</a><a class="btn btn-ghost btn-sm" href="https://wa.me/233531207256?text=${encodeURIComponent(`Hello, I'm following up on ${ref}.`)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Ask about it</a></div>
      </article>`;
    history.replaceState(null, "", `?track=${ref}#track`);
  } catch {
    out.innerHTML = `<p class="empty">We couldn't find <b>${esc(ref)}</b>. Check the reference, or contact us on WhatsApp.</p>`;
  }
}
$("#track-form").addEventListener("submit", e => { e.preventDefault(); track($("#track-ref").value); });

// ---------------- Boot ----------------
(async () => {
  studios = (await loadCollection("studios")).map(s => ({ ...(DEFAULTS.studios.find(d => d.id === s.id) || {}), ...s })).filter(s => s.active !== false);
  me = await currentClient();
  if (me) {
    $("#b-name").value = me.name; $("#b-email").value = me.email || ""; $("#b-phone").value = me.phone; $("#b-company").value = me.company;
    $("#wz-signed").innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Signed in as <b>${esc(me.email)}</b> — this booking will appear in your client portal.`;
  }
  const t = params.get("track");
  if (t) { $("#track-ref").value = t; track(t); }
  if (sel.studio && studioOf()) {
    $$(".wz-studio").forEach(b => b.classList.toggle("selected", b.dataset.studio === sel.studio));
    go(sel.service ? 3 : 2);
    if (t) $("#track").scrollIntoView();
  }
})();
