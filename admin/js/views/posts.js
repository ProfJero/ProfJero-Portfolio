import { $, $$, fb, esc, fmtDate, emptyState, confirmDialog, toast, uploadToCloudinary } from "../core.js";
import { renderFields, bindFields, readFields } from "../forms.js";
import { renderMarkdown } from "/assets/js/markdown.js";
import { slugify, readingTime, wordCount, compact, img, toDate } from "/assets/js/utils.js";

const CATEGORIES = ["Web Development", "Backend & Databases", "Career & Growth", "Motivation", "AI & Productivity", "Tech in Africa", "Security", "SEO & Marketing", "Tutorials", "News"];

export async function render(view, { params }) {
  if (params[0]) return editor(view, params[0] === "new" ? null : decodeURIComponent(params[0]));
  return list(view);
}

// ---------------- List ----------------
async function list(view) {
  const snap = await fb.getDocs(fb.collection(fb.db, "posts"));
  let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  let filter = "all", q = "";
  view.innerHTML = `
    <div class="toolbar">
      <div class="pill-tabs" id="p-tabs"></div>
      <label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="p-q" type="search" placeholder="Search posts…"></label>
      <span class="spacer"></span>
      <a class="btn btn-primary btn-sm" href="#/posts/new"><i class="fa-solid fa-plus"></i> New post</a>
    </div>
    <div id="p-table"></div>`;
  const paint = () => {
    const tabs = [["all", "All"], ["published", "Published"], ["draft", "Drafts"]];
    $("#p-tabs").innerHTML = tabs.map(([k, l]) => `<button class="${filter === k ? "active" : ""}" data-f="${k}">${l}<span>${k === "all" ? posts.length : posts.filter(p => p.status === k).length}</span></button>`).join("");
    const rows = posts.filter(p => (filter === "all" || p.status === filter) && (!q || `${p.title} ${p.category} ${(p.tags || []).join(" ")}`.toLowerCase().includes(q)))
      .sort((a, b) => (toDate(b.publishedAt) || 0) - (toDate(a.publishedAt) || 0));
    $("#p-table").innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Title</th><th>Status</th><th>Published</th><th>Views</th><th>Likes</th><th>Comments</th><th></th></tr></thead><tbody>
      ${rows.map(p => `<tr>
        <td>${p.cover ? `<img class="thumb" src="${esc(img(p.cover, 160))}" alt="">` : `<span class="thumb" style="display:grid;place-items:center;color:var(--muted)"><i class="fa-regular fa-image"></i></span>`}</td>
        <td class="t-title"><a href="#/posts/${encodeURIComponent(p.id)}" style="color:var(--text)">${esc(p.title)}</a>${p.featured ? ' <i class="fa-solid fa-bolt" style="color:var(--amber)" title="Featured"></i>' : ""}<small>${esc(p.category || "")} · ${p.readingTime || readingTime(p.content)} min</small></td>
        <td><span class="status ${esc(p.status)}">${esc(p.status)}</span></td>
        <td class="small">${fmtDate(p.publishedAt)}</td>
        <td>${compact(p.views)}</td><td>${compact(p.likes)}</td><td>${compact(p.commentCount)}</td>
        <td><div class="row-actions">
          <a class="icon-btn sm" href="/blog/${encodeURIComponent(p.id)}" target="_blank" title="View"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          <a class="icon-btn sm" href="#/posts/${encodeURIComponent(p.id)}" title="Edit"><i class="fa-solid fa-pen"></i></a>
          <button class="icon-btn sm" data-dup="${esc(p.id)}" title="Duplicate"><i class="fa-regular fa-copy"></i></button>
          <button class="icon-btn sm danger" data-del="${esc(p.id)}" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
        </div></td></tr>`).join("")}</tbody></table></div>`
      : emptyState("fa-solid fa-pen-nib", posts.length ? "No posts match." : "No posts in the database yet.", `<a class="btn btn-primary btn-sm" href="#/posts/new">Write your first post</a> <a class="btn btn-ghost btn-sm" href="#/settings">Import the 9 launch posts</a>`);
  };
  paint();
  $("#p-q").addEventListener("input", e => { q = e.target.value.toLowerCase(); paint(); });
  view.addEventListener("click", async e => {
    const f = e.target.closest("[data-f]");
    if (f) { filter = f.dataset.f; paint(); return; }
    const dup = e.target.closest("[data-dup]");
    if (dup) {
      const p = posts.find(x => x.id === dup.dataset.dup);
      let id = slugify(p.title + " copy"), n = 2;
      while (posts.some(x => x.id === id)) id = slugify(`${p.title} copy ${n++}`);
      const { id: _, ...rest } = p;
      const copy = { ...rest, slug: id, title: p.title + " (copy)", status: "draft", views: 0, likes: 0, shares: 0, commentCount: 0, createdAt: fb.serverTimestamp(), updatedAt: fb.serverTimestamp() };
      await fb.setDoc(fb.doc(fb.db, "posts", id), copy);
      location.hash = `#/posts/${id}`;
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      const p = posts.find(x => x.id === del.dataset.del);
      if (!await confirmDialog(`Delete <b>${esc(p.title)}</b> and all its comments and likes? This can't be undone.`)) return;
      await deletePost(p.id);
      posts = posts.filter(x => x.id !== p.id);
      paint();
      toast("Post deleted");
    }
  });
}

async function deletePost(id) {
  const refs = [];
  const comments = await fb.getDocs(fb.collection(fb.db, "posts", id, "comments"));
  for (const c of comments.docs) {
    const likes = await fb.getDocs(fb.collection(fb.db, "posts", id, "comments", c.id, "likes"));
    likes.docs.forEach(l => refs.push(l.ref));
    refs.push(c.ref);
  }
  (await fb.getDocs(fb.collection(fb.db, "posts", id, "likes"))).docs.forEach(l => refs.push(l.ref));
  refs.push(fb.doc(fb.db, "posts", id));
  for (let i = 0; i < refs.length; i += 450) {
    const b = fb.writeBatch(fb.db);
    refs.slice(i, i + 450).forEach(r => b.delete(r));
    await b.commit();
  }
}

// ---------------- Editor ----------------
const metaFields = [
  { key: "status", label: "Status", type: "select", options: [["draft", "Draft (hidden)"], ["published", "Published (public)"]] },
  { key: "publishedAt", label: "Publish date", type: "datetime", help: "Shown on the article. Set a past or current date." },
  { key: "category", label: "Category", type: "text", placeholder: "e.g. Web Development" },
  { key: "tags", label: "Tags", type: "tags", full: true },
  { key: "cover", label: "Cover image", type: "image", full: true, help: "Recommended 1600×900. Leave empty for an automatic branded cover." },
  { key: "featured", label: "Feature this post (shown large on the blog)", type: "toggle", full: true },
  { key: "commentsEnabled", label: "Allow comments", type: "toggle", full: true, default: true },
  { key: "sites", label: "Show on", type: "select", full: true, options: [["portfolio,hub", "Portfolio + ProfJero Hub"], ["portfolio", "Portfolio only"], ["hub", "ProfJero Hub only"]] }
];
const seoFields = [
  { key: "seoTitle", label: "SEO title", type: "text", max: 70, full: true, help: "Optional. Defaults to the post title. Aim for 50–60 characters." },
  { key: "seoDescription", label: "Meta description", type: "textarea", max: 170, full: true, rows: 3, help: "Optional. Defaults to the excerpt. Aim for 140–160 characters." }
];

async function editor(view, id) {
  let post = { status: "draft", publishedAt: new Date(), tags: [], commentsEnabled: true, sites: ["portfolio", "hub"], content: "", title: "", excerpt: "" };
  let isNew = !id;
  if (id) {
    const snap = await fb.getDoc(fb.doc(fb.db, "posts", id));
    if (!snap.exists()) { view.innerHTML = emptyState("fa-regular fa-file", "Post not found.", `<a class="btn btn-primary btn-sm" href="#/posts">Back to posts</a>`); return; }
    post = { ...post, ...snap.data() };
  } else {
    try { const d = JSON.parse(localStorage.getItem("pj_draft_new") || "null"); if (d && (d.title || d.content) && confirm("Restore your unsaved draft?")) post = { ...post, ...d, publishedAt: new Date() }; } catch { }
  }
  const sitesValue = (post.sites || ["portfolio", "hub"]).join(",");
  let slugTouched = !isNew;

  view.innerHTML = `
    <form id="post-form" data-scope novalidate>
      <div class="toolbar"><a class="btn btn-ghost btn-sm" href="#/posts"><i class="fa-solid fa-arrow-left"></i> All posts</a><span class="spacer"></span>
        ${!isNew ? `<a class="btn btn-ghost btn-sm" href="/blog/${encodeURIComponent(id)}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> View</a>` : ""}
      </div>
      <div class="editor-grid">
        <div>
          <div class="card">
            <input class="title-input" id="e-title" placeholder="Post title" value="${esc(post.title)}" maxlength="140" aria-label="Title">
            <div class="slug-row"><i class="fa-solid fa-link"></i> profjero.pages.dev/blog/<input id="e-slug" value="${esc(id || post.slug || "")}" ${isNew ? "" : "readonly title='The URL can’t change after creation (it would break shared links).'"} aria-label="Slug"></div>
            <div class="f" style="margin-bottom:16px"><label for="e-excerpt">Excerpt <span class="count" id="ex-count">${(post.excerpt || "").length}/220</span></label><textarea id="e-excerpt" rows="2" maxlength="220" placeholder="One or two sentences that make people want to read — also used in Google results.">${esc(post.excerpt || "")}</textarea></div>
            <div class="md-toolbar" role="toolbar" aria-label="Formatting">
              <button type="button" data-md="h2" title="Heading"><i class="fa-solid fa-heading"></i></button>
              <button type="button" data-md="h3" title="Subheading" style="font-size:.75rem;font-weight:800">H3</button>
              <button type="button" data-md="bold" title="Bold (Ctrl+B)"><i class="fa-solid fa-bold"></i></button>
              <button type="button" data-md="italic" title="Italic (Ctrl+I)"><i class="fa-solid fa-italic"></i></button>
              <span class="sep"></span>
              <button type="button" data-md="ul" title="Bullet list"><i class="fa-solid fa-list-ul"></i></button>
              <button type="button" data-md="ol" title="Numbered list"><i class="fa-solid fa-list-ol"></i></button>
              <button type="button" data-md="quote" title="Quote"><i class="fa-solid fa-quote-left"></i></button>
              <button type="button" data-md="code" title="Code block"><i class="fa-solid fa-code"></i></button>
              <span class="sep"></span>
              <button type="button" data-md="link" title="Link (Ctrl+K)"><i class="fa-solid fa-link"></i></button>
              <label title="Upload image" style="display:grid;place-items:center;width:34px;height:32px;border-radius:8px;cursor:pointer"><i class="fa-regular fa-image"></i><input type="file" accept="image/*" hidden id="md-img"></label>
              <button type="button" data-md="video" title="Embed YouTube/TikTok video"><i class="fa-brands fa-youtube"></i></button>
              <button type="button" data-md="table" title="Table"><i class="fa-solid fa-table"></i></button>
              <button type="button" data-md="hr" title="Divider"><i class="fa-solid fa-minus"></i></button>
              <div class="tabs"><button type="button" data-pane="write">Write</button><button type="button" data-pane="split" class="active">Split</button><button type="button" data-pane="preview">Preview</button></div>
            </div>
            <div class="md-panes" id="panes">
              <textarea id="e-content" spellcheck="true" placeholder="Write your article in Markdown…&#10;&#10;## A heading&#10;Some **bold** text, a [link](https://…) and a list:&#10;- one&#10;- two">${esc(post.content || "")}</textarea>
              <div class="md-preview"><div class="prose" id="e-preview"></div></div>
            </div>
            <div class="editor-stats" id="e-stats"></div>
          </div>
        </div>
        <div>
          <div class="card"><div class="card-head"><h3>Publishing</h3></div><div id="meta-fields">${renderFields(metaFields, { ...post, sites: sitesValue })}</div></div>
          <div class="card"><div class="card-head"><h3>Search & social</h3></div><div id="seo-fields">${renderFields(seoFields, post)}</div>
            <p class="small muted" style="margin:14px 0 8px">Google preview</p><div class="serp" id="serp"></div></div>
          ${!isNew ? `<div class="card"><div class="card-head"><h3>Engagement</h3></div><div class="kpis" style="grid-template-columns:repeat(2,1fr);margin:0">
            <div class="kpi"><small>Views</small><strong>${compact(post.views)}</strong></div><div class="kpi"><small>Likes</small><strong>${compact(post.likes)}</strong></div>
            <div class="kpi"><small>Comments</small><strong>${compact(post.commentCount)}</strong></div><div class="kpi"><small>Shares</small><strong>${compact(post.shares)}</strong></div></div></div>` : ""}
        </div>
      </div>
      <div class="save-bar" id="save-bar"><span class="dirty-dot"></span><span class="small muted" id="save-state">${isNew ? "New post" : `Last updated ${fmtDate(post.updatedAt, true)}`}</span><span class="spacer"></span>
        ${!isNew ? `<button class="btn btn-ghost btn-sm danger" type="button" id="e-del"><i class="fa-regular fa-trash-can"></i> Delete</button>` : ""}
        <button class="btn btn-ghost" type="button" id="e-draft">Save draft</button>
        <button class="btn btn-primary" type="submit" id="e-publish"><i class="fa-solid fa-paper-plane"></i> ${post.status === "published" ? "Update" : "Publish"}</button></div>
    </form>`;

  const form = $("#post-form");
  const ta = $("#e-content");
  const markDirty = () => {
    form.classList.add("is-dirty");
    if (isNew) { try { localStorage.setItem("pj_draft_new", JSON.stringify({ title: $("#e-title").value, excerpt: $("#e-excerpt").value, content: ta.value })); } catch { } }
  };
  bindFields(form, () => { markDirty(); updateSerp(); });

  let pt;
  const preview = () => { clearTimeout(pt); pt = setTimeout(() => {
    if (!ta.isConnected) return;
    $("#e-preview").innerHTML = renderMarkdown(ta.value).html || '<p class="muted">Nothing to preview yet.</p>';
    $("#e-stats").innerHTML = `<span>${wordCount(ta.value)} words</span><span>${readingTime(ta.value)} min read</span><span>${(ta.value.match(/^##\s/gm) || []).length} sections</span>`;
  }, 120); };
  const updateSerp = () => {
    if (!form.isConnected) return;
    const seo = readFields(seoFields, form);
    const slug = $("#e-slug").value || "your-post";
    $("#serp").innerHTML = `<div class="s-url">profjero.pages.dev › blog › ${esc(slug)}</div><div class="s-title">${esc(seo.seoTitle || $("#e-title").value || "Post title")} | ProfJero Blog</div><div class="s-desc">${esc(seo.seoDescription || $("#e-excerpt").value || "Your excerpt will appear here.")}</div>`;
  };
  preview(); updateSerp();

  $("#e-title").addEventListener("input", e => { if (!slugTouched) $("#e-slug").value = slugify(e.target.value); markDirty(); updateSerp(); });
  $("#e-slug").addEventListener("input", e => { slugTouched = true; e.target.value = slugify(e.target.value); updateSerp(); });
  $("#e-excerpt").addEventListener("input", e => { $("#ex-count").textContent = `${e.target.value.length}/220`; markDirty(); updateSerp(); });
  ta.addEventListener("input", () => { preview(); markDirty(); });
  ta.addEventListener("scroll", () => { const p = $(".md-preview"); p.scrollTop = (ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight)) * (p.scrollHeight - p.clientHeight); });

  // Markdown toolbar
  const wrap = (before, after = before, placeholder = "text") => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, "end");
    ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length;
    ta.dispatchEvent(new Event("input"));
  };
  const linePrefix = prefix => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const start = ta.value.lastIndexOf("\n", s - 1) + 1;
    const block = ta.value.slice(start, e) || "Item";
    const out = block.split("\n").map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l.replace(/^(#{1,4}\s|[-*]\s|\d+\.\s|>\s)/, "")).join("\n");
    ta.setRangeText(out, start, e, "end"); ta.focus(); ta.dispatchEvent(new Event("input"));
  };
  const insertBlock = text => { const s = ta.selectionStart; const pre = s && ta.value[s - 1] !== "\n" ? "\n\n" : ""; ta.setRangeText(pre + text + "\n", s, ta.selectionEnd, "end"); ta.focus(); ta.dispatchEvent(new Event("input")); };
  const actions = {
    h2: () => linePrefix("## "), h3: () => linePrefix("### "), bold: () => wrap("**"), italic: () => wrap("*"),
    ul: () => linePrefix("- "), ol: () => linePrefix(i => `${i + 1}. `), quote: () => linePrefix("> "),
    code: () => wrap("\n```js\n", "\n```\n", "// code"),
    link: () => { const url = prompt("Link URL", "https://"); if (url) wrap("[", `](${url})`, "link text"); },
    video: () => { const url = prompt("Paste a YouTube or TikTok video link"); if (url) insertBlock(`@[video](${url.trim()})`); },
    table: () => insertBlock("| Column | Column |\n|---|---|\n| Value | Value |"),
    hr: () => insertBlock("---")
  };
  form.addEventListener("click", e => {
    const b = e.target.closest("[data-md]");
    if (b) { actions[b.dataset.md](); return; }
    const pane = e.target.closest("[data-pane]");
    if (pane) { $$("[data-pane]").forEach(x => x.classList.toggle("active", x === pane)); $("#panes").className = "md-panes " + (pane.dataset.pane === "split" ? "" : pane.dataset.pane); preview(); }
  });
  ta.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === "b") { e.preventDefault(); actions.bold(); }
    if (e.key === "i") { e.preventDefault(); actions.italic(); }
    if (e.key === "k") { e.preventDefault(); actions.link(); }
  });
  $("#md-img").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    toast("Uploading image…", "info");
    try {
      const item = await uploadToCloudinary(file, { folder: "blog" });
      const alt = prompt("Describe the image (alt text for accessibility & SEO)", file.name.replace(/\.\w+$/, "")) || "";
      insertBlock(`![${alt}](${item.url})`);
    } catch (err) { toast(err.message, "error", 6000); }
    e.target.value = "";
  });

  async function save(status) {
    const title = $("#e-title").value.trim();
    const slug = $("#e-slug").value.trim();
    if (!title) { toast("Please add a title.", "error"); $("#e-title").focus(); return; }
    if (!slug) { toast("Please add a URL slug.", "error"); $("#e-slug").focus(); return; }
    const meta = readFields(metaFields, form);
    const seo = readFields(seoFields, form);
    const content = ta.value;
    if (status === "published" && content.trim().length < 50) { toast("Write a bit more before publishing.", "error"); return; }
    const data = {
      ...meta, ...seo, title, slug, excerpt: $("#e-excerpt").value.trim(), content, status,
      sites: (meta.sites || "portfolio,hub").split(","),
      publishedAt: fb.Timestamp.fromDate(meta.publishedAt || new Date()),
      readingTime: readingTime(content), updatedAt: fb.serverTimestamp(),
      author: post.author || { name: "Benjamin Amoako (ProfJero)", avatar: "/assets/img/people/benjamin-amoako.webp" }
    };
    const btns = $$("#save-bar button");
    btns.forEach(b => b.disabled = true);
    try {
      const ref = fb.doc(fb.db, "posts", slug);
      if (isNew) {
        const exists = await fb.getDoc(ref).then(s => s.exists()).catch(() => false);
        if (exists) { toast("A post with this URL already exists. Change the slug.", "error"); return; }
        await fb.setDoc(ref, { ...data, views: 0, likes: 0, shares: 0, commentCount: 0, createdAt: fb.serverTimestamp() });
        try { localStorage.removeItem("pj_draft_new"); } catch { }
      } else {
        await fb.updateDoc(ref, data);
      }
      form.classList.remove("is-dirty");
      $("#save-state").textContent = `Saved ${new Date().toLocaleTimeString()}`;
      toast(status === "published" ? "Published! Your article is live." : "Draft saved");
      if (isNew) { isNew = false; location.hash = `#/posts/${slug}`; }
      else $("#e-publish").innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${status === "published" ? "Update" : "Publish"}`;
      post.status = status;
    } catch (e) {
      console.error(e); toast("Save failed: " + e.message, "error", 6000);
    } finally { btns.forEach(b => b.disabled = false); }
  }
  form.addEventListener("submit", e => { e.preventDefault(); save("published"); });
  $("#e-draft").addEventListener("click", () => save("draft"));
  $("#e-del")?.addEventListener("click", async () => {
    if (!await confirmDialog(`Delete <b>${esc(post.title)}</b> and all its comments? This can't be undone.`)) return;
    await deletePost(id);
    form.classList.remove("is-dirty");
    toast("Post deleted");
    location.hash = "#/posts";
  });
  const keySave = e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(post.status === "published" ? "published" : "draft"); } };
  document.addEventListener("keydown", keySave);
  destroyHandlers.push(() => document.removeEventListener("keydown", keySave));
  // Category suggestions
  const cat = $('[data-field="category"] input', form);
  cat.setAttribute("list", "cat-list");
  form.insertAdjacentHTML("beforeend", `<datalist id="cat-list">${CATEGORIES.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`);
}

const destroyHandlers = [];
export function destroy() { destroyHandlers.splice(0).forEach(f => f()); }
