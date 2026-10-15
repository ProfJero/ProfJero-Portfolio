// ProfJero Hub — homepage, studio pages and work page. Static HTML is already
// rendered (sites/hub/pages.mjs); this hydrates it with live Firestore data.
import { $, $$, reveal, bootCommon, initCurrency, initWater, setHeroImage, initProjectModals, initWorkFilters, initContactForm, initQuotes } from "./hub-common.js";
import { loadCollection, loadPosts, DEFAULTS, mergeSettings } from "./store.js";
import * as R from "./hub-render.js";
import { byOrder, esc } from "./utils.js";
import { PRODUCT_CATEGORIES } from "./defaults.js";

const page = document.body.dataset.page;
const studioId = $("main[data-studio]")?.dataset.studio || null;
const state = { projects: DEFAULTS.projects, products: DEFAULTS.products, studios: DEFAULTS.studios };

initProjectModals(() => state.projects);
initWorkFilters();
initContactForm();
initQuotes(() => state.products);
initCurrency();

/** Replace a container's HTML only when it changed, keeping revealed content visible. */
function put(sel, html) {
  const el = $(sel);
  if (!el || el.innerHTML === html) return;
  const seen = el.querySelector(".in-view");
  el.innerHTML = html;
  if (seen) el.querySelectorAll(".reveal, .bar").forEach(x => x.classList.add("in-view"));
}
const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);

// ---------- Products: category filter + search ----------
let pcat = "*", pq = "";
function filterProducts() {
  let shown = 0;
  $$("#product-grid .product-card").forEach(c => {
    const ok = (pcat === "*" || c.dataset.pcat === pcat) && (!pq || c.dataset.search.includes(pq));
    c.classList.toggle("hide", !ok);
    if (ok) shown++;
  });
  const empty = $("#product-empty");
  if (empty) empty.hidden = shown > 0;
}
document.addEventListener("click", e => {
  const chip = e.target.closest("#product-filters .chip");
  if (!chip) return;
  $$("#product-filters .chip").forEach(c => c.classList.toggle("active", c === chip));
  pcat = chip.dataset.pcat; filterProducts();
});
$("#product-search")?.addEventListener("input", e => { pq = e.target.value.trim().toLowerCase(); filterProducts(); });

// ---------- Paint ----------
function paint({ site, hub, studios, projects, testimonials, products, posts }) {
  Object.assign(state, { studios, projects, products });
  const vis = list => list.filter(x => x.visible !== false).sort(byOrder);
  if (page === "home") {
    put("#studios-grid", R.renderStudioCards(studios));
    put("#hub-stats", R.renderHubStats(site, studios));
    if (hub.about?.length) put("#hub-about", hub.about.map(p => `<p>${esc(p)}</p>`).join(""));
    put("#values-list", R.renderValues(hub.values || []));
    put("#steps-list", R.renderSteps(hub.steps || []));
    const featured = projects.filter(p => p.featured || p.studio === "creative-studio").sort(byOrder).slice(0, 6);
    put("#work-filters", R.renderStudioFilters(featured, studios));
    put("#work-grid", R.renderProjects(featured));
    put("#product-grid", R.renderProducts(vis(products).filter(p => p.featured).slice(0, 6)));
    put("#testimonial-list", R.renderTestimonials(testimonials));
    if (posts.length) put("#latest-posts", [...posts].sort(R.byNewest).slice(0, 3).map(p => R.renderPostCard(p)).join(""));
    put("#faq-list", R.renderStudioFaqs({ faqs: hub.faqs || [] }));
    setHeroImage(hub.heroBackground, hub.heroOverlay);
    window.__pjWater = hub.waterEffect !== false;
    initWater(window.__pjWater);
  } else if (studioId) {
    const s = studios.find(x => x.id === studioId);
    if (s) {
      $$("[data-sf]").forEach(el => { const v = get(s, el.dataset.sf); if (typeof v === "string" && v) el.textContent = v; });
      put("#services-grid", R.renderServices(s));
      put("#highlights", R.renderHighlights(s));
      put("#package-grid", R.renderPackages(s));
      put("#process-list", R.renderStudioProcess(s));
      put("#faq-list", R.renderStudioFaqs(s));
      put("#other-studios", R.renderOtherStudios(studios, s.id));
      if (s.heroImage) setHeroImage(s.heroImage);
    }
    const mine = R.studioProjects(projects, studioId).sort(byOrder);
    $("#work").hidden = !mine.length;
    put("#work-grid", R.renderProjects(mine));
    if ($("#product-grid")) {
      put("#product-filters", R.renderProductFilters(vis(products), PRODUCT_CATEGORIES));
      put("#product-grid", R.renderProducts(products));
      pcat = "*"; filterProducts();
    }
    window.__pjWater = true;
    initWater(true);
  } else if (page === "work") {
    const all = [...projects].sort(byOrder);
    put("#work-filters", R.renderStudioFilters(all, studios));
    put("#work-grid", R.renderProjects(all));
  }
  reveal();
}

// ---------- Boot ----------
const fallback = { site: mergeSettings(), hub: {}, studios: DEFAULTS.studios, projects: DEFAULTS.projects, testimonials: DEFAULTS.testimonials, products: DEFAULTS.products, posts: [] };
if (page === "home") { window.__pjWater = true; initWater(true); }
else if (studioId) initWater(true);

(async () => {
  const [{ site, hub }, studios, projects, testimonials, products, posts] = await Promise.all([
    bootCommon(), loadCollection("studios"), loadCollection("projects"), loadCollection("testimonials"),
    loadCollection("products"), page === "home" ? loadPosts() : Promise.resolve([])
  ]);
  // Live studio records may predate the rich page fields — fill gaps from defaults.
  const merged = studios.map(s => ({ ...(DEFAULTS.studios.find(d => d.id === s.id) || {}), ...s }));
  paint({ ...fallback, site, hub, studios: merged, projects, testimonials, products, posts: posts.length ? posts : [] });
})();
