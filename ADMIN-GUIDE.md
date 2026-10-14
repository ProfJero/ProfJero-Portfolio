# ProfJero — Setup & Admin Guide

This guide covers the one-time setup (about 15 minutes) and everyday use of the admin dashboard at **https://profjero.pages.dev/admin/**.

---

## 1. One-time setup

### 1.1 Publish the Firestore security rules (required)

Your Firestore database is currently locked, so the website shows its built-in default content. To unlock it safely:

1. Open the [Firebase console](https://console.firebase.google.com/) → project **jerohub-1** → **Firestore Database** → **Rules**.
2. Replace everything with the contents of [`firestore.rules`](firestore.rules) from this repository.
3. Click **Publish**.

The rules allow:
- **Anyone:** read published content, send contact forms, subscribe to the newsletter, and add +1 to views/shares.
- **Visitors who are signed in** (silently and anonymously, or with Google): like posts and comments, comment, reply, and delete their own comments. Each person can like something only once.
- **Admins only:** read messages and subscribers, and change any content.

> The rules come with 52 automated tests ([`tests/rules.test.mjs`](tests/rules.test.mjs)). Run them with `npm run test:rules`.

### 1.2 Turn on sign-in methods

Firebase console → **Authentication** → **Sign-in method**. Enable these:

| Provider | Why |
|---|---|
| **Google** | Admin login, and optional comment sign-in for visitors |
| **Anonymous** | Lets visitors like and comment without creating an account |
| **Email/Password** (optional) | Admin login with a password |

Then go to **Authentication → Settings → Authorized domains** and add:
- `profjero.pages.dev`
- `profjerohub.pages.dev`

### 1.3 Sign in and import your content

1. Open **https://profjero.pages.dev/admin/** and choose **Continue with Google** using **profjero947@gmail.com**. This owner account is always an admin.
2. Go to **Settings → Import default content**. This copies your profile, skills, studios, projects, testimonials, timeline and the 9 launch blog posts into Firestore.
3. You can now edit everything, and readers can like and comment.

### 1.4 Connect Cloudinary (media storage)

1. Create a free account at [cloudinary.com](https://cloudinary.com/).
2. Find your **Cloud name** on the Cloudinary **Dashboard**.
3. Go to **Settings → Upload → Upload presets → Add upload preset**:
   - Signing mode: **Unsigned**
   - Folder: `profjero` (optional)
   - Recommended: restrict **Allowed formats** to `jpg, png, webp, gif, mp4, pdf` and set a **max file size**.
4. In the admin, go to **Settings → Cloudinary storage**, enter the cloud name and preset name, then click **Save**. Use **Test upload** to check that it works.

Uploads from any image field, the blog editor or the **Media library** go to Cloudinary. Images are served automatically as WebP/AVIF and resized for speed.

### 1.5 Cloudflare Pages deployment

The site is static, with no build step. Use these project settings:
- **Build command:** *(empty)*
- **Build output directory:** `/`

The `functions/` folder is deployed automatically when Pages is connected to GitHub. It server-renders the homepage and the blog articles, and generates `sitemap.xml`, `rss.xml`, `llms.txt` and `llms-full.txt` from live data. This matters for Google and AI crawlers.

If you deploy by drag-and-drop instead, Functions are skipped. The site still works, but it shows static fallbacks. To include Functions, deploy with `npx wrangler pages deploy .`.

### 1.6 Optional hardening

In Google Cloud console → **APIs & Services → Credentials**, open the Browser API key. Restrict it under **Website restrictions** to these referrers:
- `profjero.pages.dev/*`
- `profjerohub.pages.dev/*`
- `localhost/*`

---

## 2. Everyday use

| I want to… | Where |
|---|---|
| Read form submissions, reply by email/WhatsApp, archive, export CSV | **Messages** (a red badge shows unread count) |
| Write or edit a blog post (Markdown, live preview, images, YouTube/TikTok embeds, SEO preview) | **Blog posts → New post** |
| Pin, delete or reply to comments as the author | **Comments** |
| Add a project with a **live demo** and a **YouTube/TikTok video** | **Projects & demos → Add project** |
| Change studios, their services and the **Visit studio** links | **Studios & services** |
| Update skills, testimonials, timeline | **Skills / Testimonials / Experience** |
| Change name, photo, intro, availability, contact, socials, pricing, FAQ, SEO, announcement bar | **Profile & site** |
| Change the hero photo, overlay darkness or turn the water ripple off | **Profile & site → Hero & profile** |
| Set the default theme colour, layout (full/boxed), colour mode, background, or hide the visitor Customize panel | **Profile & site → Appearance** |
| Edit pricing tabs, plans, GH₵/US$ prices and payment terms | **Profile & site → Pricing** |
| Add, hide or reorder team members, or hide the whole Team section | **Team** and **Profile & site → Team** |
| Upload and reuse files | **Media library** |
| Manage newsletter subscribers | **Subscribers** |
| Add another admin (owner only), import content, download a backup | **Settings** |

### Years of experience (automatic)
Your years of experience are calculated from **Profile & site → Experience & stats → Career start** (currently January 2021). The number goes up by itself every January, everywhere on the site. In text such as the About paragraphs, write `{years}` and it is replaced with the live number.

### Adding a project demo video
Paste any of these into **Demo video**:
- YouTube: `https://www.youtube.com/watch?v=…`, `https://youtu.be/…` or `https://www.youtube.com/shorts/…`
- TikTok: `https://www.tiktok.com/@profjero/video/1234567890`. Use the full link from the browser, not the short `vm.tiktok.com` link.

A preview appears right away. Visitors see a play button on the project card and can watch without leaving your site.

### Water effect, Customize panel & appearance
The hero shows a full-width photo with an interactive **water ripple**: it reacts to the mouse or touch, and adds gentle ripples on its own.
- **Visitors:** the gear button on the left edge opens **Customize**. There they can pick a theme colour, light/dark/auto mode, full or boxed layout, a background pattern or image with an optional overlay, and switch the ripple off. Their choices are remembered on their device.
- **You:** set the defaults everyone starts with in **Profile & site → Appearance**.
- **Fallback:** the ripple runs only on devices that support it, and never for visitors who have turned on "reduce motion".

### Pricing
Pricing is organised in tabs: Websites, Web Apps & Systems, Care & Hosting, and Training.
- **Currency:** each plan has a GH₵ price and an optional US$ price. Visitors in Ghana see GH₵ by default and everyone else sees US$; anyone can switch.
- **Get a quote:** this button fills in the contact form's subject, budget range and service.
- **Starting prices:** these are suggestions for an experienced full-stack developer in Ghana in 2026. Adjust them any time.

### Live demos
Set **Live demo URL** to open the real system inside your portfolio, with desktop, tablet and mobile views. Use **Demo note** for demo login details.

> Some sites block being embedded. If that happens, visitors can still click **New tab**.

### Blog formatting cheatsheet
```
## Heading            ### Subheading
**bold**  *italic*    `code`
- bullet              1. numbered
> quote               ---  (divider)
[link text](https://…)
![image description](https://…)
@[video](https://www.youtube.com/watch?v=…)   ← embeds a YouTube/TikTok video
| Table | Header |
|---|---|
| a | b |
```

---

## 3. SEO & AI visibility checklist

- Your sitemap is generated live at **https://profjero.pages.dev/sitemap.xml**. In **Google Search Console → Sitemaps**, submit `sitemap.xml`. Search Console is already verified.
- Also add the site to **[Bing Webmaster Tools](https://www.bing.com/webmasters)**. You can import it from Search Console. Bing's index feeds Copilot and other AI search engines.
- The site includes:
  - Structured data: Person, WebSite, ProfessionalService, FAQPage, BlogPosting and BreadcrumbList.
  - Open Graph and Twitter cards.
  - An RSS feed at `/rss.xml`.
  - `llms.txt` and `llms-full.txt` for AI assistants.
  - A `robots.txt` that welcomes GPTBot, ClaudeBot, PerplexityBot, Google-Extended and other crawlers.
- Every new post appears in the sitemap and RSS feed within about 2 minutes. After publishing an important post, use **URL Inspection → Request indexing** in Search Console.
- Fill in **SEO title** and **Meta description** for each post, and update **Profile & site → SEO & sharing**.
- Use the same name, photo and links on Facebook, TikTok, LinkedIn and GitHub, and add them in **Profile & site → Contact & social**. Consistent profiles help both Google and AI assistants recognise you.

---

## 4. Local development

```bash
npm install
npm run emulators          # Firestore + Auth emulators (needs Java)
npm run dev                # http://localhost:8788  (add ?emulator=1 to use the emulators)
npm run test:rules         # 52 security-rule tests
npm run prerender          # refresh static fallback HTML/feeds after editing assets/js/defaults.js
```
