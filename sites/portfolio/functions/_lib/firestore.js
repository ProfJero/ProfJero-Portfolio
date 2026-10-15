// Minimal Firestore REST client for Cloudflare Pages Functions. Requests are
// unauthenticated, so Firestore security rules apply exactly as for visitors.
import { firebaseConfig } from "../../../../shared/assets/js/config.js";

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const KEY = `key=${firebaseConfig.apiKey}`;

function decode(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  return null;
}
const decodeFields = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));
const docId = name => decodeURIComponent(name.split("/").pop());

async function fetchJson(url, init) {
  // The Referer lets this work even if the API key is restricted to your site's domains.
  const headers = { referer: "https://profjero.pages.dev/", ...(init?.headers || {}) };
  const res = await fetch(url, { ...init, headers, cf: { cacheTtl: 0 } });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  return res.json();
}

export async function getDoc(path) {
  const j = await fetchJson(`${BASE}/${path}?${KEY}`);
  return j?.fields ? { id: docId(j.name), ...decodeFields(j.fields) } : null;
}

export async function listDocs(collection) {
  const out = [];
  let token = "";
  do {
    const j = await fetchJson(`${BASE}/${collection}?pageSize=300&${KEY}${token ? `&pageToken=${token}` : ""}`);
    if (!j) break;
    (j.documents || []).forEach(d => out.push({ id: docId(d.name), ...decodeFields(d.fields || {}) }));
    token = j.nextPageToken || "";
  } while (token && out.length < 2000);
  return out;
}

export async function publishedPosts() {
  const j = await fetchJson(`${BASE}:runQuery?${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "posts" }], where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } } } })
  });
  return (j || []).filter(r => r.document).map(r => ({ id: docId(r.document.name), ...decodeFields(r.document.fields || {}) }));
}

/** Runs fn with a short edge cache so Firestore is read at most once per TTL per colo. */
export async function cached(context, key, ttl, fn) {
  const cache = caches.default;
  const req = new Request(`https://cache.profjero.internal/${key}`);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const value = await fn();
  context.waitUntil(cache.put(req, new Response(JSON.stringify(value), { headers: { "cache-control": `public, max-age=${ttl}` } })));
  return value;
}
