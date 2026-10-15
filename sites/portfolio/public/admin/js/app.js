import { $, $$, fb, state, toast, esc } from "./core.js";
import { initTheme } from "/assets/js/ui.js";
import { SITE } from "/assets/js/config.js";
import { avatar } from "/assets/js/render.js";

initTheme();

const routes = {
  dashboard: ["Dashboard", () => import("./views/dashboard.js")],
  messages: ["Messages", () => import("./views/messages.js")],
  posts: ["Blog posts", () => import("./views/posts.js")],
  comments: ["Comments", () => import("./views/comments.js")],
  projects: ["Projects & demos", () => import("./views/collections.js")],
  studios: ["Studios & services", () => import("./views/collections.js")],
  skills: ["Skills", () => import("./views/collections.js")],
  testimonials: ["Testimonials", () => import("./views/collections.js")],
  experience: ["Experience", () => import("./views/collections.js")],
  team: ["Team", () => import("./views/collections.js")],
  bookings: ["Bookings", () => import("./views/requests.js")],
  orders: ["Quotes & orders", () => import("./views/requests.js")],
  clients: ["Clients", () => import("./views/clients.js")],
  clientProjects: ["Client projects", () => import("./views/collections.js")],
  chat: ["Client chat", () => import("./views/chat.js")],
  reviews: ["Client testimonials", () => import("./views/reviews.js")],
  products: ["Branded products", () => import("./views/collections.js")],
  hub: ["Hub homepage", () => import("./views/hubsettings.js")],
  profile: ["Profile & site", () => import("./views/profile.js")],
  media: ["Media library", () => import("./views/media.js")],
  subscribers: ["Subscribers", () => import("./views/subscribers.js")],
  settings: ["Settings", () => import("./views/settings.js")]
};

let current = null;
export function guardLeave() {
  return !document.querySelector(".is-dirty") || confirm("You have unsaved changes. Leave this page?");
}

async function route() {
  const [name, ...rest] = (location.hash.replace(/^#\/?/, "") || "dashboard").split("/");
  const r = routes[name] || routes.dashboard;
  const key = routes[name] ? name : "dashboard";
  $$(".side-link").forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#/${key}`));
  document.body.classList.remove("side-open");
  $("#page-title").textContent = r[0];
  document.title = `${r[0]} · ProfJero Admin`;
  // Fresh element per route so listeners a view attached don't leak into the next one.
  const old = $("#view"), view = old.cloneNode(false);
  old.replaceWith(view);
  view.innerHTML = `<div class="kpis">${'<div class="kpi skeleton" style="height:110px"></div>'.repeat(4)}</div><div class="card skeleton" style="height:320px"></div>`;
  current?.destroy?.();
  try {
    const mod = await r[1]();
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
  if (location.hash === lastHash) return;
  if (!guardLeave()) { history.replaceState(null, "", lastHash); return; }
  lastHash = location.hash;
  route();
});
addEventListener("beforeunload", e => { if (document.querySelector(".is-dirty")) { e.preventDefault(); e.returnValue = ""; } });

$("#menu-btn").addEventListener("click", () => document.body.classList.toggle("side-open"));
document.addEventListener("click", e => { if (document.body.classList.contains("side-open") && !e.target.closest(".sidebar, #menu-btn")) document.body.classList.remove("side-open"); });

// ---------- Auth ----------
async function isAdmin(u) {
  if (!u || u.isAnonymous || !u.email) return false;
  if (u.email === SITE.ownerEmail && u.emailVerified) return true;
  try { return (await fb.getDoc(fb.doc(fb.db, "admins", u.email))).exists() && u.emailVerified; } catch { return false; }
}

function showLogin(msg = "") {
  $("#boot").hidden = true;
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#login-msg").innerHTML = msg;
}

let unsubBadge;
async function startApp(u) {
  state.user = u;
  $("#boot").hidden = true;
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#user-chip").innerHTML = `${avatar(u.displayName || u.email, u.photoURL)}<span>${esc(u.displayName || u.email)}</span>`;
  unsubBadge?.();
  const badge = (id, n) => { const b = $(id); if (b) { b.textContent = n || ""; b.dataset.n = n; } };
  fb.onSnapshot(fb.query(fb.collection(fb.db, "bookings"), fb.where("status", "==", "pending")), s => { state.pendingBookings = s.size; badge("#badge-bookings", s.size); }, () => { });
  fb.onSnapshot(fb.query(fb.collection(fb.db, "orders"), fb.where("status", "==", "requested")), s => { state.newOrders = s.size; badge("#badge-orders", s.size); }, () => { });
  fb.onSnapshot(fb.query(fb.collection(fb.db, "threads"), fb.where("unreadAdmin", ">", 0)), s => { state.unreadChats = s.size; badge("#badge-chat", s.size); }, () => { });
  fb.onSnapshot(fb.query(fb.collection(fb.db, "reviews"), fb.where("status", "==", "pending")), s => { state.pendingReviews = s.size; badge("#badge-reviews", s.size); }, () => { });
  unsubBadge = fb.onSnapshot(fb.query(fb.collection(fb.db, "messages"), fb.where("status", "==", "new")), snap => {
    state.unread = snap.size;
    const b = $("#badge-messages");
    b.textContent = snap.size || "";
    b.dataset.n = snap.size;
    document.title = document.title.replace(/^\(\d+\) /, "");
    if (snap.size) document.title = `(${snap.size}) ${document.title}`;
  }, () => { });
  route();
}

fb.onAuthStateChanged(fb.auth, async u => {
  if (!u || u.isAnonymous) return showLogin();
  if (await isAdmin(u)) return startApp(u);
  if (!u.emailVerified && u.providerData.some(p => p.providerId === "password")) {
    showLogin(`Your email isn't verified yet. <a href="#" id="resend">Send verification email</a>, then sign in again.`);
    $("#resend").onclick = async e => { e.preventDefault(); try { await fb.sendEmailVerification(u); toast("Verification email sent"); } catch (err) { toast(err.message, "error"); } };
    return;
  }
  await fb.signOut(fb.auth);
  showLogin(`<span style="color:var(--red)"><i class="fa-solid fa-lock"></i> ${esc(u.email)} is not an admin.</span> Ask the owner to add you in Settings → Admins.`);
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

function friendly(e) {
  const m = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "No account with that email.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase Authentication.",
    "auth/unauthorized-domain": "This domain isn't authorised in Firebase Authentication → Settings → Authorized domains.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again."
  };
  return m[e.code] || e.message;
}
