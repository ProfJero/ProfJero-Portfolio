// HTML renderers shared by the browser and Cloudflare Pages Functions (SSR).
// Pure string functions: no DOM access.
import { esc, safeUrl, img, parseVideo, compact, formatDate, readingTime, initials, hueFrom, byOrder, yearsSince, toDate } from "./utils.js";

const SOCIAL_ICONS = {
  whatsapp: ["fa-brands fa-whatsapp", "WhatsApp"], facebook: ["fa-brands fa-facebook-f", "Facebook"],
  tiktok: ["fa-brands fa-tiktok", "TikTok"], youtube: ["fa-brands fa-youtube", "YouTube"],
  linkedin: ["fa-brands fa-linkedin-in", "LinkedIn"], github: ["fa-brands fa-github", "GitHub"],
  x: ["fa-brands fa-x-twitter", "X (Twitter)"], instagram: ["fa-brands fa-instagram", "Instagram"]
};

export function renderSocials(socials = {}) {
  return Object.entries(SOCIAL_ICONS)
    .filter(([k]) => safeUrl(socials[k]))
    .map(([k, [icon, label]]) => `<a class="social" href="${esc(safeUrl(socials[k]))}" target="_blank" rel="noopener me" aria-label="${label}" title="${label}"><i class="${icon}"></i></a>`)
    .join("");
}

/** Replaces {years} placeholders with the live experience count. */
export const withYears = (text, s) => String(text || "").replace(/\{years\}/g, yearsSince(s.careerStart));

export function renderSkills(skills = []) {
  const groups = {};
  [...skills].sort(byOrder).forEach(s => (groups[s.group || "Other"] ||= []).push(s));
  const icons = { Frontend: "fa-solid fa-display", Backend: "fa-solid fa-server", "Databases & Cloud": "fa-solid fa-database", "Tools & Design": "fa-solid fa-pen-nib" };
  return Object.entries(groups).map(([g, list]) => `
    <article class="skill-card reveal">
      <header><span class="skill-icon"><i class="${icons[g] || "fa-solid fa-star"}"></i></span><h3>${esc(g)}</h3></header>
      <ul>${list.map(s => `
        <li>
          <div class="skill-row"><span>${esc(s.name)}</span><span class="skill-pct">${Number(s.level) || 0}%</span></div>
          <div class="bar" role="progressbar" aria-label="${esc(s.name)}" aria-valuenow="${Number(s.level) || 0}" aria-valuemin="0" aria-valuemax="100"><span style="--w:${Number(s.level) || 0}%"></span></div>
        </li>`).join("")}
      </ul>
    </article>`).join("");
}

export function renderStudios(studios = []) {
  const list = studios.filter(s => s.active !== false).sort(byOrder);
  const tabs = list.map((s, i) => `<button class="studio-tab${i === 0 ? " active" : ""}" role="tab" aria-selected="${i === 0}" data-studio="${esc(s.id)}" style="--c:${esc(s.color || "#0A60EE")}"><i class="${esc(s.icon || "fa-solid fa-cube")}"></i><span>${esc(s.name)}</span></button>`).join("");
  const panels = list.map((s, i) => `
    <div class="studio-panel${i === 0 ? " active" : ""}" role="tabpanel" data-panel="${esc(s.id)}" style="--c:${esc(s.color || "#0A60EE")}"${i === 0 ? "" : " hidden"}>
      <div class="studio-head">
        <div class="studio-badge"><i class="${esc(s.icon || "fa-solid fa-cube")}"></i></div>
        <div>
          <h3>${esc(s.name)} <small>${esc(s.tagline || "")}</small></h3>
          <p>${esc(s.description || "")}</p>
        </div>
        ${safeUrl(s.url) ? `<a class="btn btn-studio" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">Visit ${esc(s.name)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}
      </div>
      <div class="service-grid">
        ${(s.services || []).map((sv, j) => `
          <article class="service-card">
            <span class="service-num">${String(j + 1).padStart(2, "0")}</span>
            <h4>${esc(sv.title)}</h4>
            <p>${esc(sv.text || sv.description || "")}</p>
            <a class="service-link" href="#contact" data-service="${esc(sv.title)}">Request this service <i class="fa-solid fa-arrow-right"></i></a>
          </article>`).join("")}
      </div>
    </div>`).join("");
  return { tabs, panels };
}

export function projectCover(p, w = 800) {
  if (p.cover) return img(p.cover, w);
  const v = parseVideo(p.videoUrl);
  if (v?.thumb) return v.thumb;
  const live = safeUrl(p.liveUrl || p.demoUrl);
  if (/^https?:/.test(live)) return `https://s0.wp.com/mshots/v1/${encodeURIComponent(live)}?w=${w}&h=${Math.round(w * 0.625)}`;
  return "";
}

export function renderProjectFilters(projects = []) {
  const cats = [...new Set(projects.map(p => p.category).filter(Boolean))];
  return [`<button class="chip active" data-filter="*">All <span>${projects.length}</span></button>`]
    .concat(cats.map(c => `<button class="chip" data-filter="${esc(c)}">${esc(c)} <span>${projects.filter(p => p.category === c).length}</span></button>`)).join("");
}

export function renderProjects(projects = []) {
  return [...projects].sort(byOrder).map(p => {
    const cover = projectCover(p);
    const video = parseVideo(p.videoUrl);
    const live = safeUrl(p.liveUrl);
    const statusLabel = { live: "Live", "in-progress": "In progress", concept: "Concept", delivered: "Delivered" }[p.status] || "";
    return `
    <article class="project-card reveal" data-cat="${esc(p.category || "")}" data-id="${esc(p.id)}">
      <div class="project-media" style="--h:${hueFrom(p.title)}">
        <div class="project-fallback"><i class="fa-solid fa-window-maximize"></i><span>${esc(p.title)}</span></div>
        ${cover ? `<img src="${esc(cover)}" alt="${esc(p.title)} preview" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        <div class="project-badges">
          ${statusLabel ? `<span class="pill pill-${esc(p.status)}">${p.status === "live" ? '<i class="dot"></i>' : ""}${statusLabel}</span>` : ""}
          ${video ? `<span class="pill pill-video"><i class="fa-brands fa-${video.provider === "tiktok" ? "tiktok" : video.provider === "youtube" ? "youtube" : "film"}"></i> Video</span>` : ""}
        </div>
        ${video ? `<button class="play-btn" data-action="video" data-id="${esc(p.id)}" aria-label="Watch ${esc(p.title)} demo video"><i class="fa-solid fa-play"></i></button>` : ""}
      </div>
      <div class="project-body">
        <div class="project-meta"><span>${esc(p.category || "")}</span>${p.year ? `<span>${esc(p.year)}</span>` : ""}</div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary || "")}</p>
        <div class="tags">${(p.tech || []).slice(0, 5).map(t => `<span>${esc(t)}</span>`).join("")}</div>
        <div class="project-actions">
          ${safeUrl(p.demoUrl) ? `<button class="btn btn-primary btn-sm" data-action="demo" data-id="${esc(p.id)}"><i class="fa-solid fa-display"></i> Try live demo</button>`
            : live ? `<a class="btn btn-primary btn-sm" href="${esc(live)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>` : ""}
          ${video ? `<button class="btn btn-ghost btn-sm" data-action="video" data-id="${esc(p.id)}"><i class="fa-solid fa-circle-play"></i> Watch</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-action="details" data-id="${esc(p.id)}">Details</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function stars(n = 5) {
  return Array.from({ length: 5 }, (_, i) => `<i class="fa-${i < n ? "solid" : "regular"} fa-star"></i>`).join("");
}

export function avatar(name, url, cls = "avatar") {
  return url
    ? `<img class="${cls}" src="${esc(img(url, 120))}" alt="${esc(name)}" loading="lazy" width="48" height="48">`
    : `<span class="${cls} avatar-fallback" style="--h:${hueFrom(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

export function renderTestimonials(list = []) {
  return list.filter(t => t.visible !== false).sort(byOrder).map(t => `
    <figure class="testimonial reveal">
      <div class="stars" aria-label="${Number(t.rating) || 5} out of 5 stars">${stars(Number(t.rating) || 5)}</div>
      <blockquote>“${esc(t.text)}”</blockquote>
      <figcaption>${avatar(t.name, t.avatar)}<div><strong>${esc(t.name)}</strong><span>${esc(t.role || "")}</span></div></figcaption>
    </figure>`).join("");
}

export function renderExperience(list = []) {
  const col = type => list.filter(e => e.type === type).sort(byOrder).map(e => `
    <li class="tl-item reveal">
      <span class="tl-dot"></span>
      <div class="tl-when">${esc([e.start, e.end].filter(Boolean).join(" — "))}</div>
      <h4>${esc(e.title)}</h4>
      <div class="tl-org">${esc(e.org || "")}</div>
      <p>${esc(e.text || "")}</p>
    </li>`).join("");
  return { work: col("work"), education: col("education") };
}

export function renderProcess(steps = []) {
  return steps.map((s, i) => `
    <li class="process-step reveal">
      <span class="process-num">${i + 1}</span>
      <i class="${esc(s.icon || "fa-solid fa-circle")}"></i>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.text)}</p>
    </li>`).join("");
}

export function renderPricing(plans = []) {
  return plans.map(p => `
    <article class="price-card reveal${p.featured ? " featured" : ""}">
      ${p.featured ? '<span class="price-flag">Most popular</span>' : ""}
      <h3>${esc(p.name)}</h3>
      <div class="price"><small>${esc(p.note || "")}</small><strong>${esc(p.price)}</strong></div>
      <ul>${(p.features || []).map(f => `<li><i class="fa-solid fa-check"></i> ${esc(f)}</li>`).join("")}</ul>
      <a class="btn ${p.featured ? "btn-primary" : "btn-outline"}" href="#contact" data-plan="${esc(p.name)}">Discuss your project</a>
    </article>`).join("");
}

export function renderFaqs(faqs = []) {
  return faqs.map((f, i) => `
    <details class="faq reveal"${i === 0 ? " open" : ""}>
      <summary>${esc(f.q)}<i class="fa-solid fa-plus"></i></summary>
      <p>${esc(f.a)}</p>
    </details>`).join("");
}

// ---------- Blog ----------
export function postCover(post, w = 900) {
  return post.cover ? img(post.cover, w) : "";
}

export function postUrl(post) { return `/blog/${encodeURIComponent(post.slug || post.id)}`; }

export function coverFallback(post) {
  return `<div class="cover-fallback" style="--h:${hueFrom(post.category || post.title)}"><span>${esc(post.category || "Blog")}</span><strong>${esc(post.title)}</strong></div>`;
}

export function renderPostCard(post, { big = false } = {}) {
  const cover = postCover(post, big ? 1200 : 700);
  const mins = post.readingTime || readingTime(post.content || "");
  return `
  <article class="post-card reveal${big ? " post-card-big" : ""}">
    <a class="post-media" href="${postUrl(post)}" tabindex="-1" aria-hidden="true">
      ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : coverFallback(post)}
      ${post.featured ? '<span class="pill pill-featured"><i class="fa-solid fa-bolt"></i> Featured</span>' : ""}
    </a>
    <div class="post-body">
      <div class="post-meta">
        <a class="post-cat" href="/blog?category=${encodeURIComponent(post.category || "")}">${esc(post.category || "Article")}</a>
        <span>${formatDate(post.publishedAt)}</span><span>${mins} min read</span>
      </div>
      <h3><a href="${postUrl(post)}">${esc(post.title)}</a></h3>
      <p>${esc(post.excerpt || "")}</p>
      <div class="post-stats" data-post-stats="${esc(post.slug || post.id)}">
        <span title="Views"><i class="fa-regular fa-eye"></i> <b data-k="views">${compact(post.views)}</b></span>
        <span title="Likes"><i class="fa-regular fa-heart"></i> <b data-k="likes">${compact(post.likes)}</b></span>
        <span title="Comments"><i class="fa-regular fa-comment"></i> <b data-k="commentCount">${compact(post.commentCount)}</b></span>
        <a class="read-more" href="${postUrl(post)}">Read <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>
  </article>`;
}

/** Sort helper: newest published first. */
export const byNewest = (a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0);

/** All server-renderable homepage fragments, keyed by their <!--ssr:key--> marker. */
export function homeSections({ settings, skills, studios, projects, testimonials, experience, posts }) {
  const st = renderStudios(studios);
  const tl = renderExperience(experience);
  const latest = [...posts].sort(byNewest).slice(0, 3);
  return {
    about: (settings.about || []).map(p => `<p>${esc(withYears(p, settings))}</p>`).join(""),
    skills: renderSkills(skills),
    "studio-tabs": st.tabs,
    "studio-panels": st.panels,
    process: renderProcess(settings.process),
    "project-filters": renderProjectFilters(projects),
    projects: renderProjects(projects),
    "tl-work": tl.work,
    "tl-edu": tl.education,
    testimonials: renderTestimonials(testimonials),
    pricing: renderPricing(settings.pricing),
    posts: latest.map(p => renderPostCard(p)).join(""),
    faqs: renderFaqs(settings.faqs)
  };
}

/** Replaces the content between <!--ssr:key--> and <!--/ssr:key--> markers. */
export function fillMarkers(html, sections) {
  return html.replace(/<!--ssr:([\w-]+)-->[\s\S]*?<!--\/ssr:\1-->/g, (m, key) =>
    key in sections ? `<!--ssr:${key}-->${sections[key]}<!--/ssr:${key}-->` : m);
}

export function faqSchema(faqs = []) {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
  }).replace(/</g, "\\u003c");
}
