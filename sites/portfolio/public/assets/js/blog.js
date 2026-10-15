import { $, initCommon, applySettings, reveal } from "./ui.js";
import { loadPosts, loadSettings, seedPosts } from "./store.js";
import { renderPostCard, byNewest } from "./render.js";
import { esc } from "./utils.js";
import { markdownToText } from "./markdown.js";

initCommon();
loadSettings().then(applySettings);

const PAGE = 9;
const params = new URLSearchParams(location.search);
const ui = {
  q: params.get("q") || "",
  category: params.get("category") || "",
  tag: params.get("tag") || "",
  sort: params.get("sort") || "latest",
  shown: PAGE
};
let posts = seedPosts();

$("#q").value = ui.q;
$("#sort").value = ui.sort;

const sorters = {
  latest: byNewest,
  oldest: (a, b) => -byNewest(a, b),
  popular: (a, b) => (b.views || 0) - (a.views || 0) || byNewest(a, b),
  liked: (a, b) => (b.likes || 0) - (a.likes || 0) || byNewest(a, b),
  discussed: (a, b) => (b.commentCount || 0) - (a.commentCount || 0) || byNewest(a, b)
};

function syncUrl() {
  const p = new URLSearchParams();
  if (ui.q) p.set("q", ui.q);
  if (ui.category) p.set("category", ui.category);
  if (ui.tag) p.set("tag", ui.tag);
  if (ui.sort !== "latest") p.set("sort", ui.sort);
  history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
}

const haystack = new WeakMap();
const textOf = p => {
  if (!haystack.has(p)) haystack.set(p, [p.title, p.excerpt, p.category, ...(p.tags || []), markdownToText(p.content || "")].join(" ").toLowerCase());
  return haystack.get(p);
};

function render() {
  const cats = [...new Set(posts.map(p => p.category).filter(Boolean))].sort();
  $("#cats").innerHTML = [`<button class="chip${!ui.category ? " active" : ""}" data-cat="">All <span>${posts.length}</span></button>`]
    .concat(cats.map(c => `<button class="chip${ui.category === c ? " active" : ""}" data-cat="${esc(c)}">${esc(c)} <span>${posts.filter(p => p.category === c).length}</span></button>`)).join("");

  const words = ui.q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = posts.filter(p =>
    (!ui.category || p.category === ui.category) &&
    (!ui.tag || (p.tags || []).includes(ui.tag)) &&
    words.every(w => textOf(p).includes(w)));
  list.sort(sorters[ui.sort] || byNewest);

  const filtering = ui.q || ui.category || ui.tag || ui.sort !== "latest";
  const featured = !filtering ? list.find(p => p.featured) : null;
  if (featured) list = [featured, ...list.filter(p => p !== featured)];

  const visible = list.slice(0, ui.shown);
  $("#blog-list").innerHTML = visible.length
    ? visible.map(p => renderPostCard(p, { big: p === featured })).join("")
    : `<div class="empty" style="grid-column:1/-1"><i class="fa-regular fa-face-frown-open"></i><p>No articles match “${esc(ui.q || ui.tag || ui.category)}”.</p><button class="btn btn-outline btn-sm" id="reset">Clear filters</button></div>`;
  $("#count").textContent = filtering
    ? `${list.length} article${list.length === 1 ? "" : "s"}${ui.tag ? ` tagged “${ui.tag}”` : ""}${ui.q ? ` matching “${ui.q}”` : ""}`
    : `${list.length} articles`;
  $("#more").hidden = list.length <= ui.shown;
  reveal();
}

let t;
$("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { ui.q = e.target.value.trim(); ui.shown = PAGE; syncUrl(); render(); }, 180); });
$("#sort").addEventListener("change", e => { ui.sort = e.target.value; syncUrl(); render(); });
$("#cats").addEventListener("click", e => {
  const c = e.target.closest("[data-cat]");
  if (!c) return;
  ui.category = c.dataset.cat; ui.tag = ""; ui.shown = PAGE; syncUrl(); render();
});
$("#more").addEventListener("click", () => { ui.shown += PAGE; render(); });
document.addEventListener("click", e => {
  if (e.target.id === "reset") { Object.assign(ui, { q: "", category: "", tag: "", sort: "latest" }); $("#q").value = ""; $("#sort").value = "latest"; syncUrl(); render(); }
  const cat = e.target.closest(".post-cat");
  if (cat && cat.closest("#blog-list")) { e.preventDefault(); ui.category = new URL(cat.href).searchParams.get("category") || ""; syncUrl(); render(); scrollTo({ top: 0, behavior: "smooth" }); }
});

render();
loadPosts().then(p => { posts = p; render(); });
