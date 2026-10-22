# ProfJero — Setup & Admin Guide

This guide covers the one-time setup (about 15 minutes) and everyday use of the admin dashboard at **https://profjero.pages.dev/admin/**.

---

## ✅ Go-live checklist (do these in order)

| # | Where | What to do | Why |
|---|---|---|---|
| 1 | Firebase → Firestore → **Rules** | Paste [`firestore.rules`](firestore.rules) and click **Publish**. **Do this again every time `firestore.rules` changes**, including this update (invoices, roles, chat, alerts) | Until this is done the database refuses everything, so the sites show only built-in content and the admin, bookings, portal, likes and comments can't save. With old rules, new screens show “Missing or insufficient permissions” |
| 2 | Firebase → Authentication → **Sign-in method** | Enable **Google**, **Email/Password** and **Anonymous** | Admin login, client-portal accounts, and likes/comments |
| 3 | Firebase → Authentication → Settings → **Authorized domains** | Add `profjero.pages.dev` and `profjerohub.pages.dev` | Sign-in only works on listed domains |
| 4 | https://profjero.pages.dev/admin/ | Click **Continue with Google** with **profjero947@gmail.com** | Your Google account is the super admin. The *email + password* form only works if you set a password (step 4b) |
| 4b | *(optional)* Admin login page | Type your email, click **Forgot?**, and set a password from the email you receive | Gives you password sign-in too. Firebase's “400 Bad Request” on the password form just means no password exists yet |
| 5 | Admin → **Settings** → **Import default content** | Run it once | Copies your profile, studios, products, pricing, testimonials and the 9 blog posts into the database so you can edit them. It only adds what's missing and never overwrites your edits |
| 6 | Admin → **Settings** → **Cloudinary storage** | Enter your cloud name and unsigned upload preset (see 1.4) | Lets you upload images and videos |
| 7 | Cloudflare → each Pages project → Settings → **Build** | Use the settings in 1.5 | Builds each site from this one repository |
| 8 | Google Search Console | Add **profjerohub.pages.dev** as a property too, then submit `https://profjero.pages.dev/sitemap.xml` and `https://profjerohub.pages.dev/sitemap.xml` | Gets both sites, their logo and images into Google |
| 9 | Your phone | Open `/admin/` and the Hub's `/portal/`, then tap **Install app** (Android/Chrome) or Share → **Add to Home Screen** (iPhone) | Installs the admin and client-portal apps |

**Who can sign in where.**
- **Admin dashboard (`/admin/`):** only you (super admin) and the people you add under **Admins** (sidebar → Media & settings). Each admin gets a role or a custom set of permissions and only sees the screens they are allowed to use. Anyone else is signed straight back out, and the database rules enforce the same thing on the server. Only you can add, change or remove admins.
- **Client portal (`profjerohub.pages.dev/portal/`):** open to anyone. Clients only ever see their own bookings, quotes, projects and messages.

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
- **Admins only:** read messages and subscribers, and change content, each limited to the areas their role allows (see *Admins, roles & permissions*).

> The rules come with 141 automated tests ([`tests/rules.test.mjs`](tests/rules.test.mjs)). Run them with `npm run test:rules`.

### 1.2 Turn on sign-in methods

Firebase console → **Authentication** → **Sign-in method**. Enable these:

| Provider | Why |
|---|---|
| **Google** | Admin login, and optional comment sign-in for visitors |
| **Anonymous** | Lets visitors like and comment without creating an account |
| **Email/Password** | Client-portal accounts on ProfJero Hub, and optional admin login with a password |

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

Once saved, the cloud name, preset and folder are **stored encrypted** and shown as dots (••••). To see them, click **Show values** and confirm it's you (your password, or a Google pop-up). They hide again after 60 seconds. Click **Change** to replace them.

Uploads from any image field, the blog editor or the **Media library** go to Cloudinary. Images are served automatically as WebP/AVIF and resized for speed.

### 1.5 Cloudflare Pages deployment (both sites from this one repo)

Both websites build from this repository, so a change to shared code or the dashboard updates both sites at once. In Cloudflare go to **Workers & Pages → your project → Settings → Build**. Set:

| Setting | Portfolio (`profjero`) | Hub (`profjerohub`) |
|---|---|---|
| Build command | `node ../../scripts/build.mjs portfolio` | `node ../../scripts/build.mjs hub` |
| Build output directory | `dist` | `dist` |
| Root directory | `sites/portfolio` | `sites/hub` |

**Moving the Hub project over.** The `profjerohub` project is currently connected to the old `ProfJero-Hub` repository.
- If its settings let you switch the repository, choose this repository and enter the settings above.
- If not, delete the old project first, then create a new Pages project named **`profjerohub`** from this repository with the settings above. The name must be exactly `profjerohub` so the address stays `profjerohub.pages.dev`.
- After that, archive the old `ProfJero-Hub` repository on GitHub.

**Server-side functions.** The portfolio's `sites/portfolio/functions/` folder is deployed automatically. It server-renders the homepage and the blog articles, and generates `sitemap.xml`, `rss.xml`, `llms.txt` and `llms-full.txt` from live data. This matters for Google and AI crawlers. The Hub's pages are pre-rendered by its build instead.

**Deploying by hand.** Without Git, run `npm run build`, then `cd sites/portfolio && npx wrangler pages deploy dist --project-name profjero`. Do the same for `sites/hub` with `--project-name profjerohub`.

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
| Create, send and track **invoices and quotations**, record payments | **Invoices** |
| See what needs attention (deadlines, unanswered chats, overdue invoices) and set how early to be warned | **Alerts** (and the 🔔 bell at the top) |
| Add an admin and choose exactly what they can do (owner only) | **Admins** |
| Change your display name or your password | **My account** (click your name at the top right) |
| Import content, download a backup, Cloudinary settings | **Settings** |

### ProfJero Hub: bookings, quotes, clients and chat

The **ProfJero Hub** group in the sidebar manages the Hub:

| Screen | What you do there |
|---|---|
| **Bookings** | Review appointments from the Hub booking wizard. Confirm, complete or cancel them, change the date and time with the date and time pickers, add a note the client sees, and accept or decline reschedule requests. You can also reply by WhatsApp or email, or click **Invoice this**. |
| **Quotes & orders** | Product quote requests (mugs, shirts, awards and so on). Enter an amount and a note, then click **Send quote**. The client approves or declines it in their portal. After that, move the order through *in production → ready → delivered*. |
| **Client chat** | WhatsApp-style live chat with signed-in clients (see *Client chat* below). Badges show unread messages. |
| **Client testimonials** | Testimonials that clients write in their portal (**Testimonial** tab). **Approve & publish** adds one to the auto-sliding testimonial carousel on both websites. **Unpublish** takes it down again. If a client edits their testimonial it comes back here for approval, and the live version stays until you approve the new one. |
| **Clients** | Everyone who has a portal account, booked or requested a quote, with their full history. |
| **Client projects** | Projects that clients follow in their portal: status, progress %, start date and deadline (date pickers), milestones with due dates, next step, files and updates. **Choose the client** by typing their name: you can pick someone who already has a portal account, or click **New client** and enter the name, email and phone of someone who hasn't signed up yet. When they later create an account with that email (and verify it), the project appears in their portal automatically. Money is handled in **Invoices**, and linked invoices show on the project. |
| **Branded products** | The Creative Studio product catalogue (prices, MOQ, delivery time, images). |
| **Hub homepage** | The Hub hero (photo, overlay, water effect), about section, values, process steps and FAQ. |

Studios (services, packages, FAQs and highlights for each studio page) are edited in **Studios & services**.

### Invoices and quotations

**Invoices** in the sidebar (Clients & sales). Everything is in Ghana cedis (GH₵).

1. First, open **Invoices → Business details** once and enter your business name, logo, address, TIN, Mobile Money and bank details, default notes and terms. These appear on every invoice.
2. Click **New invoice** (or **New quotation**). Choose the client (registered or new, same picker as projects), the payment terms (due date fills in by itself), and add items. **Add from your services & products** pulls in your pricing plans, studio packages and products.
3. Pick the tax: **No tax**, **Ghana VAT 2026** (VAT 15% + NHIL 2.5% + GETFund 2.5% = 20%, under the VAT Act 2025), **VAT only**, or **Custom**. Add a discount if you want. The preview on the right updates as you type. Choose a design (Modern, Classic, Minimal) and colour.
4. Click **Save & send**. Send it by **WhatsApp**, **email**, or copy the link. The client opens a clean, printable page (they can save it as PDF) and you can see when they viewed it. Registered clients also see it in the **Invoices** tab of their portal.
5. When money comes in, click **Record a payment** (Mobile Money, bank, cash, card…). The status changes by itself: *Sent → Part paid → Paid*. Past the due date it shows **Overdue**.

Other actions: **Duplicate**, **Convert quotation to invoice**, mark a quote **Accepted/Declined**, **Void** (numbers are never reused), **Print/PDF**, and **Export CSV** of the list. Numbers look like `INV-2026-0001` and `QT-2026-0001` and restart each year.

> These are professional invoices, but they are **not GRA E-VAT certified invoices**. If you are VAT-registered and issue an E-VAT invoice through GRA's system, put its number in the **E-VAT invoice no.** field.

### Alerts (deadlines and things waiting on you)

The 🔔 bell at the top and the **Alerts** page list what needs your attention: bookings starting soon or not yet confirmed, quote requests not answered, quotes to follow up, invoices due soon or overdue, drafts not sent, project deadlines and milestones, client chats waiting for a reply, unread inbox messages and testimonials waiting for approval. Each alert has a **Snooze** button.

**Set your thresholds** on the Alerts page, for example “warn me **3 days** before an invoice is due” or “a chat waiting more than **30 minutes**”. On the same page you can turn on **desktop notifications** and a **sound** for this device. Alerts are checked while the admin dashboard is open (in a browser tab or the installed app); they are not sent when it is closed.

### Client chat

Works like WhatsApp, for you and the client:
- **Who said what is always clear.** Your own messages are solid blue bubbles on the right; the other person's are white bubbles on the left with their photo. Messages from the same person in a row are grouped.
- **ProfJero Assistant** (the automated AI reply) has its own violet bubble with an **Automated reply** badge. In the admin it sits on your side (right), because it answers for the business. Clients see your replies under your name with a **ProfJero team** badge.
- The assistant answers clients instantly, but stays quiet once you've replied (for 2 hours) and as soon as the client taps **Talk to a person**. A handoff shows a banner and a **Human requested** tag in the chat list; click **Mark handled** when you've taken over.
- **Formatting:** click the **A** button for bold, italic, underline, strikethrough, 7 text colours, bullet and numbered lists, quotes and code. Ctrl+B / Ctrl+I / Ctrl+U work too, and a preview shows the result before you send.
- ✓ sent, ✓✓ delivered, blue ✓✓ read; “typing…”; online / last seen.
- Reply to a specific message, react with an emoji, edit your message (within 15 minutes), delete for everyone (within 48 hours).
- Send photos, documents (PDF, Word, Excel…) and **voice notes** (tap the mic). Paste or drag images straight in.
- Search inside a conversation, jump to the newest message, unread divider.
- Label each conversation **New / Open / Waiting on client / Resolved** and filter by label.
- **Quick replies:** type `/` to insert a saved answer (e.g. `/pay` for payment details). Edit them with the ⚡ button.

Files sent in chat are stored in the database itself (about 680 KB each after compression), so keep large files to email or Cloudinary links.

### Admins, roles & permissions (owner only)

**Admins** page: click **Add admin**, enter their Google email, then pick a role:

| Role | Can use |
|---|---|
| Full admin | Everything except managing admins |
| Content editor | Blog, both websites' content and media |
| Hub manager | Bookings, quotes, clients, invoices, chat, inbox, Hub content, media |
| Support agent | Client chat, inbox and bookings |
| Accounts | Invoices and the client list |
| Custom | Tick exactly the areas they need |

Ticking or unticking a box switches the role to *Custom*. **Pause access** stops someone signing in without deleting them. The database enforces the same permissions, so a hidden screen really is off-limits. They sign in with **Continue with Google** using that email (or set a password with **Forgot?** on the login page).

### Your account

Click your name at the top right (**My account**): change the name used in the greeting (“Good morning, Benjamin”), **change your password** (you confirm the current one first), or, if you only use Google, **add a password** so you can also sign in with email.

### Small things that save mistakes
- Pop-up forms close **only** with their **×** or **Cancel** button. Clicking outside won't close them, and if you typed something you're asked before it's discarded.
- All dates use a **date picker** (with quick buttons like *Today* or *+2 weeks*). Times use a time picker.
- **Skills → Group**: pick an existing group from the list (so “Frontend” isn't added again as “Front-end”); type a new name to create a new group.
- The sidebar groups open and close, the « button shrinks it to icons, and **Ctrl K** (⌘K on Mac) jumps to any page. The coloured tags show which site a page affects: **HUB**, **PORTFOLIO** or **BOTH**.

Clients can track a booking or quote without an account at `https://profjerohub.pages.dev/booking/#track` by entering the reference code (PJB… or PJO…).

### Years of experience (automatic)
Your years of experience are calculated from **Profile & site → Experience & stats → Career start** (currently January 2021). The number goes up by itself every January, everywhere on the site. In text such as the About paragraphs, write `{years}` and it is replaced with the live number.

### Adding a project demo video
Paste any of these into **Demo video**:
- YouTube: `https://www.youtube.com/watch?v=…`, `https://youtu.be/…` or `https://www.youtube.com/shorts/…`
- TikTok: `https://www.tiktok.com/@profjero/video/1234567890`. Use the full link from the browser, not the short `vm.tiktok.com` link.

A preview appears right away. Visitors see a play button on the project card and can watch without leaving your site.

### Testimonials carousel

Testimonials on both websites slide automatically. Each slide stays for about 5 seconds, and the carousel pauses while a visitor hovers, taps or reads. Visitors can also swipe, or use the arrows and dots. There's no limit on how many testimonials you can add: add them yourself under **Testimonials**, or approve the ones clients send from the portal under **Client testimonials**. Use **order** to choose which come first, and **visible** to hide one without deleting it.

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

### Blog images

Every article opens with a full-width **hero**: its *Cover image* behind the title. Without a cover it uses a branded colour. To put pictures *inside* an article, click the **image button** in the editor toolbar and upload, pick from the Media library or paste a link. Then add alt text, an optional caption and a layout (normal, wide, small, left or right). You can also **drag an image onto the text** or **paste** one from your clipboard. Readers can tap any image to view it full screen.

### Prices

All prices are in **Ghana cedis (GH₵)**. Type “GH₵ 9,500” or just “9500”, which shows as “GH₵ 9,500”. Edit them in:
- **Profile & site → Pricing**: portfolio packages (Websites, Systems, Care plans, Training).
- **Studios & services → (a studio) → Packages**: each Hub studio's packages.
- **Branded products → Price from**: the Creative Studio catalogue.

### Blog formatting cheatsheet
```
## Heading            ### Subheading
**bold**  *italic*    `code`
- bullet              1. numbered
> quote               ---  (divider)
[link text](https://…)
![image description](https://…)                          ← image inside the text
![alt text](https://… "Caption under the image"){wide}   ← figure; layouts: wide, small, left, right
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
npm run dev:portfolio      # builds, then http://localhost:8788  (add ?emulator=1 to use the emulators)
npm run dev:hub            # builds, then http://localhost:8789
npm run test:rules         # 141 security-rule tests
```
