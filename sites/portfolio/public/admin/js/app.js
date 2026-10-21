import { $, $$, fb, state, toast, esc, openDialog } from "./core.js";
import { initTheme } from "/assets/js/ui.js";
import { SITE } from "/assets/js/config.js";
import { avatar } from "/assets/js/render.js";
import { initPWA } from "/assets/js/pwa.js";
import { NAV, ITEMS, SCOPES, accessFor, allowed } from "./nav.js";
import { startAlerts } from "./alerts.js";

initTheme();
initPWA({
  app: "admin", scope: "/admin/",
  onIOSHelp: () => openDialog({ title: "Install the admin app", body: `<p>On iPhone or iPad, open this page in <b>Safari</b>, tap <b>Share</b> <i class="fa-solid fa-arrow-up-from-bracket"></i>, then <b>Add to Home Screen</b>.</p>` })
});

const VIEWS = {
  dashboard: () => import("./views/dashboard.js"), alerts: () => import("./views/alerts.js"), messages: () => import("./views/messages.js"),
  posts: () => import("./views/posts.js"), comments: () => import("./views/comments.js"),
  projects: () => import("./views/collections.js"), studios: () => import("./views/collections.js"), skills: () => import("./views/collections.js"),
  testimonials: () => import("./views/collections.js"), experience: () => import("./views/collections.js"), team: () => import("./views/collections.js"),
  bookings: () => import("./views/requests.js"), orders: () => import("./views/requests.js"), invoices: () => import("./views/invoices.js"),
  clients: () => import("./views/clients.js"), clientProjects: () => import("./views/collections.js"), chat: () => import("./views/chat.js"),
  reviews: () => import("./views/reviews.js"), products: () => import("./views/collections.js"), hub: () => import("./views/hubsettings.js"),
  profile: () => import("./views/profile.js"), media: () => import("./views/media.js"), subscribers: () => import("./views/subscribers.js"),
  admins: () => import("./views/admins.js"), settings: () => import("./views/settings.js"), account: () => import("./views/account.js")
};

let current = null;
export function guardLeave() {
  return !document.querySelector(".is-dirty") || confirm("You have unsaved changes. Leave this page?");
}

async function route() {
  const [name, ...rest] = (location.hash.replace(/^#\/?/, "") || "dashboard").split("/");
  const key = VIEWS[name] ? name : "dashboard";
  const item = ITEMS[key];
  markActive(key);
  document.body.classList.remove("side-open");
  $("#page-title").textContent = item.label;
  document.title = `${item.label} · ProfJero Admin`;
  // Fresh element per route so listeners a view attached don't leak into the next one.
  const old = $("#view"), view = old.cloneNode(false);
  old.replaceWith(view);
  current?.destroy?.();
  current = null;
  if (!allowed(state.access, item)) {
    view.innerHTML = `<div class="empty-page"><i class="fa-solid fa-lock"></i><h2>You don't have access to ${esc(item.label)}</h2><p class="muted">Ask the super admin to add this to your role in <b>Admins &amp; roles</b>.</p><a class="btn btn-primary" href="#/dashboard">Back to dashboard</a></div>`;
    return;
  }
  view.innerHTML = `<div class="kpis">${'<div class="kpi skeleton" style="height:110px"></div>'.repeat(4)}</div><div class="card skeleton" style="height:320px"></div>`;
  try {
    const mod = await VIEWS[key]();
    if (!view.isConnected) return; // superseded by a newer navigation
    current = mod;
    await mod.render(view, { name: key, params: rest });
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="callout warn"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Couldn't load this page.</strong><br>${esc(e.message)}<br><span class="small">If this says “Missing or insufficient permissions”, publish the security rules from <code class="k">firestore.rules</code> (see ADMIN-GUIDE.md).</span></div></div>`;
  }
  view.focus({ preventScroll: true });
  scrollTo(0, 0);
}

let lastHash = location.hash;
addEventListener("hashchange", () => {
  if (location.hash === lastHash || !state.access) return;
  if (!guardLeave()) { history.replaceState(null, "", lastHash); return; }
  lastHash = location.hash;
  route();
});
addEventListener("beforeunload", e => { if (document.querySelector(".is-dirty")) { e.preventDefault(); e.returnValue = ""; } });

$("#menu-btn").addEventListener("click", () => document.body.classList.toggle("side-open"));
document.addEventListener("click", e => { if (document.body.classList.contains("side-open") && !e.target.closest(".sidebar, #menu-btn")) document.body.classList.remove("side-open"); });

// ---------- Sidebar: grouped, collapsible, searchable, with a slim "rail" mode ----------
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
let openGroups = store.get("pj_nav_open_v2", {});
const badgeCounts = {};

function renderNav() {
  const nav = $("#side-nav");
  nav.innerHTML = NAV.map(g => {
    const items = g.items.filter(i => allowed(state.access, i));
    if (!items.length) return "";
    const scopes = [...new Set(items.map(i => i.scope))];
    const scope = scopes.length === 1 ? scopes[0] : "mixed";
    const open = openGroups[g.id] === true;
    return `<section class="nav-group${open ? " open" : ""}" data-group="${g.id}">
      <button class="nav-group-head" type="button" aria-expanded="${open}" aria-controls="ng-${g.id}" data-tip="${esc(g.label)}">
        <i class="${g.icon} g-icon"></i><span class="g-label">${esc(g.label)}</span>
        ${scope !== "mixed" ? `<span class="scope-dot ${scope}" title="${esc(SCOPES[scope].title)}"></span>` : ""}
        <span class="group-badge" data-gbadge="${g.id}" hidden></span><i class="fa-solid fa-chevron-down chev"></i>
      </button>
      <div class="nav-group-body" id="ng-${g.id}"><div class="nav-group-inner">
        ${items.map(i => `<a class="side-link" href="#/${i.key}" data-key="${i.key}" data-tip="${esc(i.label)}" data-label="${esc(i.label.toLowerCase())}">
          <i class="${i.icon}"></i><span class="l-text">${esc(i.label)}</span>
          <span class="scope-tag ${i.scope}" title="${esc(SCOPES[i.scope].title)}">${SCOPES[i.scope].label}</span>
          ${i.badge ? `<span class="side-badge" id="badge-${i.badge}" data-n="0"></span>` : ""}
        </a>`).join("")}
      </div></div>
    </section>`;
  }).join("") + '<p class="nav-empty muted small" hidden>No page matches.</p>';
  Object.entries(badgeCounts).forEach(([k, n]) => setBadge(k, n));
}

function markActive(key) {
  $$("#side-nav .side-link").forEach(a => a.classList.toggle("active", a.dataset.key === key));

}

function toggleGroup(g, open = !g.classList.contains("open"), remember = true) {
  g.classList.toggle("open", open);
  $(".nav-group-head", g).setAttribute("aria-expanded", open);
  if (remember) { openGroups[g.dataset.group] = open; store.set("pj_nav_open_v2", openGroups); }
}

$("#side-nav").addEventListener("click", e => {
  const head = e.target.closest(".nav-group-head");
  if (!head) return;
  if (document.body.classList.contains("nav-rail")) { setRail(false); toggleGroup(head.closest(".nav-group"), true); return; }
  toggleGroup(head.closest(".nav-group"));
});

function setRail(on) {
  document.body.classList.toggle("nav-rail", on);
  $("#rail-btn").setAttribute("aria-pressed", on);
  $("#rail-btn").setAttribute("aria-label", on ? "Expand menu" : "Collapse menu");
  $("#rail-btn").dataset.tip = on ? "Expand menu" : "Collapse menu";
  store.set("pj_nav_rail", on);
}
$("#rail-btn").addEventListener("click", () => setRail(!document.body.classList.contains("nav-rail")));
setRail(store.get("pj_nav_rail", false));

// Find a page: filters the menu; Enter opens the first match. Ctrl/⌘+K focuses it.
$("#nav-q").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  let any = false;
  $$("#side-nav .nav-group").forEach(g => {
    let hit = false;
    $$(".side-link", g).forEach(a => { const m = !q || a.dataset.label.includes(q); a.hidden = !m; hit ||= m; });
    g.hidden = !hit; any ||= hit;
    if (q) g.classList.toggle("open", hit); else g.classList.toggle("open", openGroups[g.dataset.group] === true);
  });
  $(".nav-empty").hidden = any;
});
$("#nav-q").addEventListener("keydown", e => {
  if (e.key === "Enter") { const a = $$("#side-nav .side-link").find(x => !x.hidden && !x.closest(".nav-group").hidden); if (a) { location.hash = a.getAttribute("href"); e.target.value = ""; e.target.dispatchEvent(new Event("input")); e.target.blur(); } }
  if (e.key === "Escape") { e.target.value = ""; e.target.dispatchEvent(new Event("input")); e.target.blur(); }
});
addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setRail(false); document.body.classList.add("side-open"); $("#nav-q").focus(); }
});

// Tooltips for the slim rail (a fixed element, so the scrolling sidebar can't clip it).
const tip = Object.assign(document.createElement("div"), { className: "nav-tip", role: "tooltip" });
document.body.append(tip);
$("#sidebar").addEventListener("pointerover", e => {
  const el = e.target.closest("[data-tip]");
  if (!el || !document.body.classList.contains("nav-rail") || matchMedia("(max-width: 960px)").matches) return;
  const r = el.getBoundingClientRect();
  const n = el.querySelector(".side-badge")?.dataset.n;
  tip.textContent = el.dataset.tip + (Number(n) ? ` (${n})` : "");
  tip.style.left = `${r.right + 10}px`; tip.style.top = `${r.top + r.height / 2 - 15}px`;
  tip.classList.add("show");
});
$("#sidebar").addEventListener("pointerout", e => { if (!e.relatedTarget?.closest?.("[data-tip]")) tip.classList.remove("show"); });
$("#sidebar").addEventListener("scroll", () => tip.classList.remove("show"), { passive: true });

export function setBadge(key, n) {
  badgeCounts[key] = n;
  const b = $(`#badge-${key}`);
  if (b) { b.textContent = n || ""; b.dataset.n = n; }
  $$("#side-nav .nav-group").forEach(g => {
    const sum = $$(".side-badge", g).reduce((t, x) => t + (Number(x.dataset.n) || 0), 0);
    const gb = $(".group-badge", g); gb.textContent = sum; gb.hidden = !sum;
  });
}

// ---------- Auth ----------
// Returns the admin record ({} for the owner) or null when this account isn't an admin.
async function adminRecord(u) {
  if (!u || u.isAnonymous || !u.email || !u.emailVerified) return null;
  const email = u.email.toLowerCase();
  let rec = null;
  try { const snap = await fb.getDoc(fb.doc(fb.db, "admins", email)); rec = snap.exists() ? snap.data() : null; } catch { }
  if (email === SITE.ownerEmail) return rec || {};
  return rec && rec.disabled !== true ? rec : null;
}

function showLogin(msg = "") {
  $("#boot").hidden = true;
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#login-msg").innerHTML = msg;
}

function paintUserChip() {
  const u = state.user, a = state.access;
  const name = a.name || u.displayName || u.email;
  $("#user-chip").innerHTML = `${avatar(name, u.photoURL)}<span>${esc(name)}<small class="muted">${esc(a.roleLabel)}</small></span>`;
}
export function refreshIdentity() { paintUserChip(); }

const subs = [];
async function startApp(u, rec) {
  state.user = u;
  state.access = accessFor(u.email.toLowerCase(), SITE.ownerEmail, rec);
  if (state.access.owner && !state.access.name) {
    try { const s = await fb.getDoc(fb.doc(fb.db, "settings", "site")); state.ownerName = s.exists() ? s.data().name || "" : ""; } catch { }
  }
  $("#boot").hidden = true;
  $("#login").hidden = true;
  $("#app").hidden = false;
  paintUserChip();
  renderNav();
  subs.splice(0).forEach(f => f());
  const can = area => state.access.perms.has(area);
  const count = (q, key, also) => subs.push(fb.onSnapshot(q, snap => { setBadge(key, snap.size); also?.(snap.size); }, () => { }));
  if (can("requests")) {
    count(fb.query(fb.collection(fb.db, "bookings"), fb.where("status", "==", "pending")), "bookings", n => state.pendingBookings = n);
    count(fb.query(fb.collection(fb.db, "orders"), fb.where("status", "==", "requested")), "orders", n => state.newOrders = n);
  }
  if (can("chat")) count(fb.query(fb.collection(fb.db, "threads"), fb.where("unreadAdmin", ">", 0)), "chat", n => state.unreadChats = n);
  if (can("chat")) {
    const seenHandoffs = new Set();
    subs.push(fb.onSnapshot(fb.query(fb.collection(fb.db, "threads"), fb.where("handoffRequested", "==", true)), snap => {
      snap.docChanges().forEach(change => {
        if (change.type === "removed") { seenHandoffs.delete(change.doc.id); return; }
        if (change.type !== "added" && change.type !== "modified") return;
        const t = change.doc.data();
        if (seenHandoffs.has(change.doc.id) || !t.handoffRequested) return;
        seenHandoffs.add(change.doc.id);
        if (!location.hash.startsWith("#/chat")) {
          toast(`Human support requested by ${t.name || t.email || "a client"}. Open Chat to reply.`, "info", 7000);
          if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification("ProfJero Chat — human reply requested", { body: `${t.name || t.email || "A client"} is waiting for a human reply.` });
            n.onclick = () => { focus(); location.hash = `#/chat/${change.doc.id}`; n.close(); };
          }
        }
      });
      snap.docs.filter(d => !d.data().handoffRequested).forEach(d => seenHandoffs.delete(d.id));
    }, err => console.warn("Chat handoff notifications unavailable:", err.message)));
  }
  if (can("clients")) count(fb.query(fb.collection(fb.db, "reviews"), fb.where("status", "==", "pending")), "reviews", n => state.pendingReviews = n);
  if (can("messages")) count(fb.query(fb.collection(fb.db, "messages"), fb.where("status", "==", "new")), "messages", n => {
    state.unread = n;
    document.title = document.title.replace(/^\(\d+\) /, "");
    if (n) document.title = `(${n}) ${document.title}`;
  });
  startAlerts({ onCount: n => { setBadge("alerts", n); const c = $("#bell-count"); c.textContent = n > 99 ? "99+" : n; c.hidden = !n; } });
  route();
}

fb.onAuthStateChanged(fb.auth, async u => {
  if (!u || u.isAnonymous) return showLogin();
  const rec = await adminRecord(u);
  if (rec) return startApp(u, rec);
  if (!u.emailVerified && u.providerData.some(p => p.providerId === "password")) {
    showLogin(`Your email isn't verified yet. <a href="#" id="resend">Send verification email</a>, then sign in again.`);
    $("#resend").onclick = async e => { e.preventDefault(); try { await fb.sendEmailVerification(u); toast("Verification email sent"); } catch (err) { toast(err.message, "error"); } };
    return;
  }
  await fb.signOut(fb.auth);
  showLogin(`<span style="color:var(--red)"><i class="fa-solid fa-lock"></i> ${esc(u.email)} is not an admin.</span> Ask the super admin to add you in <b>Admins &amp; roles</b>.`);
});

$("#login-google").addEventListener("click", async () => {
  try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); }
  catch (e) { if (e.code !== "auth/popup-closed-by-user") $("#login-msg").textContent = friendly(e); }
});
$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#login-form button");
  btn.disabled = true;
  try { await fb.signInWithEmailAndPassword(fb.auth, $("#l-email").value.trim(), $("#l-pass").value); }
  catch (err) { $("#login-msg").textContent = friendly(err); }
  finally { btn.disabled = false; }
});
$("#forgot").addEventListener("click", async e => {
  e.preventDefault();
  const email = $("#l-email").value.trim();
  if (!email) { $("#login-msg").textContent = "Enter your email above first."; return; }
  try { await fb.sendPasswordResetEmail(fb.auth, email); $("#login-msg").textContent = "Password reset email sent."; }
  catch (err) { $("#login-msg").textContent = friendly(err); }
});
$("#logout").addEventListener("click", async () => { if (guardLeave()) { await fb.signOut(fb.auth); location.hash = ""; } });

const WRONG_LOGIN = "Incorrect email or password. If you normally sign in with Google, use “Continue with Google”, or tap “Forgot?” to set a password.";

function friendly(e) {
  const m = {
    "auth/invalid-credential": WRONG_LOGIN,
    "auth/invalid-login-credentials": WRONG_LOGIN,
    "auth/wrong-password": WRONG_LOGIN,
    "auth/user-not-found": WRONG_LOGIN,
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase Authentication.",
    "auth/unauthorized-domain": "This domain isn't authorised in Firebase Authentication → Settings → Authorized domains.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again."
  };
  return m[e.code] || e.message;
}
