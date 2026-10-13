// Pure helpers (no DOM access) so they can run in the browser and in
// Cloudflare Pages Functions for server-side rendering.

export const esc = (v = "") => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Only allow http(s), mailto, tel, relative and hash URLs. */
export function safeUrl(url = "") {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:|\/|#|\.\/|[a-z0-9-]+\.html)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return "https://" + u;
  return "";
}

/** Normalises Firestore Timestamps, {seconds}, ISO strings and numbers to Date. */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

/** Whole years elapsed since a "YYYY-MM" / "YYYY-MM-DD" start date. Grows every year automatically. */
export function yearsSince(start, now = new Date()) {
  const d = toDate(start && String(start).length === 7 ? start + "-01" : start);
  if (!d) return 0;
  let y = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) y--;
  return Math.max(0, y);
}

export function formatDate(v, opts = { day: "numeric", month: "short", year: "numeric" }) {
  const d = toDate(v);
  return d ? d.toLocaleDateString("en-GB", opts) : "";
}

export function timeAgo(v, now = Date.now()) {
  const d = toDate(v);
  if (!d) return "just now";
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 45) return "just now";
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/** 1234 -> "1.2K" like social platforms. */
export function compact(n = 0) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  const f = (x, s) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, "") + s;
  if (n < 1e6) return f(n / 1e3, "K");
  return f(n / 1e6, "M");
}

export function wordCount(text = "") {
  return String(text).replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
}
export const readingTime = text => Math.max(1, Math.round(wordCount(text) / 225));

export function slugify(s = "") {
  return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/**
 * Understands YouTube (watch, youtu.be, shorts, live, embed), TikTok, Vimeo,
 * Facebook videos and direct video files. Returns null for unknown URLs.
 */
export function parseVideo(url = "") {
  const u = String(url || "").trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) {
    const vertical = /shorts\//i.test(u);
    return {
      provider: "youtube", id: m[1], vertical, url: u,
      embed: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&autoplay=1`,
      thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`
    };
  }
  m = u.match(/tiktok\.com\/.*\/video\/(\d+)/i) || u.match(/tiktok\.com\/(?:embed\/v2|player\/v1)\/(\d+)/i);
  if (m) return { provider: "tiktok", id: m[1], vertical: true, url: u, embed: `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&rel=0`, thumb: "" };
  if (/(vm|vt)\.tiktok\.com\//i.test(u) || /tiktok\.com\/t\//i.test(u)) return { provider: "tiktok", id: "", vertical: true, url: u, embed: "", thumb: "" };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) return { provider: "vimeo", id: m[1], vertical: false, url: u, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: "" };
  if (/facebook\.com\/.*\/videos\/|fb\.watch\//i.test(u)) {
    return { provider: "facebook", id: "", vertical: false, url: u, embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false&autoplay=true`, thumb: "" };
  }
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u) || /res\.cloudinary\.com\/.+\/video\/upload\//i.test(u)) {
    return { provider: "file", id: "", vertical: false, url: u, embed: u, thumb: "" };
  }
  return null;
}

/** Adds Cloudinary on-the-fly optimisation (format, quality, width) to Cloudinary URLs. */
export function img(url = "", w = 800) {
  const u = String(url || "");
  if (!/res\.cloudinary\.com\/.+\/image\/upload\//.test(u)) return u;
  if (/\/upload\/(?:[a-z]_[^/]+,?)+\//.test(u)) return u;
  return u.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${w}/`);
}

export const initials = (name = "") => String(name).trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase() || "?";

/** Deterministic pleasant colour for avatars without photos. */
export function hueFrom(str = "") {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());

export const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999);
