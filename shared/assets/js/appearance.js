// Appearance: theme colour, layout (full/boxed), colour mode, background
// pattern/image, overlay and the hero water effect. Site defaults come from the
// admin (settings.appearance); each visitor can personalise via the Customize panel.
// The inline script in each page's <head> applies the saved look before first paint.
import { esc } from "./utils.js";

export const COLORS = [
  ["#0A60EE", "ProfJero Blue"], ["#1E3A8A", "Navy"], ["#0284C7", "Sky"], ["#0D9488", "Teal"],
  ["#08A15F", "Green"], ["#4F46E5", "Indigo"], ["#7C3AED", "Purple"], ["#DB2777", "Pink"],
  ["#DC2626", "Red"], ["#EA580C", "Orange"], ["#D97706", "Amber"], ["#334155", "Slate"]
];
export const BACKGROUNDS = [
  ...[1, 2, 3, 4, 5].map(n => ({ id: `pattern-${n}`, label: `Pattern ${n}`, thumb: `/assets/img/bg/pattern-${n}.png`, type: "pattern" })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ id: `image-${n}`, label: `Image ${n}`, thumb: `/assets/img/bg/thumb-${n}.webp`, type: "image" }))
];
export const DEFAULT_LOOK = { color: "#0A60EE", layout: "full", mode: "system", bg: "", overlay: false, ripples: true, panel: true };

const read = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

let site = { ...DEFAULT_LOOK, ...read("pj_site_look") };
let prefs = read("pj_prefs");

export const look = () => ({ ...site, ...prefs });

/** Called once live settings load: remembers the admin's defaults for instant paint next visit. */
export function setSiteLook(appearance = {}) {
  site = { ...DEFAULT_LOOK, ...appearance };
  write("pj_site_look", site);
  apply();
}

export function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  if (key === "bg" && value && look().layout !== "boxed") prefs.layout = "boxed"; // backgrounds only show around a boxed page
  write("pj_prefs", prefs);
  apply();
}

export function resetPrefs() {
  prefs = {};
  write("pj_prefs", prefs);
  apply();
}

function resolvedMode(mode) {
  return mode === "dark" || mode === "light" ? mode : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function apply() {
  const l = look();
  const d = document.documentElement;
  d.style.setProperty("--brand-base", /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : DEFAULT_LOOK.color);
  d.dataset.theme = resolvedMode(l.mode);
  const site = !!document.querySelector(".page-wrap"); // layout/background only apply to public pages, not the admin
  site && l.layout === "boxed" ? (d.dataset.layout = "boxed") : delete d.dataset.layout;
  site && l.bg ? (d.dataset.bg = l.bg) : delete d.dataset.bg;
  site && l.overlay ? (d.dataset.overlay = "1") : delete d.dataset.overlay;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", d.dataset.theme === "dark" ? "#060B18" : l.color);
  dispatchEvent(new CustomEvent("pj:look", { detail: l }));
  syncPanel();
}

matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (look().mode === "system") apply(); });

/** The header moon/sun button flips between light and dark. */
export function toggleMode() {
  setPref("mode", document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

// ---------------- Customize panel ----------------
let panel;
function syncPanel() {
  if (!panel) return;
  const l = look();
  panel.querySelectorAll("[data-color]").forEach(b => b.setAttribute("aria-pressed", b.dataset.color.toLowerCase() === String(l.color).toLowerCase()));
  panel.querySelector("#cz-custom").value = /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : DEFAULT_LOOK.color;
  panel.querySelectorAll("[data-layout]").forEach(b => b.setAttribute("aria-pressed", b.dataset.layout === l.layout));
  panel.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === (l.mode || "system")));
  panel.querySelectorAll("[data-bg]").forEach(b => b.setAttribute("aria-pressed", b.dataset.bg === (l.bg || "")));
  panel.querySelector("#cz-overlay").checked = !!l.overlay;
  panel.querySelector("#cz-ripples").checked = l.ripples !== false;
}

export function initCustomizer({ enabled = true } = {}) {
  document.querySelector(".cz-toggle")?.toggleAttribute("hidden", !enabled);
  if (!enabled || panel) return;
  const btn = document.createElement("button");
  btn.className = "cz-toggle";
  btn.type = "button";
  btn.setAttribute("aria-label", "Customize appearance");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "customizer");
  btn.innerHTML = '<i class="fa-solid fa-gear"></i>';
  panel = document.createElement("aside");
  panel.id = "customizer";
  panel.className = "customizer";
  panel.setAttribute("aria-label", "Customize appearance");
  panel.innerHTML = `
    <div class="cz-head"><strong><i class="fa-solid fa-palette"></i> Customize</strong><button class="icon-btn" type="button" data-cz-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="cz-body">
      <section><h4>Theme colour</h4>
        <div class="cz-colors">${COLORS.map(([c, n]) => `<button type="button" data-color="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join("")}
          <label class="cz-custom" title="Custom colour"><input type="color" id="cz-custom" aria-label="Custom colour"><i class="fa-solid fa-eye-dropper"></i></label></div></section>
      <section><h4>Colour mode</h4>
        <div class="cz-seg"><button type="button" data-mode="light"><i class="fa-solid fa-sun"></i> Light</button><button type="button" data-mode="dark"><i class="fa-solid fa-moon"></i> Dark</button><button type="button" data-mode="system"><i class="fa-solid fa-desktop"></i> Auto</button></div></section>
      <section><h4>Layout style</h4>
        <div class="cz-seg"><button type="button" data-layout="full"><i class="fa-solid fa-expand"></i> Full width</button><button type="button" data-layout="boxed"><i class="fa-regular fa-square"></i> Boxed</button></div></section>
      <section><h4>Background <small>(shows around the boxed layout)</small></h4>
        <div class="cz-bgs"><button type="button" data-bg="" class="cz-none" aria-label="No background">None</button>${BACKGROUNDS.map(b => `<button type="button" data-bg="${b.id}" aria-label="${b.label}" title="${b.label}" style="background-image:url('${esc(b.thumb)}')"></button>`).join("")}</div>
        <label class="switch cz-switch"><input type="checkbox" id="cz-overlay"><span class="track"></span>Overlay (darken background)</label></section>
      <section><h4>Effects</h4>
        <label class="switch cz-switch"><input type="checkbox" id="cz-ripples"><span class="track"></span>Water ripple on hero</label></section>
      <button class="btn btn-ghost btn-sm btn-block" type="button" data-cz-reset><i class="fa-solid fa-rotate-left"></i> Reset to default</button>
    </div>`;
  document.body.append(btn, panel);
  const open = on => {
    panel.classList.toggle("open", on);
    btn.setAttribute("aria-expanded", on);
    if (on) panel.querySelector("button")?.focus();
  };
  btn.addEventListener("click", () => open(!panel.classList.contains("open")));
  panel.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-cz-close]")) { open(false); btn.focus(); }
    else if (t.dataset.color) setPref("color", t.dataset.color);
    else if (t.dataset.mode) setPref("mode", t.dataset.mode);
    else if (t.dataset.layout) setPref("layout", t.dataset.layout);
    else if ("bg" in t.dataset) setPref("bg", t.dataset.bg);
    else if (t.matches("[data-cz-reset]")) resetPrefs();
  });
  panel.querySelector("#cz-custom").addEventListener("input", e => setPref("color", e.target.value));
  panel.querySelector("#cz-overlay").addEventListener("change", e => setPref("overlay", e.target.checked));
  panel.querySelector("#cz-ripples").addEventListener("change", e => setPref("ripples", e.target.checked));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("open")) { open(false); btn.focus(); } });
  document.addEventListener("click", e => { if (panel.classList.contains("open") && !e.target.closest(".customizer, .cz-toggle")) open(false); });
  syncPanel();
}
