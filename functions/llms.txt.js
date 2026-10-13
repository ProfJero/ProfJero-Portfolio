import { posts, settings, collection } from "./_lib/data.js";
import { llms } from "./_lib/feeds.js";
export async function onRequestGet(context) {
  const [s, studios, projects, skills, list] = await Promise.all([settings(context), collection(context, "studios"), collection(context, "projects"), collection(context, "skills"), posts(context)]);
  return new Response(llms({ settings: s, studios, projects, skills, posts: list }, false), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=600" } });
}
