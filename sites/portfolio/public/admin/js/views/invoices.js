// Invoices & quotations: list, builder with live preview, sending, payments, PDF.
//   #/invoices                 list (tabs + totals)
//   #/invoices/new[-quote]     new invoice / quotation
//   #/invoices/<id>            view, send, record payments, print
//   #/invoices/<id>/edit       edit
//   #/invoices/business        your business details, payment info & defaults
import { $, $$, fb, esc, toast, confirmDialog, openDialog, emptyState, state, downloadCsv, can } from "../core.js";
import { renderFields, bindFields, readFields } from "../forms.js";
import { clientPickerHtml, readClientPicker, bindClientPickers } from "../clientpicker.js";
import { renderInvoiceDoc, computeTotals, displayStatus, STATUS_LABEL, TAX_PRESETS, TERMS, PAY_METHODS, money, fmtDay, lineAmount, INVOICE_DEFAULTS as BIZ_DEFAULTS } from "/assets/js/invoice-doc.js";
import { SITE } from "/assets/js/config.js";
import { DEFAULT_SETTINGS, DEFAULT_PRODUCTS, DEFAULT_STUDIOS } from "/assets/js/defaults.js";
import { timeAgo, toDate } from "/assets/js/utils.js";

const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const newId = () => "inv_" + Array.from(crypto.getRandomValues(new Uint8Array(20)), b => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 56]).join("");
const publicLink = id => `${SITE.hubUrl}/invoice/?id=${encodeURIComponent(id)}`;
const priceNum = s => Number(String(s ?? "").replace(/[^\d.]/g, "")) || 0;

let biz = null;
async function loadBiz(force = false) {
  if (biz && !force) return biz;
  try { const s = await fb.getDoc(fb.doc(fb.db, "settings", "invoice")); const d = s.exists() ? s.data() : {}; biz = { ...BIZ_DEFAULTS, ...d, payment: { ...BIZ_DEFAULTS.payment, ...(d.payment || {}) } }; }
  catch { biz = { ...BIZ_DEFAULTS }; }
  return biz;
}

/** Hands out the next number (INV-2026-0007) in a transaction so two admins can't get the same one. */
async function nextNumber(kind) {
  const b = await loadBiz(), year = new Date().getFullYear();
  const ref = fb.doc(fb.db, "counters", kind === "quote" ? "quotes" : "invoices");
  const n = await fb.runTransaction(fb.db, async tx => {
    const s = await tx.get(ref);
    const cur = s.exists() && s.data().year === year ? s.data().next || 1 : 1;
    tx.set(ref, { year, next: cur + 1 });
    return cur;
  });
  return `${kind === "quote" ? b.quotePrefix || "QT" : b.invoicePrefix || "INV"}-${year}-${String(n).padStart(4, "0")}`;
}

/** Stored summary fields (for lists, alerts and the client portal). */
function withTotals(inv) {
  const t = computeTotals(inv);
  const out = { ...inv, subtotal: t.subtotal, total: t.total, amountPaid: t.paid, balance: t.balance };
  if (inv.kind !== "quote" && !["draft", "void"].includes(inv.status)) out.status = t.balance <= 0 && t.total > 0 ? "paid" : t.paid > 0 ? "partial" : "sent";
  return out;
}

export async function render(view, { params = [] }) {
  await loadBiz();
  const [a, b] = params;
  if (a === "business") return businessView(view);
  if (a === "new" || a === "new-quote") return editor(view, null, a === "new-quote" ? "quote" : "invoice");
  if (a && b === "edit") return editor(view, a);
  if (a) return detail(view, a);
  return list(view);
}

// ============================ LIST ============================
async function list(view) {
  let all = [], tab = "all", q = "";
  view.innerHTML = `
    <div class="inv-kpis" id="iv-kpis"></div>
    <div class="toolbar" style="margin-top:18px">
      <div class="pill-tabs" id="iv-tabs"></div>
      <label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="iv-q" type="search" placeholder="Search number, client, email…"></label>
      <span class="spacer"></span>
      <a class="btn btn-ghost btn-sm" href="#/invoices/business"><i class="fa-solid fa-store"></i> Business details</a>
      <button class="btn btn-ghost btn-sm" id="iv-csv"><i class="fa-solid fa-file-csv"></i> Export</button>
      <a class="btn btn-ghost btn-sm" href="#/invoices/new-quote"><i class="fa-solid fa-file-signature"></i> New quotation</a>
      <a class="btn btn-primary btn-sm" href="#/invoices/new"><i class="fa-solid fa-plus"></i> New invoice</a>
    </div>
    <div class="card" id="iv-list" style="margin-top:14px;padding:0;overflow:hidden"></div>`;

  const TABS = [["all", "All", () => true], ["draft", "Drafts", i => i._st === "draft"], ["unpaid", "Unpaid", i => ["sent", "viewed", "partial", "overdue"].includes(i._st) && i.kind !== "quote"], ["overdue", "Overdue", i => i._st === "overdue"], ["paid", "Paid", i => i._st === "paid"], ["quotes", "Quotations", i => i.kind === "quote"], ["void", "Void", i => i._st === "void"]];
  const paint = () => {
    const now = new Date(), month = new Date(now.getFullYear(), now.getMonth(), 1);
    const inv = all.filter(i => i.kind !== "quote" && i._st !== "void");
    const outstanding = inv.filter(i => i._st !== "draft").reduce((t, i) => t + i._t.balance, 0);
    const overdue = inv.filter(i => i._st === "overdue");
    const paidMonth = inv.reduce((t, i) => t + (i.payments || []).filter(p => new Date(`${p.date}T12:00`) >= month).reduce((a, p) => a + (Number(p.amount) || 0), 0), 0);
    $("#iv-kpis").innerHTML = `
      <div class="kpi" style="--c:#0D9488"><i class="fa-solid fa-sack-dollar"></i><small>Outstanding</small><strong>${money(outstanding)}</strong><span>${inv.filter(i => ["sent", "viewed", "partial", "overdue"].includes(i._st)).length} unpaid invoices</span></div>
      <div class="kpi" style="--c:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i><small>Overdue</small><strong>${money(overdue.reduce((t, i) => t + i._t.balance, 0))}</strong><span>${overdue.length} invoice${overdue.length === 1 ? "" : "s"}</span></div>
      <div class="kpi" style="--c:#16A34A"><i class="fa-solid fa-circle-check"></i><small>Received this month</small><strong>${money(paidMonth)}</strong><span>${now.toLocaleDateString("en-GB", { month: "long" })}</span></div>
      <div class="kpi" style="--c:#64748B"><i class="fa-regular fa-file-lines"></i><small>Drafts</small><strong>${all.filter(i => i._st === "draft").length}</strong><span>${all.filter(i => i.kind === "quote" && i.status === "sent").length} quotations awaiting reply</span></div>`;
    $("#iv-tabs").innerHTML = TABS.map(([k, l, f]) => `<button class="${tab === k ? "active" : ""}" data-tab="${k}">${l}<span>${all.filter(f).length}</span></button>`).join("");
    const filt = TABS.find(t => t[0] === tab)[2];
    const rows = all.filter(filt).filter(i => !q || `${i.number} ${i.clientName} ${i.email} ${i.clientCompany} ${i.subject}`.toLowerCase().includes(q));
    $("#iv-list").innerHTML = rows.length ? `<div class="table-wrap"><table class="table inv-table"><thead><tr><th>Number</th><th>Client</th><th>Date</th><th>Due</th><th class="num">Total</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>
      ${rows.map(i => `<tr data-open="${esc(i.id)}" tabindex="0">
        <td><b>${esc(i.number || "Draft")}</b>${i.kind === "quote" ? ' <span class="kind-tag">Quote</span>' : ""}</td>
        <td><div class="t-title">${esc(i.clientName || "—")}<small>${esc(i.clientCompany || i.email || "")}</small></div></td>
        <td class="small">${fmtDay(i.issueDate)}</td><td class="small">${i.kind === "quote" ? "—" : fmtDay(i.dueDate)}</td>
        <td class="num">${money(i._t.total)}</td><td class="num"><b>${i.kind === "quote" ? "—" : money(i._t.balance)}</b></td>
        <td><span class="inv-pill st-${i._st}">${STATUS_LABEL[i._st] || i._st}</span></td></tr>`).join("")}</tbody></table></div>`
      : emptyState("fa-solid fa-file-invoice-dollar", all.length ? "Nothing in this list." : "No invoices yet. Create your first one. It takes about a minute.", all.length ? "" : '<a class="btn btn-primary btn-sm" href="#/invoices/new"><i class="fa-solid fa-plus"></i> New invoice</a>');
  };
  try {
    all = (await fb.getDocs(fb.query(fb.collection(fb.db, "invoices"), fb.orderBy("createdAt", "desc"), fb.limit(500)))).docs.map(d => { const i = { id: d.id, ...d.data() }; i._t = computeTotals(i); i._st = displayStatus(i); return i; });
  } catch (e) { view.innerHTML = `<div class="callout warn">${esc(e.message)}</div>`; return; }
  paint();
  view.addEventListener("click", e => {
    const t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; paint(); return; }
    const r = e.target.closest("[data-open]"); if (r) location.hash = `#/invoices/${r.dataset.open}`;
  });
  view.addEventListener("keydown", e => { const r = e.target.closest("[data-open]"); if (r && e.key === "Enter") location.hash = `#/invoices/${r.dataset.open}`; });
  $("#iv-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); paint(); });
  $("#iv-csv").addEventListener("click", () => downloadCsv(`invoices-${today()}.csv`, all.map(i => ({ number: i.number, type: i.kind || "invoice", client: i.clientName, email: i.email, company: i.clientCompany, issued: i.issueDate, due: i.dueDate, subtotal: i._t.subtotal, tax: i._t.taxTotal, total: i._t.total, paid: i._t.paid, balance: i._t.balance, status: STATUS_LABEL[i._st] || i._st }))));
}

// ============================ EDITOR ============================
async function catalogue() {
  let site = DEFAULT_SETTINGS, products = DEFAULT_PRODUCTS, studios = DEFAULT_STUDIOS;
  try {
    const [s, p, st] = await Promise.all([fb.getDoc(fb.doc(fb.db, "settings", "site")), fb.getDocs(fb.collection(fb.db, "products")), fb.getDocs(fb.collection(fb.db, "studios"))]);
    if (s.exists() && s.data().pricingGroups) site = s.data();
    if (p.size) products = p.docs.map(d => d.data());
    if (st.size) studios = st.docs.map(d => d.data());
  } catch { }
  const out = [];
  (site.pricingGroups || []).forEach(g => (g.plans || []).forEach(pl => out.push({ group: g.name, description: pl.name, details: (pl.features || []).slice(0, 4).join(" · "), rate: priceNum(pl.price), unit: /month/.test(pl.period || "") ? "month" : /day/.test(pl.period || "") ? "day" : "" })));
  studios.forEach(s => (s.packages || []).forEach(pk => out.push({ group: s.name, description: pk.name, details: (pk.features || []).slice(0, 4).join(" · "), rate: priceNum(pk.price), unit: "" })));
  products.forEach(p => out.push({ group: "Branded products", description: p.name, details: (p.methods || []).join(", "), rate: priceNum(p.priceFrom), unit: "pcs" }));
  return out;
}

async function editor(view, id, kind = "invoice") {
  let inv;
  if (id) {
    const s = await fb.getDoc(fb.doc(fb.db, "invoices", id));
    if (!s.exists()) { view.innerHTML = emptyState("fa-solid fa-file-circle-xmark", "Invoice not found."); return; }
    inv = { id, ...s.data() };
  } else {
    const issue = today(), terms = biz.defaultTerms || "net14";
    inv = { kind, status: "draft", issueDate: issue, terms, dueDate: addDays(issue, kind === "quote" ? 30 : TERMS.find(t => t[0] === terms)?.[2] ?? 14),
      items: [{ description: "", details: "", qty: 1, unit: "", rate: 0 }], discount: { type: "percent", value: 0 }, taxMode: biz.defaultTax || "none",
      notes: biz.defaultNotes || "", termsText: biz.defaultTermsText || "", showPayment: true, template: biz.template || "modern", accent: biz.accent || "#0A60EE" };
    try { const pre = JSON.parse(sessionStorage.getItem("pj_invoice_prefill") || "null"); if (pre) { Object.assign(inv, pre); sessionStorage.removeItem("pj_invoice_prefill"); } } catch { }
  }
  const quote = inv.kind === "quote";
  const items = (inv.items || []).map(it => ({ ...it }));
  const cat = await catalogue();
  const projects = await fb.getDocs(fb.collection(fb.db, "clientProjects")).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []);

  view.innerHTML = `
    <div class="inv-editor">
      <form class="inv-form" id="iv-form" novalidate>
        <div class="toolbar no-print" style="margin:0 0 14px"><a class="btn btn-ghost btn-sm" href="#/invoices${id ? `/${id}` : ""}"><i class="fa-solid fa-arrow-left"></i> ${id ? "Back to invoice" : "All invoices"}</a><span class="spacer"></span><span class="muted small">${esc(inv.number || "Number is assigned when you save")}</span></div>
        <section class="card"><h3 class="sec-title"><span>1</span> ${quote ? "Who is this quotation for?" : "Who are you billing?"}</h3>
          ${clientPickerHtml({ uid: inv.uid, name: inv.clientName, email: inv.email, phone: inv.clientPhone, company: inv.clientCompany, address: inv.clientAddress, tin: inv.clientTin }, { extra: [["address", "Address (optional)", "text", "Street, town"], ["tin", "Client TIN (optional)", "text", "For VAT-registered clients"]] })}
        </section>
        <section class="card"><h3 class="sec-title"><span>2</span> Details</h3>
          <div class="fields">
            <div class="f"><label for="iv-issue">${quote ? "Quotation" : "Invoice"} date</label><input id="iv-issue" type="date" value="${esc(inv.issueDate)}"></div>
            ${quote ? `<div class="f"><label for="iv-due">Valid until</label><input id="iv-due" type="date" value="${esc(inv.dueDate || "")}"></div>` : `
            <div class="f"><label for="iv-terms">Payment terms</label><select id="iv-terms">${TERMS.map(([k, l]) => `<option value="${k}"${inv.terms === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
            <div class="f"><label for="iv-due">Due date</label><input id="iv-due" type="date" value="${esc(inv.dueDate || "")}"></div>`}
            <div class="f"><label for="iv-subject">Subject (optional)</label><input id="iv-subject" value="${esc(inv.subject || "")}" placeholder="e.g. School management system, phase 1"></div>
            <div class="f"><label for="iv-ref">Reference / PO (optional)</label><input id="iv-ref" value="${esc(inv.reference || "")}"></div>
            <div class="f"><label for="iv-project">Link to client project (optional)</label><select id="iv-project"><option value="">None</option>${projects.map(p => `<option value="${esc(p.id)}"${inv.projectId === p.id ? " selected" : ""}>${esc(p.title)} · ${esc(p.clientName || p.email || "")}</option>`).join("")}</select></div>
          </div>
        </section>
        <section class="card"><h3 class="sec-title"><span>3</span> Items</h3>
          <div class="li-head"><span>Description</span><span>Qty</span><span>Rate (GH₵)</span><span>Amount</span><span></span></div>
          <div id="iv-items"></div>
          <div class="btn-row" style="margin-top:10px"><button type="button" class="btn btn-ghost btn-sm" id="iv-add"><i class="fa-solid fa-plus"></i> Add item</button><button type="button" class="btn btn-ghost btn-sm" id="iv-cat"><i class="fa-solid fa-list"></i> Add from your services &amp; products</button></div>
          <div class="fields" style="margin-top:16px">
            <div class="f"><label for="iv-dtype">Discount</label><div class="f-inline"><input id="iv-dval" type="number" min="0" step="0.01" value="${esc(inv.discount?.value || 0)}" style="max-width:130px"><select id="iv-dtype"><option value="percent"${inv.discount?.type !== "amount" ? " selected" : ""}>% of subtotal</option><option value="amount"${inv.discount?.type === "amount" ? " selected" : ""}>GH₵ amount</option></select></div></div>
            <div class="f"><label for="iv-tax">Tax</label><select id="iv-tax">${Object.entries(TAX_PRESETS).map(([k, t]) => `<option value="${k}"${(inv.taxMode || "none") === k ? " selected" : ""}>${t.label}</option>`).join("")}</select></div>
            <div class="f" id="iv-custom-tax" ${inv.taxMode === "custom" ? "" : "hidden"}><label>Custom tax</label><div class="f-inline"><input id="iv-ctl" value="${esc(inv.customTaxLabel || "Tax")}" style="max-width:140px"><input id="iv-ctr" type="number" min="0" step="0.01" value="${esc(inv.customTaxRate || 0)}" style="max-width:110px"><span class="muted">%</span></div></div>
          </div>
          <p class="muted small" style="margin:10px 0 0"><i class="fa-solid fa-circle-info"></i> Since 1 Jan 2026, VAT (15%), NHIL (2.5%) and GETFund (2.5%) are all charged on the same amount: 20% in total. Use “No tax” if you're not VAT registered. If you're on GRA's E-VAT system, add your E-VAT invoice number below.</p>
        </section>
        <section class="card"><h3 class="sec-title"><span>4</span> Notes, terms &amp; look</h3>
          <div class="fields">
            <div class="f full"><label for="iv-notes">Note to client</label><textarea id="iv-notes" rows="2">${esc(inv.notes || "")}</textarea></div>
            <div class="f full"><label for="iv-termsText">Terms &amp; conditions</label><textarea id="iv-termsText" rows="2">${esc(inv.termsText || "")}</textarea></div>
            ${quote ? "" : `<div class="f"><label class="switch"><input type="checkbox" id="iv-showpay" ${inv.showPayment !== false ? "checked" : ""}><span class="track"></span>Show payment details (MoMo, bank)</label></div>`}
            <div class="f"><label for="iv-evat">E-VAT invoice no. (optional)</label><input id="iv-evat" value="${esc(inv.einvoiceRef || "")}" placeholder="From GRA's E-VAT system"></div>
            <div class="f"><label for="iv-tpl">Design</label><select id="iv-tpl">${[["modern", "Modern"], ["classic", "Classic"], ["minimal", "Minimal"]].map(([k, l]) => `<option value="${k}"${(inv.template || "modern") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
            <div class="f"><label for="iv-accent">Accent colour</label><div class="color-row"><input type="color" id="iv-accent" value="${esc(inv.accent || "#0A60EE")}"></div></div>
          </div>
        </section>
        <div class="inv-actions no-print">
          <a class="btn btn-ghost" href="#/invoices${id ? `/${id}` : ""}">Cancel</a>
          <button class="btn btn-ghost" type="button" data-save="draft"><i class="fa-regular fa-floppy-disk"></i> Save ${inv.status === "draft" ? "draft" : "changes"}</button>
          <button class="btn btn-primary" type="button" data-save="send"><i class="fa-solid fa-paper-plane"></i> Save &amp; send</button>
        </div>
      </form>
      <aside class="inv-preview-wrap"><div class="inv-preview-head"><span><i class="fa-regular fa-eye"></i> Live preview</span><span class="muted small" id="iv-total"></span></div><div class="inv-preview" id="iv-preview"></div></aside>
    </div>`;

  bindClientPickers(view);
  const itemRow = (it, i) => `<div class="li-row" data-i="${i}">
      <div class="li-desc"><input data-k="description" value="${esc(it.description || "")}" placeholder="Item or service"><textarea data-k="details" rows="1" placeholder="Details (optional)">${esc(it.details || "")}</textarea></div>
      <div class="li-qty"><input data-k="qty" type="number" min="0" step="0.01" value="${esc(it.qty ?? 1)}"><input data-k="unit" value="${esc(it.unit || "")}" placeholder="unit"></div>
      <div class="li-rate"><input data-k="rate" type="number" min="0" step="0.01" value="${esc(it.rate ?? 0)}"><input data-k="discountPct" type="number" min="0" max="100" step="1" value="${esc(it.discountPct || "")}" placeholder="disc. %"></div>
      <div class="li-amt">${money(lineAmount(it), "")}</div>
      <div class="li-act"><button type="button" class="icon-btn sm" data-mv="-1" title="Move up" aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="icon-btn sm danger" data-rm title="Remove item" aria-label="Remove item"><i class="fa-regular fa-trash-can"></i></button></div>
    </div>`;
  const paintItems = () => { $("#iv-items").innerHTML = items.map(itemRow).join("") || '<p class="muted small">No items. Add one below.</p>'; };
  const collect = () => {
    const c = readClientPicker(view) || {};
    return { ...inv, items: items.map(it => ({ ...it, qty: Number(it.qty) || 0, rate: Number(it.rate) || 0, discountPct: Number(it.discountPct) || 0 })),
      uid: c.uid || null, clientName: c.name || "", email: c.email || "", clientPhone: c.phone || "", clientCompany: c.company || "", clientAddress: c.address || "", clientTin: c.tin || "",
      issueDate: $("#iv-issue").value || today(), dueDate: $("#iv-due").value || "", terms: quote ? "" : $("#iv-terms").value,
      subject: $("#iv-subject").value.trim(), reference: $("#iv-ref").value.trim(), projectId: $("#iv-project").value || "",
      discount: { type: $("#iv-dtype").value, value: Number($("#iv-dval").value) || 0 }, taxMode: $("#iv-tax").value, taxLines: null,
      customTaxLabel: $("#iv-ctl").value.trim() || "Tax", customTaxRate: Number($("#iv-ctr").value) || 0,
      notes: $("#iv-notes").value.trim(), termsText: $("#iv-termsText").value.trim(), showPayment: quote ? false : $("#iv-showpay").checked,
      einvoiceRef: $("#iv-evat").value.trim(), template: $("#iv-tpl").value, accent: $("#iv-accent").value };
  };
  let raf;
  const preview = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
    const cur = collect();
    $("#iv-preview").innerHTML = renderInvoiceDoc(cur, biz, { origin: location.origin });
    $("#iv-total").textContent = `Total ${money(computeTotals(cur).total)}`;
  }); };
  paintItems(); preview(); fitPreview($("#iv-preview"));

  view.addEventListener("input", e => {
    const row = e.target.closest(".li-row");
    if (row && e.target.dataset.k) {
      const it = items[+row.dataset.i]; it[e.target.dataset.k] = e.target.value;
      $(".li-amt", row).textContent = money(lineAmount({ ...it, qty: Number(it.qty), rate: Number(it.rate) }), "");
    }
    view.querySelector(".inv-form").classList.add("is-dirty");
    preview();
  });
  view.addEventListener("change", e => {
    if (e.target.id === "iv-terms" || e.target.id === "iv-issue") {
      const t = TERMS.find(x => x[0] === $("#iv-terms")?.value);
      if (t && t[2] !== null) $("#iv-due").value = addDays($("#iv-issue").value || today(), t[2]);
    }
    if (e.target.id === "iv-due" && $("#iv-terms")) $("#iv-terms").value = "custom";
    if (e.target.id === "iv-tax") $("#iv-custom-tax").hidden = e.target.value !== "custom";
    preview();
  });
  view.addEventListener("click", async e => {
    if (e.target.closest("#iv-add")) { items.push({ description: "", qty: 1, unit: "", rate: 0 }); paintItems(); $$("#iv-items .li-row:last-child input")[0]?.focus(); preview(); return; }
    const row = e.target.closest(".li-row");
    if (row && e.target.closest("[data-rm]")) { items.splice(+row.dataset.i, 1); paintItems(); preview(); return; }
    if (row && e.target.closest("[data-mv]")) { const i = +row.dataset.i; if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paintItems(); preview(); } return; }
    if (e.target.closest("#iv-cat")) {
      let picked = [];
      await openDialog({
        title: "Add from your services & products", size: "wide",
        body: `<label class="search" style="width:100%;margin-bottom:12px"><i class="fa-solid fa-magnifying-glass"></i><input id="cat-q" type="search" placeholder="Search services and products…"></label>
          <div class="cat-list" id="cat-list">${cat.map((c, i) => `<label class="cat-item" data-text="${esc(`${c.group} ${c.description} ${c.details}`.toLowerCase())}"><input type="checkbox" value="${i}"><span><small>${esc(c.group)}</small><b>${esc(c.description)}</b><em>${c.rate ? money(c.rate) : "Price on request"}${c.unit ? ` / ${esc(c.unit)}` : ""}</em></span></label>`).join("") || '<p class="muted">Your pricing, studio packages and products will appear here.</p>'}</div>`,
        actions: [{ label: "Cancel", value: null, cls: "btn-ghost" }, { label: "Add selected", value: "ok", cls: "btn-primary", handler: body => { picked = $$("#cat-list input:checked", body).map(i => cat[+i.value]); } }],
        onOpen: body => $("#cat-q", body).addEventListener("input", ev => { const t = ev.target.value.toLowerCase(); $$(".cat-item", body).forEach(el => { el.hidden = !el.dataset.text.includes(t); }); })
      });
      if (picked.length) {
        if (items.length === 1 && !items[0].description && !Number(items[0].rate)) items.splice(0, 1);
        picked.forEach(c => items.push({ description: c.description, details: c.details, qty: 1, unit: c.unit, rate: c.rate }));
        paintItems(); preview();
      }
      return;
    }
    const sv = e.target.closest("[data-save]");
    if (!sv) return;
    const cur = collect();
    if (!cur.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cur.email)) { toast("Choose a client or enter their email address.", "error"); $('[data-cp="email"]').focus(); return; }
    if (!cur.clientName) { toast("Enter the client's name.", "error"); $('[data-cp="name"]').focus(); return; }
    cur.items = cur.items.filter(it => it.description || Number(it.rate));
    if (!cur.items.length) { toast("Add at least one item.", "error"); return; }
    if (!quote && !cur.dueDate) { toast("Choose a due date.", "error"); $("#iv-due").focus(); return; }
    sv.disabled = true;
    try {
      const docId = inv.id || newId();
      if (!cur.number) cur.number = await nextNumber(cur.kind);
      if (!cur.uid) { try { const s = await fb.getDocs(fb.query(fb.collection(fb.db, "users"), fb.where("email", "==", cur.email))); cur.uid = s.docs[0]?.id || null; } catch { } }
      const { id: _drop, ...data } = withTotals(cur);
      // Firestore can't store nested arrays, so each tax line is an object.
      data.taxLines = cur.taxMode === "custom" ? (cur.customTaxRate ? [{ label: cur.customTaxLabel, rate: cur.customTaxRate }] : []) : (TAX_PRESETS[cur.taxMode]?.lines || []).map(([label, rate]) => ({ label, rate }));
      data.updatedAt = fb.serverTimestamp();
      if (!inv.id) Object.assign(data, { createdAt: fb.serverTimestamp(), createdBy: state.user.email, payments: [], viewCount: 0 });
      await fb.setDoc(fb.doc(fb.db, "invoices", docId), data, { merge: true });
      view.querySelector(".inv-form").classList.remove("is-dirty");
      toast(`${quote ? "Quotation" : "Invoice"} ${data.number} saved`);
      location.hash = `#/invoices/${docId}${sv.dataset.save === "send" ? "?send=1" : ""}`;
    } catch (err) { toast(err.message, "error"); sv.disabled = false; }
  });
}

// ============================ DETAIL ============================
async function detail(view, rawId) {
  const [id, query] = rawId.split("?");
  let inv, off;
  const ref = fb.doc(fb.db, "invoices", id);
  const paint = () => {
    const t = computeTotals(inv), st = displayStatus(inv), quote = inv.kind === "quote";
    const link = publicLink(id);
    view.innerHTML = `
      <div class="toolbar no-print"><a class="btn btn-ghost btn-sm" href="#/invoices"><i class="fa-solid fa-arrow-left"></i> All invoices</a><span class="spacer"></span>
        <span class="inv-pill st-${st}">${STATUS_LABEL[st] || st}</span></div>
      <div class="inv-detail">
        <div class="inv-paper">${renderInvoiceDoc(inv, biz, { origin: location.origin })}</div>
        <aside class="inv-side no-print">
          <section class="card">
            <div class="inv-side-total"><small>${quote ? "Quotation total" : st === "paid" ? "Paid in full" : "Balance due"}</small><strong>${money(quote || st === "paid" ? t.total : t.balance)}</strong>${!quote && t.paid ? `<span class="muted small">${money(t.paid)} of ${money(t.total)} received</span>` : ""}
              ${!quote && t.total ? `<div class="pay-progress"><span style="width:${Math.min(100, (t.paid / t.total) * 100)}%"></span></div>` : ""}</div>
            <div class="inv-btns">
              ${st !== "void" ? `<button class="btn btn-primary btn-block" data-act="send"><i class="fa-solid fa-paper-plane"></i> ${inv.sentAt ? "Send again" : "Send to client"}</button>` : ""}
              ${!quote && !["void", "paid", "draft"].includes(st) ? `<button class="btn btn-ghost btn-block" data-act="pay"><i class="fa-solid fa-hand-holding-dollar"></i> Record a payment</button>` : ""}
              ${quote && !["converted", "declined"].includes(inv.status) ? `<button class="btn btn-ghost btn-block" data-act="convert"><i class="fa-solid fa-right-left"></i> Convert to invoice</button>` : ""}
              <button class="btn btn-ghost btn-block" data-act="print"><i class="fa-solid fa-print"></i> Print / save as PDF</button>
              ${st !== "void" && !(inv.payments || []).length ? `<a class="btn btn-ghost btn-block" href="#/invoices/${id}/edit"><i class="fa-solid fa-pen"></i> Edit</a>` : ""}
              <button class="btn btn-ghost btn-block" data-act="dup"><i class="fa-regular fa-copy"></i> Duplicate</button>
              ${quote && inv.status === "sent" ? `<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="accepted">Mark accepted</button><button class="btn btn-ghost btn-sm" data-act="declined">Mark declined</button></div>` : ""}
              ${inv.status === "draft" ? `<button class="btn btn-ghost btn-block danger" data-act="delete"><i class="fa-regular fa-trash-can"></i> Delete draft</button>` : st !== "void" ? `<button class="btn btn-ghost btn-block danger" data-act="void"><i class="fa-solid fa-ban"></i> Void ${quote ? "quotation" : "invoice"}</button>` : ""}
            </div>
          </section>
          ${inv.status !== "draft" ? `<section class="card"><h4 style="margin-top:0">Client link</h4><div class="copy-row"><input readonly value="${esc(link)}"><button class="btn btn-ghost btn-sm" data-act="copy" title="Copy link"><i class="fa-regular fa-copy"></i></button></div>
            <p class="muted small" style="margin:8px 0 0">${inv.viewedAt ? `<i class="fa-solid fa-eye" style="color:var(--green)"></i> Viewed ${inv.viewCount || 1}× · last ${timeAgo(inv.viewedAt)}` : '<i class="fa-regular fa-eye-slash"></i> Not viewed yet'}</p></section>` : ""}
          ${!quote ? `<section class="card"><h4 style="margin-top:0">Payments</h4>${(inv.payments || []).length ? `<div class="pay-list">${inv.payments.map((p, i) => `<div class="pay-row"><span class="pay-dot"><i class="fa-solid fa-check"></i></span><div class="grow"><b>${money(p.amount)}</b><small>${fmtDay(p.date)} · ${esc(PAY_METHODS[p.method] || p.method)}${p.reference ? ` · ${esc(p.reference)}` : ""}</small></div><button class="icon-btn sm danger" data-rmpay="${i}" title="Remove payment" aria-label="Remove payment"><i class="fa-solid fa-xmark"></i></button></div>`).join("")}</div>` : '<p class="muted small" style="margin:0">No payments recorded yet.</p>'}</section>` : ""}
          <section class="card"><h4 style="margin-top:0">Activity</h4><ul class="activity">
            <li>Created ${inv.createdAt ? timeAgo(inv.createdAt) : ""}${inv.createdBy ? ` by ${esc(inv.createdBy)}` : ""}</li>
            ${inv.sentAt ? `<li>Sent ${timeAgo(inv.sentAt)}${inv.sentVia ? ` via ${esc(inv.sentVia)}` : ""}</li>` : ""}
            ${inv.viewedAt ? `<li>Opened by client ${timeAgo(inv.viewedAt)}</li>` : ""}
            ${(inv.payments || []).map(p => `<li>Payment of ${money(p.amount)} on ${fmtDay(p.date)}</li>`).join("")}
            ${inv.paidAt ? `<li><b>Paid in full</b> ${timeAgo(inv.paidAt)}</li>` : ""}
            ${inv.convertedTo ? `<li>Converted to invoice <a href="#/invoices/${esc(inv.convertedTo)}">${esc(inv.convertedNumber || "")}</a></li>` : ""}
            ${inv.fromQuote ? `<li>Created from quotation <a href="#/invoices/${esc(inv.fromQuote)}">${esc(inv.fromQuoteNumber || "")}</a></li>` : ""}
          </ul></section>
        </aside>
      </div>`;
  };
  const save = async patch => { const next = withTotals({ ...inv, ...patch }); const { id: _x, ...data } = next; await fb.updateDoc(ref, { ...data, updatedAt: fb.serverTimestamp() }); };

  const sendDialog = async () => {
    const t = computeTotals(inv), quote = inv.kind === "quote", link = publicLink(id);
    const first = (inv.clientName || "").split(" ")[0] || "there";
    const msg = quote
      ? `Hello ${first}, here is your quotation ${inv.number} from ${biz.businessName} for ${money(t.total)}${inv.dueDate ? `, valid until ${fmtDay(inv.dueDate)}` : ""}.\n\nView it here: ${link}\n\nThank you!`
      : `Hello ${first}, here is invoice ${inv.number} from ${biz.businessName} for ${money(t.balance || t.total)}${inv.dueDate ? `, due ${inv.terms === "receipt" ? "on receipt" : fmtDay(inv.dueDate)}` : ""}.\n\nView and download it here: ${link}\n\nPlease use ${inv.number} as your payment reference. Thank you!`;
    const wa = String(inv.clientPhone || "").replace(/\D/g, "").replace(/^0/, "233");
    let via = null;
    await openDialog({
      title: `Send ${quote ? "quotation" : "invoice"} ${inv.number}`, size: "wide",
      body: `<p class="muted" style="margin-top:0">Choose how to send it. The message includes a secure link where ${esc(first)} can view, print or download it${inv.uid ? ". It also appears in their client portal" : ""}.</p>
        <div class="f"><label for="snd-msg">Message</label><textarea id="snd-msg" rows="6">${esc(msg)}</textarea></div>
        <div class="send-grid">
          <a class="send-opt wa" data-via="WhatsApp" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}"><i class="fa-brands fa-whatsapp"></i><b>WhatsApp</b><small>${wa ? esc(inv.clientPhone) : "Pick a contact"}</small></a>
          <a class="send-opt mail" data-via="email" href="mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(`${quote ? "Quotation" : "Invoice"} ${inv.number} from ${biz.businessName}`)}&body=${encodeURIComponent(msg)}"><i class="fa-regular fa-envelope"></i><b>Email</b><small>${esc(inv.email)}</small></a>
          <button type="button" class="send-opt link" data-via="link"><i class="fa-solid fa-link"></i><b>Copy link</b><small>Paste anywhere</small></button>
        </div>`,
      actions: [{ label: "Close", value: null, cls: "btn-ghost" }, ...(inv.status === "draft" ? [{ label: "Mark as sent", value: "sent", cls: "btn-primary", handler: () => { via ||= "other"; } }] : [])],
      onOpen: body => {
        const upd = () => { const m = $("#snd-msg", body).value; $(".send-opt.wa", body).href = `https://wa.me/${wa}?text=${encodeURIComponent(m)}`; $(".send-opt.mail", body).href = `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(`${quote ? "Quotation" : "Invoice"} ${inv.number} from ${biz.businessName}`)}&body=${encodeURIComponent(m)}`; };
        $("#snd-msg", body).addEventListener("input", upd);
        body.addEventListener("click", async e => {
          const o = e.target.closest(".send-opt"); if (!o) return;
          via = o.dataset.via;
          if (via === "link") { await navigator.clipboard.writeText(link).catch(() => { }); toast("Link copied"); }
          await save({ status: inv.status === "draft" ? "sent" : inv.status, sentAt: fb.serverTimestamp(), sentVia: via }).catch(err => toast(err.message, "error"));
        });
      }
    });
    if (via && inv.status === "draft") await save({ status: "sent", sentAt: fb.serverTimestamp(), sentVia: via });
  };

  const payDialog = async () => {
    const t = computeTotals(inv);
    await openDialog({
      title: `Record a payment for ${inv.number}`,
      body: `<div class="fields">
        <div class="f"><label for="pay-amt">Amount received (GH₵)</label><input id="pay-amt" type="number" min="0.01" step="0.01" value="${t.balance.toFixed(2)}"><span class="help">Balance due: ${money(t.balance)}</span></div>
        <div class="f"><label for="pay-date">Date received</label><input id="pay-date" type="date" value="${today()}" max="${today()}"></div>
        <div class="f"><label for="pay-method">Method</label><select id="pay-method">${Object.entries(PAY_METHODS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div class="f"><label for="pay-ref">Reference / transaction ID</label><input id="pay-ref" placeholder="e.g. MoMo transaction ID"></div>
        <div class="f full"><label for="pay-note">Note (optional)</label><input id="pay-note"></div></div>`,
      actions: [{ label: "Cancel", value: null, cls: "btn-ghost" }, { label: "Save payment", value: "ok", cls: "btn-primary", handler: async body => {
        const amount = Math.round((Number($("#pay-amt", body).value) || 0) * 100) / 100;
        if (amount <= 0) { toast("Enter the amount received.", "error"); return false; }
        if (amount > t.balance + 0.005 && !confirm(`That's more than the balance (${money(t.balance)}). Record it anyway?`)) return false;
        const p = { id: crypto.randomUUID(), amount, date: $("#pay-date", body).value || today(), method: $("#pay-method", body).value, reference: $("#pay-ref", body).value.trim(), note: $("#pay-note", body).value.trim(), recordedBy: state.user.email };
        const payments = [...(inv.payments || []), p];
        const done = computeTotals({ ...inv, payments }).balance <= 0;
        await save({ payments, ...(done ? { paidAt: fb.serverTimestamp() } : {}) });
        toast(done ? "Payment recorded. Invoice is paid in full 🎉" : "Payment recorded");
      } }]
    });
  };

  const duplicate = async (asKind = inv.kind, extra = {}) => {
    const { id: _i, number, payments, sentAt, sentVia, viewedAt, viewCount, paidAt, createdAt, updatedAt, convertedTo, convertedNumber, status, ...rest } = inv;
    const issue = today();
    const copy = withTotals({ ...rest, ...extra, kind: asKind, status: "draft", issueDate: issue, dueDate: addDays(issue, asKind === "quote" ? 30 : TERMS.find(t => t[0] === (inv.terms || "net14"))?.[2] ?? 14), terms: asKind === "quote" ? "" : inv.terms || biz.defaultTerms, showPayment: asKind !== "quote" });
    const newDoc = newId();
    await fb.setDoc(fb.doc(fb.db, "invoices", newDoc), { ...copy, number: await nextNumber(asKind), payments: [], viewCount: 0, createdAt: fb.serverTimestamp(), updatedAt: fb.serverTimestamp(), createdBy: state.user.email });
    return newDoc;
  };

  let openSend = /send=1/.test(query || "");
  off = fb.onSnapshot(ref, s => {
    if (!s.exists()) { view.innerHTML = emptyState("fa-solid fa-file-circle-xmark", "This invoice was deleted."); return; }
    inv = { id, ...s.data() };
    if (view.isConnected) paint();
    // "Save & send" lands here: open the send options once the invoice has loaded.
    if (openSend) { openSend = false; history.replaceState(null, "", `#/invoices/${id}`); sendDialog(); }
  });
  current = () => off?.();

  view.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]");
    const rp = e.target.closest("[data-rmpay]");
    if (rp && await confirmDialog("Remove this payment record?", { ok: "Remove" })) {
      const payments = (inv.payments || []).filter((_, i) => i !== +rp.dataset.rmpay);
      await save({ payments, paidAt: null }); toast("Payment removed"); return;
    }
    if (!b) return;
    const act = b.dataset.act;
    try {
      if (act === "send") return sendDialog();
      if (act === "pay") return payDialog();
      if (act === "print") return window.print();
      if (act === "copy") { await navigator.clipboard.writeText(publicLink(id)); return toast("Link copied"); }
      if (act === "dup") { const n = await duplicate(); toast("Copy created"); location.hash = `#/invoices/${n}/edit`; return; }
      if (act === "convert") {
        const n = await duplicate("invoice", { fromQuote: id, fromQuoteNumber: inv.number });
        const created = await fb.getDoc(fb.doc(fb.db, "invoices", n));
        await save({ status: "converted", convertedTo: n, convertedNumber: created.data().number });
        toast("Invoice created from the quotation"); location.hash = `#/invoices/${n}/edit`; return;
      }
      if (act === "accepted" || act === "declined") { await save({ status: act }); return toast(`Marked as ${act}`); }
      if (act === "void" && await confirmDialog(`Void <b>${esc(inv.number)}</b>? It stays on record (numbers are never reused) but no longer counts as money owed.`, { ok: "Void it" })) { await save({ status: "void" }); return toast("Voided"); }
      if (act === "delete" && await confirmDialog(`Delete draft <b>${esc(inv.number)}</b>?`)) { off?.(); await fb.deleteDoc(ref); toast("Draft deleted"); location.hash = "#/invoices"; }
    } catch (err) { toast(err.message, "error"); }
  });
}
let current = null;
export function destroy() { current?.(); current = null; }

// Fit the full-size A4 preview into its column.
function fitPreview(box) {
  if (!box) return;
  const fit = () => box.style.setProperty("--z", Math.min(1, (box.clientWidth - 28) / 820).toFixed(3));
  fit(); new ResizeObserver(fit).observe(box);
}

// ============================ BUSINESS DETAILS ============================
const BIZ_FIELDS = [
  { key: "businessName", label: "Business name", type: "text", required: true },
  { key: "phone", label: "Phone / WhatsApp", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "website", label: "Website", type: "text" },
  { key: "address", label: "Address", type: "textarea", rows: 2, full: true },
  { key: "tin", label: "TIN (Taxpayer Identification Number)", type: "text", help: "Shown on every invoice. Needed for VAT invoices." },
  { key: "vatNumber", label: "VAT registration no. (if any)", type: "text" },
  { key: "defaultTax", label: "Default tax", type: "select", options: Object.entries(TAX_PRESETS).map(([k, t]) => [k, t.label]) },
  { key: "defaultTerms", label: "Default payment terms", type: "select", options: TERMS.filter(t => t[0] !== "custom").map(([k, l]) => [k, l]) },
  { key: "invoicePrefix", label: "Invoice number prefix", type: "text", placeholder: "INV", help: "Numbers look like INV-2026-0001 and restart each year." },
  { key: "quotePrefix", label: "Quotation number prefix", type: "text", placeholder: "QT" },
  { key: "logo", label: "Logo on invoices", type: "image", full: true, help: "Leave empty to use the ProfJero logo." },
  { key: "template", label: "Default design", type: "select", options: [["modern", "Modern"], ["classic", "Classic"], ["minimal", "Minimal"]] },
  { key: "accent", label: "Default accent colour", type: "color" },
  { key: "defaultNotes", label: "Default note to client", type: "textarea", rows: 2, full: true },
  { key: "defaultTermsText", label: "Default terms & conditions", type: "textarea", rows: 3, full: true },
  { key: "momo", label: "Mobile Money accounts", type: "list", full: true, itemLabel: "MoMo account", fields: [
    { key: "network", label: "Network", type: "select", options: ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money"] }, { key: "number", label: "Number / merchant ID", type: "text" }, { key: "name", label: "Account name", type: "text" }] },
  { key: "bankName", label: "Bank", type: "text", placeholder: "e.g. GCB Bank" },
  { key: "branch", label: "Branch", type: "text" },
  { key: "accountName", label: "Account name", type: "text" },
  { key: "accountNumber", label: "Account number", type: "text" },
  { key: "paystackLink", label: "Paystack payment link (optional)", type: "url", full: true, help: "Lets clients pay by card or MoMo online." },
  { key: "signatureName", label: "Signature name", type: "text" },
  { key: "signatureTitle", label: "Signature title", type: "text" },
  { key: "signatureImage", label: "Signature image (optional)", type: "image", full: true },
  { key: "footer", label: "Footer message", type: "text", full: true }
];
async function businessView(view) {
  const b = await loadBiz(true);
  const data = { ...b, ...b.payment };
  view.innerHTML = `
    <div class="toolbar"><a class="btn btn-ghost btn-sm" href="#/invoices"><i class="fa-solid fa-arrow-left"></i> All invoices</a></div>
    <div class="inv-editor">
      <form class="card" id="bz-form" data-scope novalidate>
        <h3 style="margin-top:0">Your business details</h3><p class="muted small">These appear on every invoice and quotation.</p>
        ${renderFields(BIZ_FIELDS, data)}
        <div class="form-foot"><span></span><button class="btn btn-primary" type="submit" ${can("invoices") ? "" : "disabled"}><i class="fa-solid fa-floppy-disk"></i> Save details</button></div>
      </form>
      <aside class="inv-preview-wrap"><div class="inv-preview-head"><span><i class="fa-regular fa-eye"></i> Sample invoice</span></div><div class="inv-preview" id="bz-preview"></div></aside>
    </div>`;
  const sample = { kind: "invoice", status: "sent", number: `${b.invoicePrefix || "INV"}-${new Date().getFullYear()}-0001`, issueDate: today(), dueDate: addDays(today(), 14), terms: "net14", clientName: "Kofi Mensah", clientCompany: "Bright Future School", email: "kofi@example.com", items: [{ description: "Business website", details: "Up to 12 pages, admin dashboard, SEO", qty: 1, rate: 9500 }, { description: "Branded mugs", qty: 50, unit: "pcs", rate: 45 }], showPayment: true };
  const form = $("#bz-form");
  const read = () => { const v = readFields(BIZ_FIELDS, form); const { momo, bankName, branch, accountName, accountNumber, paystackLink, ...rest } = v; return { ...rest, payment: { momo, bankName, branch, accountName, accountNumber, paystackLink } }; };
  const prev = () => { const v = read(); $("#bz-preview").innerHTML = renderInvoiceDoc({ ...sample, taxMode: v.defaultTax, template: v.template, accent: v.accent, notes: v.defaultNotes, termsText: v.defaultTermsText }, v, { origin: location.origin }); };
  bindFields(form, prev); prev(); fitPreview($("#bz-preview"));
  form.addEventListener("submit", async e => {
    e.preventDefault();
    try { await fb.setDoc(fb.doc(fb.db, "settings", "invoice"), { ...read(), updatedAt: fb.serverTimestamp() }); await loadBiz(true); toast("Business details saved"); }
    catch (err) { toast(err.message, "error"); }
  });
}
