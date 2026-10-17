// One service worker for both installable apps (client portal and admin), each
// registered with its own scope:  /assets/js/pwa-sw.js?app=portal&v=<build>
// It makes the app open instantly and keeps working on a flaky connection:
//  • pages: network first, falling back to the last copy (then to the app shell)
//  • versioned JS/CSS, images, fonts and the Firebase SDK: cache first
//  • everything else (Firestore, Auth, uploads): straight to the network
const params = new URL(self.location).searchParams;
const APP = params.get("app") || "app";
const VERSION = params.get("v") || "0";
const SCOPE = new URL(self.registration.scope).pathname;           // "/portal/" or "/admin/"
const CACHE = `pj-${APP}-${VERSION}`;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(SCOPE, { cache: "reload" }))).catch(() => { }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(`pj-${APP}-`) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const cacheable = url =>
  (url.origin === self.location.origin && (/^\/assets\/(img|fonts|vendor)\//.test(url.pathname) || url.searchParams.has("v"))) ||
  /^https:\/\/www\.gstatic\.com\/firebasejs\//.test(url.href) ||
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url.href);

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === self.location.origin && url.pathname.startsWith(SCOPE)) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(SCOPE, copy)); }
      return res;
    }).catch(async () => (await caches.match(SCOPE)) || new Response("<h1>You're offline</h1><p>Reconnect and try again.</p>", { headers: { "content-type": "text/html" } })));
    return;
  }

  if (cacheable(url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
