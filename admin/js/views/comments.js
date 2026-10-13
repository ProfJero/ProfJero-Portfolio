import { $, fb, esc, fmtDate, emptyState, confirmDialog, toast, state } from "../core.js";
import { timeAgo } from "/assets/js/utils.js";
import { avatar } from "/assets/js/render.js";

export async function render(view) {
  const [snap, postsSnap] = await Promise.all([fb.getDocs(fb.collectionGroup(fb.db, "comments")), fb.getDocs(fb.collection(fb.db, "posts"))]);
  const titles = Object.fromEntries(postsSnap.docs.map(d => [d.id, d.data().title]));
  let all = snap.docs.map(d => ({ id: d.id, post: d.ref.parent.parent.id, ref: d.ref, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  let q = "", postFilter = "";
  view.innerHTML = `
    <div class="toolbar">
      <label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="cm-q" type="search" placeholder="Search comments…"></label>
      <select class="select" id="cm-post" style="max-width:320px"><option value="">All posts</option>${Object.entries(titles).map(([id, t]) => `<option value="${esc(id)}">${esc(t)}</option>`).join("")}</select>
      <span class="spacer"></span><span class="muted small" id="cm-count"></span>
    </div>
    <div class="card" id="cm-list"></div>`;
  const paint = () => {
    const list = all.filter(c => (!postFilter || c.post === postFilter) && (!q || `${c.name} ${c.text}`.toLowerCase().includes(q)));
    $("#cm-count").textContent = `${list.length} comment${list.length === 1 ? "" : "s"}`;
    $("#cm-list").innerHTML = list.length ? `<div class="list">${list.map(c => `
      <div class="list-item" style="align-items:flex-start" data-id="${esc(c.id)}" data-post="${esc(c.post)}">
        ${avatar(c.name, c.photo)}
        <div class="grow">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><strong>${esc(c.name)}</strong>${c.isAuthor ? '<span class="author-badge">Author</span>' : ""}${c.pinned ? '<span class="status">Pinned</span>' : ""}${c.parentId ? '<span class="status">Reply</span>' : ""}
            <span class="muted small">${timeAgo(c.createdAt)} · on <a href="/blog/${encodeURIComponent(c.post)}#c-${esc(c.id)}" target="_blank">${esc(titles[c.post] || c.post)}</a></span></div>
          <p style="margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere">${c.deleted ? "<em class='muted'>Deleted by user</em>" : esc(c.text)}</p>
          <div class="muted small"><i class="fa-regular fa-thumbs-up"></i> ${c.likes || 0} · ${fmtDate(c.createdAt, true)}</div>
        </div>
        <div class="row-actions">
          ${!c.parentId ? `<button class="btn btn-ghost btn-sm" data-reply>Reply</button><button class="icon-btn sm" data-pin title="${c.pinned ? "Unpin" : "Pin"}"><i class="fa-solid fa-thumbtack"></i></button>` : ""}
          <button class="icon-btn sm danger" data-del title="Delete"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>`).join("")}</div>` : emptyState("fa-regular fa-comments", "No comments yet. When readers comment on your articles they'll appear here.");
  };
  paint();
  $("#cm-q").addEventListener("input", e => { q = e.target.value.toLowerCase(); paint(); });
  $("#cm-post").addEventListener("change", e => { postFilter = e.target.value; paint(); });

  view.addEventListener("click", async e => {
    const row = e.target.closest("[data-id]");
    if (!row) return;
    const c = all.find(x => x.id === row.dataset.id && x.post === row.dataset.post);
    if (e.target.closest("[data-pin]")) {
      await fb.updateDoc(c.ref, { pinned: !c.pinned }); c.pinned = !c.pinned; paint(); toast(c.pinned ? "Pinned" : "Unpinned");
    }
    if (e.target.closest("[data-del]")) {
      const replies = all.filter(x => x.post === c.post && x.parentId === c.id);
      if (!await confirmDialog(`Delete this comment${replies.length ? ` and its ${replies.length} replies` : ""}?`)) return;
      const b = fb.writeBatch(fb.db);
      [c, ...replies].forEach(x => b.delete(x.ref));
      b.update(fb.doc(fb.db, "posts", c.post), { commentCount: fb.increment(-(1 + replies.length)) });
      await b.commit();
      all = all.filter(x => x !== c && !replies.includes(x));
      paint(); toast("Deleted");
    }
    if (e.target.closest("[data-reply]")) {
      const text = prompt(`Reply to ${c.name} as the author:`);
      if (!text?.trim()) return;
      const ref = fb.doc(fb.collection(fb.db, "posts", c.post, "comments"));
      const u = state.user;
      const data = { uid: u.uid, name: u.displayName || "Benjamin Amoako (ProfJero)", photo: u.photoURL || "", text: text.trim().slice(0, 2000), parentId: c.id, likes: 0, pinned: false, isAuthor: true, deleted: false, createdAt: fb.serverTimestamp() };
      const b = fb.writeBatch(fb.db);
      b.set(ref, data);
      b.update(fb.doc(fb.db, "posts", c.post), { commentCount: fb.increment(1), lastCommentId: ref.id });
      await b.commit();
      all.unshift({ ...data, id: ref.id, post: c.post, ref, createdAt: new Date() });
      paint(); toast("Reply posted");
    }
  });
}
