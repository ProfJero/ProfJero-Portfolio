// Hub build hook: generates the static HTML pages of ProfJero Hub into ./dist with
// all default content pre-rendered, full SEO meta and structured data. The browser
// then hydrates every section with live Firestore data. Run via the root build:
//   node scripts/build.mjs hub
// Modules are imported from the built ./dist so they see this site's config (site.js).
import { writeFile, mkdir } from "node:fs/promises";

const OUT = new URL("./dist/", import.meta.url);
const mod = p => import(new URL(`assets/js/${p}`, OUT));
const { DEFAULT_SETTINGS, DEFAULT_STUDIOS, DEFAULT_PROJECTS, DEFAULT_TESTIMONIALS, DEFAULT_PRODUCTS, PRODUCT_CATEGORIES } = await mod("defaults.js");
const { SEED_POSTS } = await mod("seed-posts.js");
const { HUB_SETTINGS } = await mod("hub-defaults.js");
const { esc, byOrder, readingTime } = await mod("utils.js");
const { renderSocials } = await mod("render.js");
const R = await mod("hub-render.js");

const URL_BASE = "https://profjerohub.pages.dev";
const site = DEFAULT_SETTINGS;
const hub = HUB_SETTINGS;
const studios = [...DEFAULT_STUDIOS].sort(byOrder);
const posts = SEED_POSTS.map(p => ({ ...p, id: p.slug, views: 0, likes: 0, commentCount: 0, readingTime: readingTime(p.content) }))
  .filter(p => !p.sites || p.sites.includes("hub"));
const TODAY = new Date().toISOString().slice(0, 10);

const THEME_SCRIPT = `<script>try{var d=document.documentElement,j=function(k){return JSON.parse(localStorage.getItem(k)||"{}")||{}},o=Object.assign({},j("pj_site_look"),j("pj_prefs")),m=o.mode||localStorage.getItem("pj_theme")||"system";if(m!=="light"&&m!=="dark")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=m;if(/^#[0-9a-f]{6}$/i.test(o.color||""))d.style.setProperty("--brand-base",o.color);if(o.layout==="boxed")d.dataset.layout="boxed";if(o.bg)d.dataset.bg=o.bg;if(o.overlay)d.dataset.overlay="1"}catch(e){}</script>`;

function head({ title, desc, path, image = "/assets/img/brand/og-hub.jpg", keywords = "", schema = [], noindex = false, preload = "" }) {
  const canonical = URL_BASE + path;
  const imageUrl = new URL(image, URL_BASE).href;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  ${keywords ? `<meta name="keywords" content="${esc(keywords)}">` : ""}
  <meta name="author" content="Benjamin Amoako (ProfJero)">
  <meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}">
  <link rel="canonical" href="${canonical}">
  <meta name="google-site-verification" content="KQFO-fdbRUuyV-gC0so2L_bkoT4S42o00kB5FmA-MCk">
  <meta name="theme-color" content="#0A60EE">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ProfJero Hub">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${imageUrl}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/img/brand/icon-192.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/brand/favicon-32.png">
  <link rel="apple-touch-icon" href="/assets/img/brand/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  ${THEME_SCRIPT}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://firestore.googleapis.com">
  ${preload}
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="stylesheet" href="/assets/css/main.css">
  <link rel="stylesheet" href="/assets/css/hub.css">
  ${R.ldJson([R.orgSchema(site), { "@type": "WebSite", "@id": URL_BASE + "/#website", url: URL_BASE + "/", name: "ProfJero Hub", publisher: { "@id": R.HUB_ORG_ID } }, ...schema])}
</head>`;
}

function header(active = "") {
  const link = (href, label, key) => `<li><a href="${href}"${active === key ? ' class="active" aria-current="page"' : ""}>${label}</a></li>`;
  return `
<body data-page="${esc(active || "page")}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="page-wrap">
  <div class="announce" hidden><span></span><button type="button" aria-label="Dismiss announcement"><i class="fa-solid fa-xmark"></i></button></div>
  <header class="site-header">
    <nav class="container nav" aria-label="Main">
      <a class="logo" href="/" aria-label="ProfJero Hub home">
        <img class="logo-mark" src="/assets/img/brand/mark-192.png" alt="ProfJero Hub logo" width="40" height="40">
        <span class="logo-text">Prof<b>Jero</b> <em class="logo-hub">Hub</em></span>
      </a>
      <ul class="nav-links">
        ${link("/", "Home", "home")}
        <li class="has-menu"><button type="button" class="menu-btn${active.endsWith("studio") ? " active" : ""}" aria-expanded="false">Studios <i class="fa-solid fa-chevron-down"></i></button>
          <div class="mega" role="menu">${studios.map(s => `<a role="menuitem" href="${R.studioPath(s)}" style="--c:${esc(s.color)}"><i class="${esc(s.icon)}"></i><span><strong>${esc(s.name)}</strong><small>${esc(s.tagline)}</small></span></a>`).join("")}</div></li>
        ${link("/work", "Work &amp; demos", "work")}
        ${link("/creative-studio#products", "Products", "products")}
        ${link("/booking/", "Book", "booking")}
        <li><a href="${site.hubUrl ? "https://profjero.pages.dev/blog" : "/"}" target="_blank" rel="noopener">Blog</a></li>
        ${link("/#contact", "Contact", "contact")}
      </ul>
      <div class="nav-actions">
        <button class="icon-btn theme-toggle" type="button" aria-label="Toggle dark mode"><i class="fa-solid fa-moon"></i><i class="fa-solid fa-sun"></i></button>
        <a class="btn btn-ghost btn-sm btn-portal" href="/portal/"><i class="fa-regular fa-circle-user"></i> <span>Client portal</span></a>
        <a class="btn btn-primary btn-sm btn-hire" href="/booking/">Book now <i class="fa-solid fa-arrow-right"></i></a>
        <button class="icon-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
      </div>
    </nav>
    <div class="progress-bar"></div>
  </header>`;
}

function footer(scripts = ["/assets/js/hub.js"]) {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-about">
          <a class="logo" href="/"><img class="logo-mark" src="/assets/img/brand/mark-192.png" alt="ProfJero Hub logo" width="40" height="40"><span class="logo-text">Prof<b>Jero</b> <em class="logo-hub">Hub</em></span></a>
          <p>Unveiling the Extraordinary — four studios for digital, creative, agro and nourish solutions, founded by Benjamin Amoako (ProfJero) in Cape Coast, Ghana.</p>
          <div class="socials" data-socials>${renderSocials(site.socials)}</div>
        </div>
        <div><h4>Studios</h4><ul>${studios.map(s => `<li><a href="${R.studioPath(s)}">${esc(s.name)}</a></li>`).join("")}<li><a href="/creative-studio#products">Branded products</a></li></ul></div>
        <div><h4>Hub</h4><ul><li><a href="/#about">About</a></li><li><a href="/work">Work &amp; demos</a></li><li><a href="/booking/">Book a service</a></li><li><a href="/booking/#track">Track a booking</a></li><li><a href="/portal/">Client portal</a></li><li><a href="https://profjero.pages.dev/" target="_blank" rel="noopener">Founder — ProfJero</a></li><li><a href="https://profjero.pages.dev/blog" target="_blank" rel="noopener">Blog</a></li></ul></div>
        <div><h4>Contact</h4>
          <ul class="footer-contact">
            <li><i class="fa-solid fa-phone"></i> <a data-s="phone" data-s-href="tel:{phone}" href="tel:+233531207256">${esc(site.phone)}</a></li>
            <li><i class="fa-brands fa-whatsapp"></i> <a data-s-href="https://wa.me/{whatsapp}" href="https://wa.me/233531207256" target="_blank" rel="noopener">WhatsApp us</a></li>
            <li><i class="fa-solid fa-envelope"></i> <a data-s="email" data-s-href="mailto:{email}" href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
            <li><i class="fa-solid fa-location-dot"></i> <span data-s="location">${esc(site.location)}</span></li>
            <li><i class="fa-regular fa-clock"></i> Mon – Sat · 7:00 AM – 8:00 PM</li>
          </ul>
          <form class="newsletter" data-newsletter><label class="sr-only" for="nl-footer">Email address</label><input id="nl-footer" type="email" placeholder="Newsletter — your email" required><button class="btn btn-primary btn-sm" type="submit">Join</button></form>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-year>${new Date().getFullYear()}</span> ProfJero Hub · Founded by <a href="https://profjero.pages.dev/" target="_blank" rel="noopener">Benjamin Amoako (ProfJero)</a></span>
        <span><a href="/sitemap.xml">Sitemap</a> · <a href="/llms.txt">llms.txt</a> · <a href="https://profjero.pages.dev/admin/" rel="nofollow">Admin</a></span>
      </div>
    </div>
  </footer>
  </div>
  <a class="wa-float" href="https://wa.me/233531207256" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
  <button class="to-top" type="button" aria-label="Back to top"><i class="fa-solid fa-arrow-up"></i></button>
  <dialog class="modal" id="modal" aria-labelledby="modal-title">
    <div class="modal-box">
      <div class="modal-head"><h3 id="modal-title">Preview</h3><div class="modal-tools"></div><button class="icon-btn" type="button" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body"></div>
    </div>
  </dialog>
  ${scripts.map(s => `<script type="module" src="${s}"></script>`).join("\n  ")}
</body>
</html>
`;
}

const section = (id, eyebrow, icon, title, intro, body, cls = "") => `
    <section class="section${cls ? " " + cls : ""}" id="${id}">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow"><i class="${icon}"></i> ${eyebrow}</span>
          <h2>${title}</h2>
          ${intro ? `<p>${intro}</p>` : ""}
        </div>
        ${body}
      </div>
    </section>`;

function contactSection(preset = "", cls = "section-alt") {
  return section("contact", "Contact", "fa-solid fa-paper-plane", "Let's talk about your project", "Send a message and we'll reply within 24 hours — or chat with us on WhatsApp.", `
        <div class="contact-grid">
          <aside class="contact-card reveal">
            <h3>Reach the Hub</h3>
            <p>Questions, quotes or partnerships — we're happy to help.</p>
            <ul class="contact-list">
              <li><i class="fa-solid fa-phone"></i><div><small>Phone</small><a data-s="phone" data-s-href="tel:{phone}" href="tel:+233531207256">${esc(site.phone)}</a></div></li>
              <li><i class="fa-brands fa-whatsapp"></i><div><small>WhatsApp</small><a data-s-href="https://wa.me/{whatsapp}" href="https://wa.me/233531207256" target="_blank" rel="noopener">Chat with us</a></div></li>
              <li><i class="fa-solid fa-envelope"></i><div><small>Email</small><a data-s="email" data-s-href="mailto:{email}" href="mailto:${esc(site.email)}">${esc(site.email)}</a></div></li>
              <li><i class="fa-solid fa-location-dot"></i><div><small>Location</small><span>Cape Coast, Ghana · serving clients nationwide &amp; online</span></div></li>
            </ul>
            <div class="socials" data-socials>${renderSocials(site.socials)}</div>
          </aside>
          <div class="form-card reveal">
            <form id="contact-form" novalidate>
              <div class="form-grid">
                <div class="field"><label for="c-name">Full name <span class="req">*</span></label><input id="c-name" name="name" autocomplete="name" required maxlength="100" placeholder="Your name"></div>
                <div class="field"><label for="c-email">Email <span class="req">*</span></label><input id="c-email" name="email" type="email" autocomplete="email" required maxlength="150" placeholder="you@example.com"></div>
                <div class="field"><label for="c-phone">Phone / WhatsApp</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+233 ..."></div>
                <div class="field"><label for="c-studio">Studio</label><select id="c-studio" name="studio"><option value="">General enquiry</option>${studios.map(s => `<option value="${esc(s.name)}"${preset === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
                <div class="field full"><label for="c-subject">Subject</label><input id="c-subject" name="subject" maxlength="150" placeholder="What do you need?"></div>
                <div class="field full"><label for="c-message">Message <span class="req">*</span></label><textarea id="c-message" name="message" required maxlength="5000" placeholder="Tell us about your goals, quantities, timeline…"></textarea></div>
                <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
              </div>
              <div class="form-foot"><small><i class="fa-solid fa-lock"></i> Private — never shared.</small><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Send message</button></div>
            </form>
          </div>
        </div>`, cls);
}

// ======================= HOME =======================
function homePage() {
  const featured = DEFAULT_PROJECTS.filter(p => p.featured || p.studio === "creative-studio").slice(0, 6);
  const topProducts = DEFAULT_PRODUCTS.filter(p => p.featured).slice(0, 6);
  const schema = [R.faqSchemaObj(hub.faqs), { "@type": "ItemList", name: "ProfJero Hub studios", itemListElement: studios.map((s, i) => ({ "@type": "ListItem", position: i + 1, url: URL_BASE + R.studioPath(s), name: s.name })) }];
  return head({
    title: "ProfJero Hub — Digital, Creative, Agro & Nourish Studios in Ghana",
    desc: "ProfJero Hub, founded by Benjamin Amoako, offers software & websites, custom product branding, smart farming and nutrition services from Cape Coast, Ghana. Book online.",
    keywords: "ProfJero Hub, ProfJero, product branding Ghana, branded mugs Ghana, website developer Ghana, software company Cape Coast, smart farming Ghana, nutrition consultant Ghana, corporate gifts Ghana",
    path: "/", schema,
    preload: `<link rel="preload" as="image" href="/assets/img/people/hero-bg.webp" media="(min-width: 701px)" fetchpriority="high">\n  <link rel="preload" as="image" href="/assets/img/people/hero-bg-sm.webp" media="(max-width: 700px)" fetchpriority="high">`
  }) + header("home") + `
  <main id="main">
    <section class="hero hero-water hub-hero" id="home">
      <div class="hero-overlay" aria-hidden="true"></div>
      <div class="container hero-inner">
        <div>
          <span class="status-pill"><span class="pulse"></span><span data-h="heroEyebrow">${esc(hub.heroEyebrow)}</span></span>
          <h1><span data-h="heroTitle">${esc(hub.heroTitle)}</span></h1>
          <p class="hero-lead" data-h="heroIntro">${esc(hub.heroIntro)}</p>
          <div class="hero-ctas">
            <a class="btn btn-primary" href="/booking/"><i class="fa-regular fa-calendar-check"></i> Book a service</a>
            <a class="btn btn-outline" href="#studios">Explore our studios <i class="fa-solid fa-arrow-down"></i></a>
          </div>
          <div class="hero-studio-pills">${studios.map(s => `<a href="${R.studioPath(s)}" style="--c:${esc(s.color)}"><i class="${esc(s.icon)}"></i> ${esc(s.name)}</a>`).join("")}</div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="float-card fc-1"><i class="fa-solid fa-laptop-code"></i><div>Digital Studio<small>Software &amp; websites</small></div></div>
          <div class="float-card fc-2" style="--fc:#7C3AED"><i class="fa-solid fa-palette"></i><div>Creative Studio<small>Product branding</small></div></div>
          <div class="float-card fc-3"><i class="fa-solid fa-seedling"></i><div>Agro &amp; Nourish<small>Farm &amp; wellness</small></div></div>
        </div>
      </div>
      <a class="scroll-cue" href="#studios" aria-label="Scroll to studios"><span></span></a>
    </section>

    <div class="hub-stats container" id="hub-stats">${R.renderHubStats(site, studios)}</div>

    ${section("studios", "Our studios", "fa-solid fa-cubes", 'Four studios, <span class="grad-text">one hub</span>', "Each studio is focused on doing one thing exceptionally well. Choose where you'd like to start.", `<div class="studio-cards" id="studios-grid">${R.renderStudioCards(studios)}</div>`)}

    <section class="section section-alt" id="about">
      <div class="container about-grid">
        <div class="about-photo reveal">
          <img src="/assets/img/people/benjamin-amoako.webp" alt="Benjamin Amoako (ProfJero), founder of ProfJero Hub" width="560" height="560" loading="lazy">
          <div class="exp-badge"><strong><span data-years>5</span>+</strong><span>Years building<br>&amp; teaching</span></div>
        </div>
        <div class="about-text reveal">
          <span class="eyebrow"><i class="fa-solid fa-user-tie"></i> Founder &amp; story</span>
          <h2 data-h="aboutTitle">${esc(hub.aboutTitle)}</h2>
          <div id="hub-about">${hub.about.map(p => `<p>${esc(p)}</p>`).join("")}</div>
          <div class="mv-grid">
            <div class="mv"><i class="fa-solid fa-bullseye"></i><div><h3>Mission</h3><p data-h="mission">${esc(hub.mission)}</p></div></div>
            <div class="mv"><i class="fa-regular fa-eye"></i><div><h3>Vision</h3><p data-h="vision">${esc(hub.vision)}</p></div></div>
          </div>
          <div class="btn-row">
            <a class="btn btn-primary" href="https://profjero.pages.dev/" target="_blank" rel="noopener"><i class="fa-solid fa-id-badge"></i> Meet the founder</a>
            <a class="btn btn-outline" href="/booking/">Work with us</a>
          </div>
        </div>
      </div>
    </section>

    ${section("values", "Why ProfJero Hub", "fa-solid fa-award", "What you can expect from us", "", `<div class="values-grid" id="values-list">${R.renderValues(hub.values)}</div>`)}

    ${section("work", "Work &amp; demos", "fa-solid fa-display", 'Real projects you can <span class="grad-text">try live</span>', "Open a live demo, watch a video walkthrough, or browse our branding work.", `
        <div class="chips" id="work-filters">${R.renderStudioFilters(featured, studios)}</div>
        <div class="project-grid" id="work-grid">${R.renderProjects(featured)}</div>
        <div class="center-cta"><a class="btn btn-outline" href="/work">See all work &amp; demos <i class="fa-solid fa-arrow-right"></i></a></div>`, "section-alt")}

    ${section("products", "Product branding", "fa-solid fa-gift", "Branded products for your business &amp; events", "Watches, mugs, apparel, awards, frames and more — custom branded by our Creative Studio. Request a quote in seconds.", `
        <div class="product-grid" id="product-grid">${R.renderProducts(topProducts)}</div>
        <div class="center-cta"><a class="btn btn-primary" href="/creative-studio#products"><i class="fa-solid fa-store"></i> Browse all ${DEFAULT_PRODUCTS.length} products</a></div>`)}

    ${section("how", "How it works", "fa-solid fa-route", "Simple from first click to final delivery", "", `<ol class="process" id="steps-list">${R.renderSteps(hub.steps)}</ol>
        <div class="portal-banner reveal"><div><h3><i class="fa-regular fa-circle-user"></i> Track everything in your client portal</h3><p>See bookings, approve quotes, follow project progress, download files and chat with the team — all in one place.</p></div><a class="btn btn-white" href="/portal/">Open client portal <i class="fa-solid fa-arrow-right"></i></a></div>`, "section-alt")}

    ${section("testimonials", "Testimonials", "fa-solid fa-heart", "What clients say", "", `<div class="testimonials" id="testimonial-list" data-carousel aria-roledescription="carousel" aria-label="Client testimonials">${R.renderTestimonials(DEFAULT_TESTIMONIALS)}</div>`)}

    ${section("blog", "Insights", "fa-solid fa-pen-nib", "From the ProfJero blog", "Guides on technology, business and growth — written by our founder.", `<div class="post-grid" id="latest-posts">${[...posts].sort(R.byNewest).slice(0, 3).map(p => R.renderPostCard(p)).join("")}</div>
        <div class="center-cta"><a class="btn btn-outline" href="https://profjero.pages.dev/blog" target="_blank" rel="noopener">Read all articles</a></div>`, "section-alt")}

    ${section("faq", "FAQ", "fa-solid fa-circle-question", "Frequently asked questions", "", `<div class="faq-list" id="faq-list">${R.renderStudioFaqs({ faqs: hub.faqs })}</div>`)}

    ${contactSection("", "section-alt")}
  </main>` + footer();
}

// ======================= STUDIO PAGES =======================
const STUDIO_HERO = {
  "digital-studio": "/assets/img/people/profjero-at-work.webp",
  "creative-studio": "/assets/img/work/dna-brand-identity.webp"
};

function studioPage(s) {
  const projects = R.studioProjects(DEFAULT_PROJECTS, s.id);
  const isCreative = s.id === "creative-studio";
  const heroImg = s.heroImage || STUDIO_HERO[s.id] || "";
  const path = R.studioPath(s);
  const schema = [R.studioSchema({ ...s, heroImage: heroImg }, site), R.faqSchemaObj(s.faqs || []), R.breadcrumbSchema([["Home", URL_BASE + "/"], [s.name, URL_BASE + path]])];
  if (isCreative) schema.push({ "@type": "ItemList", name: "Custom branded products", itemListElement: DEFAULT_PRODUCTS.map((p, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Product", name: `Custom branded ${p.name}`, description: p.description, category: p.category, brand: { "@type": "Brand", name: "ProfJero Creative Studio" } } })) });
  return head({ title: s.seoTitle || `ProfJero ${s.name}`, desc: s.seoDescription || s.description, keywords: s.keywords, path, schema, image: heroImg || "/assets/img/brand/og-hub.jpg" }) + header(s.id) + `
  <main id="main" data-studio="${esc(s.id)}" style="--c:${esc(s.color)}">
    <section class="studio-hero${heroImg ? " hero-water has-photo" : ""}" id="home" style="--c:${esc(s.color)}${heroImg ? `;--hero-bg:url('${heroImg}');--hero-bg-sm:url('${heroImg}')` : ""}">
      ${heroImg ? '<div class="hero-overlay" aria-hidden="true"></div>' : '<div class="studio-hero-pattern" aria-hidden="true"></div>'}
      <div class="container studio-hero-inner">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>${esc(s.name)}</span></nav>
        <span class="studio-chip"><i class="${esc(s.icon)}"></i> ProfJero ${esc(s.name)} · <span data-sf="mode">${esc(s.mode || "")}</span></span>
        <h1 data-sf="headline">${esc(s.headline || s.name)}</h1>
        <p class="hero-lead" data-sf="intro">${esc(s.intro || s.description)}</p>
        <div class="hero-ctas">
          <a class="btn btn-primary btn-accent" href="/booking/?studio=${esc(s.id)}"><i class="fa-regular fa-calendar-check"></i> Book ${esc(s.name)}</a>
          ${isCreative ? '<a class="btn btn-outline" href="#products"><i class="fa-solid fa-store"></i> Browse products</a>' : '<a class="btn btn-outline" href="#services">View services <i class="fa-solid fa-arrow-down"></i></a>'}
        </div>
        ${heroImg ? "" : `<i class="${esc(s.icon)} studio-hero-icon" aria-hidden="true"></i>`}
      </div>
    </section>

    ${section("services", "Services", esc(s.icon), `What ${esc(s.name)} does`, esc(s.description), `<div class="svc-grid" id="services-grid">${R.renderServices(s)}</div>`)}

    ${isCreative ? section("products", "Product catalogue", "fa-solid fa-store", 'Custom-branded products <span class="grad-text">for every occasion</span>', "Corporate gifts, events, schools, churches, weddings and promotions. Pick a product and request a quote — we reply within 24 hours.", `
        <div class="product-tools"><label class="search"><i class="fa-solid fa-magnifying-glass"></i><span class="sr-only">Search products</span><input id="product-search" type="search" placeholder="Search mugs, watches, T-shirts, awards…"></label>
          <button class="btn btn-outline" type="button" data-quote="custom"><i class="fa-solid fa-wand-magic-sparkles"></i> Custom request</button></div>
        <div class="chips" id="product-filters">${R.renderProductFilters(DEFAULT_PRODUCTS, PRODUCT_CATEGORIES)}</div>
        <div class="product-grid" id="product-grid">${R.renderProducts(DEFAULT_PRODUCTS)}</div>
        <p class="empty" id="product-empty" hidden>No products match your search. Try a <button type="button" class="linklike" data-quote="custom">custom request</button>.</p>`, "section-alt") : ""}

    ${section("why", "Why choose us", "fa-solid fa-award", `Why clients choose ${esc(s.name)}`, "", `<div class="hl-grid" id="highlights">${R.renderHighlights(s)}</div>`, isCreative ? "" : "section-alt")}

    <section class="section${isCreative ? " section-alt" : ""}" id="work"${projects.length ? "" : " hidden"}>
      <div class="container">
        <div class="section-head"><span class="eyebrow"><i class="fa-solid fa-display"></i> Work &amp; demos</span><h2>Recent ${esc(s.name)} work</h2><p>Try live demos, watch video walkthroughs or view the details.</p></div>
        <div class="project-grid" id="work-grid">${R.renderProjects(projects)}</div>
        <div class="center-cta"><a class="btn btn-outline" href="/work">All work &amp; demos <i class="fa-solid fa-arrow-right"></i></a></div>
      </div>
    </section>

    <section class="section${isCreative ? "" : " section-alt"}" id="pricing">
      <div class="container">
        <div class="section-head"><span class="eyebrow"><i class="fa-solid fa-tags"></i> Packages</span><h2>Transparent starting prices</h2><p>Every request gets a written quote. Prices below are starting points.</p></div>
        <div class="pricing-top"><div class="currency-switch" role="group" aria-label="Currency"><button type="button" data-cur="ghs" aria-pressed="true">GH₵</button><button type="button" data-cur="usd" aria-pressed="false">US$</button></div></div>
        <div class="pricing" id="package-grid">${R.renderPackages(s)}</div>
      </div>
    </section>

    ${section("process", "Process", "fa-solid fa-route", "How we work with you", "", `<ol class="process" id="process-list">${R.renderStudioProcess(s)}</ol>`, isCreative ? "section-alt" : "")}

    ${section("faq", "FAQ", "fa-solid fa-circle-question", `${esc(s.name)} — frequently asked questions`, "", `<div class="faq-list" id="faq-list">${R.renderStudioFaqs(s)}</div>`, isCreative ? "" : "section-alt")}

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="cta-band studio-cta reveal" style="--c:${esc(s.color)}">
          <div><h2 data-sf="cta.title">${esc(s.cta?.title || `Ready to start with ${s.name}?`)}</h2><p data-sf="cta.text">${esc(s.cta?.text || "Book online or chat with us on WhatsApp.")}</p></div>
          <div class="btn-row"><a class="btn btn-white" href="/booking/?studio=${esc(s.id)}"><i class="fa-regular fa-calendar-check"></i> Book now</a><a class="btn btn-outline-white" href="https://wa.me/233531207256" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a></div>
        </div>
        <h3 class="other-title">Explore our other studios</h3>
        <div class="mini-studios" id="other-studios">${R.renderOtherStudios(studios, s.id)}</div>
      </div>
    </section>

    ${contactSection(s.id)}
  </main>` + footer();
}

// ======================= WORK =======================
function workPage() {
  const all = [...DEFAULT_PROJECTS].sort(byOrder);
  return head({
    title: "Work & Live Demos — ProfJero Hub Projects",
    desc: "Explore ProfJero Hub projects: web apps, dashboards and business systems with live demos and video walkthroughs, plus product branding and design work.",
    path: "/work",
    schema: [R.breadcrumbSchema([["Home", URL_BASE + "/"], ["Work", URL_BASE + "/work"]]), { "@type": "CollectionPage", name: "ProfJero Hub work", url: URL_BASE + "/work" }]
  }) + header("work") + `
  <main id="main">
    <section class="page-hero"><div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Work</span></nav>
      <h1>Work you can <span class="grad-text">try live</span></h1>
      <p>Systems, websites and dashboards with live demos and video walkthroughs — plus branding and design projects from our studios.</p>
    </div></section>
    <section class="section" style="padding-top:10px"><div class="container">
      <div class="chips" id="work-filters">${R.renderStudioFilters(all, studios)}</div>
      <div class="project-grid" id="work-grid">${R.renderProjects(all)}</div>
    </div></section>
  </main>` + footer();
}

// ======================= BOOKING =======================
function bookingPage() {
  const faqs = [
    { q: "Do I need an account to book?", a: "No. You can book as a guest and track your booking with the reference number. Creating a free client account lets you see all your bookings, quotes and projects in one place." },
    { q: "How soon will my booking be confirmed?", a: "Usually within a few hours during working hours (Mon–Sat, 7 AM – 8 PM). You'll receive confirmation by email or WhatsApp, and the status updates on the tracking page." },
    { q: "Is the consultation free?", a: "First consultations for new projects are free. Paid services (site visits, nutrition sessions, training) are confirmed with a quote before you pay anything." },
    { q: "Can I reschedule or cancel?", a: "Yes. Sign in to the client portal to cancel or request a new time, or message us on WhatsApp with your reference number." }
  ];
  return head({
    title: "Book a Service — ProfJero Hub Online Booking",
    desc: "Book ProfJero Hub services online: websites and software, product branding, smart farming visits and nutrition consultations. Get a reference number instantly.",
    path: "/booking/",
    schema: [R.faqSchemaObj(faqs), R.breadcrumbSchema([["Home", URL_BASE + "/"], ["Book a service", URL_BASE + "/booking/"]])]
  }) + header("booking") + `
  <main id="main">
    <section class="page-hero booking-hero"><div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Book a service</span></nav>
      <h1>Book a service in <span class="grad-text">under 2 minutes</span></h1>
      <p>Choose a studio, pick a service and a time that suits you. You'll get a reference number instantly — no account needed.</p>
      <div class="btn-row"><a class="btn btn-ghost btn-sm" href="#track"><i class="fa-solid fa-magnifying-glass"></i> Track a booking or quote</a><a class="btn btn-ghost btn-sm" href="/portal/"><i class="fa-regular fa-circle-user"></i> Client portal</a></div>
    </div></section>

    <section class="section" style="padding-top:10px" id="book">
      <div class="container">
        <div class="wizard" id="wizard">
          <ol class="wz-steps" aria-label="Booking steps">
            <li class="active" data-step-label="1"><span>1</span> Studio</li><li data-step-label="2"><span>2</span> Service</li><li data-step-label="3"><span>3</span> Schedule</li><li data-step-label="4"><span>4</span> Your details</li><li data-step-label="5"><span>5</span> Confirm</li>
          </ol>
          <div class="wz-body">
            <div class="wz-panel active" data-step="1">
              <h2>Which studio would you like to book?</h2>
              <div class="wz-studios" id="wz-studios">${studios.map(s => `<button type="button" class="wz-studio" data-studio="${esc(s.id)}" style="--c:${esc(s.color)}"><i class="${esc(s.icon)}"></i><strong>${esc(s.name)}</strong><span>${esc(s.headline || s.tagline)}</span><em>${esc(s.mode || "")}</em></button>`).join("")}</div>
            </div>
            <div class="wz-panel" data-step="2"><h2>Choose a service</h2><div class="wz-services" id="wz-services"></div></div>
            <div class="wz-panel" data-step="3">
              <h2>When suits you?</h2>
              <div class="form-grid">
                <div class="field full"><label>How should we meet?</label><div class="wz-modes" id="wz-modes">
                  <label><input type="radio" name="mode" value="remote" checked><span><i class="fa-solid fa-video"></i> Online / phone</span></label>
                  <label><input type="radio" name="mode" value="in-person"><span><i class="fa-solid fa-location-dot"></i> In person</span></label></div></div>
                <div class="field"><label for="wz-date">Date <span class="req">*</span></label><input id="wz-date" type="date" required></div>
                <div class="field"><label>Time <span class="req">*</span></label><div class="wz-times" id="wz-times"></div></div>
              </div>
              <p class="hint-line"><i class="fa-regular fa-clock"></i> We work Monday – Saturday, 7:00 AM – 8:00 PM (Ghana time, GMT).</p>
            </div>
            <div class="wz-panel" data-step="4">
              <h2>Your details</h2>
              <p class="hint-line" id="wz-signed"><i class="fa-regular fa-circle-user"></i> Have an account? <a href="/portal/?next=/booking/">Sign in</a> to save this booking to your portal.</p>
              <div class="form-grid" id="wz-details">
                <div class="field"><label for="b-name">Full name <span class="req">*</span></label><input id="b-name" autocomplete="name" maxlength="100"></div>
                <div class="field"><label for="b-email">Email <span class="req">*</span></label><input id="b-email" type="email" autocomplete="email" maxlength="150"></div>
                <div class="field"><label for="b-phone">Phone / WhatsApp <span class="req">*</span></label><input id="b-phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+233 ..."></div>
                <div class="field"><label for="b-company">Company / organisation</label><input id="b-company" maxlength="120"></div>
                <div class="field full"><label for="b-notes">Tell us a little about what you need</label><textarea id="b-notes" maxlength="3000" placeholder="Goals, quantities, location for site visits, anything we should know…"></textarea></div>
              </div>
            </div>
            <div class="wz-panel" data-step="5"><h2>Review & confirm</h2><div id="wz-review"></div></div>
            <div class="wz-panel" data-step="6"><div id="wz-done"></div></div>
          </div>
          <div class="wz-foot"><button class="btn btn-ghost" type="button" id="wz-back" hidden><i class="fa-solid fa-arrow-left"></i> Back</button><span class="spacer"></span><button class="btn btn-primary" type="button" id="wz-next" hidden>Continue <i class="fa-solid fa-arrow-right"></i></button></div>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="track">
      <div class="container">
        <div class="section-head"><span class="eyebrow"><i class="fa-solid fa-magnifying-glass"></i> Track</span><h2>Track a booking or quote</h2><p>Enter the reference number you received (e.g. PJB7K2M9QXA or PJO4R8T2LVA).</p></div>
        <form class="track-form" id="track-form"><label class="sr-only" for="track-ref">Reference number</label><input class="input" id="track-ref" placeholder="Reference number" maxlength="20" autocomplete="off"><button class="btn btn-primary" type="submit">Track</button></form>
        <div id="track-result"></div>
      </div>
    </section>

    ${section("faq", "FAQ", "fa-solid fa-circle-question", "Booking questions", "", `<div class="faq-list">${R.renderStudioFaqs({ faqs })}</div>`)}
  </main>` + footer(["/assets/js/booking.js"]);
}

// ======================= CLIENT PORTAL =======================
function portalPage() {
  return head({ title: "Client Portal — ProfJero Hub", desc: "Sign in to the ProfJero Hub client portal to track bookings, approve quotes, follow project progress, download files and message the team.", path: "/portal/", noindex: true }) + header("portal") + `
  <main id="main" class="portal-main">
    <div id="portal-root"><div class="boot-loader"><img src="/assets/img/brand/mark-192.png" alt="" width="56" height="56"></div></div>
  </main>` + footer(["/assets/js/portal.js"]);
}

// ======================= FEEDS =======================
function sitemap() {
  const urls = [
    ["/", "1.0", "weekly", ["/assets/img/brand/og-hub.jpg", "/assets/img/people/benjamin-amoako.webp", "/assets/img/people/hero-bg.webp", "/assets/img/brand/icon-512.png"]],
    ...studios.map(s => [R.studioPath(s), "0.9", "weekly", [STUDIO_HERO[s.id]].filter(Boolean)]),
    ["/work", "0.8", "weekly", DEFAULT_PROJECTS.map(p => p.cover).filter(c => c && c.startsWith("/"))],
    ["/booking/", "0.8", "monthly", []]
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(([p, pr, f, imgs]) => `  <url>
    <loc>${URL_BASE}${p}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${f}</changefreq>
    <priority>${pr}</priority>${imgs.map(i => `
    <image:image><image:loc>${URL_BASE}${i}</image:loc></image:image>`).join("")}
  </url>`).join("\n")}
</urlset>
`;
}

function llms() {
  return [
    "# ProfJero Hub",
    "",
    "> ProfJero Hub (https://profjerohub.pages.dev) is a group of four studios founded by Benjamin Amoako (ProfJero) in Cape Coast, Ghana. Tagline: Unveiling the Extraordinary.",
    "",
    `- Contact: ${site.email} · ${site.phone} · WhatsApp https://wa.me/${site.whatsapp}`,
    "- Hours: Monday–Saturday, 7:00 AM – 8:00 PM (GMT)",
    "- Book online: https://profjerohub.pages.dev/booking/ · Client portal: https://profjerohub.pages.dev/portal/",
    "- Founder portfolio: https://profjero.pages.dev/",
    "",
    "## Studios",
    "",
    ...studios.flatMap(s => [`### [ProfJero ${s.name}](${URL_BASE}${R.studioPath(s)})`, "", s.intro || s.description, "", `Delivery: ${s.mode || "—"}`, "", "Services:", ...(s.services || []).map(x => `- ${x.title}: ${x.text}`), "", "Packages (starting prices):", ...(s.packages || []).map(p => `- ${p.name}: ${[p.prefix, p.price].filter(Boolean).join(" ")}${p.priceUsd ? ` (${p.priceUsd})` : ""}${p.period && p.period !== "one-off" ? " " + p.period : ""}`), ""]),
    "## Branded products (Creative Studio)",
    "",
    ...DEFAULT_PRODUCTS.map(p => `- ${p.name} (${p.category}): from ${p.priceFrom} ${p.unit || ""}, minimum ${p.minQty}, ready in ${p.leadTime}. Methods: ${(p.methods || []).join(", ")}.`),
    "",
    "## FAQ",
    "",
    ...hub.faqs.flatMap(f => [`### ${f.q}`, "", f.a, ""])
  ].join("\n") + "\n";
}

// ======================= WRITE =======================
const files = {
  "index.html": homePage(),
  "work.html": workPage(),
  ...Object.fromEntries(studios.map(s => [`${s.page || s.id}.html`, studioPage(s)])),
  "booking/index.html": bookingPage(),
  "portal/index.html": portalPage(),
  "sitemap.xml": sitemap(),
  "llms.txt": llms()
};
export default async function buildPages() {
  await mkdir(new URL("booking/", OUT), { recursive: true });
  await mkdir(new URL("portal/", OUT), { recursive: true });
  for (const [name, html] of Object.entries(files)) await writeFile(new URL(name, OUT), html);
}
