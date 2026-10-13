import { $, $$, initCommon, applySettings, reveal, toast } from "./ui.js";
import { loadSettings, loadCollection, loadPosts, firebase, mergeSettings, DEFAULTS, seedPosts } from "./store.js";
import { homeSections, faqSchema, projectCover } from "./render.js";
import { esc, safeUrl, parseVideo, isEmail, byOrder, img } from "./utils.js";
import { renderMarkdown } from "./markdown.js";
import { SITE } from "./config.js";

initCommon();

const state = {
  settings: mergeSettings(),
  projects: DEFAULTS.projects,
  studios: DEFAULTS.studios
};

const containers = {
  about: "#about-body", skills: "#skills-grid", "studio-tabs": "#studio-tabs", "studio-panels": "#studio-panels",
  process: "#process-list", "project-filters": "#project-filters", projects: "#project-grid", "tl-work": "#tl-work",
  "tl-edu": "#tl-edu", testimonials: "#testimonial-list", pricing: "#pricing-list", posts: "#latest-posts", faqs: "#faq-list"
};

function paint(data) {
  const sections = homeSections(data);
  for (const [key, sel] of Object.entries(containers)) {
    const el = $(sel);
    if (!el || sections[key] === undefined || el.innerHTML === sections[key]) continue;
    const seen = el.querySelector(".in-view");   // keep already-revealed sections visible on repaint
    el.innerHTML = sections[key];
    if (seen) el.querySelectorAll(".reveal, .bar").forEach(x => x.classList.add("in-view"));
  }
  const s = data.settings;
  applySettings(s);
  $("#faq-schema").textContent = faqSchema(s.faqs);
  $("#status-pill")?.classList.toggle("busy", s.available === false);
  $("#stat-students").hidden = !(Number(s.studentsTrained) > 0);
  if (s.heroImage) $("#hero-img").src = img(s.heroImage, 900);
  if (s.avatar) $("#about-img").src = img(s.avatar, 700);
  const cv = $("#cv-btn");
  if (safeUrl(s.cvUrl)) { cv.href = safeUrl(s.cvUrl); cv.hidden = false; } else cv.hidden = true;
  if (s.seo?.title) document.title = s.seo.title;
  if (s.seo?.description) $('meta[name="description"]')?.setAttribute("content", s.seo.description);

  const studios = data.studios.filter(x => x.active !== false).sort(byOrder);
  $("#footer-studios").innerHTML = studios.map(x => `<li><a href="${esc(safeUrl(x.url) || s.hubUrl)}" target="_blank" rel="noopener">${esc(x.name)}</a></li>`).join("")
    + `<li><a href="${esc(s.hubUrl)}" target="_blank" rel="noopener">ProfJero Hub <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:.7em"></i></a></li>`;
  const svc = $("#c-service");
  const current = svc.value;
  svc.innerHTML = `<option value="">Select a service</option>` + studios.map(st =>
    `<optgroup label="${esc(st.name)}">${(st.services || []).map(x => `<option>${esc(x.title)}</option>`).join("")}</optgroup>`).join("")
    + `<option>IT Training</option><option>Other</option>`;
  svc.value = current;
  startTyping(s.roles);
  reveal();
}

// ---------- Typed roles ----------
let typingTimer;
function startTyping(roles = []) {
  const el = $("#typed");
  clearTimeout(typingTimer);
  if (!el || !roles.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = roles[0]; return; }
  let r = 0, i = roles[0].length, deleting = true;
  const tick = () => {
    const word = roles[r % roles.length];
    i += deleting ? -1 : 1;
    el.textContent = word.slice(0, i);
    let delay = deleting ? 45 : 85;
    if (!deleting && i === word.length) { deleting = true; delay = 1800; }
    else if (deleting && i === 0) { deleting = false; r++; delay = 300; }
    typingTimer = setTimeout(tick, delay);
  };
  typingTimer = setTimeout(tick, 2000);
}

// ---------- Studio tabs ----------
$("#services").addEventListener("click", e => {
  const tab = e.target.closest(".studio-tab");
  if (tab) {
    $$(".studio-tab").forEach(t => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", t === tab); });
    $$(".studio-panel").forEach(p => { const on = p.dataset.panel === tab.dataset.studio; p.hidden = !on; p.classList.toggle("active", on); });
    return;
  }
  const link = e.target.closest("[data-service]");
  if (link) preselect(link.dataset.service);
});
$("#pricing").addEventListener("click", e => {
  const a = e.target.closest("[data-plan]");
  if (a) { $("#c-budget").value = { Starter: "GH₵ 1,000 – 3,000", Business: "GH₵ 3,000 – 7,000", Enterprise: "Above GH₵ 7,000" }[a.dataset.plan] || ""; $("#c-subject").value ||= `${a.dataset.plan} package enquiry`; }
});
function preselect(service) {
  const sel = $("#c-service");
  if ([...sel.options].some(o => o.value === service)) sel.value = service;
  setTimeout(() => $("#c-name").focus({ preventScroll: true }), 700);
}

// ---------- Project filters ----------
$("#project-filters").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$("#project-filters .chip").forEach(c => c.classList.toggle("active", c === chip));
  const f = chip.dataset.filter;
  $$("#project-grid .project-card").forEach(card => card.classList.toggle("hide", f !== "*" && card.dataset.cat !== f));
});

// ---------- Modal (demo / video / details) ----------
const modal = $("#modal");
function openModal(title, body, { tools = "", wide = true, pad = false } = {}) {
  $("#modal-title").textContent = title;
  $(".modal-tools", modal).innerHTML = tools;
  const b = $(".modal-body", modal);
  b.className = "modal-body" + (pad ? " pad" : "");
  b.innerHTML = body;
  modal.style.maxWidth = wide ? "" : "720px";
  modal.showModal();
}
function closeModal() { modal.close(); }
modal.addEventListener("close", () => { $(".modal-body", modal).innerHTML = ""; });
modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });

function videoHtml(v) {
  if (!v.embed) return `<div class="modal-body pad" style="text-align:center;padding:40px"><p>This video opens on ${esc(v.provider)}.</p><a class="btn btn-primary" href="${esc(v.url)}" target="_blank" rel="noopener">Watch on ${v.provider === "tiktok" ? "TikTok" : "the platform"}</a></div>`;
  return `<div class="video-wrap${v.vertical ? " vertical" : ""}">${v.provider === "file"
    ? `<video src="${esc(v.embed)}" controls autoplay playsinline></video>`
    : `<iframe src="${esc(v.embed)}" title="Project demo video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`}</div>`;
}

function showVideo(p) {
  const v = parseVideo(p.videoUrl);
  if (!v) return;
  openModal(`${p.title} — video demo`, videoHtml(v), {
    wide: !v.vertical,
    tools: `<a class="btn btn-ghost btn-sm" href="${esc(v.url)}" target="_blank" rel="noopener"><i class="fa-brands fa-${v.provider === "tiktok" ? "tiktok" : "youtube"}"></i> Open</a>`
  });
}

function showDemo(p) {
  const url = safeUrl(p.demoUrl || p.liveUrl);
  if (!url) return;
  openModal(`${p.title} — live demo`, `
    <div class="demo-stage"><iframe class="demo-frame" src="${esc(url)}" title="${esc(p.title)} live demo" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe></div>
    <div class="demo-note"><i class="fa-solid fa-circle-info"></i> ${esc(p.demoNote || "This is the real, live system. Some sites limit features inside a preview — open it in a new tab for the full experience.")}</div>`, {
    tools: `<div class="device-switch" role="group" aria-label="Preview size">
        <button class="active" data-device="" aria-label="Desktop"><i class="fa-solid fa-desktop"></i></button>
        <button data-device="tablet" aria-label="Tablet"><i class="fa-solid fa-tablet-screen-button"></i></button>
        <button data-device="mobile" aria-label="Mobile"><i class="fa-solid fa-mobile-screen"></i></button></div>
      <a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> New tab</a>`
  });
}
modal.addEventListener("click", e => {
  const b = e.target.closest("[data-device]");
  if (!b) return;
  $$("[data-device]", modal).forEach(x => x.classList.toggle("active", x === b));
  const f = $(".demo-frame", modal);
  f.className = "demo-frame " + b.dataset.device;
});

function showDetails(p) {
  const cover = projectCover(p, 1200);
  const v = parseVideo(p.videoUrl);
  const live = safeUrl(p.liveUrl);
  openModal(p.title, `
    ${cover ? `<img class="details-cover" src="${esc(cover)}" alt="${esc(p.title)}" onerror="this.remove()">` : ""}
    <div class="details-grid">
      <div class="prose" style="font-size:1rem">${renderMarkdown(p.description || p.summary || "").html}</div>
      <dl class="details-side">
        ${p.client ? `<div><dt>Client</dt><dd>${esc(p.client)}</dd></div>` : ""}
        ${p.year ? `<div><dt>Year</dt><dd>${esc(p.year)}</dd></div>` : ""}
        <div><dt>Category</dt><dd>${esc(p.category || "")}</dd></div>
        <div><dt>Stack</dt><dd><div class="tags">${(p.tech || []).map(t => `<span>${esc(t)}</span>`).join("")}</div></dd></div>
        ${p.demoNote ? `<div><dt>Demo access</dt><dd>${esc(p.demoNote)}</dd></div>` : ""}
        <div class="btn-row">
          ${safeUrl(p.demoUrl) ? `<button class="btn btn-primary btn-sm" data-action="demo" data-id="${esc(p.id)}"><i class="fa-solid fa-display"></i> Live demo</button>` : ""}
          ${v ? `<button class="btn btn-ghost btn-sm" data-action="video" data-id="${esc(p.id)}"><i class="fa-solid fa-circle-play"></i> Video</button>` : ""}
          ${live ? `<a class="btn btn-ghost btn-sm" href="${esc(live)}" target="_blank" rel="noopener">Visit <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}
          ${safeUrl(p.repoUrl) ? `<a class="btn btn-ghost btn-sm" href="${esc(safeUrl(p.repoUrl))}" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> Code</a>` : ""}
          <a class="btn btn-outline btn-sm" href="#contact" data-close>Build something like this</a>
        </div>
      </dl>
    </div>`, { pad: true });
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const p = state.projects.find(x => x.id === btn.dataset.id);
  if (!p) return;
  if (modal.open) modal.close();
  ({ demo: showDemo, video: showVideo, details: showDetails })[btn.dataset.action]?.(p);
});

// ---------- Contact form → Firestore "messages" ----------
const form = $("#contact-form");
form.addEventListener("submit", async e => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form));
  if (fd.website) return; // honeypot
  let ok = true;
  for (const [name, test] of [["name", v => v.trim().length >= 2], ["email", isEmail], ["message", v => v.trim().length >= 10]]) {
    const field = form.elements[name].closest(".field");
    const valid = test(fd[name] || "");
    field.classList.toggle("invalid", !valid);
    if (!valid && ok) { form.elements[name].focus(); ok = false; }
  }
  if (!ok) { toast("Please fill in your name, a valid email and a message (10+ characters).", "error"); return; }
  try {
    const last = Number(localStorage.getItem("pj_msg_ts") || 0);
    if (Date.now() - last < 30000) { toast("Please wait a few seconds before sending another message.", "info"); return; }
  } catch { }
  const btn = $("button[type=submit]", form);
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
  try {
    const { db, collection, addDoc, serverTimestamp } = await firebase();
    await addDoc(collection(db, "messages"), {
      name: fd.name.trim().slice(0, 100), email: fd.email.trim().toLowerCase().slice(0, 150),
      phone: (fd.phone || "").trim().slice(0, 30), service: (fd.service || "").slice(0, 120),
      budget: (fd.budget || "").slice(0, 60), subject: (fd.subject || "").trim().slice(0, 150),
      message: fd.message.trim().slice(0, 5000), source: SITE.id, page: location.href.slice(0, 300),
      status: "new", createdAt: serverTimestamp()
    });
    try { localStorage.setItem("pj_msg_ts", String(Date.now())); } catch { }
    form.parentElement.innerHTML = `<div class="form-success"><i class="fa-solid fa-circle-check"></i><h3>Message sent — thank you, ${esc(fd.name.split(" ")[0])}!</h3><p style="color:var(--muted)">I've received your message and will reply to <b>${esc(fd.email)}</b> within 24 hours. For anything urgent, WhatsApp is fastest.</p><a class="btn btn-primary" href="https://wa.me/${esc(String(state.settings.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp</a></div>`;
  } catch (err) {
    console.error(err);
    toast("Couldn't send your message. Please try again or reach me on WhatsApp.", "error", 6000);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send message';
  }
});
form.addEventListener("input", e => e.target.closest(".field")?.classList.remove("invalid"));

// ---------- Boot ----------
const fallback = { settings: state.settings, ...DEFAULTS, posts: seedPosts() };
paint(fallback);

Promise.all([
  loadSettings(), loadCollection("skills"), loadCollection("studios"), loadCollection("projects"),
  loadCollection("testimonials"), loadCollection("experience"), loadPosts()
]).then(([settings, skills, studios, projects, testimonials, experience, posts]) => {
  Object.assign(state, { settings, projects, studios });
  paint({ settings, skills, studios, projects, testimonials, experience, posts });
});
