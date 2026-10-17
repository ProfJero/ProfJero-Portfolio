// My account: the name used to greet you, and password management.
// Password changes always re-check your identity first (Firebase requires a recent sign-in).
import { $, fb, esc, toast, state, confirmIdentity } from "../core.js";
import { refreshIdentity } from "../app.js";

const rules = [[p => p.length >= 8, "At least 8 characters"], [p => /[A-Za-z]/.test(p) && /\d/.test(p), "Letters and numbers"], [p => /[^A-Za-z0-9]/.test(p) || p.length >= 12, "A symbol, or 12+ characters"]];

export async function render(view) {
  const u = fb.auth.currentUser;
  const hasPassword = u.providerData.some(p => p.providerId === "password");
  const hasGoogle = u.providerData.some(p => p.providerId === "google.com");
  view.innerHTML = `
    <div class="grid-2" style="align-items:start">
      <section class="card">
        <div class="card-head"><h3><i class="fa-solid fa-user" style="color:var(--brand)"></i> Your profile</h3><p class="muted small" style="margin:4px 0 0">Your name is used to greet you and to sign your chat replies.</p></div>
        <form id="acc-form" class="fields" style="grid-template-columns:1fr" novalidate>
          <div class="f"><label for="acc-name">Your name</label><input id="acc-name" class="input" maxlength="80" value="${esc(state.access.name || u.displayName || "")}" placeholder="e.g. Benjamin Amoako"></div>
          <div class="f"><label>Email</label><input class="input" value="${esc(u.email)}" disabled></div>
          <div class="f"><label>Role</label><input class="input" value="${esc(state.access.roleLabel)}" disabled></div>
          <div><button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save name</button></div>
        </form>
        <div class="signin-methods">
          <span class="${hasGoogle ? "on" : ""}"><i class="fa-brands fa-google"></i> Google sign-in ${hasGoogle ? "on" : "off"}</span>
          <span class="${hasPassword ? "on" : ""}"><i class="fa-solid fa-key"></i> Password ${hasPassword ? "set" : "not set"}</span>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h3><i class="fa-solid fa-key" style="color:var(--brand)"></i> ${hasPassword ? "Change password" : "Add a password"}</h3>
          <p class="muted small" style="margin:4px 0 0">${hasPassword ? "Enter your current password, then the new one twice." : "You sign in with Google. Add a password to also sign in with your email and password."}</p></div>
        <form id="pw-form" class="fields" style="grid-template-columns:1fr" novalidate>
          ${hasPassword ? `<div class="f"><label for="pw-cur">Current password</label><div class="pw-wrap"><input id="pw-cur" class="input" type="password" autocomplete="current-password"><button type="button" class="pw-eye" data-eye="pw-cur" aria-label="Show password"><i class="fa-regular fa-eye"></i></button></div></div>` : ""}
          <div class="f"><label for="pw-new">New password</label><div class="pw-wrap"><input id="pw-new" class="input" type="password" autocomplete="new-password"><button type="button" class="pw-eye" data-eye="pw-new" aria-label="Show password"><i class="fa-regular fa-eye"></i></button></div>
            <div class="pw-meter"><span id="pw-bar"></span></div><ul class="pw-rules" id="pw-rules">${rules.map(([, l]) => `<li>${l}</li>`).join("")}</ul></div>
          <div class="f"><label for="pw-new2">Repeat new password</label><input id="pw-new2" class="input" type="password" autocomplete="new-password"></div>
          <p class="form-msg" id="pw-msg" role="alert"></p>
          <div><button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-shield-halved"></i> ${hasPassword ? "Change password" : "Add password"}</button></div>
        </form>
      </section>
    </div>`;

  $("#acc-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#acc-name").value.trim().slice(0, 80);
    if (!name) return toast("Please enter your name", "error");
    try {
      await fb.setDoc(fb.doc(fb.db, "admins", u.email.toLowerCase()), { name, updatedAt: fb.serverTimestamp() }, { merge: true });
      await fb.updateProfile(u, { displayName: name }).catch(() => { });
      state.access.name = name; refreshIdentity(); toast(`Saved. Hello, ${name.split(" ")[0]}!`);
    } catch (err) { toast(err.message, "error"); }
  });

  const score = p => rules.filter(([t]) => t(p)).length;
  $("#pw-new").addEventListener("input", e => {
    const p = e.target.value, n = score(p);
    $("#pw-bar").style.width = `${(n / rules.length) * 100}%`;
    $("#pw-bar").dataset.s = n;
    [...$("#pw-rules").children].forEach((li, i) => li.classList.toggle("ok", rules[i][0](p)));
  });
  view.addEventListener("click", e => {
    const eye = e.target.closest("[data-eye]"); if (!eye) return;
    const i = $(`#${eye.dataset.eye}`); i.type = i.type === "password" ? "text" : "password";
    eye.innerHTML = `<i class="fa-regular fa-eye${i.type === "text" ? "-slash" : ""}"></i>`;
  });
  $("#pw-form").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = t => { $("#pw-msg").textContent = t; $("#pw-msg").className = "form-msg error"; };
    const next = $("#pw-new").value, again = $("#pw-new2").value;
    if (score(next) < 2 || next.length < 8) return msg("Choose a stronger password: at least 8 characters with letters and numbers.");
    if (next !== again) return msg("The two new passwords don't match.");
    const btn = $("#pw-form button[type=submit]"); btn.disabled = true;
    try {
      if (hasPassword) {
        await fb.reauthenticateWithCredential(u, fb.EmailAuthProvider.credential(u.email, $("#pw-cur").value));
        await fb.updatePassword(u, next);
      } else {
        await confirmIdentity("Confirm with Google before adding a password.");
        await fb.linkWithCredential(u, fb.EmailAuthProvider.credential(u.email, next));
      }
      toast(hasPassword ? "Password changed" : "Password added. You can now sign in with email and password too.");
      render(view);
    } catch (err) {
      btn.disabled = false;
      msg({ "auth/wrong-password": "Your current password is incorrect.", "auth/invalid-credential": "Your current password is incorrect.", "auth/weak-password": "That password is too weak.", "auth/requires-recent-login": "Please sign out and in again, then retry.", "auth/popup-closed-by-user": "Google confirmation was cancelled." }[err.code] || err.message);
    }
  });
}
