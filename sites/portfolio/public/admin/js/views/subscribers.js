import { $, fb, esc, emptyState, confirmDialog, toast, downloadCsv, fmtDate } from "../core.js";

export async function render(view) {
  const snap = await fb.getDocs(fb.collection(fb.db, "subscribers"));
  let subs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  let q = "";
  view.innerHTML = `
    <div class="toolbar">
      <label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="s-q" type="search" placeholder="Search emails…"></label>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" id="s-copy"><i class="fa-regular fa-copy"></i> Copy all emails</button>
      <button class="btn btn-ghost btn-sm" id="s-csv"><i class="fa-solid fa-file-csv"></i> Export CSV</button>
    </div>
    <div id="s-table"></div>`;
  const paint = () => {
    const list = subs.filter(s => !q || s.email.includes(q));
    $("#s-table").innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Source</th><th>Page</th><th>Subscribed</th><th></th></tr></thead><tbody>
      ${list.map(s => `<tr data-id="${esc(s.id)}"><td class="t-title"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td><td><span class="status">${esc(s.source || "")}</span></td><td class="small muted">${esc(s.page || "")}</td><td class="small">${fmtDate(s.createdAt, true)}</td>
      <td><div class="row-actions"><button class="icon-btn sm danger" data-del title="Remove"><i class="fa-regular fa-trash-can"></i></button></div></td></tr>`).join("")}</tbody></table></div>`
      : emptyState("fa-solid fa-envelope-open-text", "No subscribers yet. The newsletter forms in your footer and blog collect them here.");
  };
  paint();
  $("#s-q").addEventListener("input", e => { q = e.target.value.toLowerCase(); paint(); });
  $("#s-copy").addEventListener("click", async () => { await navigator.clipboard.writeText(subs.map(s => s.email).join(", ")); toast(`${subs.length} emails copied`); });
  $("#s-csv").addEventListener("click", () => downloadCsv(`subscribers-${new Date().toISOString().slice(0, 10)}.csv`, subs));
  view.addEventListener("click", async e => {
    const row = e.target.closest("[data-id]");
    if (row && e.target.closest("[data-del]") && await confirmDialog(`Remove <b>${esc(row.dataset.id)}</b> from subscribers?`, { ok: "Remove" })) {
      await fb.deleteDoc(fb.doc(fb.db, "subscribers", row.dataset.id));
      subs = subs.filter(s => s.id !== row.dataset.id); paint(); toast("Removed");
    }
  });
}
