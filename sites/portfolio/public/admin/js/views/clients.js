// Admin: client-portal accounts with their bookings, quotes, projects and chat.
import { $, fb, esc, fmtDate, emptyState, downloadCsv } from "../core.js";
import { timeAgo, initials, hueFrom } from "/assets/js/utils.js";

export async function render(view, { params }) {
  const [users, bookings, orders, projects] = await Promise.all(["users", "bookings", "orders", "clientProjects"].map(c => fb.getDocs(fb.collection(fb.db, c)).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => [])));
  const mine = (list, u) => list.filter(x => x.uid === u.id || (u.email && String(x.email || "").toLowerCase() === String(u.email).toLowerCase()));
  // Guests who booked without an account are clients too.
  const guestEmails = [...new Set([...bookings, ...orders].filter(x => !x.uid).map(x => String(x.email || "").toLowerCase()))].filter(e => e && !users.some(u => String(u.email || "").toLowerCase() === e));
  const guests = guestEmails.map(email => { const any = [...bookings, ...orders].find(x => String(x.email).toLowerCase() === email); return { id: "", email, name: any?.name || email, phone: any?.phone || "", company: any?.company || "", guest: true }; });
  const people = [...users, ...guests].map(u => ({ ...u, b: mine(bookings, u), o: mine(orders, u), p: mine(projects, u) }))
    .sort((a, b) => (b.b.length + b.o.length + b.p.length) - (a.b.length + a.o.length + a.p.length));
  let q = "";

  if (params[0]) {
    const u = people.find(x => x.id === params[0] || x.email === decodeURIComponent(params[0]));
    if (u) return detail(view, u);
  }
  view.innerHTML = `
    <div class="toolbar"><label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="cl-q" type="search" placeholder="Search clients…"></label>
      <span class="muted small">${users.length} accounts · ${guests.length} guests</span><span class="spacer"></span>
      <a class="btn btn-primary btn-sm" href="#/clientProjects"><i class="fa-solid fa-plus"></i> New client project</a>
      <button class="btn btn-ghost btn-sm" id="cl-csv"><i class="fa-solid fa-file-csv"></i> Export</button></div>
    <div id="cl-table"></div>`;
  const paint = () => {
    const list = people.filter(u => !q || `${u.name} ${u.email} ${u.company} ${u.phone}`.toLowerCase().includes(q));
    $("#cl-table").innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Contact</th><th>Bookings</th><th>Quotes</th><th>Projects</th><th>Joined</th></tr></thead><tbody>
      ${list.map(u => `<tr data-open="${esc(u.id || u.email)}" style="cursor:pointer">
        <td class="t-title"><div style="display:flex;gap:10px;align-items:center"><span class="avatar avatar-fallback" style="--h:${hueFrom(u.email)};width:34px;height:34px;font-size:.75rem">${esc(initials(u.name))}</span><div>${esc(u.name || "")}${u.guest ? ' <span class="status">guest</span>' : ""}<small>${esc(u.company || "")}</small></div></div></td>
        <td class="small">${esc(u.email || "")}<br>${esc(u.phone || "")}</td><td>${u.b.length}</td><td>${u.o.length}</td><td>${u.p.length}</td><td class="small">${u.createdAt ? fmtDate(u.createdAt) : "—"}</td></tr>`).join("")}</tbody></table></div>`
      : emptyState("fa-solid fa-users", "No clients yet. People who book, request quotes or create a portal account appear here.");
  };
  paint();
  $("#cl-q").addEventListener("input", e => { q = e.target.value.toLowerCase(); paint(); });
  $("#cl-csv").addEventListener("click", () => downloadCsv("clients.csv", people.map(({ b, o, p, ...u }) => ({ ...u, bookings: b.length, quotes: o.length, projects: p.length }))));
  view.addEventListener("click", e => { const r = e.target.closest("[data-open]"); if (r) location.hash = `#/clients/${encodeURIComponent(r.dataset.open)}`; });
}

function detail(view, u) {
  const row = (r, col) => `<a class="list-item" href="#/${col}/${esc(r.id)}" style="color:inherit"><div class="grow"><div class="title">${esc(col === "bookings" ? r.service : col === "orders" ? `${r.quantity} × ${r.product}` : r.title)}</div><div class="sub">${esc(r.ref || "")} ${col === "bookings" ? `· ${fmtDate(r.date)} ${esc(r.time)}` : col === "clientProjects" ? `· ${Number(r.progress) || 0}%` : r.quoteAmount ? `· GH₵ ${Number(r.quoteAmount).toLocaleString()}` : ""}</div></div><span class="status ${esc(r.status)}">${esc(r.status || "")}</span></a>`;
  const wa = String(u.phone || "").replace(/\D/g, "").replace(/^0/, "233");
  view.innerHTML = `
    <div class="toolbar"><a class="btn btn-ghost btn-sm" href="#/clients"><i class="fa-solid fa-arrow-left"></i> All clients</a></div>
    <div class="card"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <span class="avatar avatar-fallback" style="--h:${hueFrom(u.email)};width:64px;height:64px;font-size:1.3rem">${esc(initials(u.name))}</span>
      <div style="flex:1;min-width:200px"><h2 style="margin:0">${esc(u.name || u.email)} ${u.guest ? '<span class="status">guest</span>' : ""}</h2><p class="muted" style="margin:0">${esc(u.company || "")} · ${esc(u.email)} · ${esc(u.phone || "")}</p></div>
      <div class="btn-row"><a class="btn btn-ghost btn-sm" href="mailto:${esc(u.email)}"><i class="fa-solid fa-envelope"></i> Email</a>${wa ? `<a class="btn btn-ghost btn-sm" href="https://wa.me/${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}${u.id ? `<a class="btn btn-primary btn-sm" href="#/chat/${esc(u.id)}"><i class="fa-regular fa-comments"></i> Chat</a>` : ""}</div>
    </div></div>
    <div class="grid-2" style="margin-top:18px">
      <div class="card"><div class="card-head"><h3>Bookings (${u.b.length})</h3></div><div class="list">${u.b.map(r => row(r, "bookings")).join("") || '<p class="muted small">None</p>'}</div></div>
      <div class="card"><div class="card-head"><h3>Quotes & orders (${u.o.length})</h3></div><div class="list">${u.o.map(r => row(r, "orders")).join("") || '<p class="muted small">None</p>'}</div></div>
    </div>
    <div class="card" style="margin-top:18px"><div class="card-head"><h3>Projects (${u.p.length})</h3><a class="btn btn-primary btn-sm" href="#/clientProjects">Manage client projects</a></div><div class="list">${u.p.map(r => row(r, "clientProjects")).join("") || `<p class="muted small">No projects yet. Create one under Client projects using <b>${esc(u.email)}</b>.</p>`}</div></div>`;
}
