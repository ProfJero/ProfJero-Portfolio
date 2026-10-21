// Admin: client chat. Conversation list (search, labels, unread) + a full WhatsApp-style
// conversation (shared chat-kit used by the client portal too) with quick replies.
import { $, $$, fb, esc, emptyState, toast, state, openDialog, firstName } from "../core.js";
import { timeAgo, toDate, initials, hueFrom } from "/assets/js/utils.js";
import { mountChat, lastSeen } from "/assets/js/chat-kit.js";

const LABELS = { new: ["New", "#2563EB"], open: ["Open", "#0D9488"], pending: ["Waiting on client", "#D97706"], resolved: ["Resolved", "#64748B"] };
const DEFAULT_QR = [
  { key: "hi", text: "Hello! Thanks for reaching out to ProfJero. How can we help you today?" },
  { key: "pay", text: "You can pay by MTN Mobile Money on 053 120 7256 (Benjamin Amoako) or by bank transfer. Please use your invoice number as the reference." },
  { key: "quote", text: "Thanks! We'll prepare a quotation and send it to you within 24 hours." },
  { key: "thanks", text: "Thank you! We've received it and will get back to you shortly." },
  { key: "hours", text: "We're available Monday to Saturday, 7am to 8pm. We'll reply as soon as we can." }
];
let unsubs = [], chat = null;
const notifiedHandoffs = new Set();
export function destroy() { unsubs.forEach(u => u()); unsubs = []; chat?.destroy(); chat = null; }

const avatarOf = (t, size = 44) => t.photo ? `<img class="avatar" src="${esc(t.photo)}" alt="" style="width:${size}px;height:${size}px">` : `<span class="avatar avatar-fallback" style="--h:${hueFrom(t.email || t.id)};width:${size}px;height:${size}px;font-size:${size / 2.6}px">${esc(initials(t.name || t.email))}</span>`;

export async function render(view, { params }) {
  let threads = [], selected = params[0] || null, filter = "all", q = "", quickReplies = DEFAULT_QR;
  try { const s = await fb.getDoc(fb.doc(fb.db, "private", "chat")); if (s.exists() && Array.isArray(s.data().quickReplies)) quickReplies = s.data().quickReplies; } catch { }
  view.innerHTML = `<div class="inbox chat-inbox" id="inbox">
    <div class="inbox-list">
      <div class="cl-head"><label class="search" style="width:100%"><i class="fa-solid fa-magnifying-glass"></i><input id="t-q" type="search" placeholder="Search chats"></label></div>
      <div class="pill-tabs cl-tabs" id="t-tabs"></div>
      <div id="t-list"></div>
    </div>
    <div class="inbox-detail chat-pane" id="t-detail"></div></div>`;

  const FILTERS = [["all", "All", () => true], ["unread", "Unread", t => t.unreadAdmin > 0], ...Object.entries(LABELS).map(([k, [l]]) => [k, l, t => (t.label || "new") === k])];
  function paintList() {
    $("#t-tabs").innerHTML = FILTERS.map(([k, l, f]) => `<button class="${filter === k ? "active" : ""}" data-f="${k}">${l}${k !== "all" ? `<span>${threads.filter(f).length}</span>` : ""}</button>`).join("");
    const f = FILTERS.find(x => x[0] === filter)[2];
    const list = threads.filter(f).filter(t => !q || `${t.name} ${t.email} ${t.lastMessage}`.toLowerCase().includes(q));
    $("#t-list").innerHTML = list.length ? list.map(t => {
      const typing = Date.now() - (toDate(t.clientTyping)?.getTime() || 0) < 6000;
      const online = Date.now() - (toDate(t.clientSeenAt)?.getTime() || 0) < 150000;
      const lab = LABELS[t.label || "new"];
      return `<div class="msg-item${t.unreadAdmin ? " unread" : ""}${t.id === selected ? " active" : ""}" data-id="${esc(t.id)}" tabindex="0" role="button">
        <span class="cl-av">${avatarOf(t)}${online ? '<i class="cl-online" title="Online"></i>' : ""}</span>
        <div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center"><span class="title" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name || t.email)}</span><span class="when">${timeAgo(t.lastAt)}</span></div>
        <div class="sub" style="display:flex;gap:6px;align-items:center">${typing ? '<span class="ck-typing">typing<i></i><i></i><i></i></span>' : `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.lastFrom === "admin" ? "You: " : ""}${esc(t.lastMessage || "")}</span>`}
          <span class="cl-label" style="--c:${lab[1]}">${lab[0]}</span>${t.handoffRequested ? '<span class="cl-label" style="--c:#D97706">Human requested</span>' : ""}${t.unreadAdmin ? `<span class="side-badge" style="background:var(--green)">${t.unreadAdmin}</span>` : ""}</div></div>
      </div>`;
    }).join("") : emptyState("fa-regular fa-comments", threads.length ? "No chats match." : "No conversations yet. Clients can message you from the ProfJero Hub client portal.");
  }

  function open(id) {
    selected = id;
    history.replaceState(null, "", `#/chat/${id}`);
    const t = threads.find(x => x.id === id) || { id };
    chat?.destroy();
    $("#inbox").classList.add("detail-open");
    const pane = $("#t-detail");
    chat = mountChat(pane, {
      fb, threadId: id, me: "admin", myName: "Benjamin (ProfJero)", toast,
      peer: { name: t.name || t.email || "Client", avatar: avatarOf(t, 40), sub: t.email || "" },
      onBack: () => { chat?.destroy(); chat = null; selected = null; $("#inbox").classList.remove("detail-open"); pane.innerHTML = emptyState("fa-regular fa-comment-dots", "Select a conversation."); history.replaceState(null, "", "#/chat"); paintList(); },
      quickReplies,
      header: `${t.handoffRequested ? '<button type="button" class="btn btn-primary btn-sm" data-handoff-clear title="Mark human handoff as handled"><i class="fa-solid fa-check"></i> Mark handled</button>' : ""}<select class="cl-label-select" aria-label="Conversation label" title="Label">${Object.entries(LABELS).map(([k, [l]]) => `<option value="${k}"${(t.label || "new") === k ? " selected" : ""}>${l}</option>`).join("")}</select>
        <button type="button" class="ck-ib" data-qr-edit title="Edit quick replies" aria-label="Edit quick replies"><i class="fa-solid fa-bolt"></i></button>
        <a class="ck-ib" href="#/clients/${esc(t.id)}" title="Client profile" aria-label="Client profile"><i class="fa-regular fa-id-card"></i></a>`,
      notify: { title: t.name || "Client", icon: "/assets/img/brand/app-admin-192.png" }
    });
    paintList();
  }

  view.addEventListener("click", async e => {
    const f = e.target.closest("[data-f]"); if (f) { filter = f.dataset.f; paintList(); return; }
    const it = e.target.closest(".msg-item"); if (it) return open(it.dataset.id);
    if (e.target.closest("[data-handoff-clear]") && selected) {
      try { await fb.updateDoc(fb.doc(fb.db, "threads", selected), { handoffRequested: false, handoffStatus: "handled", handoffHandledAt: fb.serverTimestamp(), label: "open" }); toast("Human handoff marked as handled"); }
      catch (err) { toast(err.message || "Could not update handoff.", "error"); }
      return;
    }
    if (e.target.closest("[data-qr-edit]")) {
      let saved = null;
      await openDialog({
        title: "Quick replies", size: "wide",
        body: `<p class="muted" style="margin-top:0">Type <b>/</b> in a chat to insert one. Keep the shortcut short, e.g. <code>/pay</code>.</p><div id="qr-rows" class="qr-rows">${quickReplies.map(r => `<div class="qr-row"><input class="input" data-k value="${esc(r.key)}" placeholder="shortcut" maxlength="20"><textarea class="input" data-t rows="2" maxlength="600">${esc(r.text)}</textarea><button type="button" class="icon-btn sm danger" data-rm aria-label="Remove"><i class="fa-regular fa-trash-can"></i></button></div>`).join("")}</div>
          <button type="button" class="btn btn-ghost btn-sm" id="qr-add" style="margin-top:8px"><i class="fa-solid fa-plus"></i> Add quick reply</button>`,
        actions: [{ label: "Cancel", value: null, cls: "btn-ghost" }, { label: "Save", value: "ok", cls: "btn-primary", handler: async body => {
          saved = $$(".qr-row", body).map(r => ({ key: $("[data-k]", r).value.trim().replace(/^\//, "").replace(/\s+/g, "-"), text: $("[data-t]", r).value.trim() })).filter(r => r.key && r.text);
          await fb.setDoc(fb.doc(fb.db, "private", "chat"), { quickReplies: saved, updatedAt: fb.serverTimestamp() }, { merge: true });
        } }],
        onOpen: body => body.addEventListener("click", ev => {
          if (ev.target.closest("#qr-add")) $("#qr-rows", body).insertAdjacentHTML("beforeend", `<div class="qr-row"><input class="input" data-k placeholder="shortcut" maxlength="20"><textarea class="input" data-t rows="2" maxlength="600"></textarea><button type="button" class="icon-btn sm danger" data-rm aria-label="Remove"><i class="fa-regular fa-trash-can"></i></button></div>`);
          if (ev.target.closest("[data-rm]")) ev.target.closest(".qr-row").remove();
        })
      });
      if (saved) { quickReplies = saved; chat?.setQuickReplies(saved); toast("Quick replies saved"); }
    }
  });
  view.addEventListener("change", async e => {
    if (!e.target.matches(".cl-label-select") || !selected) return;
    try { await fb.updateDoc(fb.doc(fb.db, "threads", selected), { label: e.target.value }); toast(`Marked as ${LABELS[e.target.value][0].toLowerCase()}`); } catch (err) { toast(err.message, "error"); }
  });
  $("#t-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); paintList(); });

  unsubs.push(fb.onSnapshot(fb.query(fb.collection(fb.db, "threads"), fb.orderBy("lastAt", "desc"), fb.limit(300)), snap => {
    threads = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
    if (!view.isConnected) return;
    threads.filter(t => t.handoffRequested && !notifiedHandoffs.has(t.id)).forEach(t => {
      notifiedHandoffs.add(t.id);
      toast(`Human reply requested by ${t.name || t.email || "a client"}.`, "info");
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification("ProfJero Chat — human reply requested", { body: `${t.name || t.email || "A client"} is waiting for a human reply.` });
        n.onclick = () => { focus(); location.hash = `#/chat/${t.id}`; n.close(); };
      }
    });
    threads.filter(t => !t.handoffRequested).forEach(t => notifiedHandoffs.delete(t.id));
    paintList();
    if (selected && !chat) open(selected);
    // Let clients see their messages were delivered (✓✓) as soon as the admin's chat list has them.
    const stale = threads.filter(t => t.lastFrom === "client" && (toDate(t.adminSeenAt)?.getTime() || 0) < (toDate(t.lastAt)?.getTime() || 0)).slice(0, 20);
    stale.forEach(t => fb.updateDoc(fb.doc(fb.db, "threads", t.id), { adminSeenAt: fb.serverTimestamp() }).catch(() => { }));
  }, err => { $("#t-list").innerHTML = `<div class="callout warn" style="margin:14px"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`; }));
  const tick = setInterval(() => view.isConnected && paintList(), 15000);
  unsubs.push(() => clearInterval(tick));
  if (!selected) $("#t-detail").innerHTML = emptyState("fa-regular fa-comment-dots", "Select a conversation.");
}
