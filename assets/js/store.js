// Client-side data access with graceful fallbacks to bundled defaults, so the
// site always renders even before Firestore is populated or when offline.
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_STUDIOS, DEFAULT_PROJECTS, DEFAULT_TESTIMONIALS, DEFAULT_EXPERIENCE } from "./defaults.js";
import { SEED_POSTS } from "./seed-posts.js";
import { readingTime } from "./utils.js";

export const DEFAULTS = {
  skills: DEFAULT_SKILLS, studios: DEFAULT_STUDIOS, projects: DEFAULT_PROJECTS,
  testimonials: DEFAULT_TESTIMONIALS, experience: DEFAULT_EXPERIENCE
};

let fb; // lazily imported firebase module
export async function firebase() {
  if (!fb) fb = await import("./firebase.js");
  return fb;
}

/** Deep-merges saved settings over defaults so newly added fields always exist. */
export function mergeSettings(saved = {}) {
  const out = { ...DEFAULT_SETTINGS, ...saved };
  out.socials = { ...DEFAULT_SETTINGS.socials, ...(saved.socials || {}) };
  out.seo = { ...DEFAULT_SETTINGS.seo, ...(saved.seo || {}) };
  return out;
}

export function normalizePost(p, id) {
  const post = { views: 0, likes: 0, shares: 0, commentCount: 0, status: "published", tags: [], ...p };
  post.slug = post.slug || id;
  post.id = id || post.slug;
  post.readingTime = post.readingTime || readingTime(post.content || "");
  post.author = post.author || { name: "Benjamin Amoako (ProfJero)", avatar: "/assets/img/people/benjamin-amoako.webp" };
  return post;
}

export const seedPosts = () => SEED_POSTS.map(p => normalizePost({ ...p, _seed: true }, p.slug));

const withTimeout = (p, ms = 6000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

export async function loadSettings() {
  try {
    const { db, doc, getDoc } = await firebase();
    const snap = await withTimeout(getDoc(doc(db, "settings", "site")));
    return mergeSettings(snap.exists() ? snap.data() : {});
  } catch (e) {
    console.warn("[settings] using defaults:", e.message);
    return mergeSettings();
  }
}

export async function loadCollection(name) {
  try {
    const { db, collection, getDocs } = await firebase();
    const snap = await withTimeout(getDocs(collection(db, name)));
    if (snap.empty) return DEFAULTS[name] || [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn(`[${name}] using defaults:`, e.message);
    return DEFAULTS[name] || [];
  }
}

/** Published posts, newest first. Falls back to the bundled launch posts. */
export async function loadPosts() {
  try {
    const { db, collection, getDocs, query, where } = await firebase();
    const snap = await withTimeout(getDocs(query(collection(db, "posts"), where("status", "==", "published"))));
    if (snap.empty) return seedPosts();
    return snap.docs.map(d => normalizePost(d.data(), d.id)).filter(p => !p.sites || p.sites.includes("portfolio"));
  } catch (e) {
    console.warn("[posts] using bundled posts:", e.message);
    return seedPosts();
  }
}

export async function loadPost(slug) {
  try {
    const { db, doc, getDoc } = await firebase();
    const snap = await withTimeout(getDoc(doc(db, "posts", slug)));
    if (snap.exists()) return normalizePost(snap.data(), snap.id);
  } catch (e) {
    console.warn("[post] fallback:", e.message);
  }
  return seedPosts().find(p => p.slug === slug) || null;
}

/** Counts one visit per browser session (site-wide and per day) for the admin analytics. */
export async function trackVisit() {
  try {
    if (sessionStorage.getItem("pj_visit")) return;
    sessionStorage.setItem("pj_visit", "1");
  } catch { return; }
  try {
    const { db, doc, setDoc, increment } = await firebase();
    const day = new Date().toISOString().slice(0, 10);
    await Promise.all([
      setDoc(doc(db, "stats", "site"), { visits: increment(1) }, { merge: true }),
      setDoc(doc(db, "stats_daily", day), { visits: increment(1), date: day }, { merge: true })
    ]);
  } catch { /* stats are best-effort */ }
}
