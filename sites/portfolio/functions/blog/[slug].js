// Server-side renders blog articles at /blog/<slug> with full content, meta tags
// and BlogPosting structured data — ideal for Google and AI crawlers.
import { posts } from "../_lib/data.js";
import { postImages } from "../_lib/feeds.js";
import { renderMarkdown } from "../../../../shared/assets/js/markdown.js";
import { esc, img, formatDate, toDate, hueFrom } from "../../../../shared/assets/js/utils.js";
import { SITE } from "../../../../shared/assets/js/config.js";

export async function onRequestGet(context) {
  const slug = decodeURIComponent(context.params.slug || "");
  const url = new URL(context.request.url);
  const template = await context.env.ASSETS.fetch(new URL("/post", url));
  const all = await posts(context);
  const p = all.find(x => x.slug === slug);
  if (!p) {
    const headers = new Headers(template.headers);
    headers.set("x-robots-tag", "noindex");
    return new Response(template.body, { status: 404, headers });
  }
  const canonical = `${SITE.url}/blog/${encodeURIComponent(p.slug)}`;
  const title = `${p.seoTitle || p.title} | ProfJero Blog`;
  const desc = p.seoDescription || p.excerpt || "";
  const image = p.cover ? new URL(img(p.cover, 1200), SITE.url).href : `${SITE.url}/assets/img/brand/og-image.jpg`;
  const pub = toDate(p.publishedAt), upd = toDate(p.updatedAt) || pub;
  const { html } = renderMarkdown(p.content || "");
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting", "@id": `${canonical}#article`, headline: p.title, description: desc, url: canonical, mainEntityOfPage: canonical,
        image: [image, ...postImages(p).slice(1).map(u => new URL(img(u, 1200), SITE.url).href)],
        isPartOf: { "@type": "Blog", "@id": `${SITE.url}/blog#blog`, name: "ProfJero Blog", url: `${SITE.url}/blog` },
        datePublished: pub?.toISOString(), dateModified: upd?.toISOString(), articleSection: p.category,
        keywords: (p.tags || []).join(", "), wordCount: (p.content || "").split(/\s+/).length, inLanguage: "en",
        author: { "@type": "Person", "@id": `${SITE.url}/#person`, name: "Benjamin Amoako", alternateName: "ProfJero", url: SITE.url + "/", image: `${SITE.url}/assets/img/people/benjamin-amoako.webp`, jobTitle: "Full-Stack Developer & IT Trainer" },
        publisher: { "@type": "Organization", "@id": `${SITE.url}/#organization`, name: "ProfJero", url: SITE.url + "/", logo: { "@type": "ImageObject", url: `${SITE.url}/assets/img/brand/icon-512.png`, width: 512, height: 512 } },
        interactionStatistic: [
          { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.likes || 0 },
          { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: p.commentCount || 0 }
        ]
      },
      {
        "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url + "/" },
          { "@type": "ListItem", position: 2, name: "Blog", item: SITE.url + "/blog" },
          { "@type": "ListItem", position: 3, name: p.title, item: canonical }
        ]
      }
    ]
  }).replace(/</g, "\\u003c");

  const set = (attr, v) => ({ element(el) { el.setAttribute(attr, v); } });
  const res = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', set("content", desc))
    .on('link[rel="canonical"]', set("href", canonical))
    .on('meta[property="og:title"]', set("content", title))
    .on('meta[property="og:description"]', set("content", desc))
    .on('meta[property="og:url"]', set("content", canonical))
    .on('meta[property="og:image"]', set("content", image))
    .on('meta[name="twitter:title"]', set("content", title))
    .on('meta[name="twitter:description"]', set("content", desc))
    .on('meta[name="twitter:image"]', set("content", image))
    .on("head", { element(el) {
      el.append(`<meta property="article:published_time" content="${esc(pub?.toISOString() || "")}"><meta property="article:section" content="${esc(p.category || "")}">${(p.tags || []).map(t => `<meta property="article:tag" content="${esc(t)}">`).join("")}`, { html: true });
    } })
    .on("#article-schema", { element(el) { el.setInnerContent(schema, { html: true }); } })
    .on("#a-hero", { element(el) { el.setAttribute("style", `--h:${hueFrom(p.category || p.title)}`); if (p.cover) el.setAttribute("class", "article-hero has-cover"); } })
    .on("#a-hero-bg", { element(el) { if (p.cover) el.setInnerContent(`<img src="${esc(img(p.cover, 1600))}" alt="${esc(p.coverAlt || p.title)}" fetchpriority="high">`, { html: true }); } })
    .on("#a-title", { element(el) { el.setInnerContent(p.title); } })
    .on("#a-excerpt", { element(el) { el.setInnerContent(p.excerpt || ""); } })
    .on("#a-cat", { element(el) { el.setInnerContent(p.category || "Article"); el.setAttribute("href", `/blog?category=${encodeURIComponent(p.category || "")}`); } })
    .on("#crumb-cat", { element(el) { el.setInnerContent(p.category || "Article"); } })
    .on("#a-meta", { element(el) { el.setInnerContent(`<time datetime="${esc(pub?.toISOString() || "")}">${esc(formatDate(pub))}</time> · ${p.readingTime} min read`, { html: true }); } })
    .on("#a-body", { element(el) { el.setInnerContent(html, { html: true }); } })
    .on("#a-tags", { element(el) { el.setInnerContent((p.tags || []).map(t => `<a href="/blog?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join(""), { html: true }); } })
    .transform(template);
  const headers = new Headers(res.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, s-maxage=120, must-revalidate");
  return new Response(res.body, { status: 200, headers });
}
