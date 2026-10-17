// Admins & roles (super admin only): add people, give each a role or exact
// permissions, pause or remove access. The same permissions are enforced by
// firestore.rules, so the dashboard can't be used to go beyond them.
import { $, $$, fb, esc, toast, confirmDialog, openDialog, emptyState, state, fmtDate } from "../core.js";
import { AREAS, ROLES } from "../nav.js";
import { SITE } from "/assets/js/config.js";
import { initials, hueFrom, isEmail } from "/assets/js/utils.js";

const permsOf = a => a.role === "full" || a.role === "admin" || !a.role ? Object.keys(AREAS) : Object.keys(a.perms || {}).filter(k => a.perms[k] === true);

export async function render(view) {
  if (!state.access.owner) { view.innerHTML = emptyState("fa-solid fa-lock", "Only the super admin can manage admins."); return; }
  let admins = [];
  try { admins = (await fb.getDocs(fb.collection(fb.db, "admins"))).docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.id !== SITE.ownerEmail); } catch (e) { view.innerHTML = `<div class="callout warn">${esc(e.message)}</div>`; return; }

  const card = a => {
    const role = a.role === "admin" || !a.role ? "full" : a.role, perms = permsOf(a);
    return `<article class="card admin-card${a.disabled ? " is-off" : ""}" data-email="${esc(a.id)}">
      <header><span class="avatar avatar-fallback" style="--h:${hueFrom(a.id)}">${esc(initials(a.name || a.id))}</span>
        <div class="grow"><strong>${esc(a.name || a.id.split("@")[0])}</strong><small class="muted">${esc(a.id)}</small></div>
        <span class="role-pill role-${role}">${esc(ROLES[role]?.label || role)}</span></header>
      <div class="perm-chips">${perms.map(p => `<span class="perm-chip"><i class="${AREAS[p].icon}"></i> ${esc(AREAS[p].label)}</span>`).join("") || '<span class="muted small">No access yet</span>'}</div>
      <footer><span class="muted small">${a.disabled ? '<i class="fa-solid fa-circle-pause"></i> Access paused' : '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Active'}${a.createdAt ? ` · added ${fmtDate(a.createdAt)}` : ""}</span>
        <span class="btn-row"><button class="btn btn-ghost btn-sm" data-edit><i class="fa-solid fa-pen"></i> Edit</button><button class="icon-btn sm danger" data-rm title="Remove admin" aria-label="Remove admin"><i class="fa-regular fa-trash-can"></i></button></span></footer>
    </article>`;
  };

  view.innerHTML = `
    <div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-user-shield"></i><div>Give each person only what they need. Their sidebar shows just those pages, and the database blocks everything else, even if they try another way.
      <b>Only you</b> (${esc(SITE.ownerEmail)}) can add, change or remove admins. Admins sign in at this dashboard with Google or a verified email &amp; password using the exact email you enter.</div></div>
    <div class="toolbar"><h3 style="margin:0;flex:1">Admins <span class="muted small">(${admins.length + 1})</span></h3><button class="btn btn-primary btn-sm" id="ad-add"><i class="fa-solid fa-user-plus"></i> Add admin</button></div>
    <div class="admin-grid">
      <article class="card admin-card owner"><header><span class="avatar avatar-fallback" style="--h:45"><i class="fa-solid fa-crown"></i></span>
        <div class="grow"><strong>${esc(state.access.name || state.user.displayName || state.ownerName || "You")}</strong><small class="muted">${esc(SITE.ownerEmail)}</small></div><span class="role-pill role-owner">Super admin</span></header>
        <p class="muted small" style="margin:12px 0 0">Full access to everything, and the only person who can manage admins and roles.</p></article>
      ${admins.map(card).join("")}
    </div>`;

  const editor = async (a = null) => {
    const startRole = a ? (a.role === "admin" || !a.role ? "full" : a.role) : "editor";
    const startPerms = new Set(a ? permsOf(a) : ROLES.editor.perms);
    let saved = false;
    await openDialog({
      title: a ? `Edit ${a.name || a.id}` : "Add an admin", size: "wide",
      body: `<div class="fields">
          <div class="f"><label for="ad-email">Email address</label><input id="ad-email" class="input" type="email" placeholder="name@gmail.com" value="${esc(a?.id || "")}" ${a ? "disabled" : ""}></div>
          <div class="f"><label for="ad-name">Name</label><input id="ad-name" class="input" maxlength="80" placeholder="e.g. Ama Mensah" value="${esc(a?.name || "")}"></div>
        </div>
        <h4 style="margin:18px 0 8px">Role</h4>
        <div class="role-grid">${Object.entries(ROLES).map(([k, r]) => `<label class="role-opt"><input type="radio" name="ad-role" value="${k}" ${k === startRole ? "checked" : ""}><span><strong>${esc(r.label)}</strong><small>${esc(r.desc)}</small></span></label>`).join("")}</div>
        <h4 style="margin:18px 0 8px">What they can do</h4>
        <div class="perm-grid">${Object.entries(AREAS).map(([k, ar]) => `<label class="perm-opt"><input type="checkbox" value="${k}" ${startPerms.has(k) ? "checked" : ""}><span><i class="${ar.icon}"></i><b>${esc(ar.label)}</b><small>${esc(ar.desc)}</small></span></label>`).join("")}</div>
        ${a ? `<label class="switch" style="margin-top:16px"><input type="checkbox" id="ad-off" ${a.disabled ? "checked" : ""}><span class="track"></span>Pause access (they can't sign in until you turn this off)</label>` : ""}`,
      actions: [{ label: "Cancel", value: null, cls: "btn-ghost" }, { label: a ? "Save changes" : "Add admin", value: "ok", cls: "btn-primary", handler: async body => {
        const email = (a?.id || $("#ad-email", body).value).trim().toLowerCase();
        if (!isEmail(email)) { toast("Enter a valid email address", "error"); return false; }
        if (email === SITE.ownerEmail) { toast("That's you — the super admin already has full access.", "error"); return false; }
        if (!a && admins.some(x => x.id === email)) { toast("That person is already an admin.", "error"); return false; }
        const role = $("input[name=ad-role]:checked", body)?.value || "custom";
        const perms = Object.fromEntries($$(".perm-opt input", body).map(i => [i.value, i.checked]));
        if (!Object.values(perms).some(Boolean)) { toast("Tick at least one thing they can do.", "error"); return false; }
        const doc = { name: $("#ad-name", body).value.trim().slice(0, 80), role, perms, disabled: !!$("#ad-off", body)?.checked, updatedAt: fb.serverTimestamp(), updatedBy: state.user.email };
        if (!a) Object.assign(doc, { addedBy: state.user.email, createdAt: fb.serverTimestamp() });
        await fb.setDoc(fb.doc(fb.db, "admins", email), doc, { merge: true });
        saved = true;
      } }],
      onOpen: body => {
        // Picking a role ticks its permissions; changing a tick switches the role to Custom.
        body.addEventListener("change", e => {
          if (e.target.name === "ad-role" && e.target.value !== "custom") {
            const set = new Set(ROLES[e.target.value].perms);
            $$(".perm-opt input", body).forEach(i => { i.checked = set.has(i.value); });
          }
          if (e.target.closest(".perm-opt")) {
            const on = $$(".perm-opt input", body).filter(i => i.checked).map(i => i.value).sort().join();
            const match = Object.entries(ROLES).find(([k, r]) => k !== "custom" && [...r.perms].sort().join() === on);
            $(`input[name=ad-role][value="${match ? match[0] : "custom"}"]`, body).checked = true;
          }
        });
      }
    });
    if (saved) { toast(a ? "Admin updated" : "Admin added. They can now sign in with that email."); render(view); }
  };

  $("#ad-add").addEventListener("click", () => editor());
  view.addEventListener("click", async e => {
    const c = e.target.closest("[data-email]"); if (!c) return;
    const a = admins.find(x => x.id === c.dataset.email);
    if (e.target.closest("[data-edit]")) editor(a);
    if (e.target.closest("[data-rm]") && await confirmDialog(`Remove <b>${esc(a.id)}</b>? They will no longer be able to open the dashboard.`, { ok: "Remove admin" })) {
      await fb.deleteDoc(fb.doc(fb.db, "admins", a.id)); toast("Admin removed"); render(view);
    }
  });
}
