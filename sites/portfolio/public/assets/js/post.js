import { $, $$, initCommon, applySettings, reveal, toast, initCopyButtons, guardModal } from "./ui.js";
import { loadPost, loadPosts, loadSettings, firebase } from "./store.js";
import { renderPostCard, postCover, avatar, byNewest } from "./render.js";
import { renderMarkdown } from "./markdown.js";
import { esc, compact, formatDate, timeAgo, toDate, img, hueFrom, initials } from "./utils.js";
import { SITE } from "./config.js";

initCommon();
initCopyButtons($("#a-body"));
loadSettings().then(applySettings);

const slug = decodeURIComponent((location.pathname.match(/^\/blog\/([^/?#]+)/) || [])[1] || new URLSearchParams(location.search).get("slug") || "");
const postUrl = `${SITE.url}/blog/${encodeURIComponent(slug)}`;
let post = null;
let live = false;           // true when the post exists in Firestore (interactions enabled)
let user = null;
let isAdmin = false;
let comments = [];
let commentSort = "top";
let commentLimit = 10;
const likedComments = new Set();

// ---------- Render article ----------
// Full-width hero: the cover photo behind the title (or a branded gradient without one).
function setHeroCover(p) {
  const hero = $("#a-hero"), cover = postCover(p, 1600);
  hero.style.setProperty("--h", hueFrom(p.category || p.title));
  hero.classList.toggle("has-cover", !!cover);
  $("#a-hero-bg").innerHTML = cover ? `<img src="${esc(cover)}" alt="${esc(p.coverAlt || p.title)}" fetchpriority="high">` : "";
}

// Tap an image in the article to view it full screen.
function initLightbox() {
  $("#a-body").addEventListener("click", e => {
    const im = e.target.closest(".prose img");
    if (!im) return;
    const box = document.createElement("dialog");
    box.className = "lightbox";
    const cap = im.closest("figure")?.querySelector("figcaption")?.textContent || im.alt || "";
    box.innerHTML = `<button type="button" class="lightbox-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><img src="${esc(im.dataset.zoom || im.currentSrc || im.src)}" alt="${esc(im.alt)}">${cap ? `<p>${esc(cap)}</p>` : ""}`;
    document.body.append(box);
    box.addEventListener("click", ev => { if (ev.target === box || ev.target.closest(".lightbox-close")) box.close(); });
    box.addEventListener("close", () => box.remove());
    box.showModal();
  });
}
initLightbox();

function setMeta(p) {
  const title = `${p.seoTitle || p.title} | ProfJero Blog`;
  const desc = p.seoDescription || p.excerpt || "";
  const image = p.cover ? new URL(img(p.cover, 1200), location.origin).href : `${SITE.url}/assets/img/brand/og-image.jpg`;
  document.title = title;
  const set = (sel, attr, v) => $(sel)?.setAttribute(attr, v);
  set('meta[name="description"]', "content", desc);
  set('link[rel="canonical"]', "href", postUrl);
  set('meta[property="og:title"]', "content", title);
  set('meta[property="og:description"]', "content", desc);
  set('meta[property="og:url"]', "content", postUrl);
  set('meta[property="og:image"]', "content", image);
  set('meta[name="twitter:title"]', "content", title);
  set('meta[name="twitter:description"]', "content", desc);
  set('meta[name="twitter:image"]', "content", image);
  $("#article-schema").textContent = JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: p.title, description: desc, image, url: postUrl, mainEntityOfPage: postUrl,
    datePublished: toDate(p.publishedAt)?.toISOString(), dateModified: (toDate(p.updatedAt) || toDate(p.publishedAt))?.toISOString(),
    articleSection: p.category, keywords: (p.tags || []).join(", "), wordCount: (p.content || "").split(/\s+/).length,
    author: { "@type": "Person", "@id": `${SITE.url}/#person`, name: "Benjamin Amoako", alternateName: "ProfJero", url: SITE.url + "/" },
    publisher: { "@type": "Person", "@id": `${SITE.url}/#person`, name: "Benjamin Amoako" },
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.likes || 0 },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: p.commentCount || 0 }
    ]
  }).replace(/</g, "\\u003c");
}

function renderArticle(p) {
  $("#article").dataset.slug = p.slug;
  $("#a-title").textContent = p.title;
  $("#a-excerpt").textContent = p.excerpt || "";
  const cat = $("#a-cat");
  cat.textContent = p.category || "Article";
  cat.href = `/blog?category=${encodeURIComponent(p.category || "")}`;
  $("#crumb-cat").textContent = p.category || "Article";
  if (p.author?.name) $("#a-author").textContent = p.author.name;
  if (p.author?.avatar) $("#a-avatar").src = img(p.author.avatar, 120);
  const updated = toDate(p.updatedAt), pub = toDate(p.publishedAt);
  $("#a-meta").innerHTML = `<time datetime="${pub?.toISOString() || ""}">${formatDate(pub)}</time> · ${p.readingTime} min read${updated && pub && updated - pub > 864e5 ? ` · Updated ${formatDate(updated)}` : ""}`;
  setHeroCover(p);
  const { html, toc } = renderMarkdown(p.content || "");
  $("#a-body").innerHTML = html;
  $("#a-tags").innerHTML = (p.tags || []).map(t => `<a href="/blog?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("");
  $("#toc").innerHTML = toc.length > 2 ? `<h4>On this page</h4><ol>${toc.map(t => `<li><a class="lvl-${t.level}" href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ol>` : "";
  setMeta(p);
  updateCounts(p);
  initToc();
}

function updateCounts(p) {
  for (const k of ["likes", "commentCount", "shares", "views"]) $$(`[data-count="${k}"]`).forEach(el => el.textContent = compact(p[k]));
}

function notFound() {
  document.title = "Article not found | ProfJero Blog";
  $("#a-title").textContent = "Article not found";
  $("#a-excerpt").textContent = "This article may have been moved or unpublished.";
  $("#a-body").innerHTML = `<p><a class="btn btn-primary" href="/blog">Browse all articles</a></p>`;
  $(".action-bar").hidden = true;
  $("#comments").hidden = true;
  // Keep the rail's grid column (hiding it would drop the article into that narrow column).
  $(".share-rail").style.visibility = "hidden";
}

// ---------- Table of contents scroll-spy & reading progress ----------
function initToc() {
  const links = $$("#toc a");
  const heads = links.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if ("IntersectionObserver" in window && heads.length) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle("active", a.hash === "#" + e.target.id));
    }), { rootMargin: "-20% 0px -70% 0px" });
    heads.forEach(h => io.observe(h));
  }
}
const bar = $("#reading-progress");
let readTick = false;
addEventListener("scroll", () => {
  if (readTick) return;
  readTick = true;
  requestAnimationFrame(() => {
    const r = $("#a-body").getBoundingClientRect();
    bar.style.setProperty("--p", Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight * .6))).toFixed(4));
    readTick = false;
  });
}, { passive: true });

// ---------- Auth helpers ----------
async function me() {
  const fb = await firebase();
  user = await fb.ensureVisitor();
  return user;
}
function displayName() {
  if (user && !user.isAnonymous && user.displayName) return user.displayName;
  return ($("#c-name").value || "").trim();
}
function paintMe() {
  const el = $("#me-avatar");
  if (user && !user.isAnonymous && user.photoURL) el.outerHTML = `<img class="avatar" id="me-avatar" src="${esc(user.photoURL)}" alt="" width="40" height="40" referrerpolicy="no-referrer">`;
  const nameInput = $("#c-name");
  if (user && !user.isAnonymous) { nameInput.value = user.displayName || ""; nameInput.hidden = true; $("#g-signin").hidden = true; }
  else { try { nameInput.value ||= localStorage.getItem("pj_name") || ""; } catch { } }
}

async function checkAdmin(u) {
  if (!u || u.isAnonymous || !u.email) return false;
  if (u.email === SITE.ownerEmail && u.emailVerified) return true;
  try {
    const { db, doc, getDoc } = await firebase();
    return (await getDoc(doc(db, "admins", u.email))).exists();
  } catch { return false; }
}

// ---------- Likes ----------
async function refreshLiked() {
  if (!live || !user) return;
  const { db, doc, getDoc } = await firebase();
  try {
    const liked = (await getDoc(doc(db, "posts", slug, "likes", user.uid))).exists();
    setLiked(liked);
  } catch { }
}
function setLiked(on) {
  $$("[data-like]").forEach(b => {
    b.classList.toggle("liked", on);
    b.setAttribute("aria-pressed", on);
    const i = $("i", b);
    i.className = on ? "fa-solid fa-heart" : "fa-regular fa-heart";
  });
}
let liking = false;
async function toggleLike() {
  if (!live) return toast("Likes will be available once this article is published to the database.", "info");
  if (liking) return;
  liking = true;
  const wasLiked = $("[data-like]").classList.contains("liked");
  setLiked(!wasLiked);
  post.likes = Math.max(0, (post.likes || 0) + (wasLiked ? -1 : 1));
  updateCounts(post);
  try {
    await me();
    const { db, doc, writeBatch, increment, serverTimestamp } = await firebase();
    const b = writeBatch(db);
    const likeRef = doc(db, "posts", slug, "likes", user.uid);
    if (wasLiked) b.delete(likeRef); else b.set(likeRef, { createdAt: serverTimestamp() });
    b.update(doc(db, "posts", slug), { likes: increment(wasLiked ? -1 : 1) });
    await b.commit();
  } catch (e) {
    console.error(e);
    setLiked(wasLiked);
    post.likes = Math.max(0, (post.likes || 0) + (wasLiked ? 1 : -1));
    updateCounts(post);
    toast("Couldn't save your like. Please try again.", "error");
  } finally { liking = false; }
}
document.addEventListener("click", e => { if (e.target.closest("[data-like]")) toggleLike(); });

// ---------- Sharing ----------
async function countShare() {
  if (!live) return;
  try {
    const { db, doc, updateDoc, increment } = await firebase();
    await updateDoc(doc(db, "posts", slug), { shares: increment(1) });
  } catch { }
}
const shareModal = $("#share-modal");
function openShare() {
  const u = encodeURIComponent(postUrl), t = encodeURIComponent(post.title);
  const opts = [
    ["WhatsApp", "fa-brands fa-whatsapp", "#25D366", `https://wa.me/?text=${t}%20${u}`],
    ["Facebook", "fa-brands fa-facebook-f", "#1877F2", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["X", "fa-brands fa-x-twitter", "#000", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ["LinkedIn", "fa-brands fa-linkedin-in", "#0A66C2", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["Telegram", "fa-brands fa-telegram", "#229ED9", `https://t.me/share/url?url=${u}&text=${t}`],
    ["Email", "fa-solid fa-envelope", "#5F6E8A", `mailto:?subject=${t}&body=${t}%0A%0A${u}`]
  ];
  $("#share-sheet").innerHTML = opts.map(([n, i, c, href]) => `<a class="share-opt" href="${href}" target="_blank" rel="noopener" data-share-out><i class="${i}" style="background:${c}"></i>${n}</a>`).join("")
    + (navigator.share ? `<button class="share-opt" type="button" id="native-share"><i class="fa-solid fa-ellipsis" style="background:var(--brand)"></i>More</button>` : "");
  $("#share-url").value = postUrl;
  shareModal.showModal();
}
document.addEventListener("click", async e => {
  if (e.target.closest("[data-share]")) openShare();
  if (e.target.closest("[data-share-out]")) { countShare(); shareModal.close(); }
  if (e.target.closest("#native-share")) {
    try { await navigator.share({ title: post.title, text: post.excerpt, url: postUrl }); countShare(); shareModal.close(); } catch { }
  }
});
$("#copy-link").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(postUrl); } catch { $("#share-url").select(); document.execCommand("copy"); }
  toast("Link copied to clipboard");
  countShare();
});
guardModal(shareModal);

// ---------- Views (one per browser session) ----------
async function countView() {
  const key = "pj_view_" + slug;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { return; }
  try {
    const { db, doc, updateDoc, increment } = await firebase();
    await updateDoc(doc(db, "posts", slug), { views: increment(1) });
  } catch { }
}

// ---------- Comments ----------
function commentHtml(c, replies = []) {
  const mine = user && c.uid === user.uid;
  const name = c.deleted ? "Deleted comment" : c.name;
  const liked = likedComments.has(c.id);
  return `
  <div class="comment" id="c-${esc(c.id)}" data-id="${esc(c.id)}">
    ${c.photo && !c.deleted ? `<img class="avatar" src="${esc(c.photo)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">` : `<span class="avatar avatar-fallback" style="--h:${hueFrom(c.name)}">${esc(initials(name))}</span>`}
    <div class="comment-main">
      <div class="comment-top">
        <strong>${esc(name)}</strong>
        ${c.isAuthor ? '<span class="author-badge"><i class="fa-solid fa-circle-check"></i> Author</span>' : ""}
        <time datetime="${toDate(c.createdAt)?.toISOString() || ""}" title="${toDate(c.createdAt)?.toLocaleString() || ""}">${c.createdAt ? timeAgo(c.createdAt) : "just now"}</time>
        ${c.pinned ? '<span class="pinned-badge"><i class="fa-solid fa-thumbtack"></i> Pinned by author</span>' : ""}
      </div>
      <p class="comment-text">${c.deleted ? "<em>This comment was deleted.</em>" : esc(c.text)}</p>
      ${c.deleted ? "" : `<div class="comment-actions">
        <button class="c-act${liked ? " liked" : ""}" data-c-like="${esc(c.id)}" aria-pressed="${liked}"><i class="fa-${liked ? "solid" : "regular"} fa-thumbs-up"></i> ${c.likes ? compact(c.likes) : ""}</button>
        ${!c.parentId ? `<button class="c-act" data-c-reply="${esc(c.id)}">Reply</button>` : `<button class="c-act" data-c-reply="${esc(c.parentId)}" data-mention="${esc(c.name)}">Reply</button>`}
        ${isAdmin && !c.parentId ? `<button class="c-act" data-c-pin="${esc(c.id)}"><i class="fa-solid fa-thumbtack"></i> ${c.pinned ? "Unpin" : "Pin"}</button>` : ""}
        ${mine || isAdmin ? `<button class="c-act" data-c-del="${esc(c.id)}"><i class="fa-regular fa-trash-can"></i> Delete</button>` : ""}
      </div>`}
      ${!c.parentId && replies.length ? `<button class="c-act reply-toggle" data-c-toggle="${esc(c.id)}"><i class="fa-solid fa-caret-down"></i> ${replies.length} ${replies.length === 1 ? "reply" : "replies"}</button>` : ""}
      <div class="reply-box" data-reply-box="${esc(c.id)}"></div>
      ${!c.parentId && replies.length ? `<div class="replies" data-replies="${esc(c.id)}" ${openThreads.has(c.id) ? "" : "hidden"}>${replies.map(r => commentHtml(r)).join("")}</div>` : ""}
    </div>
  </div>`;
}
const openThreads = new Set();

function renderComments() {
  const tops = comments.filter(c => !c.parentId);
  const replies = id => comments.filter(c => c.parentId === id).sort((a, b) => (toDate(a.createdAt) || 0) - (toDate(b.createdAt) || 0));
  const score = c => (c.likes || 0) * 3 + replies(c.id).length * 2;
  tops.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (commentSort === "top" ? score(b) - score(a) : 0)
    || (toDate(b.createdAt)?.getTime() ?? Date.now()) - (toDate(a.createdAt)?.getTime() ?? Date.now()));
  const visible = tops.filter(c => !c.deleted || replies(c.id).length).slice(0, commentLimit);
  $("#comment-list").innerHTML = visible.length
    ? visible.map(c => commentHtml(c, replies(c.id))).join("")
    : `<div class="empty"><i class="fa-regular fa-comments"></i><p>No comments yet. Start the conversation!</p></div>`;
  $("#c-more").hidden = tops.length <= commentLimit;
}

async function listenComments() {
  const { db, collection, onSnapshot } = await firebase();
  onSnapshot(collection(db, "posts", slug, "comments"), snap => {
    comments = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    renderComments();
  }, err => console.warn("comments:", err.message));
}

function composerOpen(form, open) { form.classList.toggle("active", open); }
const composer = $("#composer");
$("#c-text").addEventListener("focus", () => composerOpen(composer, true));
$("#c-text").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = e.target.scrollHeight + "px";
  $("#c-chars").textContent = `${e.target.value.length}/2000`;
});
$("#c-cancel").addEventListener("click", () => { $("#c-text").value = ""; composerOpen(composer, false); });
$("#g-signin").addEventListener("click", async () => {
  try {
    const { signInWithGoogle } = await firebase();
    user = await signInWithGoogle();
    isAdmin = await checkAdmin(user);
    paintMe(); renderComments(); refreshLiked();
    toast(`Signed in as ${user.displayName || user.email}`);
  } catch (e) { if (e?.code !== "auth/popup-closed-by-user") toast("Google sign-in failed. You can still comment with your name.", "error"); }
});

async function submitComment(text, parentId = null) {
  if (!live) { toast("Comments will open once this article is published to the database.", "info"); return false; }
  text = text.trim();
  if (text.length < 2) { toast("Please write a little more.", "error"); return false; }
  await me();
  const name = displayName();
  if (!name || name.length < 2) { toast("Please enter your name so people know who's commenting.", "error"); composerOpen(composer, true); $("#c-name").hidden = false; $("#c-name").focus(); return false; }
  try { localStorage.setItem("pj_name", name); } catch { }
  const { db, doc, collection, writeBatch, increment, serverTimestamp, updateProfile } = await firebase();
  if (user.isAnonymous && user.displayName !== name) updateProfile(user, { displayName: name }).catch(() => { });
  const ref = doc(collection(db, "posts", slug, "comments"));
  const b = writeBatch(db);
  b.set(ref, {
    uid: user.uid, name: name.slice(0, 60), photo: (!user.isAnonymous && user.photoURL) || "",
    text: text.slice(0, 2000), parentId, likes: 0, pinned: false, isAuthor: isAdmin, deleted: false,
    createdAt: serverTimestamp()
  });
  b.update(doc(db, "posts", slug), { commentCount: increment(1), lastCommentId: ref.id });
  await b.commit();
  if (parentId) openThreads.add(parentId);
  return true;
}

composer.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#c-submit");
  btn.disabled = true;
  try {
    if (await submitComment($("#c-text").value)) {
      $("#c-text").value = ""; $("#c-text").style.height = ""; $("#c-chars").textContent = "0/2000";
      composerOpen(composer, false);
      toast("Comment posted");
    }
  } catch (err) { console.error(err); toast("Couldn't post your comment. Please try again.", "error"); }
  finally { btn.disabled = false; }
});

$("#c-sort").addEventListener("change", e => { commentSort = e.target.value; renderComments(); });
$("#c-more").addEventListener("click", () => { commentLimit += 10; renderComments(); });

$("#comment-list").addEventListener("click", async e => {
  const t = e.target.closest("button");
  if (!t) return;
  const { db, doc, writeBatch, increment, updateDoc, serverTimestamp } = await firebase();

  if (t.dataset.cToggle) {
    const box = $(`[data-replies="${CSS.escape(t.dataset.cToggle)}"]`);
    box.hidden = !box.hidden;
    box.hidden ? openThreads.delete(t.dataset.cToggle) : openThreads.add(t.dataset.cToggle);
    return;
  }
  if (t.dataset.cReply) {
    const id = t.dataset.cReply;
    const box = $(`[data-reply-box="${CSS.escape(id)}"]`, t.closest(".comment")) || $(`[data-reply-box="${CSS.escape(id)}"]`);
    box.innerHTML = `<form class="composer active" data-reply-form="${esc(id)}"><div class="composer-main">
      <textarea rows="1" maxlength="2000" placeholder="Add a reply…">${t.dataset.mention ? "@" + esc(t.dataset.mention) + " " : ""}</textarea>
      <div class="composer-row"><span class="spacer"></span><button class="btn btn-ghost btn-sm" type="button" data-cancel-reply>Cancel</button><button class="btn btn-primary btn-sm" type="submit">Reply</button></div></div></form>`;
    const ta = $("textarea", box); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    if (!displayName()) { composerOpen(composer, true); toast("Add your name in the comment box above first.", "info"); }
    return;
  }
  if (t.dataset.cancelReply !== undefined) { t.closest(".reply-box").innerHTML = ""; return; }
  if (t.dataset.cLike) {
    if (!live) return;
    const id = t.dataset.cLike;
    const c = comments.find(x => x.id === id);
    const on = !likedComments.has(id);
    try {
      await me();
      const b = writeBatch(db);
      const likeRef = doc(db, "posts", slug, "comments", id, "likes", user.uid);
      on ? b.set(likeRef, { createdAt: serverTimestamp() }) : b.delete(likeRef);
      b.update(doc(db, "posts", slug, "comments", id), { likes: increment(on ? 1 : -1) });
      on ? likedComments.add(id) : likedComments.delete(id);
      if (c) c.likes = Math.max(0, (c.likes || 0) + (on ? 1 : -1));
      renderComments();
      await b.commit();
      saveLikedComments();
    } catch (err) {
      console.warn(err);
      on ? likedComments.delete(id) : likedComments.add(id);
      // the like may already exist from another session; resync state
      if (on && err?.code === "permission-denied") { likedComments.add(id); saveLikedComments(); }
      renderComments();
    }
    return;
  }
  if (t.dataset.cPin) {
    const c = comments.find(x => x.id === t.dataset.cPin);
    try { await updateDoc(doc(db, "posts", slug, "comments", c.id), { pinned: !c.pinned }); } catch { toast("Couldn't update pin.", "error"); }
    return;
  }
  if (t.dataset.cDel) {
    if (!confirm("Delete this comment?")) return;
    const c = comments.find(x => x.id === t.dataset.cDel);
    const hasReplies = comments.some(x => x.parentId === c.id);
    try {
      if (hasReplies) {
        await updateDoc(doc(db, "posts", slug, "comments", c.id), { deleted: true, text: "" });
      } else {
        const b = writeBatch(db);
        b.delete(doc(db, "posts", slug, "comments", c.id));
        b.update(doc(db, "posts", slug), { commentCount: increment(-1), lastCommentId: c.id });
        await b.commit();
      }
      toast("Comment deleted");
    } catch (err) { console.error(err); toast("Couldn't delete the comment.", "error"); }
  }
});

$("#comment-list").addEventListener("submit", async e => {
  const form = e.target.closest("[data-reply-form]");
  if (!form) return;
  e.preventDefault();
  const btn = $("button[type=submit]", form);
  btn.disabled = true;
  try {
    if (await submitComment($("textarea", form).value, form.dataset.replyForm)) { form.parentElement.innerHTML = ""; toast("Reply posted"); }
  } catch (err) { console.error(err); toast("Couldn't post your reply.", "error"); }
  finally { btn.disabled = false; }
});

function loadLikedComments() {
  likedComments.clear();
  if (!user) return;
  try { JSON.parse(localStorage.getItem("pj_cl_" + user.uid) || "[]").forEach(id => likedComments.add(id)); } catch { }
}
function saveLikedComments() {
  try { localStorage.setItem("pj_cl_" + user.uid, JSON.stringify([...likedComments].slice(-500))); } catch { }
}

// ---------- Related ----------
async function renderRelated(current) {
  const all = (await loadPosts()).filter(p => p.slug !== current.slug);
  const score = p => (p.category === current.category ? 3 : 0) + (p.tags || []).filter(t => (current.tags || []).includes(t)).length;
  const list = all.sort((a, b) => score(b) - score(a) || byNewest(a, b)).slice(0, 3);
  $("#related").innerHTML = list.map(p => renderPostCard(p)).join("");
  reveal();
}

// ---------- Boot ----------
(async () => {
  if (!slug) return notFound();
  post = await loadPost(slug);
  if (!post || (post.status && post.status !== "published" && !post._seed)) return notFound();
  live = !post._seed;
  renderArticle(post);
  renderRelated(post);
  if (!live) {
    $("#comment-list").innerHTML = `<div class="empty"><i class="fa-regular fa-comments"></i><p>Comments open once this article is published to the live database.</p></div>`;
    return;
  }
  countView();
  const fb = await firebase();
  fb.onSnapshot(fb.doc(fb.db, "posts", slug), snap => {
    if (!snap.exists()) return;
    Object.assign(post, snap.data());
    updateCounts(post);
  }, () => { });
  user = await fb.currentUser();
  isAdmin = await checkAdmin(user);
  loadLikedComments();
  paintMe();
  refreshLiked();
  listenComments();
  fb.onAuthStateChanged(fb.auth, async u => {
    if (u?.uid === user?.uid) return;
    user = u; isAdmin = await checkAdmin(u); loadLikedComments(); paintMe(); refreshLiked(); renderComments();
  });
})();
