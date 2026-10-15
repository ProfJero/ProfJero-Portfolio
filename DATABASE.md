# Shared database: Firestore (project `jerohub-1`)

The ProfJero portfolio and **ProfJero Hub** (https://profjerohub.pages.dev) use the same Firebase project. Media files are stored on **Cloudinary**. Access rules are in [`firestore.rules`](firestore.rules).

## Collections

| Collection | Purpose | Public read | Public write |
|---|---|---|---|
| `settings/site` | Portfolio profile, hero (`heroBackground`, `heroOverlay`, `waterEffect`), about, contact, socials, process, pricing (`pricingGroups[{name, icon, plans[{name, tagline, prefix, price, priceUsd, period, delivery, featured, features[]}]}]`, `pricingNote`), team (`showTeam`, `teamTitle`, `teamIntro`), appearance (`appearance{color, layout, mode, bg, overlay, panel}`), FAQ, SEO, announcement | ✅ | ❌ |
| `settings/hub` | Hub homepage: hero, about, values, steps, FAQ, SEO | ✅ | ❌ |
| `skills/{id}` | `name, level (0–100), group, order` | ✅ | ❌ |
| `studios/{id}` | `name, tagline, description, icon, color, url, page, active, order, services[], packages[], highlights[], process[], faqs[], seo{}` | ✅ | ❌ |
| `products/{id}` | Creative Studio catalogue: `name, category, description, image, priceFrom, moq, delivery, options[], featured, active, order` | ✅ | ❌ |
| `projects/{id}` | `title, category, summary, description (md), cover, videoUrl, demoUrl, liveUrl, demoNote, repoUrl, client, year, tech[], status, featured, order` | ✅ | ❌ |
| `testimonials/{id}` | `name, role, text, avatar, rating, visible, order` | ✅ | ❌ |
| `experience/{id}` | `type (work/education), title, org, start, end, text, order` | ✅ | ❌ |
| `team/{id}` | `name, role, studio, photo, bio, visible, order, linkedin, github, x, instagram, email` | ✅ | ❌ |
| `content/{id}` | Free-form content blocks (for example Hub pages) | ✅ | ❌ |
| `posts/{slug}` | `title, slug, excerpt, content (md), cover, category, tags[], status (draft/published), featured, publishedAt, updatedAt, sites[] ("portfolio","hub"), commentsEnabled, seoTitle, seoDescription, readingTime, author{name,avatar}, views, likes, shares, commentCount` | published only | +1 views/shares; ±1 likes and commentCount, each tied to a real like or comment |
| `posts/{slug}/likes/{uid}` | One document per person who liked the post | ✅ | own document only |
| `posts/{slug}/comments/{id}` | `uid, name, photo, text, parentId, likes, pinned, isAuthor, deleted, createdAt` | ✅ | signed-in visitors (validated) |
| `posts/{slug}/comments/{id}/likes/{uid}` | Comment likes | ✅ | own document only |
| `messages/{id}` | Contact and enquiry forms: `name, email, phone, service, budget, subject, message, studio, extra{}, source ("portfolio"/"hub"), page, status, createdAt` | ❌ | create only (validated) |
| `subscribers/{email}` | Newsletter: `email, source, page, createdAt` | ❌ | create only |
| `stats/site`, `stats_daily/{YYYY-MM-DD}` | Visit counters (`visits`) | ❌ | +1 only |
| `bookings/{ref}` | Hub appointments. The id is the reference code `PJB…`. Fields: `ref, studio, service, date, time, mode, name, email, phone, company, notes, uid, status, adminNote, rescheduleRequest, createdAt` | get by reference only | create (validated, `pending`); the owner can cancel or request a new time |
| `orders/{ref}` | Product quotes and orders, with id `PJO…`. Fields: `product, quantity, options, name, email, phone, company, uid, status (requested/quoted/approved/declined/in-production/ready/delivered/cancelled), quoteAmount, quoteNote, createdAt` | get by reference only | create (validated); the owner can approve or decline a quote, or cancel |
| `users/{uid}` | Client portal profile: `name, email, phone, company, photo, notify` | owner, admins | owner |
| `clientProjects/{id}` | `title, uid, email, studio, status, progress, stages[], nextStep, files[], updates[], invoice{total, paid}` | owner (uid or verified email), admins | admins |
| `reviews/{uid}` | Client-portal testimonial: `uid, email, name, role, text (20–700), rating (1–5), studio, photo, status (pending/approved/rejected), createdAt, updatedAt`. Approving copies it to `testimonials/review-{uid}`. | owner, admins | owner with a verified email (always back to `pending`); admins set the status |
| `threads/{uid}` and `threads/{uid}/messages/{id}` | Client ↔ admin chat | owner, admins | owner (`from: "client"`), admins |
| `media/{id}` | Cloudinary upload library | admins | admins |
| `private/integrations` | Cloudinary cloud name and upload preset | admins | admins |
| `admins/{email}` | Extra admins. `profjero947@gmail.com` is always the owner. | admins | owner |

All admin screens are in the portfolio dashboard at `/admin/`, including the ProfJero Hub screens. The Hub has no separate admin.

"Owner" means the signed-in user whose `uid` matches the document, or whose **verified** email matches its `email`. Bookings and quotes made as a guest therefore appear in the portal once the client verifies the same email address.

## How the two sites share code

Both sites live in this repository (see [README](README.md)). Shared modules exist once, in `shared/assets/js/`. `config.js` holds the Firebase config and both sites' settings (`SITES.portfolio`, `SITES.hub`). `SITE` is chosen by `site.js`: the shared default says `"portfolio"`, and the Hub build replaces it with `sites/hub/public/assets/js/site.js` (`"hub"`). Everything a site writes is tagged with `SITE.id` (for example `messages.source`, `bookings.source`, `stats/{site}`), and posts are shown on a site when `posts.sites` includes its id.

Article links on the Hub point to the portfolio (`SITE.blogBase`): `https://profjero.pages.dev/blog/<slug>`. They include likes, comments and shares.

**Studio links.** Each studio's **Visit studio** button uses its `url` field, for example `https://profjerohub.pages.dev/digital-studio`. Each studio has its own page on the Hub.
