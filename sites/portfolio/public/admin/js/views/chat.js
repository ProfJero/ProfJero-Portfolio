// Admin: live support chat with client-portal users (threads/{uid}/messages).
import { $, $$, fb, esc, emptyState, toast, state } from "../core.js";
import { timeAgo, toDate, initials, hueFrom } from "/assets/js/utils.js";

let unsubs = [];
export function destroy() { unsubs.forEach(u => u()); unsubs = []; }

export async function render(view, { params }) {
  let threads = [], selected = params[0] || null, msgs = [], msgUnsub = null;
  view.innerHTML = `<div class="inbox" id="inbox"><div class="inbox-list" id="t-list"></div><div class="inbox-detail chat-pane" id="t-detail"></div></div>`;

  function paintList() {
    $("#t-list").innerHTML = threads.length ? threads.map(t => `
      <div class="msg-item${t.unreadAdmin ? " unread" : ""}${t.id === selected ? " active" : ""}" data-id="${esc(t.id)}" tabindex="0" role="button">
        <span class="avatar avatar-fallback" style="--h:${hueFrom(t.email || t.id)};width:40px;height:40px;font-size:.8rem">${esc(initials(t.name || t.email))}</span>
        <div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><span class="title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name || t.email)}</span><span class="when">${timeAgo(t.lastAt)}</span></div>
        <div class="sub">${t.lastFrom === "admin" ? "You: " : ""}${esc(t.lastMessage || "")}</div></div>
        ${t.unreadAdmin ? `<span class="side-badge">${t.unreadAdmin}</span>` : ""}
      </div>`).join("") : emptyState("fa-regular fa-comments", "No conversations yet. Clients can message you from the ProfJero Hub client portal.");
  }

  function paintChat() {
    const t = threads.find(x => x.id === selected);
    $("#inbox").classList.toggle("detail-open", !!t);
    if (!t) { $("#t-detail").innerHTML = emptyState("fa-regular fa-comment-dots", "Select a conversation."); return; }
    const draft = $("#t-text")?.value || "";
    $("#t-detail").innerHTML = `
      <div class="chat-head"><button class="btn btn-ghost btn-sm" id="t-back"><i class="fa-solid fa-arrow-left"></i></button><div><strong>${esc(t.name || "")}</strong><small class="muted"> ${esc(t.email || "")}</small></div><span class="spacer" style="flex:1"></span><a class="btn btn-ghost btn-sm" href="#/clients/${esc(t.id)}"><i class="fa-regular fa-id-card"></i> Client profile</a></div>
      <div class="chat-log" id="t-log">${msgs.map(m => `<div class="bubble ${m.from === "admin" ? "me" : "them"}"><p>${esc(m.text)}</p><time>${toDate(m.createdAt) ? timeAgo(m.createdAt) : "sending…"}</time></div>`).join("") || '<p class="muted small">No messages yet.</p>'}</div>
      <form class="chat-form" id="t-form"><textarea id="t-text" rows="1" maxlength="4000" placeholder="Reply to ${esc((t.name || "").split(" ")[0])}…">${esc(draft)}</textarea><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button></form>`;
    $("#t-back").style.display = matchMedia("(max-width:900px)").matches ? "" : "none";
    const log = $("#t-log"); log.scrollTop = log.scrollHeight;
    $("#t-text").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#t-form").requestSubmit(); } });
  }

  function open(id) {
    selected = id; msgs = [];
    history.replaceState(null, "", `#/chat/${id}`);
    msgUnsub?.();
    msgUnsub = fb.onSnapshot(fb.query(fb.collection(fb.db, "threads", id, "messages"), fb.orderBy("createdAt", "asc"), fb.limit(500)), snap => {
      msgs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      if (view.isConnected) paintChat();
    });
    unsubs.push(() => msgUnsub?.());
    const t = threads.find(x => x.id === id);
    if (t?.unreadAdmin) fb.updateDoc(fb.doc(fb.db, "threads", id), { unreadAdmin: 0 }).catch(() => { });
    paintList(); paintChat();
  }

  view.addEventListener("click", e => {
    const it = e.target.closest(".msg-item"); if (it) return open(it.dataset.id);
    if (e.target.closest("#t-back")) { selected = null; paintList(); paintChat(); }
  });
  view.addEventListener("submit", async e => {
    if (e.target.id !== "t-form") return;
    e.preventDefault();
    const ta = $("#t-text"), text = ta.value.trim();
    if (!text || !selected) return;
    ta.value = "";
    try {
      await fb.addDoc(fb.collection(fb.db, "threads", selected, "messages"), { from: "admin", text: text.slice(0, 4000), name: state.user.displayName || "ProfJero", createdAt: fb.serverTimestamp() });
      await fb.updateDoc(fb.doc(fb.db, "threads", selected), { lastMessage: text.slice(0, 200), lastAt: fb.serverTimestamp(), lastFrom: "admin", unreadClient: fb.increment(1), unreadAdmin: 0 });
    } catch (err) { ta.value = text; toast(err.message, "error"); }
  });

  unsubs.push(fb.onSnapshot(fb.query(fb.collection(fb.db, "threads"), fb.orderBy("lastAt", "desc"), fb.limit(200)), snap => {
    threads = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    if (!view.isConnected) return;
    paintList();
    if (selected && !msgUnsub) open(selected);
  }, err => { $("#t-list").innerHTML = `<div class="callout warn" style="margin:14px"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`; }));
  paintChat();
}
