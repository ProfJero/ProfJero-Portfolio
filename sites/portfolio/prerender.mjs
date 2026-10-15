// Portfolio build hook: fills the <!--ssr:*--> markers in the built HTML with the
// default content so crawlers (and visitors without JavaScript) always get real,
// readable HTML, and writes static fallbacks for the feeds. Live Firestore content
// replaces it at runtime (browser) and at the edge (Pages Functions).
import { readFile, writeFile } from "node:fs/promises";

export default async function prerender(dist) {
  const mod = p => import(new URL(`assets/js/${p}`, dist));
  const [{ homeSections, fillMarkers, faqSchema, renderPostCard, byNewest }, D, { SEED_POSTS }, { readingTime }] =
    await Promise.all([mod("render.js"), mod("defaults.js"), mod("seed-posts.js"), mod("utils.js")]);
  const posts = SEED_POSTS.map(p => ({ ...p, id: p.slug, views: 0, likes: 0, commentCount: 0, readingTime: readingTime(p.content) }));

  const home = await readFile(new URL("index.html", dist), "utf8");
  let out = fillMarkers(home, homeSections({
    settings: D.DEFAULT_SETTINGS, skills: D.DEFAULT_SKILLS, studios: D.DEFAULT_STUDIOS, projects: D.DEFAULT_PROJECTS,
    testimonials: D.DEFAULT_TESTIMONIALS, experience: D.DEFAULT_EXPERIENCE, posts, team: D.DEFAULT_TEAM
  }));
  out = out.replace(/(<script type="application\/ld\+json" id="faq-schema">)[\s\S]*?(<\/script>)/, `$1${faqSchema(D.DEFAULT_SETTINGS.faqs)}$2`);
  await writeFile(new URL("index.html", dist), out);

  const blog = await readFile(new URL("blog.html", dist), "utf8");
  await writeFile(new URL("blog.html", dist), fillMarkers(blog, { "blog-list": [...posts].sort(byNewest).map(p => renderPostCard(p)).join("") }));

  // Static fallbacks for the feeds (Pages Functions serve live versions).
  const { sitemap, rss, llms } = await import("./functions/_lib/feeds.js");
  const data = { settings: D.DEFAULT_SETTINGS, studios: D.DEFAULT_STUDIOS, projects: D.DEFAULT_PROJECTS, skills: D.DEFAULT_SKILLS, posts };
  await writeFile(new URL("sitemap.xml", dist), sitemap(posts));
  await writeFile(new URL("rss.xml", dist), rss(posts));
  await writeFile(new URL("llms.txt", dist), llms(data));
  await writeFile(new URL("llms-full.txt", dist), llms(data, true));
}
