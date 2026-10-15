// Admin: testimonials that clients submitted from the ProfJero Hub client portal
// (reviews/{uid}). Approving publishes a copy to testimonials/review-{uid}, which
// both websites show in their auto-sliding testimonial carousel.
import { $, fb, esc, emptyState, confirmDialog, toast } from "../core.js";
import { timeAgo, initials, hueFrom } from "/assets/js/utils.js";

let unsub = null;
export function destroy() { unsub?.(); unsub = null; }

const TABS = [["pending", "Waiting"], ["approved", "Published"], ["rejected", "Not published"], ["all", "All"]];
const STUDIOS = { "digital-studio": "Digital Studio", "creative-studio": "Creative Studio", "nourish-studio": "Nourish Studio", "agro-studio": "Agro Studio" };
const stars = n => Array.from({ length: 5 }, (_, i) => `<i class="fa-${i < n ? "solid" : "regular"} fa-star"></i>`).join("");

export async function render(view) {
  let all = [], tab = "pending";
  view.innerHTML = `
    <div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-circle-info"></i><div>Clients write these in the <a href="https://profjerohub.pages.dev/portal/#/review" target="_blank" rel="noopener">Hub client portal</a>. <b>Approve</b> publishes one to the testimonial carousel on both websites. If a client edits a published testimonial, it comes back here for approval, and the live version stays until you approve the new one. You can also edit and reorder published ones under <a href="#/testimonials">Testimonials</a>.</div></div>
    <div class="toolbar"><div class="pill-tabs" id="rv-tabs"></div></div>
    <div class="review-grid" id="rv-list"></div>`;

  const paint = () => {
    $("#rv-tabs").innerHTML = TABS.map(([k, l]) => `<button class="${tab === k ? "active" : ""}" data-tab="${k}">${l}<span>${all.filter(r => k === "all" || r.status === k).length}</span></button>`).join("");
    const list = all.filter(r => tab === "all" || r.status === tab);
    $("#rv-list").innerHTML = list.length ? list.map(r => `
      <article class="card review-card" data-id="${esc(r.id)}">
        <header>${r.photo ? `<img class="avatar" src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar avatar-fallback" style="--h:${hueFrom(r.email || r.name)}">${esc(initials(r.name))}</span>`}
          <div style="flex:1;min-width:0"><strong>${esc(r.name)}</strong><small class="muted">${esc(r.role || "")}${r.studio ? ` · ${esc(STUDIOS[r.studio] || r.studio)}` : ""}</small></div>
          <span class="status ${r.status === "approved" ? "confirmed" : r.status === "rejected" ? "cancelled" : "pending"}">${r.status === "approved" ? "published" : r.status === "rejected" ? "not published" : "waiting"}</span></header>
        <div class="stars-row">${stars(Number(r.rating) || 5)}</div>
        <blockquote>“${esc(r.text)}”</blockquote>
        <p class="muted small">${esc(r.email || "")} · ${timeAgo(r.updatedAt || r.createdAt)}</p>
        <div class="btn-row">
          ${r.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve"><i class="fa-solid fa-check"></i> Approve & publish</button>` : ""}
          ${r.status !== "rejected" ? `<button class="btn btn-ghost btn-sm" data-act="reject"><i class="fa-solid fa-eye-slash"></i> ${r.status === "approved" ? "Unpublish" : "Don't publish"}</button>` : ""}
          <button class="btn btn-ghost btn-sm danger" data-act="delete"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </article>`).join("") : emptyState("fa-regular fa-star", tab === "pending" ? "No testimonials waiting. Clients can write one from their Hub portal." : "Nothing here yet.");
  };

  view.addEventListener("click", async e => {
    const t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; return paint(); }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const r = all.find(x => x.id === b.closest("[data-id]").dataset.id); if (!r) return;
    const pub = fb.doc(fb.db, "testimonials", `review-${r.id}`);
    b.disabled = true;
    try {
      if (b.dataset.act === "approve") {
        await fb.setDoc(pub, { name: r.name, role: r.role || "", text: r.text, rating: Number(r.rating) || 5, avatar: r.photo || "", visible: true, order: 100, source: "portal", uid: r.id, studio: r.studio || "", updatedAt: fb.serverTimestamp() }, { merge: true });
        await fb.updateDoc(fb.doc(fb.db, "reviews", r.id), { status: "approved" });
        toast("Published on both websites");
      } else if (b.dataset.act === "reject") {
        await fb.setDoc(pub, { visible: false }, { merge: true });
        await fb.updateDoc(fb.doc(fb.db, "reviews", r.id), { status: "rejected" });
        toast(r.status === "approved" ? "Removed from the websites" : "Marked as not published");
      } else if (b.dataset.act === "delete" && await confirmDialog(`Delete <b>${esc(r.name)}</b>'s testimonial? It is also removed from the websites.`)) {
        await fb.deleteDoc(pub).catch(() => { });
        await fb.deleteDoc(fb.doc(fb.db, "reviews", r.id));
        toast("Deleted");
      }
    } catch (err) { toast(err.message, "error"); }
    b.disabled = false;
  });

  unsub = fb.onSnapshot(fb.collection(fb.db, "reviews"), snap => {
    all = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    if (view.isConnected) paint();
  }, err => { $("#rv-list").innerHTML = `<div class="callout warn"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`; });
}
