# ProfJero — Portfolio of Benjamin Amoako

Live site: **https://profjero.pages.dev** · Admin: **https://profjero.pages.dev/admin/**

A full-stack developer portfolio with a blog, live project demos, an admin dashboard and a shared database for ProfJero Hub.

- **Frontend:** hand-built HTML, CSS and JavaScript ES modules. There is no build step. Light and dark themes are included and it is designed mobile-first.
- **Database:** Firebase Firestore, protected by [security rules](firestore.rules) that have 52 automated tests.
- **Media:** Cloudinary, with uploads straight from the admin dashboard.
- **Edge:** Cloudflare Pages Functions handle:
  - server-side rendering of the homepage and articles, for SEO and AI crawlers
  - a live `sitemap.xml`, `rss.xml`, `llms.txt` and `llms-full.txt`

| Path | What it is |
|---|---|
| `index.html` | Homepage: water-ripple hero, about, skills, studios & services, process, portfolio with live demos and videos, experience, team, testimonials, pricing (GH₵/US$), latest posts, FAQ, contact. It also has a visitor Customize panel: theme colour, layout, mode, backgrounds. |
| `blog.html` → `/blog` | Article list with search, categories, tags and sorting |
| `post.html` → `/blog/<slug>` | Article page with views, likes, shares, threaded comments, table of contents and related posts |
| `admin/` | Admin dashboard: messages, posts, comments, projects, studios, skills, testimonials, experience, profile & site, media, subscribers, settings |
| `assets/js/` | Shared modules (`config`, `firebase`, `store`, `render`, `markdown`, `utils`) plus the default content in `defaults.js` and `seed-posts.js` |
| `functions/` | Cloudflare Pages Functions for SSR and feeds |
| `profile.html`, `docs.html`, `*-demo.html` | Resume page and the project documentation and demo pages |

📘 **Start here:** [ADMIN-GUIDE.md](ADMIN-GUIDE.md) covers one-time setup (rules, sign-in, Cloudinary) and everyday use.
🗄️ **Data model and ProfJero Hub integration:** [DATABASE.md](DATABASE.md)
