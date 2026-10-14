// Fills the <!--ssr:*--> markers in the HTML pages with the default content so
// crawlers (and visitors without JavaScript) always get real, readable HTML.
// Live Firestore content replaces it at runtime (browser) and at the edge
// (Cloudflare Pages Functions). Run after editing defaults:  node scripts/prerender.mjs
import { readFile, writeFile } from "node:fs/promises";
import { homeSections, fillMarkers, faqSchema, renderPostCard, byNewest } from "../assets/js/render.js";
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_STUDIOS, DEFAULT_PROJECTS, DEFAULT_TESTIMONIALS, DEFAULT_EXPERIENCE, DEFAULT_TEAM } from "../assets/js/defaults.js";
import { SEED_POSTS } from "../assets/js/seed-posts.js";
import { readingTime } from "../assets/js/utils.js";

const root = new URL("../", import.meta.url);
const posts = SEED_POSTS.map(p => ({ ...p, id: p.slug, views: 0, likes: 0, commentCount: 0, readingTime: readingTime(p.content) }));

const home = await readFile(new URL("index.html", root), "utf8");
let out = fillMarkers(home, homeSections({
  settings: DEFAULT_SETTINGS, skills: DEFAULT_SKILLS, studios: DEFAULT_STUDIOS, projects: DEFAULT_PROJECTS,
  testimonials: DEFAULT_TESTIMONIALS, experience: DEFAULT_EXPERIENCE, posts, team: DEFAULT_TEAM
}));
out = out.replace(/(<script type="application\/ld\+json" id="faq-schema">)[\s\S]*?(<\/script>)/, `$1${faqSchema(DEFAULT_SETTINGS.faqs)}$2`);
await writeFile(new URL("index.html", root), out);

const blog = await readFile(new URL("blog.html", root), "utf8").catch(() => null);
if (blog) {
  const sorted = [...posts].sort(byNewest);
  await writeFile(new URL("blog.html", root), fillMarkers(blog, { "blog-list": sorted.map(p => renderPostCard(p)).join("") }));
}
console.log("Prerendered index.html" + (blog ? " and blog.html" : ""));

// Static fallbacks for feeds (live versions are served by Pages Functions).
const { sitemap, rss, llms } = await import("../functions/_lib/feeds.js");
const data = { settings: DEFAULT_SETTINGS, studios: DEFAULT_STUDIOS, projects: DEFAULT_PROJECTS, skills: DEFAULT_SKILLS, posts };
await writeFile(new URL("sitemap.xml", root), sitemap(posts));
await writeFile(new URL("rss.xml", root), rss(posts));
await writeFile(new URL("llms.txt", root), llms(data));
await writeFile(new URL("llms-full.txt", root), llms(data, true));
console.log("Wrote sitemap.xml, rss.xml, llms.txt, llms-full.txt");
