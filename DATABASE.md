# Shared database: Firestore (project `jerohub-1`)

The ProfJero portfolio and **ProfJero Hub** (https://profjerohub.pages.dev) use the same Firebase project. Media files are stored on **Cloudinary**. Access rules are in [`firestore.rules`](firestore.rules).

## Collections

| Collection | Purpose | Public read | Public write |
|---|---|---|---|
| `settings/site` | Portfolio profile, hero (`heroBackground`, `heroOverlay`, `waterEffect`), about, contact, socials, process, pricing (`pricingGroups[{name, icon, plans[{name, tagline, prefix, price, priceUsd, period, delivery, featured, features[]}]}]`, `pricingNote`), team (`showTeam`, `teamTitle`, `teamIntro`), appearance (`appearance{color, layout, mode, bg, overlay, panel}`), FAQ, SEO, announcement | ✅ | ❌ |
| `settings/hub` | *(Reserved for ProfJero Hub settings)* | ✅ | ❌ |
| `skills/{id}` | `name, level (0–100), group, order` | ✅ | ❌ |
| `studios/{id}` | `name, tagline, description, icon, color, url, active, order, services[{title,text}]` | ✅ | ❌ |
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
| `media/{id}` | Cloudinary upload library | admins | admins |
| `private/integrations` | Cloudinary cloud name and upload preset | admins | admins |
| `admins/{email}` | Extra admins. `profjero947@gmail.com` is always the owner. | admins | owner |

All admin screens are in the portfolio dashboard at `/admin/`. The Hub can use the same dashboard because the data is shared.

## Using the database from ProfJero Hub

The shared modules allow cross-origin imports (`Access-Control-Allow-Origin: *` on `/assets/js/*`), so the Hub can use them directly:

```html
<script type="module">
  import { db, collection, getDocs, query, where, addDoc, serverTimestamp } from "https://profjero.pages.dev/assets/js/firebase.js";

  // Studios + services (managed in the portfolio admin)
  const studios = (await getDocs(collection(db, "studios"))).docs.map(d => ({ id: d.id, ...d.data() }));

  // Blog posts marked "Show on: ProfJero Hub"
  const posts = (await getDocs(query(collection(db, "posts"), where("status", "==", "published"))))
    .docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.sites || p.sites.includes("hub"));

  // Send a Hub form submission into the same admin inbox
  async function sendEnquiry(form) {
    await addDoc(collection(db, "messages"), {
      name: form.name, email: form.email, phone: form.phone || "", service: form.service || "",
      studio: form.studio || "", message: form.message, subject: form.subject || "",
      source: "hub", page: location.href, status: "new", createdAt: serverTimestamp()
    });
  }
</script>
```

Article links for Hub readers: `https://profjero.pages.dev/blog/<slug>`. They include likes, comments and shares.

**Studio links.** Each studio's **Visit studio** button uses its `url` field. Point it at the matching section or page on the Hub, for example `https://profjerohub.pages.dev/#digital-studio`. If the Hub uses different anchors or page paths, update the links in **Admin → Studios & services**.
