# ProfJero: portfolio + ProfJero Hub (one repo, one dashboard)

| Site | Live URL | Source |
|---|---|---|
| Portfolio of Benjamin Amoako, plus the **admin dashboard for both sites** | https://profjero.pages.dev · admin: https://profjero.pages.dev/admin/ | `sites/portfolio/` |
| ProfJero Hub: four studios, booking, branded products and the client portal | https://profjerohub.pages.dev | `sites/hub/` |

Both sites share one codebase, one Firestore database (`jerohub-1`), one Cloudinary account and one admin dashboard. Each shared file exists **once**, in `shared/`, and a small build script assembles each site for its own Cloudflare Pages project.

```
shared/                    used by BOTH sites (one copy)
  assets/js/               config, firebase, store, render, ui, utils, markdown, appearance, ripples,
                           defaults, studio-content, hub-defaults, seed-posts, site.js (default: portfolio),
                           chat-kit (WhatsApp-style chat used by admin + portal), invoice-doc (invoice layout + totals)
  assets/css/              main.css design system, chat.css, invoice.css
  assets/vendor/           self-hosted Font Awesome 6.5.1
  assets/img/              logo, photos, project and blog images
  favicon.ico, google…html (Search Console verification)
sites/portfolio/
  public/                  portfolio pages, admin/ dashboard, home/blog/post JS, _headers, _redirects …
  functions/               Cloudflare Pages Functions (SSR, sitemap, rss, llms.txt)
  prerender.mjs            build hook: pre-renders HTML and feed fallbacks
sites/hub/
  public/                  Hub-only JS (hub, booking, portal …), hub.css, site.js (= "hub"), _headers …
  pages.mjs                build hook: generates every Hub page with SEO markup
scripts/build.mjs          node scripts/build.mjs portfolio | hub | all  →  sites/<site>/dist
firestore.rules, tests/    security rules for the shared database (141 tests)
```

**How a build works:** every JS module is first syntax-checked (`node --check`), so a typo fails the build instead of breaking the live site. `shared/` is copied, then `sites/<site>/public/` is laid on top (a site's own file wins, e.g. `site.js`), then that site's build hook runs. Finally every local `.js`/`.css` URL is stamped with `?v=<content hash>`, so visitors' browsers never mix files from two deployments. The output is `sites/<site>/dist/`, which is git-ignored and never edited by hand.

**Installable apps (PWA):** the admin (`/admin/`) and the client portal (`/portal/`) each have their own manifest and icons. Both use one shared service worker, `shared/assets/js/pwa-sw.js`, registered with that app's scope.

## Deploying (Cloudflare Pages)

Both Pages projects connect to **this repository** and differ only in their folder:

| Setting | `profjero` project | `profjerohub` project |
|---|---|---|
| Production branch | `main` | `main` |
| Framework preset | None | None |
| Build command | `node ../../scripts/build.mjs portfolio` | `node ../../scripts/build.mjs hub` |
| Build output directory | `dist` | `dist` |
| Root directory (advanced) | `sites/portfolio` | `sites/hub` |

Optional: under **Build watch paths**, include `shared/*`, `scripts/*` and that site's own `sites/<site>/*` so each site only rebuilds when something it uses changes.

## AI chat backend (Cloudflare Workers, not Firebase Functions)

The visitor chat calls `workers/chat-api/`, which uses the Cloudflare Workers AI binding and returns a business-grounded answer. Firestore continues to store conversations. After deploying the Worker, set `CHAT_API_URL` in `shared/assets/js/config.js` to the full deployed URL ending in `/api/chat`; the same setting is used by the Portfolio and Hub. Until that URL is set and the Worker is deployed with its `AI` binding, the chat simply waits for a team reply, and clients can tap **Talk to a person**. Automated replies appear as **ProfJero Assistant** (stored with `from: "ai"`, `name: "ProfJero AI"`, which the rules check). Chat text supports light formatting markers (`**bold**`, `_italic_`, `__underline__`, `~~strike~~`, `[color=red]…[/color]`, lists), rendered safely by `shared/assets/js/chat-format.js`.

```bash
cd workers/chat-api
npx wrangler login
npx wrangler deploy
```

See [`workers/chat-api/README.md`](workers/chat-api/README.md) for setup, CORS and troubleshooting.

## Local development

```bash
npm install
npm run emulators        # Firestore + Auth emulators (needs Java)
npm run dev:portfolio    # build + http://localhost:8788  (add ?emulator=1 to use the emulators)
npm run dev:hub          # build + http://localhost:8789
npm run build            # build both sites
npm run test:rules       # security-rule tests
```

📘 **Setup and everyday use:** [ADMIN-GUIDE.md](ADMIN-GUIDE.md) · 🗄️ **Data model:** [DATABASE.md](DATABASE.md)
