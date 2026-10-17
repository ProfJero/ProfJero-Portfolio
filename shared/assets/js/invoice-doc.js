// Invoice & quotation documents: totals maths and the printable A4 layout.
// Used by the admin (editor preview + detail), the client portal and the public
// "view invoice" page, so every copy looks identical.
//
// Ghana tax (VAT Act 2025, Act 1151, from 1 January 2026): VAT 15%, NHIL 2.5% and
// GETFund 2.5% are all charged on the same taxable value (no more compounding, and
// the COVID-19 levy is abolished) → 20% on top. Rates are stored on each invoice so
// old invoices keep showing what was charged at the time.
import { esc, safeUrl } from "./utils.js";

/** Business details used until the admin saves their own (Invoices → Business details). */
export const INVOICE_DEFAULTS = {
  businessName: "ProfJero", address: "Cape Coast, Central Region, Ghana", phone: "+233 53 120 7256", email: "profjero947@gmail.com", website: "profjero.pages.dev",
  tin: "", vatNumber: "", defaultTax: "none", accent: "#0A60EE", template: "modern", invoicePrefix: "INV", quotePrefix: "QT",
  defaultTerms: "net14", defaultNotes: "Thank you for choosing ProfJero. We appreciate your business!",
  defaultTermsText: "50% deposit is required to start work; the balance is due on delivery. Prices are in Ghana cedis (GH₵).",
  payment: { momo: [{ network: "MTN Mobile Money", number: "053 120 7256", name: "Benjamin Amoako" }], bankName: "", branch: "", accountName: "", accountNumber: "", paystackLink: "" },
  signatureName: "Benjamin Amoako", signatureTitle: "Founder, ProfJero", signatureImage: "", footer: "Thank you for your business! Questions? WhatsApp +233 53 120 7256."
};

export const TAX_PRESETS = {
  none: { label: "No tax (not VAT registered)", lines: [] },
  ghana2026: { label: "Ghana VAT 2026: VAT 15% + NHIL 2.5% + GETFund 2.5%", lines: [["NHIL", 2.5], ["GETFund Levy", 2.5], ["VAT", 15]] },
  vatOnly: { label: "VAT only (15%)", lines: [["VAT", 15]] },
  custom: { label: "Custom tax rate", lines: [] }
};

export const TERMS = [["receipt", "Due on receipt", 0], ["net7", "Net 7 (7 days)", 7], ["net14", "Net 14 (14 days)", 14], ["net30", "Net 30 (30 days)", 30], ["custom", "Custom date", null]];
export const PAY_METHODS = { momo: "Mobile Money", bank: "Bank transfer", cash: "Cash", card: "Card", paystack: "Paystack", cheque: "Cheque", other: "Other" };

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const money = (n, cur = "GH₵") => `${cur} ${r2(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDay = d => d ? new Date(`${String(d).slice(0, 10)}T12:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function lineAmount(it) {
  const gross = (Number(it.qty) || 0) * (Number(it.rate) || 0);
  return r2(gross - gross * (Math.min(100, Math.max(0, Number(it.discountPct) || 0)) / 100));
}

/** Works out every number on the invoice. Pure: same input → same totals everywhere. */
export function computeTotals(inv) {
  const items = inv.items || [];
  const subtotal = r2(items.reduce((t, it) => t + lineAmount(it), 0));
  const d = inv.discount || {};
  const discount = r2(d.type === "percent" ? subtotal * Math.min(100, Math.max(0, Number(d.value) || 0)) / 100 : Math.min(subtotal, Math.max(0, Number(d.value) || 0)));
  const taxable = r2(subtotal - discount);
  // Saved invoices keep the rates they were issued with (taxLines: [{ label, rate }]).
  const lines = inv.taxMode === "custom"
    ? (Number(inv.customTaxRate) > 0 ? [{ label: inv.customTaxLabel || "Tax", rate: Number(inv.customTaxRate) }] : [])
    : (inv.taxLines || (TAX_PRESETS[inv.taxMode || "none"]?.lines || []).map(([label, rate]) => ({ label, rate })));
  const taxes = lines.map(({ label, rate }) => ({ label, rate, amount: r2(taxable * rate / 100) }));
  const taxTotal = r2(taxes.reduce((t, x) => t + x.amount, 0));
  const total = r2(taxable + taxTotal);
  const paid = r2((inv.payments || []).reduce((t, p) => t + (Number(p.amount) || 0), 0));
  return { subtotal, discount, taxable, taxes, taxTotal, total, paid, balance: r2(Math.max(0, total - paid)) };
}

/** Status shown to people: overdue is derived from the due date, never stored. */
export function displayStatus(inv, now = new Date()) {
  if (inv.kind === "quote") return inv.status;
  if (["draft", "void", "paid"].includes(inv.status)) return inv.status;
  const t = computeTotals(inv);
  if (t.balance <= 0 && t.total > 0) return "paid";
  if (inv.dueDate && new Date(`${inv.dueDate}T23:59`) < now) return "overdue";
  return t.paid > 0 ? "partial" : (inv.viewedAt ? "viewed" : "sent");
}
export const STATUS_LABEL = { draft: "Draft", sent: "Sent", viewed: "Viewed", partial: "Part paid", paid: "Paid", overdue: "Overdue", void: "Void", accepted: "Accepted", declined: "Declined", converted: "Converted" };

const nl2br = s => esc(s || "").replace(/\n/g, "<br>");

/** Full A4 document. `biz` = settings/invoice (your business details & payment info). */
export function renderInvoiceDoc(inv, bizIn = {}, { origin = "" } = {}) {
  const biz = { ...INVOICE_DEFAULTS, ...bizIn, payment: { ...INVOICE_DEFAULTS.payment, ...(bizIn.payment || {}) } };
  const t = computeTotals(inv);
  const quote = inv.kind === "quote";
  const st = displayStatus(inv);
  const accent = /^#[0-9a-f]{6}$/i.test(inv.accent || biz.accent || "") ? (inv.accent || biz.accent) : "#0A60EE";
  const logo = safeUrl(biz.logo || "") || `${origin}/assets/img/brand/icon-512.png`;
  const pay = biz.payment || {};
  const momo = (pay.momo || []).filter(m => m.number);
  const showPay = !quote && inv.showPayment !== false && (momo.length || pay.bankName || pay.paystackLink);
  const stamp = st === "paid" ? "PAID" : st === "void" ? "VOID" : st === "overdue" ? "OVERDUE" : st === "draft" ? "DRAFT" : "";
  return `<article class="inv-doc tpl-${esc(inv.template || biz.template || "modern")}" style="--inv-accent:${accent}">
  ${stamp ? `<div class="inv-stamp st-${st}" aria-hidden="true">${stamp}</div>` : ""}
  <header class="inv-top">
    <div class="inv-from">
      <img class="inv-logo" src="${esc(logo)}" alt="" width="56" height="56">
      <div><h2>${esc(biz.businessName || "ProfJero")}</h2>
        <p>${nl2br([biz.address, [biz.phone, biz.email].filter(Boolean).join(" · "), biz.website].filter(Boolean).join("\n"))}</p>
        ${biz.tin ? `<p><b>TIN:</b> ${esc(biz.tin)}${biz.vatNumber ? ` · <b>VAT No.:</b> ${esc(biz.vatNumber)}` : ""}</p>` : ""}</div>
    </div>
    <div class="inv-title">
      <h1>${quote ? "QUOTATION" : "INVOICE"}</h1>
      <table class="inv-meta"><tbody>
        <tr><th>${quote ? "Quote" : "Invoice"} no.</th><td>${esc(inv.number || "Draft")}</td></tr>
        <tr><th>Date</th><td>${fmtDay(inv.issueDate)}</td></tr>
        <tr><th>${quote ? "Valid until" : "Due date"}</th><td>${inv.terms === "receipt" && !quote ? "Due on receipt" : fmtDay(inv.dueDate)}</td></tr>
        ${inv.reference ? `<tr><th>Reference</th><td>${esc(inv.reference)}</td></tr>` : ""}
      </tbody></table>
    </div>
  </header>
  <section class="inv-parties">
    <div><h4>${quote ? "Prepared for" : "Bill to"}</h4>
      <p><b>${esc(inv.clientName || "")}</b>${inv.clientCompany ? `<br>${esc(inv.clientCompany)}` : ""}${inv.clientAddress ? `<br>${nl2br(inv.clientAddress)}` : ""}<br>${esc(inv.email || "")}${inv.clientPhone ? `<br>${esc(inv.clientPhone)}` : ""}${inv.clientTin ? `<br>TIN: ${esc(inv.clientTin)}` : ""}</p></div>
    <div class="inv-due-box"><span>${quote ? "Quotation total" : t.paid > 0 && t.balance > 0 ? "Balance due" : st === "paid" ? "Paid in full" : "Amount due"}</span><strong>${money(quote ? t.total : st === "paid" ? t.total : t.balance)}</strong>${!quote && inv.dueDate && st !== "paid" ? `<small>${inv.terms === "receipt" ? "Due on receipt" : `by ${fmtDay(inv.dueDate)}`}</small>` : ""}</div>
  </section>
  ${inv.subject ? `<p class="inv-subject"><b>Subject:</b> ${esc(inv.subject)}</p>` : ""}
  <table class="inv-items">
    <thead><tr><th class="c-n">#</th><th>Description</th><th class="c-q">Qty</th><th class="c-r">Rate</th><th class="c-a">Amount</th></tr></thead>
    <tbody>${(inv.items || []).map((it, i) => `<tr>
      <td class="c-n">${i + 1}</td>
      <td><b>${esc(it.description || "")}</b>${it.details ? `<small>${nl2br(it.details)}</small>` : ""}${Number(it.discountPct) ? `<small>Less ${Number(it.discountPct)}% discount</small>` : ""}</td>
      <td class="c-q">${esc(String(Number(it.qty) || 0))}${it.unit ? ` <small>${esc(it.unit)}</small>` : ""}</td>
      <td class="c-r">${money(it.rate, "")}</td>
      <td class="c-a">${money(lineAmount(it), "")}</td></tr>`).join("") || `<tr><td colspan="5" class="inv-empty">No items yet</td></tr>`}</tbody>
  </table>
  <section class="inv-bottom">
    <div class="inv-notes">
      ${showPay ? `<div class="inv-pay"><h4>How to pay</h4>
        ${momo.map(m => `<p><span class="pay-ico">MoMo</span> <b>${esc(m.network || "Mobile Money")}</b>: ${esc(m.number)}${m.name ? ` (${esc(m.name)})` : ""}</p>`).join("")}
        ${pay.bankName ? `<p><span class="pay-ico">Bank</span> <b>${esc(pay.bankName)}</b>${pay.branch ? `, ${esc(pay.branch)}` : ""}<br>${esc(pay.accountName || "")} · ${esc(pay.accountNumber || "")}</p>` : ""}
        ${pay.paystackLink ? `<p><span class="pay-ico">Card</span> Pay online: <a href="${esc(safeUrl(pay.paystackLink))}">${esc(pay.paystackLink.replace(/^https?:\/\//, ""))}</a></p>` : ""}
        <p class="pay-ref">Please use <b>${esc(inv.number || "the invoice number")}</b> as your payment reference.</p></div>` : ""}
      ${inv.notes ? `<div><h4>Notes</h4><p>${nl2br(inv.notes)}</p></div>` : ""}
      ${inv.termsText ? `<div><h4>Terms &amp; conditions</h4><p>${nl2br(inv.termsText)}</p></div>` : ""}
    </div>
    <table class="inv-totals"><tbody>
      <tr><th>Subtotal</th><td>${money(t.subtotal)}</td></tr>
      ${t.discount ? `<tr><th>Discount${inv.discount?.type === "percent" ? ` (${Number(inv.discount.value)}%)` : ""}</th><td>− ${money(t.discount)}</td></tr><tr><th>Taxable amount</th><td>${money(t.taxable)}</td></tr>` : ""}
      ${t.taxes.map(x => `<tr><th>${esc(x.label)} (${x.rate}%)</th><td>${money(x.amount)}</td></tr>`).join("")}
      <tr class="inv-grand"><th>Total</th><td>${money(t.total)}</td></tr>
      ${!quote && t.paid ? `<tr><th>Paid</th><td>− ${money(t.paid)}</td></tr><tr class="inv-balance"><th>Balance due</th><td>${money(t.balance)}</td></tr>` : ""}
    </tbody></table>
  </section>
  ${(biz.signatureName || biz.signatureImage) ? `<section class="inv-sign">${biz.signatureImage ? `<img src="${esc(safeUrl(biz.signatureImage))}" alt="Signature">` : ""}<span>${esc(biz.signatureName || "")}</span><small>${esc(biz.signatureTitle || "Authorised signature")}</small></section>` : ""}
  <footer class="inv-foot">${esc(biz.footer || "Thank you for your business!")}${inv.einvoiceRef ? ` · E-VAT invoice no. ${esc(inv.einvoiceRef)}` : ""}</footer>
</article>`;
}
