// Generators for sitemap.xml, rss.xml and llms.txt. Used by Pages Functions
// (live data) and by scripts/prerender.mjs (static fallbacks).
import { SITE } from "../../assets/js/config.js";
import { toDate, yearsSince, byOrder } from "../../assets/js/utils.js";
import { markdownToText, renderMarkdown } from "../../assets/js/markdown.js";

const x = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const newest = (a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0);
const day = d => (toDate(d) || new Date()).toISOString().slice(0, 10);

export function sitemap(posts) {
  const list = [...posts].sort(newest);
  const latest = list[0] ? day(list[0].updatedAt || list[0].publishedAt) : day();
  const urls = [
    { loc: `${SITE.url}/`, lastmod: latest, priority: "1.0", freq: "weekly", images: ["/assets/img/people/benjamin-amoako.webp", "/assets/img/people/hero-bg.webp", "/assets/img/people/profjero-at-work.webp", "/assets/img/brand/icon-512.png", "/assets/img/brand/og-image.jpg", "/assets/img/team/abel-eduah.webp", "/assets/img/team/godsway-arhin.webp", "/assets/img/work/dna-brand-identity.webp", "/assets/img/work/sanfas-brand-identity.webp", "/assets/img/work/tourizto-website.webp"] },
    { loc: `${SITE.url}/blog`, lastmod: latest, priority: "0.9", freq: "daily" },
    { loc: `${SITE.url}/profile`, lastmod: "2026-10-13", priority: "0.6", freq: "monthly" },
    { loc: `${SITE.url}/docs`, lastmod: "2026-10-13", priority: "0.5", freq: "monthly" },
    { loc: `${SITE.url}/rural-tech-docs`, lastmod: "2026-10-13", priority: "0.5", freq: "monthly" },
    { loc: `${SITE.url}/live-demo`, lastmod: "2026-10-13", priority: "0.5", freq: "monthly" },
    { loc: `${SITE.url}/rth-admin-demo`, lastmod: "2026-10-13", priority: "0.5", freq: "monthly" },
    ...list.map(p => ({ loc: `${SITE.url}/blog/${encodeURIComponent(p.slug)}`, lastmod: day(p.updatedAt || p.publishedAt), priority: p.featured ? "0.9" : "0.8", freq: "monthly", image: p.cover }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => `  <url>
    <loc>${x(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>${(u.images || []).map(i => `
    <image:image><image:loc>${x(new URL(i, SITE.url).href)}</image:loc></image:image>`).join("")}${u.image ? `
    <image:image><image:loc>${x(new URL(u.image, SITE.url).href)}</image:loc></image:image>` : ""}
  </url>`).join("\n")}
</urlset>
`;
}

export function rss(posts) {
  const list = [...posts].sort(newest).slice(0, 30);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>ProfJero Blog</title>
  <link>${SITE.url}/blog</link>
  <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>
  <description>Full-stack web development, backend, AI, careers and motivation by Benjamin Amoako (ProfJero).</description>
  <language>en</language>
  <lastBuildDate>${(toDate(list[0]?.publishedAt) || new Date()).toUTCString()}</lastBuildDate>
${list.map(p => `  <item>
    <title>${x(p.title)}</title>
    <link>${SITE.url}/blog/${encodeURIComponent(p.slug)}</link>
    <guid isPermaLink="true">${SITE.url}/blog/${encodeURIComponent(p.slug)}</guid>
    <pubDate>${(toDate(p.publishedAt) || new Date()).toUTCString()}</pubDate>
    <category>${x(p.category || "")}</category>
    <description>${x(p.excerpt || "")}</description>
    <content:encoded><![CDATA[${renderMarkdown(p.content || "").html.replace(/]]>/g, "]]]]><![CDATA[>")}]]></content:encoded>
  </item>`).join("\n")}
</channel>
</rss>
`;
}

/** llms.txt — a concise, markdown summary of the site for AI assistants (llmstxt.org). */
export function llms({ settings: s, studios = [], projects = [], posts = [], skills = [] }, full = false) {
  const years = yearsSince(s.careerStart);
  const sorted = [...posts].sort(newest);
  const lines = [
    `# ProfJero — ${s.name}`,
    "",
    `> ${s.name} (also known as ProfJero / Prof Jero) is a ${s.title} based in ${s.location} with ${years}+ years of experience building websites, web applications, admin dashboards and business systems end-to-end (frontend, backend, databases, cloud). He is Co-Founder & Executive Director of Digital Bridge Initiative and Founder of ProfJero Hub.`,
    "",
    `- Website: ${SITE.url}/`,
    `- Contact: ${s.email} · ${s.phone} · WhatsApp https://wa.me/${String(s.whatsapp || "").replace(/\D/g, "")}`,
    `- Availability: ${s.available === false ? "Currently busy" : s.availability || "Available for projects"}`,
    `- ProfJero Hub: ${s.hubUrl}`,
    "",
    "## Skills",
    "",
    ...[...new Set(skills.map(k => k.group))].map(g => `- ${g}: ${skills.filter(k => k.group === g).sort(byOrder).map(k => k.name).join(", ")}`),
    "",
    "## Studios & services",
    "",
    ...studios.filter(t => t.active !== false).sort(byOrder).map(t => `- [${t.name}](${t.url || s.hubUrl}): ${t.description} Services: ${(t.services || []).map(v => v.title).join(", ")}.`),
    "",
    "## Projects (with live demos)",
    "",
    ...[...projects].sort(byOrder).map(p => `- ${p.liveUrl && /^https?:/.test(p.liveUrl) ? `[${p.title}](${p.liveUrl})` : p.title}: ${p.summary}${p.tech?.length ? ` Tech: ${p.tech.join(", ")}.` : ""}${p.videoUrl ? ` Video: ${p.videoUrl}` : ""}`),
    "",
    "## Blog",
    "",
    ...sorted.map(p => `- [${p.title}](${SITE.url}/blog/${encodeURIComponent(p.slug)}): ${p.excerpt}`),
    "",
    "## Pricing (starting from)",
    "",
    ...(s.pricingGroups || []).flatMap(g => [`### ${g.name}`, "", ...(g.plans || []).map(p => `- ${p.name}: ${[p.prefix, p.price].filter(Boolean).join(" ")}${p.priceUsd ? ` (${p.priceUsd})` : ""}${p.period && p.period !== "one-off" ? ` ${p.period}` : ""} — ${(p.features || []).join("; ")}`), ""]),
    s.pricingNote || "",
    "",
    "## FAQ",
    "",
    ...(s.faqs || []).flatMap(f => [`### ${f.q}`, "", f.a, ""]),
    "## Optional",
    "",
    `- [Full content for LLMs](${SITE.url}/llms-full.txt)`,
    `- [RSS feed](${SITE.url}/rss.xml)`,
    `- [Sitemap](${SITE.url}/sitemap.xml)`
  ];
  if (full) {
    lines.push("", "---", "", "# Full articles", "");
    sorted.forEach(p => lines.push(`## ${p.title}`, "", `URL: ${SITE.url}/blog/${encodeURIComponent(p.slug)} · Published: ${day(p.publishedAt)} · Category: ${p.category}`, "", p.content || markdownToText(p.excerpt), "", "---", ""));
  }
  return lines.join("\n") + "\n";
}
