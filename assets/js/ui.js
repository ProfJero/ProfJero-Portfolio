// Shared UI for all public pages: theme, navigation, reveal animations,
// toasts, settings bindings, newsletter and visit tracking.
import { esc, yearsSince, isEmail, safeUrl } from "./utils.js";
import { renderSocials } from "./render.js";
import { firebase, trackVisit } from "./store.js";
import { SITE } from "./config.js";

document.documentElement.classList.add("js");
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- Theme ----------
export function initTheme() {
  const btn = $(".theme-toggle");
  btn?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("pj_theme", next); } catch { }
    $('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#060B18" : "#0A60EE");
  });
}

// ---------- Header / nav ----------
export function initNav() {
  const header = $(".site-header");
  const toggle = $(".nav-toggle");
  const bar = $(".progress-bar");
  const toTop = $(".to-top");
  toggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
    toggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
  });
  $$(".nav-links a").forEach(a => a.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    toggle?.setAttribute("aria-expanded", "false");
    if (toggle) toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
  }));
  let ticking = false;
  const onScroll = () => {
    const y = scrollY;
    header?.classList.toggle("scrolled", y > 8);
    toTop?.classList.toggle("show", y > 700);
    if (bar) {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  toTop?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  // Highlight the nav link of the section in view
  const links = $$('.nav-links a[href^="#"], .nav-links a[href^="/#"]');
  const map = new Map(links.map(a => [a.getAttribute("href").replace(/^\/?#/, ""), a]));
  const secs = [...map.keys()].map(id => document.getElementById(id)).filter(Boolean);
  if (secs.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove("active"));
          map.get(e.target.id)?.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach(s => io.observe(s));
  }
}

// ---------- Reveal on scroll ----------
let revealObserver;
export function reveal(root = document) {
  const els = $$(".reveal:not(.in-view), .bar:not(.in-view)", root);
  if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in-view")); return; }
  revealObserver ||= new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in-view"); revealObserver.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .05 });
  els.forEach(e => revealObserver.observe(e));
}

// ---------- Toasts ----------
export function toast(msg, type = "success", ms = 3800) {
  let box = $(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  const icon = type === "error" ? "fa-circle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
  t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(msg)}</span>`;
  box.append(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = ".3s"; setTimeout(() => t.remove(), 300); }, ms);
}

// ---------- Settings bindings ----------
const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);

/**
 * Applies settings to elements:
 *  data-s="path"           -> textContent
 *  data-s-href="mailto:{email}" -> href built from a template
 *  data-years              -> years of experience (auto-calculated)
 *  data-socials            -> social icon links
 */
export function applySettings(s) {
  const years = yearsSince(s.careerStart);
  $$("[data-s]").forEach(el => {
    const v = get(s, el.dataset.s);
    if (v !== undefined && v !== null && v !== "") el.textContent = String(v).replace(/\{years\}/g, years);
  });
  $$("[data-s-href]").forEach(el => {
    const href = el.dataset.sHref.replace(/\{([\w.]+)\}/g, (_, k) => get(s, k) ?? "");
    const clean = el.dataset.sHref.startsWith("tel:") ? href.replace(/[^\d+:a-z]/gi, "") : href;
    el.setAttribute("href", clean);
  });
  $$("[data-years]").forEach(el => { el.textContent = years; });
  $$("[data-socials]").forEach(el => { el.innerHTML = renderSocials(s.socials); });
  $$("[data-hub]").forEach(el => { if (safeUrl(s.hubUrl)) el.href = s.hubUrl; });
  $$(".wa-float").forEach(el => { if (s.whatsapp) el.href = `https://wa.me/${String(s.whatsapp).replace(/\D/g, "")}`; });
  const ann = $(".announce");
  if (ann && s.announcement) {
    let dismissed = false;
    try { dismissed = localStorage.getItem("pj_ann") === s.announcement; } catch { }
    if (!dismissed) {
      ann.hidden = false;
      $("span", ann).textContent = s.announcement;
      $("button", ann).onclick = () => { ann.hidden = true; try { localStorage.setItem("pj_ann", s.announcement); } catch { } };
    }
  }
}

// ---------- Newsletter ----------
export function initNewsletter() {
  $$("form[data-newsletter]").forEach(form => form.addEventListener("submit", async e => {
    e.preventDefault();
    const input = $("input[type=email]", form);
    const email = input.value.trim().toLowerCase();
    if (!isEmail(email)) { toast("Please enter a valid email address.", "error"); input.focus(); return; }
    const btn = $("button", form);
    btn.disabled = true;
    try {
      const { db, doc, setDoc, serverTimestamp } = await firebase();
      await setDoc(doc(db, "subscribers", email), { email, source: SITE.id, page: location.pathname, createdAt: serverTimestamp() });
      toast("You're subscribed! Thanks for joining.");
      form.reset();
    } catch (err) {
      // A permission error here means the address already exists (rules forbid overwriting).
      if (err?.code === "permission-denied") toast("You're already subscribed. Thank you!", "info");
      else toast("Couldn't subscribe right now. Please try again.", "error");
    } finally { btn.disabled = false; }
  }));
}

// ---------- Code copy buttons (articles) ----------
export function initCopyButtons(root = document) {
  root.addEventListener("click", async e => {
    const btn = e.target.closest(".copy-code");
    if (!btn) return;
    const code = btn.closest(".code-block")?.querySelector("code")?.innerText || "";
    try { await navigator.clipboard.writeText(code); btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 1800); } catch { }
  });
}

export function initCommon() {
  initTheme();
  initNav();
  initNewsletter();
  reveal();
  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  trackVisit();
  import("./firebase.js").then(m => m.startAnalytics()).catch(() => { });
}
