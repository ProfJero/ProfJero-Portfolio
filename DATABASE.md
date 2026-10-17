# Shared database: Firestore (project `jerohub-1`)

The ProfJero portfolio and **ProfJero Hub** (https://profjerohub.pages.dev) use the same Firebase project. Media files are stored on **Cloudinary**. Access rules are in [`firestore.rules`](firestore.rules).

## Collections

| Collection | Purpose | Public read | Public write |
|---|---|---|---|
| `settings/site` | Portfolio profile, hero (`heroBackground`, `heroOverlay`, `waterEffect`), about, contact, socials, process, pricing (`pricingGroups[{name, icon, plans[{name, tagline, prefix, price, priceUsd, period, delivery, featured, features[]}]}]`, `pricingNote`), team (`showTeam`, `teamTitle`, `teamIntro`), appearance (`appearance{color, layout, mode, bg, overlay, panel}`), FAQ, SEO, announcement | ✅ | ❌ |
| `settings/hub` | Hub homepage: hero, about, values, steps, FAQ, SEO | ✅ | ❌ |
| `settings/invoice` | Business details for invoices: name, logo, address, TIN, phone, email, MoMo and bank details, default terms/notes, number prefixes, template, accent | ✅ | `invoices` permission |
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
| `users/{uid}` | Client portal profile: `name, email, phone, company, photo (URL or small JPEG data URL ≤ 200 KB), notify` | owner, admins | owner |
| `clientProjects/{id}` | `title, uid (if registered), email, clientName, clientPhone, clientCompany, studio, status (planning/in-progress/review/on-hold/completed/cancelled), progress, startDate, dueDate, stages[{name, due, done}], nextStep, files[], updates[{date, text}]`. Unregistered clients are matched later by verified email. | owner (uid or verified email), admins | `clients` permission |
| `invoices/{id}` | Invoices and quotations. The id is long and random, so the link works as a private share link. Fields: `kind (invoice/quote), number, status (draft/sent/partial/paid/void/accepted/declined/converted; overdue is derived), uid, email, clientName, clientPhone, clientCompany, clientAddress, clientTin, issueDate, dueDate, terms, subject, reference, einvoiceRef, projectId, items[{description, details, qty, unit, rate, discountPct}], discount{type, value}, taxMode, taxLines[{label, rate}], customTaxLabel, customTaxRate, notes, termsText, template, accent, showPayment, payments[{id, amount, date, method, reference, note, recordedBy}], total, paid, viewedAt, viewCount, sentAt, createdBy` | non-drafts by id; owner can list non-drafts; staff | `invoices` permission; a viewer may only bump `viewedAt`/`viewCount` |
| `counters/{kind-year}` | Next invoice/quote number, updated in a transaction | admins | `invoices` / `requests` permission |
| `reviews/{uid}` | Client-portal testimonial: `uid, email, name, role, text (20–700), rating (1–5), studio, photo, status (pending/approved/rejected), createdAt, updatedAt`. Approving copies it to `testimonials/review-{uid}`. | owner, admins | owner with a verified email (always back to `pending`); admins set the status |
| `threads/{uid}` | Chat thread per client: `uid, name, email, photo, label, lastMessage, lastAt, lastFrom, unreadAdmin, unreadClient, clientReadAt/adminReadAt (read ✓✓), clientSeenAt/adminSeenAt (delivered + online), clientTyping/adminTyping` | owner, admins with `chat` | owner (limited fields), admins |
| `threads/{uid}/messages/{id}` | `from (client/admin), text, createdAt, attachment{fileId or url, type (image/file/audio), name, size, mime, w, h, thumb ≤ 4 KB, duration}, replyTo{id, text, from}, reactions{client, admin}, editedAt, deleted`. Edit within 15 min, delete for everyone within 48 h (enforced by the rules). | owner, admins | sender |
| `threads/{uid}/files/{id}` | Chat attachment content as a data URL (≤ ~680 KB) | owner, admins | sender |
| `media/{id}` | Cloudinary upload library | admins | admins |
| `private/integrations` | Cloudinary settings, stored **encrypted** (`enc`, AES-GCM) | admins | `settings` permission |
| `private/vault` | The encryption key for `private/integrations` | admins | `settings` permission |
| `private/alerts` | Alert thresholds (`bookingSoonHours`, `invoiceDueDays`, `chatReplyMinutes`, …) | admins | `settings` permission |
| `private/chat` | Chat quick replies `[{key, text}]` | admins | `chat` permission |
| `admins/{email}` | Extra admins: `name, role (full/editor/manager/support/accounts/custom), perms{blog, portfolio, hub, requests, clients, invoices, chat, messages, media, settings}, disabled`. `profjero947@gmail.com` is always the owner (super admin). | admins | owner; an admin may change only their own `name` |

**Permissions.** Every admin-only rule checks `can(area)`: the owner can do everything; other admins need role `full` or `perms[area] == true`. The same map drives which screens they see in the dashboard.

All admin screens are in the portfolio dashboard at `/admin/`, including the ProfJero Hub screens. The Hub has no separate admin.

"Owner" means the signed-in user whose `uid` matches the document, or whose **verified** email matches its `email`. Bookings and quotes made as a guest therefore appear in the portal once the client verifies the same email address.

## How the two sites share code

Both sites live in this repository (see [README](README.md)). Shared modules exist once, in `shared/assets/js/`. `config.js` holds the Firebase config and both sites' settings (`SITES.portfolio`, `SITES.hub`). `SITE` is chosen by `site.js`: the shared default says `"portfolio"`, and the Hub build replaces it with `sites/hub/public/assets/js/site.js` (`"hub"`). Everything a site writes is tagged with `SITE.id` (for example `messages.source`, `bookings.source`, `stats/{site}`), and posts are shown on a site when `posts.sites` includes its id.

Article links on the Hub point to the portfolio (`SITE.blogBase`): `https://profjero.pages.dev/blog/<slug>`. They include likes, comments and shares.

**Studio links.** Each studio's **Visit studio** button uses its `url` field, for example `https://profjerohub.pages.dev/digital-studio`. Each studio has its own page on the Hub.
