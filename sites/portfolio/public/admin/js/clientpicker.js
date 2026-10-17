// Client picker: search ProfJero Hub clients (portal accounts) and people you've
// already worked with (bookings, quotes, projects, invoices), or type a brand-new
// client. Records are matched to a portal account by email, so a client who signs
// up later with that email sees everything that was created for them.
import { $, $$, fb, esc } from "./core.js";
import { initials, hueFrom, isEmail } from "/assets/js/utils.js";

let cache = null, loading = null;
export async function loadClients(force = false) {
  if (cache && !force) return cache;
  if (loading && !force) return loading;
  loading = (async () => {
    const get = c => fb.getDocs(fb.collection(fb.db, c)).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []);
    const [users, projects, invoices, bookings, orders] = await Promise.all(["users", "clientProjects", "invoices", "bookings", "orders"].map(get));
    const map = new Map();
    const put = (email, info) => {
      email = String(email || "").trim().toLowerCase();
      if (!isEmail(email)) return;
      const cur = map.get(email) || { email, name: "", phone: "", company: "", uid: "", registered: false, count: 0 };
      for (const k of ["name", "phone", "company", "address", "tin"]) if (!cur[k] && info[k]) cur[k] = info[k];
      if (info.uid && !cur.uid) cur.uid = info.uid;
      if (info.registered) cur.registered = true;
      cur.count += info.count || 0;
      map.set(email, cur);
    };
    users.forEach(u => put(u.email, { name: u.name, phone: u.phone, company: u.company, uid: u.id, registered: true }));
    projects.forEach(p => put(p.email, { name: p.clientName, phone: p.clientPhone, company: p.clientCompany, uid: p.uid, count: 1 }));
    invoices.forEach(i => put(i.email, { name: i.clientName, phone: i.clientPhone, company: i.clientCompany, address: i.clientAddress, tin: i.clientTin, uid: i.uid, count: 1 }));
    [...bookings, ...orders].forEach(b => put(b.email, { name: b.name, phone: b.phone, company: b.company, uid: b.uid, count: 1 }));
    cache = [...map.values()].sort((a, b) => Number(b.registered) - Number(a.registered) || b.count - a.count || a.name.localeCompare(b.name));
    loading = null;
    return cache;
  })();
  return loading;
}

const FIELDS = [["name", "Client name", "text", "e.g. Kofi Mensah"], ["email", "Email", "email", "client@email.com"], ["phone", "Phone / WhatsApp", "tel", "024 000 0000"], ["company", "Company / organisation", "text", "Optional"]];

/** HTML for the picker. `value` = { uid, name, email, phone, company, ... }. `extra` adds fields such as address/TIN. */
export function clientPickerHtml(value = {}, { extra = [] } = {}) {
  const fields = [...FIELDS, ...extra];
  return `<div class="client-picker" data-client-picker data-uid="${esc(value.uid || "")}">
    <div class="cp-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" class="cp-q" placeholder="Search clients by name, email, phone or company…" autocomplete="off" aria-label="Search clients"><button type="button" class="btn btn-ghost btn-sm cp-new"><i class="fa-solid fa-user-plus"></i> New client</button></div>
    <div class="cp-results" role="listbox" hidden></div>
    <div class="cp-fields fields">${fields.map(([k, l, t, ph]) => `<div class="f"><label>${l}${k === "email" ? ' <span class="req">*</span>' : ""}</label><input data-cp="${k}" type="${t}" value="${esc(value[k] || "")}" placeholder="${esc(ph)}"></div>`).join("")}</div>
    <p class="cp-status small" aria-live="polite"></p>
  </div>`;
}

export function readClientPicker(root) {
  const el = root.matches?.("[data-client-picker]") ? root : $("[data-client-picker]", root);
  if (!el) return null;
  const v = Object.fromEntries($$("[data-cp]", el).map(i => [i.dataset.cp, i.value.trim()]));
  v.email = (v.email || "").toLowerCase();
  v.uid = el.dataset.uid || "";
  return v;
}

/** Wires every picker inside `root` (call once per form). */
export function bindClientPickers(root) {
  $$("[data-client-picker]", root).forEach(async el => {
    const q = $(".cp-q", el), box = $(".cp-results", el), status = $(".cp-status", el);
    let list = [], active = -1;
    const setStatus = () => {
      const email = $('[data-cp="email"]', el).value.trim().toLowerCase();
      const match = list.find(c => c.email === email);
      el.dataset.uid = match?.uid || (match ? el.dataset.uid : "") || "";
      status.innerHTML = !email ? '<i class="fa-solid fa-circle-info"></i> Pick a client above or type their details. Email is required.'
        : !isEmail(email) ? '<span class="bad"><i class="fa-solid fa-triangle-exclamation"></i> That email doesn\'t look right.</span>'
        : match?.registered ? `<span class="ok"><i class="fa-solid fa-circle-check"></i> Has a client-portal account. They'll see this immediately.</span>`
        : `<span class="warn"><i class="fa-solid fa-user-clock"></i> Not registered yet. They'll see this as soon as they sign up at the client portal with <b>${esc(email)}</b>.</span>`;
    };
    const fill = c => {
      for (const k of ["name", "email", "phone", "company", "address", "tin"]) { const i = $(`[data-cp="${k}"]`, el); if (i && c[k]) i.value = c[k]; }
      el.dataset.uid = c.uid || "";
      box.hidden = true; q.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      setStatus();
    };
    const paint = () => {
      const t = q.value.trim().toLowerCase();
      const hits = (t ? list.filter(c => `${c.name} ${c.email} ${c.phone} ${c.company}`.toLowerCase().includes(t)) : list).slice(0, 8);
      active = hits.length ? 0 : -1;
      box.innerHTML = hits.map((c, i) => `<button type="button" class="cp-hit${i === active ? " active" : ""}" data-email="${esc(c.email)}" role="option">
          <span class="avatar avatar-fallback" style="--h:${hueFrom(c.email)}">${esc(initials(c.name || c.email))}</span>
          <span class="grow"><strong>${esc(c.name || c.email)}</strong><small>${esc([c.email, c.phone, c.company].filter(Boolean).join(" · "))}</small></span>
          <span class="cp-badge ${c.registered ? "reg" : ""}">${c.registered ? "Portal account" : "Not registered"}</span></button>`).join("")
        || `<p class="cp-none">No client matches “${esc(q.value)}”. <button type="button" class="linklike cp-new">Add as a new client</button></p>`;
      box.hidden = false;
    };
    q.addEventListener("focus", async () => { list = await loadClients(); paint(); });
    q.addEventListener("input", paint);
    q.addEventListener("keydown", e => {
      const hits = $$(".cp-hit", box);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % Math.max(1, hits.length); hits.forEach((h, i) => h.classList.toggle("active", i === active)); hits[active]?.scrollIntoView({ block: "nearest" }); }
      if (e.key === "Enter") { e.preventDefault(); const h = hits[active]; if (h) fill(list.find(c => c.email === h.dataset.email)); }
      if (e.key === "Escape") { e.stopPropagation(); box.hidden = true; }
    });
    el.addEventListener("click", e => {
      const h = e.target.closest(".cp-hit"); if (h) return fill(list.find(c => c.email === h.dataset.email));
      if (e.target.closest(".cp-new")) {
        const typed = q.value.trim();
        $$("[data-cp]", el).forEach(i => { i.value = ""; });
        if (typed) $(isEmail(typed) ? '[data-cp="email"]' : '[data-cp="name"]', el).value = typed;
        el.dataset.uid = ""; box.hidden = true; q.value = "";
        $(typed && !isEmail(typed) ? '[data-cp="email"]' : '[data-cp="name"]', el).focus();
        setStatus();
      }
    });
    document.addEventListener("click", e => { if (!el.contains(e.target)) box.hidden = true; });
    $('[data-cp="email"]', el).addEventListener("input", setStatus);
    list = await loadClients();
    setStatus();
  });
}
