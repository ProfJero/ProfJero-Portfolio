// Loads site data from Firestore with bundled defaults as a fallback.
import { getDoc, listDocs, publishedPosts, cached } from "./firestore.js";
import { DEFAULT_SKILLS, DEFAULT_STUDIOS, DEFAULT_PROJECTS, DEFAULT_TESTIMONIALS, DEFAULT_EXPERIENCE, DEFAULT_SETTINGS, DEFAULT_TEAM } from "../../../../shared/assets/js/defaults.js";
import { SEED_POSTS } from "../../../../shared/assets/js/seed-posts.js";
import { readingTime } from "../../../../shared/assets/js/utils.js";

const TTL = 120; // seconds

export function normalize(p) {
  return { views: 0, likes: 0, shares: 0, commentCount: 0, tags: [], ...p, slug: p.slug || p.id, id: p.id || p.slug, readingTime: p.readingTime || readingTime(p.content || "") };
}
export const seed = () => SEED_POSTS.map(p => normalize({ ...p, id: p.slug, _seed: true }));

export async function settings(ctx) {
  try {
    const s = await cached(ctx, "settings", TTL, () => getDoc("settings/site"));
    const out = { ...DEFAULT_SETTINGS, ...(s || {}), socials: { ...DEFAULT_SETTINGS.socials, ...(s?.socials || {}) }, seo: { ...DEFAULT_SETTINGS.seo, ...(s?.seo || {}) }, appearance: { ...DEFAULT_SETTINGS.appearance, ...(s?.appearance || {}) } };
    if (!Array.isArray(s?.pricingGroups) || !s.pricingGroups.length) out.pricingGroups = DEFAULT_SETTINGS.pricingGroups;
    return out;
  } catch { return DEFAULT_SETTINGS; }
}

const defaults = { skills: DEFAULT_SKILLS, studios: DEFAULT_STUDIOS, projects: DEFAULT_PROJECTS, testimonials: DEFAULT_TESTIMONIALS, experience: DEFAULT_EXPERIENCE, team: DEFAULT_TEAM };
export async function collection(ctx, name) {
  try {
    const list = await cached(ctx, "col-" + name, TTL, () => listDocs(name));
    return list.length ? list : defaults[name];
  } catch { return defaults[name]; }
}

export async function posts(ctx) {
  try {
    const list = await cached(ctx, "posts", TTL, () => publishedPosts());
    const mine = list.filter(p => !p.sites || p.sites.includes("portfolio")).map(normalize);
    return mine.length ? mine : seed();
  } catch { return seed(); }
}
