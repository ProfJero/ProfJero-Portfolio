import { $, $$, fb, toast } from "../core.js";
import { renderFields, bindFields, readFields } from "../forms.js";
import { mergeSettings } from "/assets/js/store.js";
import { yearsSince } from "/assets/js/utils.js";

const SECTIONS = [
  {
    id: "hero", title: "Hero & profile", icon: "fa-solid fa-user", desc: "The first thing visitors see.",
    fields: [
      { key: "name", label: "Full name", type: "text" },
      { key: "brand", label: "Brand name", type: "text" },
      { key: "title", label: "Professional title", type: "text", full: true },
      { key: "heroGreeting", label: "Hero greeting", type: "text", full: true },
      { key: "roles", label: "Rotating roles (typed animation)", type: "tags", full: true },
      { key: "heroIntro", label: "Intro paragraph", type: "textarea", full: true, rows: 3, max: 400 },
      { key: "available", label: "I'm available for new projects (green dot)", type: "toggle", full: true },
      { key: "availability", label: "Availability text", type: "text", full: true, placeholder: "Available for new projects" },
      { key: "heroImage", label: "Hero photo", type: "image" },
      { key: "avatar", label: "About / profile photo", type: "image", round: true },
      { key: "cvUrl", label: "CV / résumé (PDF)", type: "file", accept: "application/pdf", full: true, help: "Shows a “Download CV” button when set." }
    ]
  },
  {
    id: "stats", title: "Experience & stats", icon: "fa-solid fa-chart-simple", desc: "Experience is calculated automatically from your start date and increases every year.",
    fields: [
      { key: "careerStart", label: "Career start (month & year)", type: "month", help: '<span id="years-preview"></span>' },
      { key: "projectsDone", label: "Projects delivered", type: "number", min: 0 },
      { key: "happyClients", label: "Happy clients", type: "number", min: 0 },
      { key: "studentsTrained", label: "Students trained (0 hides it)", type: "number", min: 0 }
    ]
  },
  {
    id: "about", title: "About", icon: "fa-solid fa-address-card", desc: "Write {years} anywhere to insert your live years of experience.",
    fields: [
      { key: "aboutTitle", label: "About heading", type: "text", full: true },
      { key: "about", label: "About paragraphs", type: "strings", full: true, multiline: true, itemLabel: "paragraph" },
      { key: "education", label: "Education", type: "text" },
      { key: "languages", label: "Languages", type: "text" }
    ]
  },
  {
    id: "contact", title: "Contact & social", icon: "fa-solid fa-phone", desc: "Used across the site, footer and structured data.",
    fields: [
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "whatsapp", label: "WhatsApp number (international, digits only)", type: "text", placeholder: "233531207256" },
      { key: "location", label: "Location", type: "text" },
      { key: "hubUrl", label: "ProfJero Hub URL", type: "url", full: true }
    ],
    nested: {
      key: "socials", title: "Social links (leave empty to hide)",
      fields: ["facebook", "tiktok", "youtube", "linkedin", "github", "x", "instagram", "whatsapp"].map(k => ({ key: k, label: k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1), type: "url" }))
    }
  },
  {
    id: "process", title: "Process", icon: "fa-solid fa-route", desc: "“How I work” steps.",
    fields: [{ key: "process", label: "Steps", type: "list", full: true, itemLabel: "Step", fields: [
      { key: "title", label: "Title", type: "text" }, { key: "icon", label: "Icon", type: "icon" }, { key: "text", label: "Description", type: "textarea", full: true, rows: 2 }] }]
  },
  {
    id: "pricing", title: "Pricing", icon: "fa-solid fa-tags", desc: "Packages shown in the Pricing section.",
    fields: [{ key: "pricing", label: "Plans", type: "list", full: true, itemLabel: "Plan", fields: [
      { key: "name", label: "Plan name", type: "text" }, { key: "price", label: "Price", type: "text", placeholder: "GH₵ 3,000" },
      { key: "note", label: "Small note", type: "text", placeholder: "Starting from" }, { key: "featured", label: "Highlight as most popular", type: "toggle" },
      { key: "features", label: "Features", type: "strings", full: true, itemLabel: "feature" }] }]
  },
  {
    id: "faq", title: "FAQ", icon: "fa-solid fa-circle-question", desc: "Also published as FAQ structured data for Google & AI assistants.",
    fields: [{ key: "faqs", label: "Questions", type: "list", full: true, itemLabel: "Question", fields: [
      { key: "q", label: "Question", type: "text", full: true }, { key: "a", label: "Answer", type: "textarea", full: true, rows: 3 }] }]
  },
  {
    id: "seo", title: "SEO & sharing", icon: "fa-brands fa-google", desc: "How your homepage appears on Google, AI assistants and social media.",
    nested: {
      key: "seo", title: "",
      fields: [
        { key: "title", label: "Homepage title", type: "text", full: true, max: 70 },
        { key: "description", label: "Meta description", type: "textarea", full: true, rows: 3, max: 170 },
        { key: "keywords", label: "Keywords (comma separated)", type: "textarea", full: true, rows: 2 },
        { key: "ogImage", label: "Social share image (1200×630)", type: "image", full: true }
      ]
    },
    fields: []
  },
  {
    id: "misc", title: "Footer & announcement", icon: "fa-solid fa-bullhorn", desc: "",
    fields: [
      { key: "footerText", label: "Footer text", type: "textarea", full: true, rows: 2 },
      { key: "announcement", label: "Announcement bar (leave empty to hide)", type: "text", full: true, placeholder: "🎉 Now booking projects for next month — get a free quote!" }
    ]
  }
];

export async function render(view, { params }) {
  const snap = await fb.getDoc(fb.doc(fb.db, "settings", "site"));
  const s = mergeSettings(snap.exists() ? snap.data() : {});
  const active = params[0] || "hero";
  view.innerHTML = `
    ${snap.exists() ? "" : `<div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-circle-info"></i><div>These are the built-in defaults. Saving will store them in Firestore so the website uses your version.</div></div>`}
    <div class="toolbar"><div class="pill-tabs" id="sec-tabs">${SECTIONS.map(x => `<button type="button" data-sec="${x.id}" class="${x.id === active ? "active" : ""}"><i class="${x.icon}"></i> ${x.title}</button>`).join("")}</div></div>
    <form id="settings-form" data-scope novalidate>
      ${SECTIONS.map(x => `<section class="card" data-section="${x.id}" ${x.id === active ? "" : "hidden"}>
        <div class="card-head"><h3><i class="${x.icon}" style="color:var(--brand)"></i> ${x.title}</h3>${x.desc ? `<p>${x.desc}</p>` : ""}</div>
        ${x.fields.length ? renderFields(x.fields, s) : ""}
        ${x.nested ? `<div data-scope data-nested="${x.nested.key}" style="margin-top:${x.fields.length ? "20px" : "0"}">${x.nested.title ? `<p class="small muted" style="font-weight:700">${x.nested.title}</p>` : ""}${renderFields(x.nested.fields, s[x.nested.key])}</div>` : ""}
      </section>`).join("")}
      <div class="save-bar"><span class="dirty-dot"></span><span class="small muted" id="save-state">Changes go live on your website immediately after saving.</span><span class="spacer"></span>
        <a class="btn btn-ghost btn-sm" href="/" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> Preview site</a>
        <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save all changes</button></div>
    </form>`;

  const form = $("#settings-form");
  const yearsPreview = () => {
    const v = $('[data-field="careerStart"] input', form)?.value;
    $("#years-preview").innerHTML = v ? `→ The site currently shows <b>${yearsSince(v)} years</b> of experience. It updates automatically every year.` : "";
  };
  yearsPreview();
  bindFields(form, () => { form.classList.add("is-dirty"); yearsPreview(); });
  $("#sec-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-sec]");
    if (!b) return;
    $$("#sec-tabs button").forEach(x => x.classList.toggle("active", x === b));
    $$("[data-section]", form).forEach(x => x.hidden = x.dataset.section !== b.dataset.sec);
    history.replaceState(null, "", `#/profile/${b.dataset.sec}`);
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = {};
    for (const sec of SECTIONS) {
      const el = $(`[data-section="${sec.id}"]`, form);
      Object.assign(data, readFieldsIn(sec.fields, form, el));
      if (sec.nested) data[sec.nested.key] = { ...(s[sec.nested.key] || {}), ...readFields(sec.nested.fields, $(`[data-nested="${sec.nested.key}"]`, el)) };
    }
    data.whatsapp = String(data.whatsapp || "").replace(/\D/g, "");
    data.updatedAt = fb.serverTimestamp();
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    try {
      await fb.setDoc(fb.doc(fb.db, "settings", "site"), data, { merge: true });
      form.classList.remove("is-dirty");
      $("#save-state").textContent = `Saved at ${new Date().toLocaleTimeString()} — live now.`;
      toast("Saved! Your website is updated.");
    } catch (err) { toast("Save failed: " + err.message, "error", 6000); }
    finally { btn.disabled = false; }
  });
}

// Fields of a section live directly in the form scope (sections are not scopes themselves).
function readFieldsIn(fields, form) { return readFields(fields, form); }
