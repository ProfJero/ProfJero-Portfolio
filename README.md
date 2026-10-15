# ProfJero: portfolio + ProfJero Hub (one repo, one dashboard)

| Site | Live URL | Source |
|---|---|---|
| Portfolio of Benjamin Amoako, plus the **admin dashboard for both sites** | https://profjero.pages.dev · admin: https://profjero.pages.dev/admin/ | `sites/portfolio/` |
| ProfJero Hub: four studios, booking, branded products and the client portal | https://profjerohub.pages.dev | `sites/hub/` |

Both sites share one codebase, one Firestore database (`jerohub-1`), one Cloudinary account and one admin dashboard. Each shared file exists **once**, in `shared/`, and a small build script assembles each site for its own Cloudflare Pages project.

```
shared/                    used by BOTH sites (one copy)
  assets/js/               config, firebase, store, render, ui, utils, markdown, appearance, ripples,
                           defaults, studio-content, hub-defaults, seed-posts, site.js (default: portfolio)
  assets/css/main.css      design system
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
firestore.rules, tests/    security rules for the shared database (98 tests)
```

**How a build works:** `shared/` is copied, then `sites/<site>/public/` is laid on top (a site's own file wins, e.g. `site.js`), then that site's build hook runs. The output is `sites/<site>/dist/`, which is git-ignored and never edited by hand.

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
