// Shared browser behaviour for every ProfJero Hub page.
import { $, $$, initCommon, applySettings, toast, reveal } from "./ui.js";
import { look } from "./appearance.js";
import { loadSettings, loadDoc, firebase } from "./store.js";
import { esc, safeUrl, parseVideo, isEmail, img } from "./utils.js";
import { renderMarkdown } from "./markdown.js";
import { projectCover } from "./render.js";
import { HUB_SETTINGS } from "./hub-defaults.js";
import { SITE } from "./config.js";

export { $, $$, toast, reveal, esc };

// ---------- Boot ----------
export async function bootCommon() {
  initCommon();
  initMenus();
  const [site, hub] = await Promise.all([loadSettings(), loadDoc("settings/hub", HUB_SETTINGS)]);
  applySettings(site);
  if (hub.announcement) applySettings({ ...site, announcement: hub.announcement });
  $$("[data-h]").forEach(el => { const v = hub[el.dataset.h]; if (typeof v === "string" && v) el.textContent = v; });
  return { site, hub };
}

function initMenus() {
  $$(".has-menu").forEach(m => {
    const btn = $(".menu-btn", m);
    btn.addEventListener("click", e => { e.stopPropagation(); const open = !m.classList.contains("open"); m.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".has-menu")) $$(".has-menu.open").forEach(m => { m.classList.remove("open"); $(".menu-btn", m).setAttribute("aria-expanded", "false"); }); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".has-menu.open").forEach(m => m.classList.remove("open")); });
}

// ---------- Reference codes (booking / order ids) ----------
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeRef(prefix = "B") {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `PJ${prefix}${[...bytes].map(b => ALPHABET[b % ALPHABET.length]).join("")}`;
}

// ---------- Water ripple on photo heroes ----------
let ripples = null;
export async function initWater(enabled = true) {
  const hero = $(".hero-water");
  const want = hero && enabled && look().ripples !== false && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!want) { ripples?.destroy(); ripples = null; return; }
  if (ripples) return;
  try {
    const { Ripples, ripplesSupported } = await import("./ripples.js");
    if (ripplesSupported()) ripples = new Ripples(hero, { resolution: innerWidth < 700 ? 192 : 320, dropRadius: innerWidth < 700 ? 16 : 22, perturbance: 0.035 });
  } catch (e) { console.warn("Water effect unavailable:", e.message); }
}
addEventListener("pj:look", () => initWater(window.__pjWater !== false));

export function setHeroImage(url, overlay) {
  const hero = $(".hero-water");
  if (!hero) return;
  if (url && !/\/assets\/img\/people\/hero-bg\.webp$/.test(url)) {
    hero.style.setProperty("--hero-bg", `url("${img(url, 1920)}")`);
    hero.style.setProperty("--hero-bg-sm", `url("${img(url, 900)}")`);
    ripples?.setImage(img(url, innerWidth < 700 ? 900 : 1920));
  }
  if (overlay !== undefined) hero.style.setProperty("--hero-overlay", Math.min(1, Math.max(0, Number(overlay) / 100)));
}

// ---------- Modal ----------
const modal = () => $("#modal");
export function openModal(title, body, { tools = "", wide = true, pad = false } = {}) {
  const m = modal();
  $("#modal-title", m).textContent = title;
  $(".modal-tools", m).innerHTML = tools;
  const b = $(".modal-body", m);
  b.className = "modal-body" + (pad ? " pad" : "");
  b.innerHTML = body;
  m.style.maxWidth = wide ? "" : "720px";
  if (!m.open) m.showModal();
  return b;
}
export const closeModal = () => modal()?.open && modal().close();
document.addEventListener("click", e => {
  const m = modal();
  if (m && (e.target === m || e.target.closest("#modal [data-close]"))) closeModal();
});
document.addEventListener("close", e => { if (e.target === modal()) $(".modal-body", modal()).innerHTML = ""; }, true);

// ---------- Projects: demo / video / details ----------
export function initProjectModals(getProjects) {
  const videoHtml = v => !v.embed
    ? `<div class="pad" style="text-align:center;padding:40px"><p>This video opens on ${esc(v.provider)}.</p><a class="btn btn-primary" href="${esc(v.url)}" target="_blank" rel="noopener">Watch the video</a></div>`
    : `<div class="video-wrap${v.vertical ? " vertical" : ""}">${v.provider === "file" ? `<video src="${esc(v.embed)}" controls autoplay playsinline></video>` : `<iframe src="${esc(v.embed)}" title="Project demo video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`}</div>`;
  const actions = {
    video(p) {
      const v = parseVideo(p.videoUrl);
      if (v) openModal(`${p.title} — video demo`, videoHtml(v), { wide: !v.vertical, tools: `<a class="btn btn-ghost btn-sm" href="${esc(v.url)}" target="_blank" rel="noopener">Open</a>` });
    },
    demo(p) {
      const url = safeUrl(p.demoUrl || p.liveUrl);
      if (!url) return;
      openModal(`${p.title} — live demo`, `
        <div class="demo-stage"><iframe class="demo-frame" src="${esc(url)}" title="${esc(p.title)} live demo" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe></div>
        <div class="demo-note"><i class="fa-solid fa-circle-info"></i> ${esc(p.demoNote || "This is the real, live system. Open it in a new tab for the full experience.")}</div>`, {
        tools: `<div class="device-switch" role="group" aria-label="Preview size"><button class="active" data-device="" aria-label="Desktop"><i class="fa-solid fa-desktop"></i></button><button data-device="tablet" aria-label="Tablet"><i class="fa-solid fa-tablet-screen-button"></i></button><button data-device="mobile" aria-label="Mobile"><i class="fa-solid fa-mobile-screen"></i></button></div>
          <a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> New tab</a>`
      });
    },
    details(p) {
      const cover = projectCover(p, 1200), v = parseVideo(p.videoUrl), live = safeUrl(p.liveUrl);
      openModal(p.title, `
        ${cover ? `<img class="details-cover" src="${esc(cover)}" alt="${esc(p.title)}" onerror="this.remove()">` : ""}
        <div class="details-grid">
          <div class="prose" style="font-size:1rem">${renderMarkdown(p.description || p.summary || "").html}</div>
          <dl class="details-side">
            ${p.client ? `<div><dt>Client</dt><dd>${esc(p.client)}</dd></div>` : ""}${p.year ? `<div><dt>Year</dt><dd>${esc(p.year)}</dd></div>` : ""}
            <div><dt>Category</dt><dd>${esc(p.category || "")}</dd></div>
            <div><dt>Stack / tools</dt><dd><div class="tags">${(p.tech || []).map(t => `<span>${esc(t)}</span>`).join("")}</div></dd></div>
            ${p.demoNote ? `<div><dt>Demo access</dt><dd>${esc(p.demoNote)}</dd></div>` : ""}
            <div class="btn-row">
              ${safeUrl(p.demoUrl) ? `<button class="btn btn-primary btn-sm" data-action="demo" data-id="${esc(p.id)}"><i class="fa-solid fa-display"></i> Live demo</button>` : ""}
              ${v ? `<button class="btn btn-ghost btn-sm" data-action="video" data-id="${esc(p.id)}"><i class="fa-solid fa-circle-play"></i> Video</button>` : ""}
              ${live ? `<a class="btn btn-ghost btn-sm" href="${esc(live.startsWith("/") ? SITE.portfolioUrl + live : live)}" target="_blank" rel="noopener">Visit <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}
              <a class="btn btn-outline btn-sm" href="/booking/?studio=${esc(p.studio || "digital-studio")}">Start a similar project</a>
            </div>
          </dl>
        </div>`, { pad: true });
    }
  };
  document.addEventListener("click", e => {
    const d = e.target.closest("[data-device]");
    if (d) { $$("[data-device]").forEach(x => x.classList.toggle("active", x === d)); $(".demo-frame").className = "demo-frame " + d.dataset.device; return; }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const p = getProjects().find(x => x.id === btn.dataset.id);
    if (p) actions[btn.dataset.action]?.(p);
  });
}

export function initWorkFilters(root = document) {
  root.addEventListener("click", e => {
    const chip = e.target.closest("#work-filters .chip");
    if (!chip) return;
    $$("#work-filters .chip").forEach(c => c.classList.toggle("active", c === chip));
    const f = chip.dataset.filter;
    $$("#work-grid .project-card").forEach(card => card.classList.toggle("hide", f !== "*" && `studio:${card.dataset.studio}` !== f && card.dataset.cat !== f));
  });
}

// ---------- Contact form → messages (source: hub) ----------
export function initContactForm() {
  const form = $("#contact-form");
  if (!form) return;
  form.addEventListener("input", e => e.target.closest(".field")?.classList.remove("invalid"));
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    if (fd.website) return;
    let ok = true;
    for (const [name, test] of [["name", v => v.trim().length >= 2], ["email", isEmail], ["message", v => v.trim().length >= 10]]) {
      const valid = test(fd[name] || "");
      form.elements[name].closest(".field").classList.toggle("invalid", !valid);
      if (!valid && ok) { form.elements[name].focus(); ok = false; }
    }
    if (!ok) return toast("Please add your name, a valid email and a message (10+ characters).", "error");
    const btn = $("button[type=submit]", form);
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
    try {
      const { db, collection, addDoc, serverTimestamp } = await firebase();
      await addDoc(collection(db, "messages"), {
        name: fd.name.trim().slice(0, 100), email: fd.email.trim().toLowerCase().slice(0, 150), phone: (fd.phone || "").trim().slice(0, 30),
        studio: (fd.studio || "").slice(0, 80), subject: (fd.subject || "").trim().slice(0, 150), message: fd.message.trim().slice(0, 5000),
        source: SITE.id, page: location.href.slice(0, 300), status: "new", createdAt: serverTimestamp()
      });
      form.parentElement.innerHTML = `<div class="form-success"><i class="fa-solid fa-circle-check"></i><h3>Thank you, ${esc(fd.name.split(" ")[0])}!</h3><p style="color:var(--muted)">Your message reached the ProfJero Hub team. We'll reply to <b>${esc(fd.email)}</b> within 24 hours.</p><a class="btn btn-primary" href="https://wa.me/233531207256" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp</a></div>`;
    } catch (err) {
      console.error(err);
      toast("Couldn't send your message. Please try again or WhatsApp us.", "error", 6000);
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send message';
    }
  });
}

// ---------- Signed-in client (for prefilling forms) ----------
export async function currentClient() {
  try {
    const fb = await firebase();
    const u = await fb.currentUser();
    if (!u || u.isAnonymous) return null;
    let profile = {};
    try { const s = await fb.getDoc(fb.doc(fb.db, "users", u.uid)); if (s.exists()) profile = s.data(); } catch { }
    return { uid: u.uid, email: u.email, name: profile.name || u.displayName || "", phone: profile.phone || "", company: profile.company || "", verified: u.emailVerified };
  } catch { return null; }
}

// ---------- Product quote requests → orders ----------
export function initQuotes(getProducts) {
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-quote]");
    if (!b) return;
    const products = getProducts();
    const p = products.find(x => x.id === b.dataset.quote) || null;
    const me = await currentClient();
    const methods = p?.methods || [];
    const body = openModal(p ? `Request a quote — ${p.name}` : "Custom branding request", `
      ${p ? `<div class="quote-product"><i class="${esc(p.icon || "fa-solid fa-box")}"></i><div><strong>${esc(p.name)}</strong><span>From ${esc(p.priceFrom)} ${esc(p.unit || "")} · min. ${esc(p.minQty)} · ready in ${esc(p.leadTime)}</span></div></div>` : ""}
      <form id="quote-form" novalidate><div class="form-grid">
        ${p ? "" : `<div class="field full"><label for="q-product">What would you like branded? <span class="req">*</span></label><input id="q-product" name="product" required maxlength="120" placeholder="e.g. 200 branded water bottles for a conference"></div>`}
        <div class="field"><label for="q-qty">Quantity <span class="req">*</span></label><input id="q-qty" name="quantity" type="number" min="${Number(p?.minQty) || 1}" value="${Number(p?.minQty) || 1}" required></div>
        <div class="field"><label for="q-method">Branding method</label><select id="q-method" name="method"><option value="">Recommend for me</option>${methods.map(m => `<option>${esc(m)}</option>`).join("")}</select></div>
        <div class="field"><label for="q-colors">Logo colours</label><input id="q-colors" name="colors" maxlength="120" placeholder="e.g. 2 colours / full colour"></div>
        <div class="field"><label for="q-deadline">Needed by</label><input id="q-deadline" name="deadline" type="date" min="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field full"><label for="q-art">Logo / artwork link (optional)</label><input id="q-art" name="artworkUrl" type="url" maxlength="500" placeholder="Google Drive, Dropbox or website link — or send it on WhatsApp later"></div>
        <div class="field"><label for="q-name">Full name <span class="req">*</span></label><input id="q-name" name="name" required maxlength="100" value="${esc(me?.name || "")}"></div>
        <div class="field"><label for="q-email">Email <span class="req">*</span></label><input id="q-email" name="email" type="email" required maxlength="150" value="${esc(me?.email || "")}"></div>
        <div class="field"><label for="q-phone">Phone / WhatsApp</label><input id="q-phone" name="phone" type="tel" maxlength="30" value="${esc(me?.phone || "")}"></div>
        <div class="field"><label for="q-company">Company / organisation</label><input id="q-company" name="company" maxlength="120" value="${esc(me?.company || "")}"></div>
        <div class="field full"><label for="q-notes">Notes</label><textarea id="q-notes" name="notes" maxlength="3000" style="min-height:90px" placeholder="Event, sizes, colours, delivery location…"></textarea></div>
      </div>
      <div class="form-foot"><small>${me ? `<i class="fa-solid fa-circle-user"></i> Saved to your client portal` : `<i class="fa-solid fa-circle-info"></i> <a href="/portal/">Sign in</a> to track quotes in your portal`}</small><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Request quote</button></div></form>`, { wide: false, pad: true });
    $("#quote-form", body).addEventListener("submit", async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      const product = p ? p.name : (f.product || "").trim();
      const qty = parseInt(f.quantity, 10);
      if (product.length < 2 || !(qty >= 1) || f.name.trim().length < 2 || !isEmail(f.email)) return toast("Please complete the product, quantity, your name and a valid email.", "error");
      const ref = makeRef("O");
      const btn = $("button[type=submit]", ev.target);
      btn.disabled = true;
      try {
        const { db, doc, setDoc, serverTimestamp } = await firebase();
        await setDoc(doc(db, "orders", ref), {
          ref, productId: p?.id || "custom", product: product.slice(0, 120), category: p?.category || "Custom", quantity: Math.min(qty, 100000),
          method: (f.method || "").slice(0, 80), colors: (f.colors || "").slice(0, 120), artworkUrl: (safeUrl(f.artworkUrl) || "").slice(0, 500),
          deadline: (f.deadline || "").slice(0, 20), budget: "", name: f.name.trim().slice(0, 100), email: f.email.trim().toLowerCase().slice(0, 150),
          phone: (f.phone || "").trim().slice(0, 30), company: (f.company || "").trim().slice(0, 120), notes: (f.notes || "").trim().slice(0, 3000),
          uid: me?.uid || null, status: "requested", source: SITE.id, createdAt: serverTimestamp()
        });
        body.innerHTML = refSuccess(ref, "Quote request received", `We'll send your quote to <b>${esc(f.email)}</b> within 24 hours.`, `Hi ProfJero Hub, I just requested a quote (${ref}) for ${qty} × ${product}.`);
      } catch (err) {
        console.error(err); btn.disabled = false;
        toast("Couldn't send your request. Please try again or WhatsApp us.", "error", 6000);
      }
    });
  });
}

export function refSuccess(ref, title, text, waText) {
  return `<div class="ref-box"><i class="fa-solid fa-circle-check"></i><h3>${esc(title)}</h3>
    <p style="color:var(--muted)">Your reference number:</p>
    <div class="ref-code">${esc(ref)} <button type="button" onclick="navigator.clipboard.writeText('${esc(ref)}');this.innerHTML='<i class=\\'fa-solid fa-check\\'></i>'" aria-label="Copy reference"><i class="fa-regular fa-copy"></i></button></div>
    <p style="color:var(--muted)">${text}</p>
    <div class="btn-row" style="justify-content:center">
      <a class="btn btn-primary" href="/booking/?track=${encodeURIComponent(ref)}#track"><i class="fa-solid fa-magnifying-glass"></i> Track status</a>
      <a class="btn btn-ghost" href="https://wa.me/233531207256?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Send on WhatsApp</a>
      <a class="btn btn-ghost" href="/portal/"><i class="fa-regular fa-circle-user"></i> Client portal</a>
    </div></div>`;
}
