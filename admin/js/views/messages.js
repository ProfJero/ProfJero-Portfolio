import { $, $$, fb, esc, fmtDate, emptyState, confirmDialog, toast, downloadCsv } from "../core.js";
import { timeAgo, initials, hueFrom } from "/assets/js/utils.js";

let unsub = null;
export function destroy() { unsub?.(); unsub = null; }

export async function render(view, { params }) {
  let all = [], filter = "inbox", q = "", selected = params[0] || null;
  view.innerHTML = `
    <div class="toolbar">
      <div class="pill-tabs" id="m-tabs"></div>
      <label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="m-q" type="search" placeholder="Search name, email, message…"></label>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" id="m-export"><i class="fa-solid fa-file-csv"></i> Export CSV</button>
    </div>
    <div class="inbox" id="inbox"><div class="inbox-list" id="m-list"></div><div class="inbox-detail" id="m-detail"></div></div>`;

  const tabs = [["inbox", "Inbox", m => m.status !== "archived"], ["new", "Unread", m => m.status === "new"], ["replied", "Replied", m => m.status === "replied"], ["archived", "Archived", m => m.status === "archived"], ["all", "All", () => true]];
  const match = m => !q || [m.name, m.email, m.message, m.subject, m.service, m.phone].join(" ").toLowerCase().includes(q);

  function paint() {
    $("#m-tabs").innerHTML = tabs.map(([k, l, fn]) => `<button class="${filter === k ? "active" : ""}" data-tab="${k}">${l}<span>${all.filter(fn).length}</span></button>`).join("");
    const list = all.filter(tabs.find(t => t[0] === filter)[2]).filter(match);
    $("#m-list").innerHTML = list.length ? list.map(m => `
      <div class="msg-item${m.status === "new" ? " unread" : ""}${m.id === selected ? " active" : ""}" data-id="${m.id}" tabindex="0" role="button">
        <span class="avatar avatar-fallback" style="--h:${hueFrom(m.email)};width:40px;height:40px;font-size:.8rem">${esc(initials(m.name))}</span>
        <div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><span class="title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span><span class="when">${timeAgo(m.createdAt)}</span></div>
        <div class="sub" style="font-weight:600;color:var(--text-2)">${esc(m.subject || m.service || "New enquiry")}</div>
        <div class="sub">${esc(m.message)}</div></div>
      </div>`).join("") : emptyState("fa-solid fa-inbox", q ? "No messages match your search." : "Nothing here yet.");
    paintDetail();
  }

  function paintDetail() {
    const m = all.find(x => x.id === selected);
    $("#inbox").classList.toggle("detail-open", !!m);
    if (!m) { $("#m-detail").innerHTML = emptyState("fa-regular fa-envelope-open", "Select a message to read it."); return; }
    const subject = encodeURIComponent(`Re: ${m.subject || m.service || "Your enquiry"} — ProfJero`);
    const body = encodeURIComponent(`Hi ${m.name.split(" ")[0]},\n\nThank you for reaching out.\n\n\n\nBest regards,\nBenjamin Amoako (ProfJero)\n\n---\nOn ${fmtDate(m.createdAt, true)}, you wrote:\n> ${m.message.replace(/\n/g, "\n> ")}`);
    const wa = (m.phone || "").replace(/\D/g, "");
    $("#m-detail").innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-ghost btn-sm" id="m-back" style="display:none"><i class="fa-solid fa-arrow-left"></i></button>
        <span class="status ${esc(m.status)}">${esc(m.status)}</span>
        ${m.source ? `<span class="status">${esc(m.source)}</span>` : ""}
        <span class="spacer" style="flex:1"></span>
        <a class="btn btn-primary btn-sm" href="mailto:${esc(m.email)}?subject=${subject}&body=${body}" data-reply><i class="fa-solid fa-reply"></i> Reply by email</a>
        ${wa ? `<a class="btn btn-ghost btn-sm" href="https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${m.name.split(" ")[0]}, this is Benjamin (ProfJero) — thanks for your message about ${m.service || m.subject || "your project"}.`)}" target="_blank" rel="noopener" data-reply><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}
        <button class="btn btn-ghost btn-sm" data-set="${m.status === "new" ? "read" : "new"}">${m.status === "new" ? '<i class="fa-regular fa-envelope-open"></i> Mark read' : '<i class="fa-regular fa-envelope"></i> Mark unread'}</button>
        <button class="btn btn-ghost btn-sm" data-set="${m.status === "archived" ? "read" : "archived"}"><i class="fa-solid fa-box-archive"></i> ${m.status === "archived" ? "Unarchive" : "Archive"}</button>
        <button class="icon-btn sm danger" data-del title="Delete"><i class="fa-regular fa-trash-can"></i></button>
      </div>
      <h2 style="margin:20px 0 4px;font-size:1.35rem">${esc(m.subject || m.service || "New enquiry")}</h2>
      <p class="muted small" style="margin:0">${fmtDate(m.createdAt, true)} · ${timeAgo(m.createdAt)}</p>
      <div class="msg-meta">
        <div><small>Name</small><span>${esc(m.name)}</span></div>
        <div><small>Email</small><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
        ${m.phone ? `<div><small>Phone</small><a href="tel:${esc(m.phone)}">${esc(m.phone)}</a></div>` : ""}
        ${m.service ? `<div><small>Service</small><span>${esc(m.service)}</span></div>` : ""}
        ${m.budget ? `<div><small>Budget</small><span>${esc(m.budget)}</span></div>` : ""}
        ${m.studio ? `<div><small>Studio</small><span>${esc(m.studio)}</span></div>` : ""}
        ${m.page ? `<div><small>Sent from</small><span class="small">${esc(m.page)}</span></div>` : ""}
      </div>
      <div class="msg-body">${esc(m.message)}</div>
      ${m.extra ? `<div class="msg-meta">${Object.entries(m.extra).map(([k, v]) => `<div><small>${esc(k)}</small><span>${esc(v)}</span></div>`).join("")}</div>` : ""}`;
    if (matchMedia("(max-width:900px)").matches) $("#m-back").style.display = "";
    if (m.status === "new") setStatus(m, "read");
  }

  async function setStatus(m, status) {
    try { await fb.updateDoc(fb.doc(fb.db, "messages", m.id), { status }); } catch (e) { toast(e.message, "error"); }
  }

  view.addEventListener("click", async e => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { filter = tab.dataset.tab; paint(); return; }
    const item = e.target.closest(".msg-item");
    if (item) { selected = item.dataset.id; history.replaceState(null, "", `#/messages/${selected}`); paint(); return; }
    if (e.target.closest("#m-back")) { selected = null; history.replaceState(null, "", "#/messages"); paint(); return; }
    const m = all.find(x => x.id === selected);
    if (!m) return;
    const set = e.target.closest("[data-set]");
    if (set) { await setStatus(m, set.dataset.set); toast(`Marked as ${set.dataset.set}`); return; }
    if (e.target.closest("[data-reply]")) { setStatus(m, "replied"); return; }
    if (e.target.closest("[data-del]") && await confirmDialog(`Delete the message from <b>${esc(m.name)}</b>? This can't be undone.`)) {
      await fb.deleteDoc(fb.doc(fb.db, "messages", m.id)); selected = null; toast("Message deleted");
    }
  });
  view.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest(".msg-item")) e.target.click(); });
  $("#m-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); paint(); });
  $("#m-export").addEventListener("click", () => downloadCsv(`messages-${new Date().toISOString().slice(0, 10)}.csv`, all.map(({ id, ...m }) => ({ id, ...m }))));

  unsub = fb.onSnapshot(fb.query(fb.collection(fb.db, "messages"), fb.orderBy("createdAt", "desc"), fb.limit(500)), snap => {
    all = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    paint();
  }, err => { $("#m-list").innerHTML = `<div class="callout warn" style="margin:14px"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`; });
}
