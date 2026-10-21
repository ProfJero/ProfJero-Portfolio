// Generic CRUD screens for the portfolio's content collections.
import { $, $$, fb, esc, emptyState, confirmDialog, toast, openDialog } from "../core.js";
import { renderFields, bindFields, readFields, validate } from "../forms.js";
import { slugify, img, parseVideo, byOrder } from "/assets/js/utils.js";
import { DEFAULTS } from "/assets/js/store.js";
import { projectCover } from "/assets/js/render.js";

const CONFIG = {
  projects: {
    singular: "project", idFrom: "title",
    intro: "Projects appear in the Portfolio section. Add a <b>live demo URL</b> to let visitors try the system inside your site, and a <b>YouTube or TikTok link</b> to show a video walkthrough.",
    fields: [
      { key: "title", label: "Project name", type: "text", required: true, max: 80 },
      { key: "category", label: "Categories (comma-separated)", type: "text", placeholder: "Web Apps, E-commerce, Dashboards", help: "Enter one or more categories separated by commas. A project can appear under every matching filter." },
      { key: "studio", label: "Studio (ProfJero Hub)", type: "select", options: [["digital-studio", "Digital Studio"], ["creative-studio", "Creative Studio"], ["agro-studio", "Agro Studio"], ["nourish-studio", "Nourish Studio"], ["", "None"]] },
      { key: "summary", label: "Short summary (card)", type: "textarea", full: true, rows: 2, max: 200 },
      { key: "description", label: "Full description (Markdown — shown in Details)", type: "markdown", full: true, rows: 7, help: "Use - for bullet lists of features." },
      { key: "cover", label: "Cover / screenshot", type: "image", full: true, help: "Leave empty to use an automatic live screenshot of the site (or the video thumbnail)." },
      { key: "videoUrl", label: "Demo video (YouTube or TikTok)", type: "video", full: true },
      { key: "demoUrl", label: "Live demo URL (opens inside your site)", type: "url", placeholder: "https://…" },
      { key: "liveUrl", label: "Live website URL", type: "url", placeholder: "https://…" },
      { key: "demoNote", label: "Demo note / login credentials", type: "text", full: true, placeholder: "e.g. Login: demo@demo.com / demo123" },
      { key: "repoUrl", label: "Source code URL (optional)", type: "url" },
      { key: "client", label: "Client", type: "text" },
      { key: "year", label: "Year", type: "number", min: 2000 },
      { key: "tech", label: "Technologies", type: "tags", full: true },
      { key: "status", label: "Status", type: "select", options: [["live", "Live"], ["in-progress", "In progress"], ["delivered", "Delivered"], ["concept", "Concept"]] },
      { key: "featured", label: "Featured", type: "toggle" }
    ],
    card: p => {
      const cover = projectCover(p, 400);
      const v = parseVideo(p.videoUrl);
      return `<div style="display:flex;gap:14px;align-items:center;min-width:0;flex:1">
        ${cover ? `<img class="thumb" style="width:96px;height:60px" src="${esc(cover)}" alt="" onerror="this.style.visibility='hidden'">` : `<span class="thumb" style="width:96px;height:60px"></span>`}
        <div class="grow" style="min-width:0"><div class="title">${esc(p.title)} ${p.featured ? '<i class="fa-solid fa-star" style="color:var(--amber)"></i>' : ""}</div>
        <div class="sub">${esc(p.category || "")} · <span class="status ${esc(p.status)}">${esc(p.status || "")}</span> ${p.demoUrl ? '· <i class="fa-solid fa-display"></i> demo' : ""} ${v ? `· <i class="fa-brands fa-${v.provider === "tiktok" ? "tiktok" : "youtube"}"></i> video` : ""}</div></div></div>`;
    }
  },
  studios: {
    singular: "studio", idFrom: "name",
    toForm: s => ({ ...(DEFAULTS.studios.find(d => d.id === s.id) || {}), ...s }),   // older records lack the Hub page fields
    intro: "Studios power the Services section of your portfolio <b>and</b> each studio page on ProfJero Hub (services, packages, FAQs, SEO). Booking options come from the services and packages here.",
    fields: [
      { key: "name", label: "Studio name", type: "text", required: true },
      { key: "tagline", label: "Short tagline", type: "text" },
      { key: "headline", label: "Page headline (Hub)", type: "text", full: true },
      { key: "intro", label: "Hero intro (Hub)", type: "textarea", full: true, rows: 3 },
      { key: "description", label: "Short description", type: "textarea", full: true, rows: 2 },
      { key: "mode", label: "Delivery mode", type: "select", options: ["Mostly remote", "Hybrid", "Mostly in-person"] },
      { key: "url", label: "Studio page link", type: "url", help: "e.g. https://profjerohub.pages.dev/creative-studio" },
      { key: "icon", label: "Icon (Font Awesome class)", type: "icon", help: 'Browse icons at <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noopener">fontawesome.com</a>' },
      { key: "color", label: "Accent colour", type: "color" },
      { key: "heroImage", label: "Hub page hero photo (optional)", type: "image", full: true, help: "With a photo, the studio hero gets the water ripple effect." },
      { key: "active", label: "Visible on websites", type: "toggle", default: true },
      { key: "services", label: "Services", type: "list", full: true, itemLabel: "Service", fields: [
        { key: "title", label: "Service", type: "text" }, { key: "icon", label: "Icon", type: "icon" },
        { key: "text", label: "Description", type: "textarea", full: true, rows: 2 },
        { key: "duration", label: "Typical duration", type: "text", placeholder: "2–4 weeks" },
        { key: "mode", label: "Delivery", type: "select", options: [["remote", "Remote"], ["hybrid", "Hybrid"], ["in-person", "In-person"]] },
        { key: "features", label: "Key features", type: "strings", full: true, itemLabel: "feature" }
      ] },
      { key: "packages", label: "Packages (pricing on the Hub studio page)", type: "list", full: true, itemLabel: "Package", fields: [
        { key: "name", label: "Name", type: "text" }, { key: "tagline", label: "Tagline", type: "text" },
        { key: "prefix", label: "Prefix", type: "text", placeholder: "From" }, { key: "period", label: "Period", type: "text", placeholder: "one-off, /month" },
        { key: "price", label: "Price (GH₵)", type: "text", placeholder: "GH₵ 4,500 or just 4500" },
        { key: "featured", label: "Most popular", type: "toggle" }, { key: "features", label: "Features", type: "strings", full: true, itemLabel: "feature" }
      ] },
      { key: "highlights", label: "Why choose us", type: "list", full: true, itemLabel: "Point", fields: [
        { key: "title", label: "Title", type: "text" }, { key: "icon", label: "Icon", type: "icon" }, { key: "text", label: "Text", type: "textarea", full: true, rows: 2 }] },
      { key: "process", label: "Process steps", type: "list", full: true, itemLabel: "Step", fields: [
        { key: "title", label: "Title", type: "text", full: true }, { key: "text", label: "Text", type: "textarea", full: true, rows: 2 }] },
      { key: "faqs", label: "FAQs", type: "list", full: true, itemLabel: "Question", fields: [
        { key: "q", label: "Question", type: "text", full: true }, { key: "a", label: "Answer", type: "textarea", full: true, rows: 3 }] },
      { key: "seoTitle", label: "SEO title", type: "text", full: true, max: 70 },
      { key: "seoDescription", label: "SEO description", type: "textarea", full: true, rows: 2, max: 170 },
      { key: "keywords", label: "SEO keywords", type: "textarea", full: true, rows: 2 }
    ],
    card: s => `<div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0"><span class="icon-preview" style="background:${esc(s.color)};color:#fff"><i class="${esc(s.icon)}"></i></span>
      <div class="grow"><div class="title">${esc(s.name)} ${s.active === false ? '<span class="status">Hidden</span>' : ""}</div><div class="sub">${(s.services || []).length} services · ${(s.packages || []).length} packages · ${(s.faqs || []).length} FAQs</div></div></div>`
  },
  products: {
    singular: "product", idFrom: "name",
    intro: "Branded products shown in the Creative Studio catalogue on ProfJero Hub. Visitors request quotes for them — you'll see requests under <a href=\"#/orders\">Quotes & orders</a>.",
    fields: [
      { key: "name", label: "Product name", type: "text", required: true },
      { key: "category", label: "Category", type: "select", options: ["Timepieces", "Tech Accessories", "Drinkware", "Apparel", "Print & Signage", "Awards & Recognition", "Frames & Décor", "Office & Stationery", "Packaging"] },
      { key: "description", label: "Description", type: "textarea", full: true, rows: 3 },
      { key: "image", label: "Product photo (optional — an icon is shown otherwise)", type: "image", full: true },
      { key: "icon", label: "Icon", type: "icon" },
      { key: "methods", label: "Branding methods", type: "tags" },
      { key: "priceFrom", label: "Current price from (GH₵)", type: "text", placeholder: "GH₵ 35" },
      { key: "originalPrice", label: "Original price before discount (optional)", type: "text", placeholder: "GH₵ 50", help: "Leave empty when not discounted." },
      { key: "salePrice", label: "Discounted price from (optional)", type: "text", placeholder: "GH₵ 35", help: "When set, the public product card shows the original price crossed out and the sale price in bold." },
      { key: "unit", label: "Unit", type: "text", placeholder: "per piece" },
      { key: "minQty", label: "Minimum quantity", type: "number", min: 1 },
      { key: "leadTime", label: "Lead time", type: "text", placeholder: "5–7 days" },
      { key: "featured", label: "Popular (shown on Hub homepage)", type: "toggle" },
      { key: "visible", label: "Visible", type: "toggle", default: true }
    ],
    card: p => `<div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">${p.image ? `<img class="thumb" src="${esc(img(p.image, 160))}" alt="">` : `<span class="icon-preview"><i class="${esc(p.icon || "fa-solid fa-box")}"></i></span>`}
      <div class="grow"><div class="title">${esc(p.name)} ${p.featured ? '<i class="fa-solid fa-fire" style="color:var(--amber)"></i>' : ""} ${p.visible === false ? '<span class="status">Hidden</span>' : ""}</div><div class="sub">${esc(p.category || "")} · from ${esc(p.priceFrom || "—")} · min ${esc(p.minQty ?? 1)}</div></div></div>`
  },
  clientProjects: {
    singular: "client project", idFrom: "title", noDefaults: true,
    intro: "Projects you're delivering for clients. Pick a client from ProfJero Hub, or type the details of someone who hasn't signed up yet. When they create a client-portal account with that email, they'll see the project's progress, milestones, files and updates. Bill them from <a href=\"#/invoices\">Invoices</a>.",
    toForm: p => ({ ...p, client: { uid: p.uid || "", name: p.clientName || "", email: p.email || "", phone: p.clientPhone || "", company: p.clientCompany || "" } }),
    beforeSave: async v => {
      const c = v.client || {};
      Object.assign(v, { email: c.email, clientName: c.name, clientPhone: c.phone || "", clientCompany: c.company || "", uid: c.uid || null });
      delete v.client;
      if (!v.uid) {
        try { const snap = await fb.getDocs(fb.query(fb.collection(fb.db, "users"), fb.where("email", "==", v.email))); v.uid = snap.docs[0]?.id || null; } catch { }
      }
      return v;
    },
    fields: [
      { key: "title", label: "Project title", type: "text", required: true, full: true },
      { key: "client", label: "Client", type: "client" },
      { key: "studio", label: "Studio", type: "select", options: [["digital-studio", "Digital Studio"], ["creative-studio", "Creative Studio"], ["agro-studio", "Agro Studio"], ["nourish-studio", "Nourish Studio"]] },
      { key: "status", label: "Status", type: "select", options: [["active", "Active"], ["on-hold", "On hold"], ["completed", "Completed"], ["cancelled", "Cancelled"]] },
      { key: "startDate", label: "Start date", type: "date", quick: [["Today", 0]] },
      { key: "dueDate", label: "Deadline", type: "date", quick: [["+1 week", 7], ["+2 weeks", 14], ["+1 month", 30]], help: "You'll get an alert before this date (set how early in Alerts)." },
      { key: "progress", label: "Progress", type: "range", full: true },
      { key: "summary", label: "Summary", type: "textarea", full: true, rows: 2 },
      { key: "nextStep", label: "Next step", type: "text", full: true },
      { key: "demoUrl", label: "Preview / demo link", type: "url", full: true },
      { key: "stages", label: "Milestones", type: "list", full: true, itemLabel: "Milestone", fields: [{ key: "name", label: "Milestone", type: "text" }, { key: "due", label: "Due", type: "date" }, { key: "done", label: "Done", type: "toggle" }] },
      { key: "files", label: "Files & deliverables", type: "list", full: true, itemLabel: "File", fields: [{ key: "name", label: "Name", type: "text" }, { key: "url", label: "File", type: "file" }] },
      { key: "updates", label: "Progress updates (newest last)", type: "list", full: true, itemLabel: "Update", fields: [{ key: "date", label: "Date", type: "date" }, { key: "text", label: "Update", type: "textarea", full: true, rows: 2 }] }
    ],
    card: p => {
      const due = p.dueDate ? new Date(`${String(p.dueDate).slice(0, 10)}T23:59`) : null, late = due && due < new Date() && !["completed", "cancelled"].includes(p.status);
      return `<div class="grow"><div class="title">${esc(p.title)} <span class="status ${esc(p.status)}">${esc(p.status || "active")}</span>${late ? ' <span class="status cancelled">overdue</span>' : ""}</div><div class="sub">${esc(p.clientName || p.email || "")}${p.uid ? ' <i class="fa-solid fa-circle-check" style="color:var(--green)" title="Has a portal account"></i>' : ' <i class="fa-solid fa-user-clock" style="color:#b07a00" title="Not registered yet"></i>'} · ${Number(p.progress) || 0}%${due ? ` · due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}${p.nextStep ? ` · ${esc(p.nextStep)}` : ""}</div></div>
      <div style="width:140px" class="bar in-view"><span style="--w:${Number(p.progress) || 0}%"></span></div>`;
    }
  },
  skills: {
    singular: "skill", idFrom: "name",
    intro: "Skills are grouped into cards on the website. Choose an existing group from the list so spellings stay identical, or type a new group name.",
    // Offer the groups already in use so "Frontend" and "Front-end" never become two cards.
    fieldsFor: items => CONFIG.skills.fields.map(f => f.key !== "group" ? f : { ...f, options: [...new Set([...items.map(i => String(i.group || "").trim()), ...DEFAULTS.skills.map(i => i.group)].filter(Boolean))].sort() }),
    beforeSave: async v => {
      // Snap near-duplicates ("frontend ", "FrontEnd") onto the existing spelling.
      const norm = x => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const known = (await fb.getDocs(fb.collection(fb.db, "skills"))).docs.map(d => d.data().group).filter(Boolean);
      v.group = known.find(g => norm(g) === norm(v.group)) || String(v.group || "").trim();
      return v;
    },
    fields: [
      { key: "name", label: "Skill", type: "text", required: true },
      { key: "group", label: "Group", type: "combo", placeholder: "Pick a group or type a new one", help: "Click the box to see existing groups." },
      { key: "level", label: "Level", type: "range", full: true }
    ],
    card: s => `<div class="grow"><div class="title">${esc(s.name)}</div><div class="sub">${esc(s.group || "")}</div></div>
      <div style="width:160px" class="bar in-view"><span style="--w:${Number(s.level) || 0}%"></span></div><b style="width:44px;text-align:right">${Number(s.level) || 0}%</b>`
  },
  testimonials: {
    singular: "testimonial", idFrom: "name",
    intro: "Client testimonials shown on the homepage.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "role", label: "Role / company", type: "text" },
      { key: "text", label: "Testimonial", type: "textarea", full: true, rows: 5, required: true },
      { key: "avatar", label: "Photo or logo", type: "image", round: true, full: true },
      { key: "rating", label: "Rating", type: "select", options: [[5, "★★★★★"], [4, "★★★★"], [3, "★★★"]] },
      { key: "visible", label: "Visible", type: "toggle", default: true }
    ],
    card: t => `<div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">${t.avatar ? `<img class="avatar" src="${esc(img(t.avatar, 100))}" alt="">` : ""}<div class="grow"><div class="title">${esc(t.name)} ${t.visible === false ? '<span class="status">Hidden</span>' : ""}</div><div class="sub">${esc(t.text)}</div></div></div>`
  },
  team: {
    singular: "team member", idFrom: "name",
    intro: "Team members appear in the <b>Team</b> section of the homepage. Turn the whole section on or off in <a href=\"#/profile/team\">Profile & site → Team</a>.",
    toForm: m => ({ ...(m.socials || {}), ...m }),
    fields: [
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "role", label: "Role", type: "text", placeholder: "e.g. Graphic & UI/UX Designer" },
      { key: "studio", label: "Studio", type: "text", placeholder: "Digital Studio, Creative Studio…" },
      { key: "visible", label: "Visible on website", type: "toggle", default: true },
      { key: "photo", label: "Photo", type: "image", full: true, help: "Square or portrait photo works best." },
      { key: "bio", label: "Short bio", type: "textarea", full: true, rows: 3, max: 220 },
      { key: "linkedin", label: "LinkedIn URL", type: "url" },
      { key: "github", label: "GitHub URL", type: "url" },
      { key: "x", label: "X (Twitter) URL", type: "url" },
      { key: "instagram", label: "Instagram URL", type: "url" },
      { key: "email", label: "Email", type: "email" }
    ],
    card: m => `<div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">${m.photo ? `<img class="avatar" src="${esc(img(m.photo, 100))}" alt="">` : ""}<div class="grow"><div class="title">${esc(m.name)} ${m.visible === false ? '<span class="status">Hidden</span>' : ""}</div><div class="sub">${esc(m.role || "")} · ${esc(m.studio || "")}</div></div></div>`
  },
  experience: {
    singular: "entry", idFrom: "title",
    intro: "Your work experience and education timeline.",
    toForm: e => ({ ...e, start: monthValue(e.start), end: monthValue(e.end) }),
    fields: [
      { key: "type", label: "Type", type: "select", options: [["work", "Work experience"], ["education", "Education / training"]] },
      { key: "title", label: "Title / role", type: "text", required: true },
      { key: "org", label: "Organisation / school", type: "text" },
      { key: "start", label: "Started", type: "month" },
      { key: "end", label: "Ended", type: "month", help: "Leave empty if you're still there (shows “Present”)." },
      { key: "text", label: "Description", type: "textarea", full: true, rows: 3 }
    ],
    card: e => `<div class="grow"><div class="title">${esc(e.title)} <span class="muted">· ${esc(e.org || "")}</span></div><div class="sub"><span class="status">${esc(e.type)}</span> ${esc([e.start, e.end].filter(Boolean).join(" — "))}</div></div>`
  }
};

// "2023" → "2023-01", "Present"/"" → "" (for <input type=month>); "2023-05" stays.
const monthValue = v => /^\d{4}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 7) : /^\d{4}$/.test(String(v || "")) ? `${v}-01` : "";

export async function render(view, { name, params = [] }) {
  const cfg = CONFIG[name];
  const col = fb.collection(fb.db, name);
  let items = (await fb.getDocs(col)).docs.map(d => ({ id: d.id, ...d.data() })).sort(byOrder);

  view.innerHTML = `
    <div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-circle-info"></i><div>${cfg.intro}</div></div>
    <div class="toolbar"><span class="muted small" id="c-count"></span><span class="spacer"></span>
      <button class="btn btn-primary btn-sm" id="c-add"><i class="fa-solid fa-plus"></i> Add ${cfg.singular}</button></div>
    <div class="card" id="c-list"></div>`;

  const paint = () => {
    $("#c-count").textContent = `${items.length} ${cfg.singular}${items.length === 1 ? "" : "s"} · use the arrows to reorder`;
    $("#c-list").innerHTML = items.length ? `<div class="list">${items.map((it, i) => `
      <div class="list-item" data-id="${esc(it.id)}">
        <span class="order-btns"><button data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}>▲</button><button data-down aria-label="Move down" ${i === items.length - 1 ? "disabled" : ""}>▼</button></span>
        ${cfg.card(it)}
        <div class="row-actions"><button class="icon-btn sm" data-edit title="Edit"><i class="fa-solid fa-pen"></i></button><button class="icon-btn sm danger" data-del title="Delete"><i class="fa-regular fa-trash-can"></i></button></div>
      </div>`).join("")}</div>`
      : cfg.noDefaults ? emptyState("fa-regular fa-folder-open", `No ${cfg.singular}s yet.`, `<button class="btn btn-primary btn-sm" onclick="document.getElementById('c-add').click()">Add the first ${cfg.singular}</button>`)
      : emptyState("fa-regular fa-folder-open", `No ${cfg.singular}s in the database yet — the website is showing ${DEFAULTS[name]?.length || 0} built-in defaults.`,
        `<button class="btn btn-primary btn-sm" id="c-import">Import the ${DEFAULTS[name]?.length || 0} defaults to edit them</button>`);
  };
  paint();

  async function edit(item) {
    const isNew = !item;
    const data = item || { order: items.length + 1 };
    const fields = cfg.fieldsFor ? cfg.fieldsFor(items) : cfg.fields;
    await openDialog({
      title: isNew ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`, size: "wide",
      body: `<form data-scope id="c-form" novalidate>${renderFields(fields, cfg.toForm ? cfg.toForm(data) : data)}</form>`,
      onOpen: body => { bindFields($("#c-form", body)); $("input, textarea", body)?.focus(); },
      actions: [
        { label: "Cancel", value: null, cls: "btn-ghost" },
        {
          label: isNew ? `Add ${cfg.singular}` : "Save changes", value: "saved", cls: "btn-primary",
          handler: async body => {
            const form = $("#c-form", body);
            if (!validate(fields, form)) return false;
            const values = readFields(fields, form);
            let id = item?.id;
            if (!id) {
              const base = slugify(values[cfg.idFrom]) || `${cfg.singular}-${Date.now()}`;
              id = base; let n = 2;
              while (items.some(x => x.id === id)) id = `${base}-${n++}`;
            }
            const vals = cfg.beforeSave ? await cfg.beforeSave({ ...values }) : values;
            if (name === "projects") { const cats = [...new Set(String(vals.category || "").split(",").map(x => x.trim()).filter(Boolean))]; vals.category = cats.join(", "); vals.categories = cats; }
            const doc = { ...vals, order: data.order ?? items.length + 1, updatedAt: fb.serverTimestamp() };
            try {
              await fb.setDoc(fb.doc(fb.db, name, id), doc, { merge: true });
            } catch (e) { toast("Save failed: " + e.message, "error", 6000); return false; }
            const i = items.findIndex(x => x.id === id);
            const full = { ...(items[i] || {}), ...doc, id };
            i >= 0 ? items.splice(i, 1, full) : items.push(full);
            paint();
            toast(isNew ? "Added — it's live on your website" : "Saved — changes are live");
          }
        }
      ]
    });
  }

  async function saveOrder() {
    const b = fb.writeBatch(fb.db);
    items.forEach((it, i) => { it.order = i + 1; b.update(fb.doc(fb.db, name, it.id), { order: i + 1 }); });
    try { await b.commit(); } catch (e) { toast(e.message, "error"); }
  }

  // Deep link (e.g. from an alert): #/clientProjects/<id> opens that item.
  if (params[0]) { const hit = items.find(x => x.id === decodeURIComponent(params[0])); if (hit) setTimeout(() => edit(hit), 0); }

  view.addEventListener("click", async e => {
    if (e.target.closest("#c-add")) return edit(null);
    if (e.target.closest("#c-import")) {
      const b = fb.writeBatch(fb.db);
      DEFAULTS[name].forEach(({ id, ...rest }, i) => b.set(fb.doc(fb.db, name, id || slugify(rest[cfg.idFrom])), { order: i + 1, ...rest }));
      await b.commit();
      items = (await fb.getDocs(col)).docs.map(d => ({ id: d.id, ...d.data() })).sort(byOrder);
      paint(); toast("Defaults imported");
      return;
    }
    const row = e.target.closest("[data-id]");
    if (!row) return;
    const i = items.findIndex(x => x.id === row.dataset.id);
    if (e.target.closest("[data-edit]")) return edit(items[i]);
    if (e.target.closest("[data-up]") && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paint(); saveOrder(); }
    if (e.target.closest("[data-down]") && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; paint(); saveOrder(); }
    if (e.target.closest("[data-del]")) {
      const label = items[i].title || items[i].name;
      if (!await confirmDialog(`Delete <b>${esc(label)}</b>?`)) return;
      await fb.deleteDoc(fb.doc(fb.db, name, items[i].id));
      items.splice(i, 1); paint(); toast("Deleted");
    }
  });
}
