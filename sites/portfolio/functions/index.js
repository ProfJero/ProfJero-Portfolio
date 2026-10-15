// Server-side renders the homepage with live Firestore content so search
// engines and AI crawlers (which often don't run JavaScript) see current data.
import { settings, collection, posts } from "./_lib/data.js";
import { homeSections, faqSchema } from "../../../shared/assets/js/render.js";
import { yearsSince, img } from "../../../shared/assets/js/utils.js";

const IDS = {
  about: "about-body", skills: "skills-grid", "studio-tabs": "studio-tabs", "studio-panels": "studio-panels",
  process: "process-list", "project-filters": "project-filters", projects: "project-grid", "tl-work": "tl-work",
  "tl-edu": "tl-edu", testimonials: "testimonial-list", pricing: "pricing-list", posts: "latest-posts", faqs: "faq-list", team: "team-list"
};
const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);

export async function onRequestGet(context) {
  const asset = await context.env.ASSETS.fetch(context.request);
  if (!asset.ok || !(asset.headers.get("content-type") || "").includes("text/html")) return asset;
  try {
    const [s, skills, studios, projects, testimonials, experience, list, team] = await Promise.all([
      settings(context), collection(context, "skills"), collection(context, "studios"), collection(context, "projects"),
      collection(context, "testimonials"), collection(context, "experience"), posts(context), collection(context, "team")
    ]);
    const sections = homeSections({ settings: s, skills, studios, projects, testimonials, experience, posts: list, team });
    const showTeam = s.showTeam !== false && team.some(m => m.visible !== false);
    const heroStyle = [`--hero-overlay:${Math.min(1, Math.max(0, Number(s.heroOverlay ?? 78) / 100))}`]
      .concat(s.heroBackground && !/\/assets\/img\/people\/hero-bg\.webp$/.test(s.heroBackground)
        ? [`--hero-bg:url('${img(s.heroBackground, 1920)}')`, `--hero-bg-sm:url('${img(s.heroBackground, 900)}')`] : []).join(";");
    const years = String(yearsSince(s.careerStart));
    let rw = new HTMLRewriter();
    for (const [key, id] of Object.entries(IDS)) rw = rw.on(`#${id}`, { element(el) { el.setInnerContent(sections[key], { html: true }); } });
    rw = rw
      .on("[data-s]", { element(el) { const v = get(s, el.getAttribute("data-s")); if (v !== undefined && v !== null && v !== "") el.setInnerContent(String(v).replace(/\{years\}/g, years)); } })
      .on("[data-years]", { element(el) { el.setInnerContent(years); } })
      .on("#faq-schema", { element(el) { el.setInnerContent(faqSchema(s.faqs), { html: true }); } })
      .on("title", { element(el) { if (s.seo?.title) el.setInnerContent(s.seo.title); } })
      .on('meta[name="description"]', { element(el) { if (s.seo?.description) el.setAttribute("content", s.seo.description); } })
      .on('meta[name="keywords"]', { element(el) { if (s.seo?.keywords) el.setAttribute("content", s.seo.keywords); } })
      .on("#home", { element(el) { el.setAttribute("style", heroStyle); } })
      .on("#team", { element(el) { if (!showTeam) el.setAttribute("hidden", ""); } })
      .on("#about-img", { element(el) { if (s.avatar) el.setAttribute("src", img(s.avatar, 700)); } });
    const res = rw.transform(asset);
    const headers = new Headers(res.headers);
    headers.set("cache-control", "public, max-age=0, s-maxage=120, must-revalidate");
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    return asset;
  }
}
