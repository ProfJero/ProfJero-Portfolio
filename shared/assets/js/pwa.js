// Makes a page an installable app (PWA): registers the shared service worker for
// this app's scope and wires every [data-install] button to the install prompt.
// On iPhone/iPad (no prompt API) the button explains "Share → Add to Home Screen".
const VERSION = new URL(import.meta.url).searchParams.get("v") || "dev";
let deferred = null;

const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function paint() {
  const show = !standalone() && (deferred || isIOS());
  document.querySelectorAll("[data-install]").forEach(b => { b.hidden = !show; });
}

export function initPWA({ app, scope, onIOSHelp }) {
  const secure = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
  if ("serviceWorker" in navigator && secure) {
    navigator.serviceWorker.register(`/assets/js/pwa-sw.js?app=${encodeURIComponent(app)}&v=${VERSION}`, { scope }).catch(() => { });
  }
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; paint(); });
  addEventListener("appinstalled", () => { deferred = null; paint(); });
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-install]");
    if (!btn) return;
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => { }); deferred = null; paint(); }
    else if (isIOS()) onIOSHelp?.();
  });
  paint();
  // Buttons rendered later (e.g. after sign-in) pick up the current state too.
  let raf;
  new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }).observe(document.body, { childList: true, subtree: true });
}
