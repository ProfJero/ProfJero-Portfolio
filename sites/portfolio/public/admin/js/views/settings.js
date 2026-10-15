import { $, $$, fb, esc, toast, confirmDialog, download, cloudinaryConfig, uploadToCloudinary, state } from "../core.js";
import { renderFields, bindFields, readFields } from "../forms.js";
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_STUDIOS, DEFAULT_PROJECTS, DEFAULT_TESTIMONIALS, DEFAULT_EXPERIENCE, DEFAULT_TEAM, DEFAULT_PRODUCTS } from "/assets/js/defaults.js";
import { HUB_SETTINGS } from "/assets/js/hub-defaults.js";
import { SEED_POSTS } from "/assets/js/seed-posts.js";
import { SITE } from "/assets/js/config.js";
import { readingTime } from "/assets/js/utils.js";

const cloudFields = [
  { key: "cloudName", label: "Cloud name", type: "text", placeholder: "e.g. dxyz123ab", help: "Cloudinary Console → Dashboard → “Cloud name”." },
  { key: "uploadPreset", label: "Unsigned upload preset", type: "text", placeholder: "e.g. profjero_unsigned", help: "Settings → Upload → Upload presets → Add → Signing mode: <b>Unsigned</b>." },
  { key: "folder", label: "Folder (optional)", type: "text", placeholder: "profjero", full: true }
];

const COLLECTIONS = ["settings", "skills", "studios", "projects", "testimonials", "experience", "team", "products", "bookings", "orders", "users", "clientProjects", "threads", "posts", "messages", "subscribers", "media", "admins"];

export async function render(view) {
  const cfg = await cloudinaryConfig(true);
  const isOwner = state.user.email === SITE.ownerEmail;
  let admins = [];
  try { admins = (await fb.getDocs(fb.collection(fb.db, "admins"))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }

  view.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h3><i class="fa-solid fa-cloud" style="color:#3448C5"></i> Cloudinary storage</h3><p>Images, videos and files you upload are stored on Cloudinary and optimised automatically (WebP/AVIF, resized).</p></div>
        <form id="cl-form" data-scope novalidate>${renderFields(cloudFields, cfg)}
          <div class="btn-row" style="margin-top:16px"><button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="fa-solid fa-vial"></i> Test upload<input type="file" accept="image/*" hidden id="cl-test"></label>
          <span class="small" id="cl-status">${cfg.cloudName && cfg.uploadPreset ? '<span style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> Configured</span>' : '<span style="color:#b07a00"><i class="fa-solid fa-triangle-exclamation"></i> Not configured</span>'}</span></div>
        </form>
        <div class="callout" style="margin-top:16px"><i class="fa-solid fa-shield-halved"></i><div class="small">Tip: in the upload preset, limit <b>allowed formats</b> (jpg, png, webp, gif, mp4, pdf) and set a <b>max file size</b>. These values are stored privately — only admins can read them.</div></div>
      </section>

      <section class="card">
        <div class="card-head"><h3><i class="fa-solid fa-user-shield" style="color:var(--brand)"></i> Admins</h3><p>People who can sign in to this dashboard (portfolio and ProfJero Hub). The owner account <b>${esc(SITE.ownerEmail)}</b> always has access.</p></div>
        <div class="list" id="admin-list">${admins.map(a => `<div class="list-item" data-email="${esc(a.id)}"><div class="grow"><div class="title">${esc(a.id)}</div><div class="sub">${esc(a.role || "admin")}</div></div>${isOwner ? '<button class="icon-btn sm danger" data-rm title="Remove"><i class="fa-regular fa-trash-can"></i></button>' : ""}</div>`).join("") || '<p class="muted small">No additional admins.</p>'}</div>
        ${isOwner ? `<form id="admin-form" class="f-inline" style="margin-top:12px"><input class="input" type="email" id="admin-email" placeholder="new.admin@gmail.com" required><button class="btn btn-primary btn-sm" type="submit">Add</button></form><p class="small muted">They sign in with Google (or a verified email/password account) using that address.</p>` : '<p class="small muted">Only the owner can add or remove admins.</p>'}
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h3><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--green)"></i> Import default content</h3>
        <p>Copies the built-in content (profile & site settings, ${DEFAULT_SKILLS.length} skills, ${DEFAULT_STUDIOS.length} studios, ${DEFAULT_PROJECTS.length} projects, ${DEFAULT_TESTIMONIALS.length} testimonials, ${DEFAULT_EXPERIENCE.length} timeline entries, ${DEFAULT_TEAM.length} team members, ${DEFAULT_PRODUCTS.length} branded products, the Hub homepage and ${SEED_POSTS.length} blog posts) into Firestore so you can edit everything here and readers can like and comment on posts.</p></div>
      <label class="switch" style="margin-bottom:14px"><input type="checkbox" id="seed-overwrite"><span class="track"></span>Overwrite items that already exist (blog stats, likes and comments are never touched)</label>
      <div class="btn-row"><button class="btn btn-primary" id="seed"><i class="fa-solid fa-file-import"></i> Import default content</button></div>
      <pre class="small muted" id="seed-log" style="white-space:pre-wrap;margin-top:12px"></pre>
    </section>

    <section class="card">
      <div class="card-head"><h3><i class="fa-solid fa-database" style="color:#7C3AED"></i> Backup</h3><p>Download a JSON backup of your content and form submissions.</p></div>
      <button class="btn btn-ghost" id="backup"><i class="fa-solid fa-download"></i> Download backup</button>
    </section>

    <section class="card">
      <div class="card-head"><h3><i class="fa-solid fa-cubes" style="color:#D97706"></i> ProfJero Hub integration</h3><p>ProfJero Hub uses this same Firebase project. Content is shared: studios, blog posts (choose “Show on” per post), testimonials and the <code class="k">messages</code> inbox (tagged with <code class="k">source: "hub"</code>). See <b>DATABASE.md</b> in the repository for the schema and a copy-paste snippet for the Hub.</p></div>
      <div class="callout"><i class="fa-solid fa-circle-info"></i><div class="small">Firebase config to use in ProfJero Hub: project <code class="k">jerohub-1</code>. Import <code class="k">https://profjero.pages.dev/assets/js/firebase.js</code> or copy <code class="k">assets/js/config.js</code>.</div></div>
    </section>`;

  const clForm = $("#cl-form");
  bindFields(clForm);
  clForm.addEventListener("submit", async e => {
    e.preventDefault();
    const v = readFields(cloudFields, clForm);
    try {
      await fb.setDoc(fb.doc(fb.db, "private", "integrations"), { ...v, updatedAt: fb.serverTimestamp() }, { merge: true });
      await cloudinaryConfig(true);
      $("#cl-status").innerHTML = '<span style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> Saved</span>';
      toast("Cloudinary settings saved");
    } catch (err) { toast(err.message, "error"); }
  });
  $("#cl-test").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    $("#cl-status").textContent = "Uploading…";
    try { const r = await uploadToCloudinary(f, { onProgress: p => $("#cl-status").textContent = `Uploading… ${p}%` }); $("#cl-status").innerHTML = `<span style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> Works! <a href="${esc(r.url)}" target="_blank">View file</a></span>`; }
    catch (err) { $("#cl-status").innerHTML = `<span style="color:var(--red)">${esc(err.message)}</span>`; }
    e.target.value = "";
  });

  $("#admin-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#admin-email").value.trim().toLowerCase();
    if (!email) return;
    await fb.setDoc(fb.doc(fb.db, "admins", email), { role: "admin", addedBy: state.user.email, createdAt: fb.serverTimestamp() });
    toast(`${email} is now an admin`);
    render(view);
  });
  $("#admin-list").addEventListener("click", async e => {
    const row = e.target.closest("[data-email]");
    if (row && e.target.closest("[data-rm]") && await confirmDialog(`Remove admin access for <b>${esc(row.dataset.email)}</b>?`, { ok: "Remove" })) {
      await fb.deleteDoc(fb.doc(fb.db, "admins", row.dataset.email)); row.remove(); toast("Removed");
    }
  });

  $("#seed").addEventListener("click", async () => {
    const overwrite = $("#seed-overwrite").checked;
    if (!await confirmDialog(overwrite ? "Import defaults and <b>overwrite</b> existing items with the same IDs?" : "Import defaults? Existing items are kept.", { title: "Import default content", ok: "Import", danger: false })) return;
    const log = m => { $("#seed-log").textContent += m + "\n"; };
    $("#seed-log").textContent = "";
    const btn = $("#seed");
    btn.disabled = true;
    try {
      const writes = [];
      const existing = async col => new Set((await fb.getDocs(fb.collection(fb.db, col))).docs.map(d => d.id));
      const siteDoc = await fb.getDoc(fb.doc(fb.db, "settings", "site"));
      if (!siteDoc.exists() || overwrite) writes.push([fb.doc(fb.db, "settings", "site"), { ...DEFAULT_SETTINGS, updatedAt: fb.serverTimestamp() }]);
      log(`settings: ${!siteDoc.exists() || overwrite ? "imported" : "kept existing"}`);
      const hubDoc = await fb.getDoc(fb.doc(fb.db, "settings", "hub"));
      if (!hubDoc.exists() || overwrite) writes.push([fb.doc(fb.db, "settings", "hub"), { ...HUB_SETTINGS, updatedAt: fb.serverTimestamp() }]);
      log(`hub homepage: ${!hubDoc.exists() || overwrite ? "imported" : "kept existing"}`);
      const studioDocs = Object.fromEntries((await fb.getDocs(fb.collection(fb.db, "studios"))).docs.map(d => [d.id, d.data()]));
      for (const [col, list] of [["skills", DEFAULT_SKILLS], ["studios", DEFAULT_STUDIOS], ["projects", DEFAULT_PROJECTS], ["testimonials", DEFAULT_TESTIMONIALS], ["experience", DEFAULT_EXPERIENCE], ["team", DEFAULT_TEAM], ["products", DEFAULT_PRODUCTS]]) {
        const have = await existing(col);
        let n = 0;
        list.forEach((item, i) => {
          const id = item.id || `${col}-${String(i + 1).padStart(2, "0")}-${item.name || item.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (have.has(id) && !overwrite) {
            if (col === "studios") {   // add only the new Hub page fields that older studio records lack — never overwrite edits
              const cur = studioDocs[id] || {};
              const missing = Object.fromEntries(Object.entries(item).filter(([k]) => k !== "id" && !(k in cur)));
              if (Object.keys(missing).length) { writes.push([fb.doc(fb.db, col, id), missing, true]); n++; }
            }
            return;
          }
          const { id: _, ...rest } = item;
          writes.push([fb.doc(fb.db, col, id), { order: i + 1, ...rest }]); n++;
        });
        log(`${col}: ${n} imported`);
      }
      const havePosts = await existing("posts");
      let np = 0;
      for (const p of SEED_POSTS) {
        const ref = fb.doc(fb.db, "posts", p.slug);
        const base = {
          ...p, status: "published", sites: ["portfolio", "hub"], commentsEnabled: true, readingTime: readingTime(p.content),
          publishedAt: fb.Timestamp.fromDate(new Date(p.publishedAt)), updatedAt: fb.serverTimestamp(),
          author: { name: "Benjamin Amoako (ProfJero)", avatar: "/assets/img/people/benjamin-amoako.webp" }
        };
        if (!havePosts.has(p.slug)) { writes.push([ref, { ...base, views: 0, likes: 0, shares: 0, commentCount: 0, createdAt: fb.serverTimestamp() }]); np++; }
        else if (overwrite) { writes.push([ref, base, true]); np++; }
      }
      log(`posts: ${np} imported`);
      for (let i = 0; i < writes.length; i += 400) {
        const b = fb.writeBatch(fb.db);
        writes.slice(i, i + 400).forEach(([ref, data, merge]) => merge ? b.set(ref, data, { merge: true }) : b.set(ref, data));
        await b.commit();
      }
      log(`✔ Done — ${writes.length} documents written.`);
      toast("Default content imported");
    } catch (err) { log("✖ " + err.message); toast(err.message, "error", 7000); }
    finally { btn.disabled = false; }
  });

  $("#backup").addEventListener("click", async () => {
    const out = { exportedAt: new Date().toISOString(), project: "jerohub-1" };
    for (const c of COLLECTIONS) {
      try { out[c] = (await fb.getDocs(fb.collection(fb.db, c))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { out[c] = "no access"; }
    }
    download(`profjero-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, (k, v) => v?.seconds !== undefined && v?.nanoseconds !== undefined ? new Date(v.seconds * 1000).toISOString() : v, 2));
    toast("Backup downloaded");
  });
}
