import { $, $$, fb, esc, toast, confirmDialog, download, cloudinaryConfig, saveCloudinary, uploadToCloudinary, confirmIdentity, state } from "../core.js";
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

const COLLECTIONS = ["settings", "skills", "studios", "projects", "testimonials", "experience", "team", "products", "bookings", "orders", "invoices", "users", "clientProjects", "reviews", "threads", "posts", "messages", "subscribers", "media", "admins"];
const mask = v => v ? "•".repeat(Math.min(14, Math.max(8, String(v).length))) : "—";

export async function render(view) {
  const cfg = await cloudinaryConfig(true);
  const configured = !!(cfg.cloudName && cfg.uploadPreset);
  let revealed = false;

  view.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h3><i class="fa-solid fa-cloud" style="color:#3448C5"></i> Cloudinary storage</h3><p>Images, videos and files you upload are stored on Cloudinary and optimised automatically (WebP/AVIF, resized).</p></div>
        <div id="cl-view">
          <div class="secret-list">
            <div class="secret"><span>Cloud name</span><code data-secret="cloudName">${mask(cfg.cloudName)}</code></div>
            <div class="secret"><span>Upload preset</span><code data-secret="uploadPreset">${mask(cfg.uploadPreset)}</code></div>
            <div class="secret"><span>Folder</span><code data-secret="folder">${cfg.folder ? mask(cfg.folder) : "—"}</code></div>
          </div>
          <div class="btn-row" style="margin-top:14px">
            ${configured ? `<button class="btn btn-ghost btn-sm" type="button" id="cl-reveal"><i class="fa-regular fa-eye"></i> Show values</button>` : ""}
            <button class="btn ${configured ? "btn-ghost" : "btn-primary"} btn-sm" type="button" id="cl-edit"><i class="fa-solid fa-pen"></i> ${configured ? "Change" : "Set up Cloudinary"}</button>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="fa-solid fa-vial"></i> Test upload<input type="file" accept="image/*" hidden id="cl-test"></label>
            <span class="small" id="cl-status">${configured ? '<span style="color:var(--green)"><i class="fa-solid fa-lock"></i> Configured &amp; encrypted</span>' : '<span style="color:#b07a00"><i class="fa-solid fa-triangle-exclamation"></i> Not configured</span>'}</span>
          </div>
        </div>
        <form id="cl-form" data-scope novalidate hidden>${renderFields(cloudFields, {})}
          <div class="btn-row" style="margin-top:16px"><button class="btn btn-ghost btn-sm" type="button" id="cl-cancel">Cancel</button><button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-lock"></i> Save encrypted</button></div>
        </form>
        <div class="callout" style="margin-top:16px"><i class="fa-solid fa-shield-halved"></i><div class="small">These details are stored <b>encrypted</b> (AES-256) and only admins can read them. They stay hidden here until you confirm it's you. In Cloudinary, also limit the upload preset's <b>allowed formats</b> (jpg, png, webp, gif, mp4, pdf) and set a <b>max file size</b>.</div></div>
      </section>

      <section class="card">
        <div class="card-head"><h3><i class="fa-solid fa-user-shield" style="color:var(--brand)"></i> Admins &amp; roles</h3><p>${state.access.owner ? "Add people to the dashboard and choose exactly what each one can do." : "Only the super admin can add or change admins."}</p></div>
        ${state.access.owner ? '<a class="btn btn-primary btn-sm" href="#/admins"><i class="fa-solid fa-user-plus"></i> Manage admins &amp; roles</a>' : ""}
        <hr style="margin:20px 0;border:0;border-top:1px solid var(--line)">
        <div class="card-head"><h3><i class="fa-regular fa-bell" style="color:var(--brand)"></i> Alerts</h3><p>Choose when you're alerted about deadlines, overdue invoices, waiting clients and more.</p></div>
        <a class="btn btn-ghost btn-sm" href="#/alerts"><i class="fa-solid fa-sliders"></i> Alert thresholds</a>
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

`;

  const clForm = $("#cl-form");
  bindFields(clForm);
  const showForm = on => { clForm.hidden = !on; $("#cl-view").hidden = on; };
  $("#cl-edit").addEventListener("click", async () => {
    if (configured) {
      try { if (!await confirmIdentity("Confirm it's you to change the storage settings.")) return; } catch (err) { return toast(err.code === "auth/popup-closed-by-user" ? "Cancelled" : err.message, "error"); }
      cloudFields.forEach(f => { const i = clForm.querySelector(`[data-field="${f.key}"] input`); if (i) i.value = cfg[f.key] || ""; });
    }
    showForm(true);
  });
  $("#cl-cancel").addEventListener("click", () => showForm(false));
  $("#cl-reveal")?.addEventListener("click", async () => {
    if (revealed) { $$("[data-secret]").forEach(c => { c.textContent = cfg[c.dataset.secret] ? mask(cfg[c.dataset.secret]) : "—"; }); revealed = false; $("#cl-reveal").innerHTML = '<i class="fa-regular fa-eye"></i> Show values'; return; }
    try { if (!await confirmIdentity("Confirm it's you to view the storage settings.")) return; } catch (err) { return toast(err.code === "auth/popup-closed-by-user" ? "Cancelled" : err.message, "error"); }
    $$("[data-secret]").forEach(c => { c.textContent = cfg[c.dataset.secret] || "—"; });
    revealed = true; $("#cl-reveal").innerHTML = '<i class="fa-regular fa-eye-slash"></i> Hide values';
    setTimeout(() => { if (revealed && $("#cl-reveal")) $("#cl-reveal").click(); }, 60000);   // re-mask after a minute
  });
  clForm.addEventListener("submit", async e => {
    e.preventDefault();
    const v = readFields(cloudFields, clForm);
    if (!v.cloudName || !v.uploadPreset) return toast("Enter the cloud name and the upload preset.", "error");
    try {
      Object.assign(cfg, await saveCloudinary(v));
      toast("Cloudinary settings saved (encrypted)");
      render(view);
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
