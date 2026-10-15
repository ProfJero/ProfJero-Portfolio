import { posts } from "./_lib/data.js";
import { sitemap } from "./_lib/feeds.js";
export async function onRequestGet(context) {
  return new Response(sitemap(await posts(context)), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
