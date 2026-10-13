import { posts } from "./_lib/data.js";
import { rss } from "./_lib/feeds.js";
export async function onRequestGet(context) {
  return new Response(rss(await posts(context)), { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
