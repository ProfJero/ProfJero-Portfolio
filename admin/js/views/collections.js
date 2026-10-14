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
      { key: "category", label: "Category (filter tab)", type: "text", placeholder: "Web Apps, Dashboards, Business Systems…" },
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
    intro: "Studios power the Services section. Each studio has a <b>Visit studio</b> button linking to its page on ProfJero Hub, and its services fill the contact form's service list.",
    fields: [
      { key: "name", label: "Studio name", type: "text", required: true },
      { key: "tagline", label: "Tagline", type: "text" },
      { key: "description", label: "Description", type: "textarea", full: true, rows: 2 },
      { key: "url", label: "Studio link (ProfJero Hub page)", type: "url", full: true, help: "Where “Visit studio” goes, e.g. https://profjerohub.pages.dev/#digital-studio" },
      { key: "icon", label: "Icon (Font Awesome class)", type: "icon", help: 'Browse icons at <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noopener">fontawesome.com</a>' },
      { key: "color", label: "Accent colour", type: "color" },
      { key: "active", label: "Visible on website", type: "toggle", default: true },
      { key: "services", label: "Services", type: "list", full: true, itemLabel: "Service", fields: [
        { key: "title", label: "Service", type: "text", full: true },
        { key: "text", label: "Description", type: "textarea", full: true, rows: 2 }
      ] }
    ],
    card: s => `<div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0"><span class="icon-preview" style="background:${esc(s.color)};color:#fff"><i class="${esc(s.icon)}"></i></span>
      <div class="grow"><div class="title">${esc(s.name)} ${s.active === false ? '<span class="status">Hidden</span>' : ""}</div><div class="sub">${(s.services || []).length} services · ${esc(s.url || "no link")}</div></div></div>`
  },
  skills: {
    singular: "skill", idFrom: "name",
    intro: "Skills are grouped into cards on the website. Use the groups <b>Frontend</b>, <b>Backend</b>, <b>Databases & Cloud</b> and <b>Tools & Design</b> (or create your own).",
    fields: [
      { key: "name", label: "Skill", type: "text", required: true },
      { key: "group", label: "Group", type: "text", placeholder: "Frontend, Backend, Databases & Cloud, Tools & Design" },
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
    fields: [
      { key: "type", label: "Type", type: "select", options: [["work", "Work experience"], ["education", "Education / training"]] },
      { key: "title", label: "Title / role", type: "text", required: true },
      { key: "org", label: "Organisation / school", type: "text" },
      { key: "start", label: "Start (e.g. 2023)", type: "text" },
      { key: "end", label: "End (e.g. Present)", type: "text" },
      { key: "text", label: "Description", type: "textarea", full: true, rows: 3 }
    ],
    card: e => `<div class="grow"><div class="title">${esc(e.title)} <span class="muted">· ${esc(e.org || "")}</span></div><div class="sub"><span class="status">${esc(e.type)}</span> ${esc([e.start, e.end].filter(Boolean).join(" — "))}</div></div>`
  }
};

export async function render(view, { name }) {
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
      : emptyState("fa-regular fa-folder-open", `No ${cfg.singular}s in the database yet — the website is showing ${DEFAULTS[name]?.length || 0} built-in defaults.`,
        `<button class="btn btn-primary btn-sm" id="c-import">Import the ${DEFAULTS[name]?.length || 0} defaults to edit them</button>`);
  };
  paint();

  async function edit(item) {
    const isNew = !item;
    const data = item || { order: items.length + 1 };
    await openDialog({
      title: isNew ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`, size: "wide",
      body: `<form data-scope id="c-form" novalidate>${renderFields(cfg.fields, cfg.toForm ? cfg.toForm(data) : data)}</form>`,
      onOpen: body => { bindFields($("#c-form", body)); $("input, textarea", body)?.focus(); },
      actions: [
        { label: "Cancel", value: null, cls: "btn-ghost" },
        {
          label: isNew ? `Add ${cfg.singular}` : "Save changes", value: "saved", cls: "btn-primary",
          handler: async body => {
            const form = $("#c-form", body);
            if (!validate(cfg.fields, form)) return false;
            const values = readFields(cfg.fields, form);
            let id = item?.id;
            if (!id) {
              const base = slugify(values[cfg.idFrom]) || `${cfg.singular}-${Date.now()}`;
              id = base; let n = 2;
              while (items.some(x => x.id === id)) id = `${base}-${n++}`;
            }
            const doc = { ...values, order: data.order ?? items.length + 1, updatedAt: fb.serverTimestamp() };
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
