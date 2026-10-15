// Admin: ProfJero Hub homepage content (settings/hub).
import { $, fb, toast } from "../core.js";
import { renderFields, bindFields, readFields } from "../forms.js";
import { HUB_SETTINGS } from "/assets/js/hub-defaults.js";

const FIELDS = [
  { key: "heroEyebrow", label: "Hero eyebrow", type: "text", full: true },
  { key: "heroTitle", label: "Hero title", type: "text", full: true },
  { key: "heroIntro", label: "Hero intro", type: "textarea", full: true, rows: 3, max: 400 },
  { key: "heroBackground", label: "Hero background photo (water ripple runs on it)", type: "image", full: true },
  { key: "heroOverlay", label: "Hero overlay darkness", type: "range", full: true },
  { key: "waterEffect", label: "Water ripple effect on the Hub hero", type: "toggle", full: true },
  { key: "aboutTitle", label: "About heading", type: "text", full: true },
  { key: "about", label: "About paragraphs", type: "strings", full: true, multiline: true, itemLabel: "paragraph" },
  { key: "mission", label: "Mission", type: "textarea", full: true, rows: 2 },
  { key: "vision", label: "Vision", type: "textarea", full: true, rows: 2 },
  { key: "values", label: "Why ProfJero Hub (values)", type: "list", full: true, itemLabel: "Value", fields: [{ key: "title", label: "Title", type: "text" }, { key: "icon", label: "Icon", type: "icon" }, { key: "text", label: "Text", type: "textarea", full: true, rows: 2 }] },
  { key: "steps", label: "How it works", type: "list", full: true, itemLabel: "Step", fields: [{ key: "title", label: "Title", type: "text" }, { key: "icon", label: "Icon", type: "icon" }, { key: "text", label: "Text", type: "textarea", full: true, rows: 2 }] },
  { key: "faqs", label: "Hub FAQs", type: "list", full: true, itemLabel: "Question", fields: [{ key: "q", label: "Question", type: "text", full: true }, { key: "a", label: "Answer", type: "textarea", full: true, rows: 3 }] },
  { key: "announcement", label: "Announcement bar on the Hub (empty = hidden)", type: "text", full: true }
];

export async function render(view) {
  const snap = await fb.getDoc(fb.doc(fb.db, "settings", "hub"));
  const s = { ...HUB_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
  view.innerHTML = `
    <div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-cubes"></i><div>Content for the <a href="https://profjerohub.pages.dev/" target="_blank" rel="noopener">ProfJero Hub homepage</a>. Studios, services, packages and products are edited in <a href="#/studios">Studios</a> and <a href="#/products">Products</a>; contact details and socials come from <a href="#/profile/contact">Profile & site</a>.</div></div>
    <form class="card" id="hub-form" data-scope novalidate>${renderFields(FIELDS, s)}
      <div class="save-bar"><span class="dirty-dot"></span><span class="small muted" id="save-state">Changes go live on ProfJero Hub immediately.</span><span class="spacer"></span>
        <a class="btn btn-ghost btn-sm" href="https://profjerohub.pages.dev/" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> View Hub</a>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button></div>
    </form>`;
  const form = $("#hub-form");
  bindFields(form, () => form.classList.add("is-dirty"));
  form.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await fb.setDoc(fb.doc(fb.db, "settings", "hub"), { ...readFields(FIELDS, form), updatedAt: fb.serverTimestamp() }, { merge: true });
      form.classList.remove("is-dirty"); $("#save-state").textContent = `Saved at ${new Date().toLocaleTimeString()} — live on the Hub.`; toast("Hub updated");
    } catch (err) { toast(err.message, "error"); }
  });
}
