// ProfJero Hub renderers (pure string functions) — used by sites/hub/pages.mjs to
// pre-render static HTML for search engines, and in the browser to show live data.
import { esc, safeUrl, img, byOrder, yearsSince } from "./utils.js";
import { renderProjects, renderProjectFilters, renderTestimonials, renderPostCard, renderFaqs, byNewest } from "./render.js";

export const studioPath = s => `/${s.page || s.id}`;
const accent = s => esc(s.color || "#0A60EE");
const visible = list => (list || []).filter(x => x.active !== false && x.visible !== false).sort(byOrder);

// ---------- Homepage ----------
export function renderStudioCards(studios = []) {
  return visible(studios).map(s => `
    <a class="studio-card reveal" href="${studioPath(s)}" style="--c:${accent(s)}">
      <span class="studio-card-icon"><i class="${esc(s.icon)}"></i></span>
      <span class="studio-card-mode">${esc(s.mode || "")}</span>
      <h3>${esc(s.name)}</h3>
      <p class="studio-card-tag">${esc(s.headline || s.tagline || "")}</p>
      <p>${esc(s.description || "")}</p>
      <ul>${(s.services || []).slice(0, 4).map(x => `<li><i class="fa-solid fa-check"></i> ${esc(x.title)}</li>`).join("")}</ul>
      <span class="studio-card-cta">Explore ${esc(s.name)} <i class="fa-solid fa-arrow-right"></i></span>
    </a>`).join("");
}

export function renderHubStats(site = {}, studios = []) {
  const stats = [
    [visible(studios).length || 4, "Specialised studios"],
    [`${yearsSince(site.careerStart)}+`, "Years of experience"],
    [`${site.projectsDone || 0}+`, "Projects delivered"],
    [`${site.happyClients || 0}+`, "Happy clients"]
  ];
  return stats.map(([v, l]) => `<div class="hub-stat reveal"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join("");
}

export function renderValues(values = []) {
  return values.map(v => `<div class="value-item reveal"><i class="${esc(v.icon)}"></i><div><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div></div>`).join("");
}

export function renderSteps(steps = []) {
  return steps.map((s, i) => `
    <li class="process-step reveal"><span class="process-num">${i + 1}</span><i class="${esc(s.icon || "fa-solid fa-circle")}"></i><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("");
}

// ---------- Studio pages ----------
export function renderServices(s) {
  const modeLabel = { remote: "Remote", "in-person": "In-person", hybrid: "Remote or in-person" };
  return (s.services || []).map(x => `
    <article class="svc-card reveal" style="--c:${accent(s)}">
      <div class="svc-top"><span class="svc-icon"><i class="${esc(x.icon || s.icon)}"></i></span>
        <div class="svc-badges">${x.mode ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(modeLabel[x.mode] || x.mode)}</span>` : ""}${x.duration ? `<span><i class="fa-regular fa-clock"></i> ${esc(x.duration)}</span>` : ""}</div></div>
      <h3>${esc(x.title)}</h3>
      <p>${esc(x.text || "")}</p>
      ${(x.features || []).length ? `<ul>${x.features.map(f => `<li><i class="fa-solid fa-check"></i> ${esc(f)}</li>`).join("")}</ul>` : ""}
      <a class="svc-link" href="/booking/?studio=${encodeURIComponent(s.id)}&service=${encodeURIComponent(x.title)}">Book this service <i class="fa-solid fa-arrow-right"></i></a>
    </article>`).join("");
}

export function renderHighlights(s) {
  return (s.highlights || []).map(h => `<div class="hl-item reveal" style="--c:${accent(s)}"><i class="${esc(h.icon)}"></i><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>`).join("");
}

export function renderStudioProcess(s) {
  return (s.process || []).map((p, i) => `<li class="process-step reveal" style="--c:${accent(s)}"><span class="process-num">${i + 1}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join("");
}

export function renderPackages(s) {
  const money = p => `<span class="p-ghs">${esc(p.price)}</span><span class="p-usd">${esc(p.priceUsd || p.price)}</span>`;
  return (s.packages || []).map(p => `
    <article class="price-card reveal${p.featured ? " featured" : ""}" style="--brand:${accent(s)}">
      ${p.featured ? '<span class="price-flag"><i class="fa-solid fa-star"></i> Most popular</span>' : ""}
      <h3>${esc(p.name)}</h3>
      ${p.tagline ? `<p class="price-tagline">${esc(p.tagline)}</p>` : ""}
      <div class="price">${p.prefix ? `<small>${esc(p.prefix)}</small>` : ""}<strong>${money(p)}</strong>${p.period && p.period !== "one-off" ? `<em>${esc(p.period)}</em>` : ""}</div>
      <ul>${(p.features || []).map(f => `<li><i class="fa-solid fa-check"></i> ${esc(f)}</li>`).join("")}</ul>
      <a class="btn ${p.featured ? "btn-primary" : "btn-outline"}" href="/booking/?studio=${encodeURIComponent(s.id)}&package=${encodeURIComponent(p.name)}">Get started <i class="fa-solid fa-arrow-right"></i></a>
    </article>`).join("");
}

export const renderStudioFaqs = s => renderFaqs(s.faqs || []);

export function renderOtherStudios(studios, current) {
  return visible(studios).filter(s => s.id !== current).map(s => `
    <a class="mini-studio reveal" href="${studioPath(s)}" style="--c:${accent(s)}"><i class="${esc(s.icon)}"></i><div><strong>${esc(s.name)}</strong><span>${esc(s.headline || s.tagline || "")}</span></div><i class="fa-solid fa-arrow-right"></i></a>`).join("");
}

// ---------- Products (Creative Studio) ----------
export function renderProductFilters(products = [], categories = []) {
  const cats = categories.length ? categories.filter(c => products.some(p => p.category === c)) : [...new Set(products.map(p => p.category))];
  return [`<button class="chip active" data-pcat="*">All <span>${products.length}</span></button>`]
    .concat(cats.map(c => `<button class="chip" data-pcat="${esc(c)}">${esc(c)} <span>${products.filter(p => p.category === c).length}</span></button>`)).join("");
}

export function renderProducts(products = []) {
  return visible(products).map(p => `
    <article class="product-card reveal" data-pcat="${esc(p.category)}" data-pid="${esc(p.id)}" data-search="${esc([p.name, p.category, p.description, ...(p.methods || [])].join(" ").toLowerCase())}">
      <div class="product-media">${p.image ? `<img src="${esc(img(p.image, 600))}" alt="${esc(p.name)} — custom branded by ProfJero Creative Studio" loading="lazy">` : `<i class="${esc(p.icon || "fa-solid fa-box")}"></i>`}
        ${p.featured ? '<span class="pill pill-featured"><i class="fa-solid fa-fire"></i> Popular</span>' : ""}</div>
      <div class="product-body">
        <span class="product-cat">${esc(p.category)}</span>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description || "")}</p>
        <div class="product-methods">${(p.methods || []).slice(0, 3).map(m => `<span>${esc(m)}</span>`).join("")}</div>
        <dl class="product-facts">
          <div><dt>From</dt><dd>${esc(p.priceFrom || "Quote")}<small> ${esc(p.unit || "")}</small></dd></div>
          <div><dt>Min. qty</dt><dd>${esc(p.minQty ?? 1)}</dd></div>
          <div><dt>Ready in</dt><dd>${esc(p.leadTime || "—")}</dd></div>
        </dl>
        <button class="btn btn-primary btn-sm btn-block" type="button" data-quote="${esc(p.id)}"><i class="fa-solid fa-file-invoice"></i> Request a quote</button>
      </div>
    </article>`).join("");
}

// ---------- Work (projects with demos) ----------
export function studioProjects(projects = [], studioId) {
  return studioId ? projects.filter(p => p.studio === studioId) : projects;
}
export { renderProjects, renderProjectFilters, renderTestimonials, renderPostCard, byNewest };

export function renderStudioFilters(projects = [], studios = []) {
  const ids = [...new Set(projects.map(p => p.studio).filter(Boolean))];
  return [`<button class="chip active" data-filter="*">All <span>${projects.length}</span></button>`]
    .concat(visible(studios).filter(s => ids.includes(s.id)).map(s => `<button class="chip" data-filter="studio:${esc(s.id)}">${esc(s.name)} <span>${projects.filter(p => p.studio === s.id).length}</span></button>`)).join("");
}

// ---------- Structured data ----------
export const HUB_ORG_ID = "https://profjerohub.pages.dev/#organization";

export function orgSchema(site = {}) {
  return {
    "@type": "Organization",
    "@id": HUB_ORG_ID,
    name: "ProfJero Hub",
    alternateName: ["ProfJero", "ProfJero Studios"],
    url: "https://profjerohub.pages.dev/",
    logo: { "@type": "ImageObject", url: "https://profjerohub.pages.dev/assets/img/brand/icon-512.png", width: 512, height: 512 },
    image: "https://profjerohub.pages.dev/assets/img/brand/og-hub.jpg",
    slogan: "Unveiling the Extraordinary",
    description: "ProfJero Hub is a group of four studios in Cape Coast, Ghana: Digital Studio (software, websites, apps), Creative Studio (product branding & design), Agro Studio (smart farming) and Nourish Studio (nutrition & wellness).",
    email: site.email || "profjero947@gmail.com",
    telephone: "+" + String(site.whatsapp || "233531207256").replace(/\D/g, ""),
    address: { "@type": "PostalAddress", addressLocality: "Cape Coast", addressRegion: "Central Region", addressCountry: "GH" },
    founder: { "@type": "Person", "@id": "https://profjero.pages.dev/#person", name: "Benjamin Amoako", alternateName: "ProfJero", url: "https://profjero.pages.dev/", image: "https://profjero.pages.dev/assets/img/people/benjamin-amoako.webp" },
    sameAs: Object.values(site.socials || {}).filter(u => /^https?:/.test(u || "")).concat(["https://profjero.pages.dev/"]),
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", telephone: "+233531207256", email: site.email || "profjero947@gmail.com", areaServed: ["GH", "Worldwide"], availableLanguage: ["English"] }]
  };
}

export function studioSchema(s, site = {}) {
  const url = `https://profjerohub.pages.dev${studioPath(s)}`;
  return {
    "@type": "ProfessionalService",
    "@id": `${url}#service`,
    name: `ProfJero ${s.name}`,
    url,
    description: s.seoDescription || s.description,
    image: s.heroImage ? new URL(s.heroImage, "https://profjerohub.pages.dev").href : "https://profjerohub.pages.dev/assets/img/brand/og-hub.jpg",
    logo: "https://profjerohub.pages.dev/assets/img/brand/icon-512.png",
    parentOrganization: { "@id": HUB_ORG_ID },
    telephone: "+233531207256",
    email: site.email || "profjero947@gmail.com",
    address: { "@type": "PostalAddress", addressLocality: "Cape Coast", addressRegion: "Central Region", addressCountry: "GH" },
    areaServed: ["Ghana", "Worldwide"],
    priceRange: (s.packages || []).length ? `${s.packages[0].price}+` : undefined,
    openingHours: "Mo-Sa 07:00-20:00",
    hasOfferCatalog: {
      "@type": "OfferCatalog", name: `${s.name} services`,
      itemListElement: (s.services || []).map(x => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: x.title, description: x.text } }))
    }
  };
}

export function faqSchemaObj(faqs = []) {
  return { "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function breadcrumbSchema(items) {
  return { "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) };
}

export const ldJson = (graph, id = "") => `<script type="application/ld+json"${id ? ` id="${id}"` : ""}>${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
