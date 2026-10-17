// Admin: ProfJero Hub bookings and product-branding quotes/orders (live).
import { $, $$, fb, esc, fmtDate, emptyState, confirmDialog, toast, downloadCsv, can } from "../core.js";
import { timeAgo, toDate } from "/assets/js/utils.js";

let unsub = null;
export function destroy() { unsub?.(); unsub = null; }

const CFG = {
  bookings: {
    label: "booking", tabs: [["open", "Open", b => ["pending", "confirmed"].includes(b.status)], ["pending", "Pending", b => b.status === "pending"], ["confirmed", "Confirmed", b => b.status === "confirmed"], ["completed", "Completed", b => b.status === "completed"], ["cancelled", "Cancelled", b => b.status === "cancelled"], ["all", "All", () => true]],
    statuses: ["pending", "confirmed", "completed", "cancelled"],
    title: b => b.service, sub: b => `${b.studioName || b.studio} · ${fmtDate(b.date)} ${b.time} · ${b.mode === "remote" ? "Online" : "In person"}`
  },
  orders: {
    label: "quote", tabs: [["open", "Open", o => !["delivered", "cancelled", "declined"].includes(o.status)], ["requested", "New requests", o => o.status === "requested"], ["quoted", "Awaiting client", o => o.status === "quoted"], ["approved", "Approved", o => o.status === "approved"], ["in-production", "In production", o => o.status === "in-production"], ["done", "Delivered", o => o.status === "delivered"], ["all", "All", () => true]],
    statuses: ["requested", "quoted", "approved", "in-production", "ready", "delivered", "declined", "cancelled"],
    title: o => `${o.quantity} × ${o.product}`, sub: o => `${o.category || "Custom"} · ${o.company || o.name}${o.deadline ? ` · needed by ${fmtDate(o.deadline)}` : ""}`
  }
};

export async function render(view, { name, params }) {
  const cfg = CFG[name];
  let all = [], tab = "open", q = "", selected = params[0] || null;
  view.innerHTML = `
    <div class="toolbar"><div class="pill-tabs" id="r-tabs"></div>
      <label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="r-q" type="search" placeholder="Search name, email, reference…"></label>
      <span class="spacer"></span><button class="btn btn-ghost btn-sm" id="r-csv"><i class="fa-solid fa-file-csv"></i> Export CSV</button></div>
    <div class="inbox" id="inbox"><div class="inbox-list" id="r-list"></div><div class="inbox-detail" id="r-detail"></div></div>`;

  const match = r => !q || [r.ref, r.name, r.email, r.phone, r.company, r.service, r.product, r.studioName].join(" ").toLowerCase().includes(q);
  function paint() {
    $("#r-tabs").innerHTML = cfg.tabs.map(([k, l, fn]) => `<button class="${tab === k ? "active" : ""}" data-tab="${k}">${l}<span>${all.filter(fn).length}</span></button>`).join("");
    const list = all.filter(cfg.tabs.find(t => t[0] === tab)[2]).filter(match);
    $("#r-list").innerHTML = list.length ? list.map(r => `
      <div class="msg-item${r.status === "pending" || r.status === "requested" ? " unread" : ""}${r.id === selected ? " active" : ""}" data-id="${esc(r.id)}" tabindex="0" role="button">
        <div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><span class="title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cfg.title(r))}</span><span class="when">${timeAgo(r.createdAt)}</span></div>
        <div class="sub">${esc(r.name)} · ${esc(r.ref || r.id)}</div><div class="sub">${esc(cfg.sub(r))}</div>
        <span class="status ${esc(r.status)}" style="margin-top:6px">${esc(r.status)}</span>${r.rescheduleRequest ? ' <span class="status new">reschedule request</span>' : ""}</div>
      </div>`).join("") : emptyState("fa-regular fa-calendar", q ? "Nothing matches your search." : `No ${cfg.label}s here.`);
    paintDetail();
  }

  function paintDetail() {
    const r = all.find(x => x.id === selected);
    $("#inbox").classList.toggle("detail-open", !!r);
    if (!r) { $("#r-detail").innerHTML = emptyState("fa-regular fa-hand-pointer", `Select a ${cfg.label} to see details.`); return; }
    const wa = String(r.phone || "").replace(/\D/g, "").replace(/^0/, "233");
    const first = (r.name || "").split(" ")[0];
    const waText = name === "bookings"
      ? `Hi ${first}, this is ProfJero Hub. Your booking ${r.ref} for ${r.service} on ${r.date} at ${r.time} is ${r.status}.`
      : `Hi ${first}, this is ProfJero Hub about your quote ${r.ref} (${r.quantity} × ${r.product})${r.quoteAmount ? `: GH₵ ${Number(r.quoteAmount).toLocaleString()}. You can approve it in your client portal: https://profjerohub.pages.dev/portal/` : "."}`;
    $("#r-detail").innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-ghost btn-sm" id="r-back" style="display:none"><i class="fa-solid fa-arrow-left"></i></button>
        <span class="status ${esc(r.status)}">${esc(r.status)}</span><code class="k">${esc(r.ref || r.id)}</code><span class="spacer" style="flex:1"></span>
        <a class="btn btn-primary btn-sm" href="mailto:${esc(r.email)}?subject=${encodeURIComponent(`ProfJero Hub — ${r.ref}`)}"><i class="fa-solid fa-envelope"></i> Email</a>
        ${wa ? `<a class="btn btn-ghost btn-sm" href="https://wa.me/${wa}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}
        ${can("invoices") ? `<button class="btn btn-ghost btn-sm" type="button" data-invoice><i class="fa-solid fa-file-invoice-dollar"></i> ${name === "orders" ? "Create invoice" : "Invoice this"}</button>` : ""}
        <button class="icon-btn sm danger" data-del title="Delete"><i class="fa-regular fa-trash-can"></i></button>
      </div>
      <h2 style="margin:18px 0 4px;font-size:1.35rem">${esc(cfg.title(r))}</h2>
      <p class="muted small" style="margin:0">${esc(cfg.sub(r))} · received ${fmtDate(r.createdAt, true)}</p>
      ${r.rescheduleRequest ? `<div class="callout" style="margin-top:14px"><i class="fa-solid fa-clock-rotate-left"></i><div>Client asked to move to <b>${fmtDate(r.rescheduleRequest.date)} at ${esc(r.rescheduleRequest.time)}</b>${r.rescheduleRequest.note ? ` — “${esc(r.rescheduleRequest.note)}”` : ""}. <button class="btn btn-primary btn-sm" data-resched="accept">Accept</button> <button class="btn btn-ghost btn-sm" data-resched="reject">Dismiss</button></div></div>` : ""}
      <div class="msg-meta">
        <div><small>Name</small><span>${esc(r.name)}</span></div>
        <div><small>Email</small><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></div>
        ${r.phone ? `<div><small>Phone</small><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></div>` : ""}
        ${r.company ? `<div><small>Company</small><span>${esc(r.company)}</span></div>` : ""}
        ${name === "orders" ? `<div><small>Method</small><span>${esc(r.method || "Recommend")}</span></div><div><small>Colours</small><span>${esc(r.colors || "—")}</span></div>${r.artworkUrl ? `<div><small>Artwork</small><a href="${esc(r.artworkUrl)}" target="_blank" rel="noopener">Open link</a></div>` : ""}` : ""}
        <div><small>Account</small><span>${r.uid ? "Signed-in client" : "Guest"}</span></div>
        <div><small>Source</small><span>${esc(r.source || "")}</span></div>
      </div>
      ${r.notes ? `<div class="msg-body" style="margin-bottom:18px">${esc(r.notes)}</div>` : ""}
      ${r.clientNote ? `<p class="muted small">Client note: ${esc(r.clientNote)}</p>` : ""}
      <form class="card" id="r-form" style="margin-top:8px" novalidate>
        <div class="fields">
          <div class="f"><label for="r-status">Status</label><select id="r-status">${cfg.statuses.map(s => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></div>
          ${name === "bookings" ? `<div class="f"><label for="r-date">Date</label><input id="r-date" type="date" value="${esc(r.date || "")}"></div><div class="f"><label for="r-time">Time</label><input id="r-time" type="time" step="900" value="${esc(r.time || "")}"></div>`
            : `<div class="f"><label for="r-deadline">Needed by</label><input id="r-deadline" type="date" value="${esc(r.deadline || "")}"></div>`}
          ${name === "orders" ? `<div class="f"><label for="r-amount">Quote amount (GH₵)</label><input id="r-amount" type="number" min="0" step="0.01" value="${esc(r.quoteAmount ?? "")}"></div>
            <div class="f full"><label for="r-qnote">Quote details for the client</label><textarea id="r-qnote" rows="3" placeholder="What's included, delivery, payment terms…">${esc(r.quoteNote || "")}</textarea></div>` : ""}
          <div class="f full"><label for="r-note">Note to client (shown on tracking & portal)</label><textarea id="r-note" rows="2">${esc(r.adminNote || "")}</textarea></div>
          <div class="f full"><label for="r-internal">Internal notes (only admins see this)</label><textarea id="r-internal" rows="2">${esc(r.internalNote || "")}</textarea></div>
        </div>
        <div class="form-foot" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          ${name === "orders" ? `<button class="btn btn-ghost btn-sm" type="button" id="r-send-quote"><i class="fa-solid fa-paper-plane"></i> Save & mark as quoted</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-quick="confirmed"><i class="fa-solid fa-check"></i> Confirm</button>`}
          <button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button>
        </div>
      </form>`;
    if (matchMedia("(max-width:900px)").matches) $("#r-back").style.display = "";
  }

  async function save(extra = {}) {
    const r = all.find(x => x.id === selected);
    const upd = { status: $("#r-status").value, adminNote: $("#r-note").value.trim(), internalNote: $("#r-internal").value.trim(), updatedAt: fb.serverTimestamp(), ...extra };
    if (name === "bookings") {
      const d = $("#r-date").value, t = $("#r-time").value;
      if (d && t && (d !== r.date || t !== r.time)) { upd.date = d; upd.time = t; if (!upd.adminNote || upd.adminNote === r.adminNote) upd.adminNote = `Moved to ${d} at ${t}.`; }
    } else upd.deadline = $("#r-deadline").value || null;
    if (name === "orders") { const a = $("#r-amount").value; upd.quoteAmount = a === "" ? null : Number(a); upd.quoteNote = $("#r-qnote").value.trim(); }
    try { await fb.updateDoc(fb.doc(fb.db, name, r.id), upd); toast("Saved — the client sees the update"); } catch (e) { toast(e.message, "error"); }
  }

  view.addEventListener("click", async e => {
    const t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; paint(); return; }
    const it = e.target.closest(".msg-item"); if (it) { selected = it.dataset.id; history.replaceState(null, "", `#/${name}/${selected}`); paint(); return; }
    if (e.target.closest("#r-back")) { selected = null; paint(); return; }
    const r = all.find(x => x.id === selected); if (!r) return;
    const quick = e.target.closest("[data-quick]"); if (quick) { $("#r-status").value = quick.dataset.quick; return save(); }
    if (e.target.closest("[data-invoice]")) {
      // Hand the client and the item over to the invoice builder.
      const qty = Number(r.quantity) || 1, total = Number(r.quoteAmount) || 0;
      sessionStorage.setItem("pj_invoice_prefill", JSON.stringify({
        uid: r.uid || null, clientName: r.name, email: r.email, clientPhone: r.phone || "", clientCompany: r.company || "", reference: r.ref || "",
        subject: name === "orders" ? r.product : r.service,
        items: name === "orders" ? [{ description: r.product, details: [r.method, r.colors && `${r.colors} colours`].filter(Boolean).join(" · "), qty, unit: "pcs", rate: total ? Math.round((total / qty) * 100) / 100 : 0 }]
          : [{ description: r.service, details: `${r.studioName || r.studio || ""} · ${r.date || ""} ${r.time || ""}`.trim(), qty: 1, rate: 0 }]
      }));
      location.hash = "#/invoices/new";
      return;
    }
    if (e.target.closest("#r-send-quote")) {
      if (!$("#r-amount").value) return toast("Enter the quote amount first", "error");
      $("#r-status").value = "quoted"; return save();
    }
    const rs = e.target.closest("[data-resched]");
    if (rs) {
      const upd = rs.dataset.resched === "accept" ? { date: r.rescheduleRequest.date, time: r.rescheduleRequest.time, status: "confirmed", rescheduleRequest: null, adminNote: `Moved to ${r.rescheduleRequest.date} at ${r.rescheduleRequest.time}.` } : { rescheduleRequest: null };
      await fb.updateDoc(fb.doc(fb.db, name, r.id), upd); toast(rs.dataset.resched === "accept" ? "Rescheduled" : "Request dismissed"); return;
    }
    if (e.target.closest("[data-del]") && await confirmDialog(`Delete ${cfg.label} <b>${esc(r.ref || r.id)}</b>?`)) { await fb.deleteDoc(fb.doc(fb.db, name, r.id)); selected = null; toast("Deleted"); }
  });
  view.addEventListener("submit", e => { if (e.target.id === "r-form") { e.preventDefault(); save(); } });
  $("#r-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); paint(); });
  $("#r-csv").addEventListener("click", () => downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, all));

  unsub = fb.onSnapshot(fb.query(fb.collection(fb.db, name), fb.orderBy("createdAt", "desc"), fb.limit(500)), snap => {
    all = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    if (!view.isConnected) return;
    if ($("#r-form") && document.activeElement?.closest("#r-form")) return; // don't wipe a form being edited
    paint();
  }, err => { $("#r-list").innerHTML = `<div class="callout warn" style="margin:14px"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`; });
}
