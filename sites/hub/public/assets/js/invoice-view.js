// Public invoice / quotation page: /invoice/?id=<id>. The id is long and random, so
// the link works like a hosted invoice page. Shows the document, lets the client
// print or save a PDF, and tells the admin it was opened.
import { $, initTheme } from "./ui.js";
import { firebase } from "./store.js";
import { renderInvoiceDoc, displayStatus, computeTotals, money, fmtDay } from "./invoice-doc.js";
import { esc } from "./utils.js";

initTheme();
const root = $("#inv-root");
const id = new URLSearchParams(location.search).get("id") || "";

const fail = (title, text) => {
  root.innerHTML = `<div class="inv-msg"><i class="fa-regular fa-file-lines"></i><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="btn btn-primary" href="/portal/#/invoices">Open the client portal</a></div>`;
};

(async () => {
  if (!/^inv_[A-Za-z0-9]{20}$/.test(id)) return fail("Invoice link not valid", "Please check the link you received, or sign in to the client portal to see your invoices.");
  const fb = await firebase();
  let inv, biz = {};
  try {
    const [s, b] = await Promise.all([fb.getDoc(fb.doc(fb.db, "invoices", id)), fb.getDoc(fb.doc(fb.db, "settings", "invoice")).catch(() => null)]);
    if (!s.exists()) return fail("Invoice not found", "This invoice may have been withdrawn. Please contact us if you think this is a mistake.");
    inv = s.data();
    biz = b?.exists() ? b.data() : {};
  } catch { return fail("Invoice not available", "This invoice isn't available yet. Please contact us if you were expecting one."); }

  const quote = inv.kind === "quote", st = displayStatus(inv), t = computeTotals(inv);
  document.title = `${quote ? "Quotation" : "Invoice"} ${inv.number} — ${biz.businessName || "ProfJero"}`;
  const banner = st === "paid" ? `<div class="inv-banner ok no-print"><i class="fa-solid fa-circle-check"></i> Paid in full. Thank you!</div>`
    : st === "overdue" ? `<div class="inv-banner bad no-print"><i class="fa-solid fa-triangle-exclamation"></i> This invoice was due on ${fmtDay(inv.dueDate)}. Balance: <b>${money(t.balance)}</b></div>`
    : st === "void" ? `<div class="inv-banner no-print"><i class="fa-solid fa-ban"></i> This ${quote ? "quotation" : "invoice"} has been cancelled.</div>`
    : !quote && t.balance > 0 ? `<div class="inv-banner no-print"><i class="fa-regular fa-clock"></i> <b>${money(t.balance)}</b> due ${inv.terms === "receipt" ? "on receipt" : `by ${fmtDay(inv.dueDate)}`}. Payment details are at the bottom.</div>` : "";
  root.innerHTML = banner + renderInvoiceDoc(inv, biz, { origin: location.origin });
  $("#inv-actions").hidden = false;
  $("#inv-print").addEventListener("click", () => window.print());
  // Let the admin know it was opened (once per browser session).
  try {
    if (!sessionStorage.getItem(`pj_inv_seen_${id}`)) {
      await fb.updateDoc(fb.doc(fb.db, "invoices", id), { viewedAt: fb.serverTimestamp(), viewCount: (inv.viewCount || 0) + 1 });
      sessionStorage.setItem(`pj_inv_seen_${id}`, "1");
    }
  } catch { }
})();
