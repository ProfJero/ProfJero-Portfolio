// ProfJero chat: one conversation UI shared by the client portal and the admin.
// WhatsApp-style: ✓ sent · ✓✓ delivered · blue ✓✓ read, typing…, online / last seen,
// reply, reactions, edit (15 min), delete for everyone (48 h), photos, documents,
// voice notes, emoji, search, date separators, unread divider, jump to latest,
// sound + pop-up notifications, and (admin) quick replies.
//
// Data: threads/{uid} (presence, typing, read markers, counters)
//       threads/{uid}/messages/{id} { from, text, name, createdAt, attachment, replyTo, reactions, editedAt, deleted }
//       threads/{uid}/files/{id}    { data (compressed data URL), mime, name, size, by }
import { esc, toDate } from "./utils.js";

const EDIT_MS = 15 * 6e4, DELETE_MS = 48 * 36e5, TYPING_MS = 6000, ONLINE_MS = 2.5 * 6e4;
const MAX_FILE = 680 * 1024;
const AI_CHAT_ENDPOINT = window.PROFJERO_CHAT_API || "";
const REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "🎉"];
const EMOJI = "😀 😁 😂 🤣 😊 😍 🥰 😘 😎 🤩 🤔 🙄 😅 😉 🙂 😇 🥳 😢 😭 😡 😴 🤝 👍 👎 👏 🙌 🙏 💪 👌 ✌️ 🤞 👋 ❤️ 💙 💚 🔥 ⭐ ✨ 🎉 ✅ ❌ ⚠️ 📌 📎 📷 📄 💡 💰 📅 ⏰ 🚀 🇬🇭".split(" ");

const pad = n => String(n).padStart(2, "0");
const ms = v => toDate(v)?.getTime() || 0;
const clock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayLabel = d => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((t - x) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? x.toLocaleDateString("en-GB", { weekday: "long" }) : x.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: x.getFullYear() === t.getFullYear() ? undefined : "numeric" });
};
export const lastSeen = v => {
  const t = ms(v); if (!t) return "";
  const d = Date.now() - t;
  if (d < ONLINE_MS) return "online";
  if (d < 36e5) return `last seen ${Math.round(d / 6e4)} min ago`;
  const dt = new Date(t);
  return `last seen ${dayLabel(dt).toLowerCase()} at ${clock(dt)}`;
};
const fmtSize = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const fmtDur = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, "<br>");

// ---------- file helpers ----------
const readAsDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
async function compressImage(file, max = 1600, q = .82) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return { data: await readAsDataURL(file), w: 0, h: 0, thumb: "" };
  const draw = (m, qq) => { const s = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return { data: c.toDataURL("image/jpeg", qq), w: c.width, h: c.height }; };
  let out = draw(max, q);
  for (let m = max, qq = q; out.data.length > MAX_FILE * 1.37 && m > 500; m -= 300, qq -= .08) out = draw(m - 300, Math.max(.5, qq - .08));
  return { ...out, thumb: draw(24, .5).data };
}

let audioCtx;
function ping() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(660, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(990, audioCtx.currentTime + .1);
    g.gain.setValueAtTime(.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.1, audioCtx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .3);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + .32);
  } catch { }
}

/**
 * Mounts a conversation into `root`.
 * opts: { fb, threadId, me: "client"|"admin", myName, peer: { name, avatar (html), sub }, onBack, toast,
 *         quickReplies: [{ key, text }], header (extra HTML for the header), threadDefaults (client: fields for a new thread),
 *         notify: { icon, title } }
 */
export function mountChat(root, opts) {
  const { fb, threadId, me } = opts;
  const peerSide = me === "client" ? "admin" : "client";
  const tRef = fb.doc(fb.db, "threads", threadId);
  const mCol = fb.collection(fb.db, "threads", threadId, "messages");
  const fileCache = new Map();
  let msgs = [], thread = null, unsubs = [], replyTo = null, editing = null, firstPaint = true, unreadFrom = null, newBelow = 0;
  let lastTyping = 0, heartbeat, searchHits = [], searchIdx = 0, recorder = null, recChunks = [], recStart = 0, recTimer = null, recCancel = false;
  const toast = opts.toast || ((m) => console.log(m));

  root.innerHTML = `<div class="ck">
    <header class="ck-head">
      ${opts.onBack ? '<button type="button" class="ck-ib ck-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>' : ""}
      <span class="ck-av">${opts.peer.avatar || ""}</span>
      <div class="ck-who"><strong>${esc(opts.peer.name)}</strong><small class="ck-status">${esc(opts.peer.sub || "")}</small></div>
      ${me === "client" ? `<button type="button" class="ck-human-btn" data-request-human title="Talk to a person"><i class="fa-solid fa-headset"></i><span>Talk to a person</span></button>` : ""}
      ${opts.header || ""}
      <button type="button" class="ck-ib ck-search-btn" aria-label="Search this chat" title="Search"><i class="fa-solid fa-magnifying-glass"></i></button>
    </header>
    <div class="ck-search" hidden><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Search messages…" aria-label="Search messages"><span class="ck-count"></span>
      <button type="button" class="ck-ib" data-s="-1" aria-label="Previous match"><i class="fa-solid fa-chevron-up"></i></button><button type="button" class="ck-ib" data-s="1" aria-label="Next match"><i class="fa-solid fa-chevron-down"></i></button>
      <button type="button" class="ck-ib ck-search-close" aria-label="Close search"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="ck-log" role="log" aria-live="polite" aria-label="Messages"><div class="ck-loading"><span></span><span></span><span></span></div></div>
    <button type="button" class="ck-jump" hidden aria-label="Jump to latest"><i class="fa-solid fa-chevron-down"></i><span class="ck-jump-n"></span></button>
    <div class="ck-bar">
      <div class="ck-reply" hidden><div class="ck-reply-body"></div><button type="button" class="ck-ib ck-reply-x" aria-label="Cancel reply"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="ck-pop ck-emoji" hidden>${EMOJI.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join("")}</div>
      <div class="ck-pop ck-attach" hidden>
        <label class="ck-att-opt"><span class="i img"><i class="fa-regular fa-image"></i></span>Photo<input type="file" accept="image/*" multiple hidden data-pick="image"></label>
        <label class="ck-att-opt"><span class="i doc"><i class="fa-regular fa-file-lines"></i></span>Document<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/pdf" hidden data-pick="file"></label>
        <label class="ck-att-opt"><span class="i cam"><i class="fa-solid fa-camera"></i></span>Camera<input type="file" accept="image/*" capture="environment" hidden data-pick="image"></label>
      </div>
      <div class="ck-pop ck-qr" hidden></div>
      <div class="ck-rec" hidden><button type="button" class="ck-ib ck-rec-x" aria-label="Cancel recording"><i class="fa-regular fa-trash-can"></i></button><span class="ck-rec-dot"></span><span class="ck-rec-t">0:00</span><span class="ck-rec-wave"></span><button type="button" class="ck-send ck-rec-send" aria-label="Send voice note"><i class="fa-solid fa-paper-plane"></i></button></div>
      <form class="ck-composer" novalidate>
        <button type="button" class="ck-ib ck-emoji-btn" aria-label="Emoji" title="Emoji"><i class="fa-regular fa-face-smile"></i></button>
        <button type="button" class="ck-ib ck-attach-btn" aria-label="Attach a photo or document" title="Attach"><i class="fa-solid fa-paperclip"></i></button>
        <textarea rows="1" maxlength="4000" placeholder="${me === "admin" ? "Type a message — “/” for quick replies" : "Type a message"}" aria-label="Message"></textarea>
        <button type="button" class="ck-send ck-mic" aria-label="Record a voice note" title="Hold to record, or tap to start"><i class="fa-solid fa-microphone"></i></button>
        <button type="submit" class="ck-send ck-go" aria-label="Send" hidden><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>
    <div class="ck-menu" hidden role="menu"></div>
  </div>`;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const log = $(".ck-log"), ta = $(".ck-composer textarea");

  // ---------- rendering ----------
  const myRead = () => ms(thread?.[`${me}ReadAt`]);
  const peerRead = () => ms(thread?.[`${peerSide}ReadAt`]);
  const peerSeen = () => Math.max(ms(thread?.[`${peerSide}SeenAt`]), peerRead());
  const ticks = m => {
    if (m.from !== me) return "";
    if (m._pending) return '<i class="fa-regular fa-clock ck-tick" title="Sending"></i>';
    const t = ms(m.createdAt);
    if (peerRead() >= t) return '<span class="ck-tick read" title="Read"><i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i></span>';
    if (peerSeen() >= t) return '<span class="ck-tick" title="Delivered"><i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i></span>';
    return '<span class="ck-tick" title="Sent"><i class="fa-solid fa-check"></i></span>';
  };
  const attHtml = (a, m) => {
    if (!a) return "";
    if (a.type === "image") return `<button type="button" class="ck-img" data-file="${esc(a.fileId || "")}" data-url="${esc(a.url || "")}" style="aspect-ratio:${a.w && a.h ? `${a.w}/${a.h}` : "4/3"}"><img alt="${esc(a.name || "Photo")}" ${a.url ? `src="${esc(a.url)}"` : a.thumb ? `src="${esc(a.thumb)}" class="blur"` : ""}></button>`;
    if (a.type === "audio") return `<div class="ck-voice" data-file="${esc(a.fileId || "")}" data-url="${esc(a.url || "")}"><button type="button" class="ck-play" aria-label="Play voice note"><i class="fa-solid fa-play"></i></button><span class="ck-vbar"><span></span></span><span class="ck-vt">${fmtDur(a.duration || 0)}</span></div>`;
    return `<button type="button" class="ck-doc" data-file="${esc(a.fileId || "")}" data-url="${esc(a.url || "")}" data-name="${esc(a.name || "file")}"><span class="ck-doc-i"><i class="fa-regular fa-file${/pdf/.test(a.mime || a.name || "") ? "-pdf" : /sheet|xls|csv/.test(a.mime || a.name || "") ? "-excel" : /word|doc/.test(a.mime || a.name || "") ? "-word" : ""}"></i></span><span class="ck-doc-t"><b>${esc(a.name || "Document")}</b><small>${a.size ? fmtSize(a.size) : ""} · tap to download</small></span></button>`;
  };
  const bubble = m => {
    const mine = m.from === me, t = toDate(m.createdAt) || new Date();
    const hit = searchHits.includes(m.id);
    const rx = Object.values(m.reactions || {}).filter(Boolean);
    if (m.deleted) return `<div class="ck-msg ${mine ? "me" : "them"}" data-id="${esc(m.id)}"><div class="ck-b deleted"><i class="fa-solid fa-ban"></i> ${mine ? "You deleted this message" : "This message was deleted"}<span class="ck-meta">${clock(t)}</span></div></div>`;
    return `<div class="ck-msg ${mine ? "me" : "them"}${hit ? " hit" : ""}${m.attachment && !m.text ? " media" : ""}" data-id="${esc(m.id)}">
      <div class="ck-b" tabindex="0">
        ${m.from === "admin" && me === "client" && m.name ? `<span class="ck-name">${esc(m.name)}</span>` : ""}
        ${m.replyTo ? `<button type="button" class="ck-quote" data-jump="${esc(m.replyTo.id || "")}"><b>${m.replyTo.from === me ? "You" : esc(opts.peer.name)}</b><span>${esc(m.replyTo.text || "📎 Attachment")}</span></button>` : ""}
        ${attHtml(m.attachment, m)}
        ${m.text ? `<div class="ck-text">${linkify(m.text)}</div>` : ""}
        <span class="ck-meta">${m.editedAt ? '<em>edited</em> ' : ""}${clock(t)} ${ticks(m)}</span>
        <button type="button" class="ck-more" aria-label="Message options"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
      ${rx.length ? `<div class="ck-rx">${rx.join("")}${rx.length > 1 ? ` <small>${rx.length}</small>` : ""}</div>` : ""}
    </div>`;
  };
  function paint() {
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    if (firstPaint) {
      const read = myRead();
      unreadFrom = msgs.find(m => m.from === peerSide && ms(m.createdAt) > read)?.id || null;
    }
    let html = "", lastDay = "";
    const unreadCount = unreadFrom ? msgs.length - msgs.findIndex(m => m.id === unreadFrom) : 0;
    for (const m of msgs) {
      const d = toDate(m.createdAt) || new Date(), label = dayLabel(d);
      if (label !== lastDay) { html += `<div class="ck-day"><span>${esc(label)}</span></div>`; lastDay = label; }
      if (m.id === unreadFrom) html += `<div class="ck-unread"><span>${unreadCount} unread message${unreadCount === 1 ? "" : "s"}</span></div>`;
      html += bubble(m);
    }
    log.innerHTML = html || `<div class="ck-empty"><i class="fa-regular fa-comments"></i><p>${me === "client" ? "Say hello 👋 Ask a question, share an idea, or send a photo or document." : "No messages yet."}</p></div>`;
    hydrateMedia();
    if (firstPaint) {
      const u = unreadFrom && log.querySelector(".ck-unread");
      u ? u.scrollIntoView({ block: "center" }) : (log.scrollTop = log.scrollHeight);
      firstPaint = false;
    } else if (atBottom) log.scrollTop = log.scrollHeight;
    paintStatus();
  }
  function paintStatus() {
    const st = $(".ck-status");
    const typing = Date.now() - ms(thread?.[`${peerSide}Typing`]) < TYPING_MS;
    if (typing) { st.innerHTML = '<span class="ck-typing">typing<i></i><i></i><i></i></span>'; return; }
    const seen = ms(thread?.[`${peerSide}SeenAt`]);
    st.textContent = seen ? lastSeen(thread[`${peerSide}SeenAt`]) : (opts.peer.sub || "");
    st.classList.toggle("on", Date.now() - seen < ONLINE_MS);
  }
  async function loadFile(fileId) {
    if (!fileId) return null;
    if (fileCache.has(fileId)) return fileCache.get(fileId);
    const p = fb.getDoc(fb.doc(fb.db, "threads", threadId, "files", fileId)).then(s => s.exists() ? s.data().data : null).catch(() => null);
    fileCache.set(fileId, p);
    return p;
  }
  function hydrateMedia() {
    $$(".ck-img[data-file]").forEach(async b => {
      if (!b.dataset.file) return;
      const src = await loadFile(b.dataset.file);
      const im = b.querySelector("img");
      if (src && im) { im.src = src; im.classList.remove("blur"); }
    });
  }

  // ---------- data ----------
  unsubs.push(fb.onSnapshot(fb.query(mCol, fb.orderBy("createdAt", "asc"), fb.limit(500)), snap => {
    const before = msgs.length;
    msgs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }), _pending: d.metadata.hasPendingWrites }));
    const added = snap.docChanges().filter(c => c.type === "added" && !c.doc.metadata.hasPendingWrites).map(c => c.doc.data());
    const incoming = before && added.some(m => m.from === peerSide);
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    paint();
    if (incoming) {
      if (!nearBottom) { newBelow += added.filter(m => m.from === peerSide).length; showJump(); }
      if (document.visibilityState === "visible" && document.hasFocus()) markRead();
      else notify(added.filter(m => m.from === peerSide).pop());
    } else if (!before) markRead();
  }, err => { log.innerHTML = `<div class="ck-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${esc(err.message)}</p></div>`; }));
  unsubs.push(fb.onSnapshot(tRef, s => { thread = s.exists() ? s.data({ serverTimestamps: "estimate" }) : null; opts.onThread?.(thread); paintTicksAndStatus(); }, () => { }));
  const statusTimer = setInterval(paintStatus, 4000);
  function paintTicksAndStatus() {
    // Re-render only the meta of my messages (cheap) so ticks turn blue live.
    $$(".ck-msg.me").forEach(el => { const m = msgs.find(x => x.id === el.dataset.id); const meta = el.querySelector(".ck-meta"); if (m && meta && !m.deleted) meta.innerHTML = `${m.editedAt ? "<em>edited</em> " : ""}${clock(toDate(m.createdAt) || new Date())} ${ticks(m)}`; });
    paintStatus();
  }

  async function writeThread(patch) {
    try { await fb.updateDoc(tRef, patch); }
    catch (e) {
      if (me === "client" && !thread) await fb.setDoc(tRef, { uid: threadId, unreadAdmin: 0, unreadClient: 0, ...(opts.threadDefaults || {}), ...patch }).catch(() => { });
    }
  }
  function markRead() {
    if (document.visibilityState !== "visible") return;
    const patch = { [`${me}ReadAt`]: fb.serverTimestamp(), [`${me}SeenAt`]: fb.serverTimestamp() };
    if (me === "client" && thread?.unreadClient) patch.unreadClient = 0;
    if (me === "admin" && thread?.unreadAdmin) patch.unreadAdmin = 0;
    if (thread || me === "admin") writeThread(patch);
  }
  const beat = () => { if (document.visibilityState === "visible" && thread) writeThread({ [`${me}SeenAt`]: fb.serverTimestamp(), ...(me === "client" ? { clientOnline: true } : {}) }); };
  heartbeat = setInterval(beat, 45000); setTimeout(beat, 1500);
  const onVis = () => { if (document.visibilityState === "visible") { markRead(); beat(); } };
  document.addEventListener("visibilitychange", onVis);
  addEventListener("focus", onVis);

  function notify(m) {
    if (!m) return;
    ping();
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(opts.notify?.title || opts.peer.name, { body: m.deleted ? "Message deleted" : m.text || (m.attachment?.type === "audio" ? "🎤 Voice note" : m.attachment?.type === "image" ? "📷 Photo" : "📄 Document"), icon: opts.notify?.icon, tag: `chat-${threadId}` });
      n.onclick = () => { focus(); n.close(); };
    }
  }

  async function requestAiReply(userText) {
    if (me !== "client" || thread?.handoffRequested) return;
    if (!window.PROFJERO_CHAT_API) { toast("AI chat is not connected yet. Please tap “Talk to a person” so Benjamin can help.", "info", 7000); return; }
    try {
      const [site, hub, projects, products, studios] = await Promise.all([
        fb.getDoc(fb.doc(fb.db, "settings", "site")).catch(() => null),
        fb.getDoc(fb.doc(fb.db, "settings", "hub")).catch(() => null),
        fb.getDocs(fb.query(fb.collection(fb.db, "projects"), fb.limit(40))).catch(() => null),
        fb.getDocs(fb.query(fb.collection(fb.db, "products"), fb.limit(40))).catch(() => null),
        fb.getDocs(fb.query(fb.collection(fb.db, "studios"), fb.limit(20))).catch(() => null)
      ]);
      const data = snap => snap?.docs?.map(d => ({ id: d.id, ...d.data() })) || [];
      const safe = value => JSON.stringify(value, (k, v) => /password|secret|token|apiKey|email|phone|uid|credential/i.test(k) ? undefined : v).slice(0, 10000);
      const context = ["Portfolio settings and pricing: " + safe(site?.data?.() || {}), "Hub information: " + safe(hub?.data?.() || {}), "Projects: " + safe(data(projects).map(p => ({title:p.title,category:p.category,categories:p.categories,summary:p.summary,description:p.description,status:p.status,tech:p.tech}))), "Products: " + safe(data(products).filter(p => p.visible !== false).map(p => ({name:p.name,category:p.category,description:p.description,priceFrom:p.priceFrom,originalPrice:p.originalPrice,salePrice:p.salePrice,unit:p.unit,minQty:p.minQty,leadTime:p.leadTime}))), "Studios: " + safe(data(studios).map(s => ({name:s.name,description:s.description,services:s.services,packages:s.packages,faqs:s.faqs})))].join("\\n");
      const history = msgs.filter(m => !m.deleted && m.text && ["client", "ai", "admin"].includes(m.from)).slice(-8).map(m => ({role: m.from === "client" ? "user" : "assistant", content: String(m.text).slice(0, 1000)}));
      const response = await fetch(window.PROFJERO_CHAT_API, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({message: userText, context, history})});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.answer) throw new Error(result.error || "AI could not respond.");
      const latest = await fb.getDoc(tRef).catch(() => null);
      if (latest?.exists() && latest.data().handoffRequested) return;
      await fb.setDoc(fb.doc(mCol), {from: "ai", text: "🤖 ProfJero AI (automated reply)\n" + String(result.answer).slice(0, 3900), name: "ProfJero AI", createdAt: fb.serverTimestamp(), reactions: {}, clientId: "profjero-ai"});
      await fb.updateDoc(tRef, {lastMessage: String(result.answer).slice(0, 200), lastAt: fb.serverTimestamp(), lastFrom: "ai"});
    } catch (error) { toast(error.message || "AI chat is not configured. Please request a human reply.", "error", 6000); }
  }

  // ---------- sending ----------
  async function send({ text = "", attachment = null } = {})
    text = text.trim().slice(0, 4000);
    if (!text && !attachment) return;
    const ref = fb.doc(mCol);
    const msg = { from: me, text, name: (opts.myName || "").slice(0, 100), createdAt: fb.serverTimestamp(), reactions: {} };
    if (attachment) msg.attachment = attachment;
    if (replyTo) msg.replyTo = { id: replyTo.id, text: (replyTo.text || "").slice(0, 140), from: replyTo.from };
    clearReply();
    const preview = text || (attachment?.type === "audio" ? "🎤 Voice note" : attachment?.type === "image" ? "📷 Photo" : `📄 ${attachment?.name || "Document"}`);
    try {
      if (me === "client" && !thread) await fb.setDoc(tRef, { uid: threadId, unreadAdmin: 0, unreadClient: 0, ...(opts.threadDefaults || {}) });
      await fb.setDoc(ref, msg);
      const patch = { lastMessage: preview.slice(0, 200), lastAt: fb.serverTimestamp(), lastFrom: me, [`${me}Typing`]: null, [`${me}ReadAt`]: fb.serverTimestamp(), [`${me}SeenAt`]: fb.serverTimestamp() };
      if (me === "client") patch.unreadAdmin = fb.increment(1); else { patch.unreadClient = fb.increment(1); patch.unreadAdmin = 0; }
      await fb.updateDoc(tRef, patch);
      unreadFrom = null;
      log.scrollTop = log.scrollHeight;
      if (me === "client" && text && !thread?.handoffRequested) requestAiReply(text);
    } catch (e) { toast("Message not sent: " + (e.message || e), "error"); if (text) ta.value = text; }
  }
  async function sendFile(file, kind) {
    try {
      let data, extra = {};
      if (kind === "image" && file.type.startsWith("image/") && !/gif|svg/.test(file.type)) { const c = await compressImage(file); data = c.data; extra = { w: c.w, h: c.h, thumb: c.thumb.length < 3900 ? c.thumb : "" }; }
      else { if (file.size > MAX_FILE) { toast(`“${file.name}” is ${fmtSize(file.size)}. Files up to 680 KB can be sent here. For bigger files, share a Google Drive or WeTransfer link.`, "error"); return; } data = await readAsDataURL(file); }
      if (data.length > 955000) { toast("That file is too large to send. Please share a link instead.", "error"); return; }
      const fRef = fb.doc(fb.collection(fb.db, "threads", threadId, "files"));
      const mime = file.type || (kind === "audio" ? "audio/webm" : "application/octet-stream");
      if (me === "client" && !thread) await fb.setDoc(tRef, { uid: threadId, unreadAdmin: 0, unreadClient: 0, ...(opts.threadDefaults || {}) });
      await fb.setDoc(fRef, { data, mime, name: (file.name || kind).slice(0, 200), size: file.size || 0, by: me, createdAt: fb.serverTimestamp() });
      fileCache.set(fRef.id, Promise.resolve(data));
      await send({ text: kind === "image" ? ta.value : "", attachment: { fileId: fRef.id, type: kind === "audio" ? "audio" : kind === "image" && mime.startsWith("image/") ? "image" : "file", name: (file.name || "").slice(0, 120), size: file.size || 0, mime, ...extra, ...(file.duration ? { duration: Math.round(file.duration) } : {}) } });
      if (kind === "image") { ta.value = ""; syncButtons(); }
    } catch (e) { toast("Couldn't send the file: " + (e.message || e), "error"); }
  }

  // ---------- composer ----------
  const syncButtons = () => { const has = !!ta.value.trim(); $(".ck-go").hidden = !has && !editing; $(".ck-mic").hidden = has || !!editing; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; };
  ta.addEventListener("input", () => {
    syncButtons();
    if (Date.now() - lastTyping > 2500 && ta.value.trim()) { lastTyping = Date.now(); if (thread || me === "admin") writeThread({ [`${me}Typing`]: fb.serverTimestamp() }); }
    if (me === "admin") quickReplyMenu();
  });
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); $(".ck-composer").requestSubmit(); }
    if (e.key === "Escape") { closePops(); clearReply(); if (editing) cancelEdit(); }
    if (e.key === "ArrowUp" && !ta.value) { const last = [...msgs].reverse().find(m => m.from === me && !m.deleted && m.text && Date.now() - ms(m.createdAt) < EDIT_MS); if (last) { e.preventDefault(); startEdit(last); } }
  });
  $(".ck-composer").addEventListener("submit", async e => {
    e.preventDefault();
    const text = ta.value;
    if (editing) {
      const m = editing; cancelEdit();
      if (text.trim() && text.trim() !== m.text) try { await fb.updateDoc(fb.doc(mCol, m.id), { text: text.trim().slice(0, 4000), editedAt: fb.serverTimestamp() }); } catch (err) { toast("Couldn't edit: the 15-minute edit window may have passed.", "error"); }
      return;
    }
    ta.value = ""; syncButtons(); closePops();
    await send({ text });
  });
  ta.addEventListener("paste", e => { const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith("image/")); if (f) { e.preventDefault(); sendFile(f, "image"); } });
  root.addEventListener("dragover", e => { if ([...e.dataTransfer.items].some(i => i.kind === "file")) { e.preventDefault(); root.classList.add("ck-drop"); } });
  root.addEventListener("dragleave", e => { if (!root.contains(e.relatedTarget)) root.classList.remove("ck-drop"); });
  root.addEventListener("drop", e => { const fs = [...e.dataTransfer.files]; if (!fs.length) return; e.preventDefault(); root.classList.remove("ck-drop"); fs.forEach(f => sendFile(f, f.type.startsWith("image/") ? "image" : "file")); });

  function startEdit(m) { editing = m; ta.value = m.text; ta.focus(); root.classList.add("ck-editing"); $(".ck-reply").hidden = false; $(".ck-reply-body").innerHTML = `<b><i class="fa-solid fa-pen"></i> Editing message</b><span>${esc(m.text)}</span>`; syncButtons(); }
  function cancelEdit() { editing = null; ta.value = ""; root.classList.remove("ck-editing"); $(".ck-reply").hidden = true; syncButtons(); }
  function setReply(m) { replyTo = m; $(".ck-reply").hidden = false; $(".ck-reply-body").innerHTML = `<b>${m.from === me ? "You" : esc(opts.peer.name)}</b><span>${esc(m.text || "📎 Attachment")}</span>`; ta.focus(); }
  function clearReply() { replyTo = null; if (!editing) $(".ck-reply").hidden = true; }
  const closePops = () => { $$(".ck-pop").forEach(p => { p.hidden = true; }); };

  function quickReplyMenu() {
    const box = $(".ck-qr"), v = ta.value;
    const m = v.match(/^\/(\S*)$/);
    const list = opts.quickReplies || [];
    if (!m || !list.length) { box.hidden = true; return; }
    const hits = list.filter(q => q.key.toLowerCase().startsWith(m[1].toLowerCase()) || q.text.toLowerCase().includes(m[1].toLowerCase())).slice(0, 8);
    box.innerHTML = hits.map((q, i) => `<button type="button" data-qr="${i}" class="${i ? "" : "active"}"><b>/${esc(q.key)}</b><span>${esc(q.text)}</span></button>`).join("") || '<p class="muted small" style="margin:8px">No quick reply matches.</p>';
    box.hidden = false; box._hits = hits;
  }

  // ---------- voice notes ----------
  async function startRec() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast("Voice notes aren't supported in this browser.", "error");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t)) || "";
      recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 });
      recChunks = []; recCancel = false;
      recorder.ondataavailable = e => e.data.size && recChunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recTimer); $(".ck-rec").hidden = true; $(".ck-composer").hidden = false;
        if (recCancel || !recChunks.length) return;
        const blob = new Blob(recChunks, { type: recorder.mimeType || "audio/webm" });
        const f = new File([blob], `voice-note.${/mp4/.test(blob.type) ? "m4a" : "webm"}`, { type: blob.type });
        f.duration = (Date.now() - recStart) / 1000;
        if (f.duration < .8) return toast("Hold on a little longer to record a voice note.", "info");
        sendFile(f, "audio");
      };
      recorder.start(250); recStart = Date.now();
      $(".ck-composer").hidden = true; $(".ck-rec").hidden = false;
      recTimer = setInterval(() => { const s = (Date.now() - recStart) / 1000; $(".ck-rec-t").textContent = fmtDur(s); if (s >= 180) recorder.stop(); }, 250);
    } catch { toast("Microphone access was blocked. Allow it in your browser to send voice notes.", "error"); }
  }

  // ---------- message menu ----------
  function openMenu(el) {
    const m = msgs.find(x => x.id === el.dataset.id); if (!m || m.deleted) return;
    const mine = m.from === me, age = Date.now() - ms(m.createdAt);
    const menu = $(".ck-menu");
    menu.innerHTML = `<div class="ck-rx-pick">${REACTIONS.map(r => `<button type="button" data-react="${r}" class="${m.reactions?.[me] === r ? "on" : ""}">${r}</button>`).join("")}</div>
      <button type="button" data-mact="reply"><i class="fa-solid fa-reply"></i> Reply</button>
      ${m.text ? '<button type="button" data-mact="copy"><i class="fa-regular fa-copy"></i> Copy</button>' : ""}
      ${mine && m.text && age < EDIT_MS ? '<button type="button" data-mact="edit"><i class="fa-solid fa-pen"></i> Edit</button>' : ""}
      ${mine && age < DELETE_MS ? '<button type="button" data-mact="delete" class="danger"><i class="fa-regular fa-trash-can"></i> Delete for everyone</button>' : ""}`;
    menu.dataset.id = m.id; menu.hidden = false;
    const r = el.querySelector(".ck-b").getBoundingClientRect(), box = root.getBoundingClientRect();
    const mw = 230, mh = menu.offsetHeight || 220;
    let left = (mine ? r.right - mw : r.left) - box.left, top = r.bottom - box.top + 6;
    if (top + mh > box.height) top = r.top - box.top - mh - 6;
    menu.style.left = `${Math.max(8, Math.min(left, box.width - mw - 8))}px`; menu.style.top = `${Math.max(8, top)}px`;
  }
  const closeMenu = () => { $(".ck-menu").hidden = true; };

  // ---------- search ----------
  function runSearch() {
    const q = $(".ck-search input").value.trim().toLowerCase();
    searchHits = q ? msgs.filter(m => !m.deleted && (m.text || "").toLowerCase().includes(q)).map(m => m.id) : [];
    searchIdx = searchHits.length - 1;
    $(".ck-count").textContent = q ? `${searchHits.length ? searchIdx + 1 : 0}/${searchHits.length}` : "";
    $$(".ck-msg").forEach(el => el.classList.toggle("hit", searchHits.includes(el.dataset.id)));
    focusHit();
  }
  function focusHit() {
    $$(".ck-msg.current").forEach(el => el.classList.remove("current"));
    const el = searchHits[searchIdx] && root.querySelector(`.ck-msg[data-id="${CSS.escape(searchHits[searchIdx])}"]`);
    if (el) { el.classList.add("current"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    if (searchHits.length) $(".ck-count").textContent = `${searchIdx + 1}/${searchHits.length}`;
  }

  // ---------- events ----------
  function showJump() { $(".ck-jump").hidden = false; $(".ck-jump-n").textContent = newBelow || ""; }
  log.addEventListener("scroll", () => {
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    if (near) { newBelow = 0; $(".ck-jump").hidden = true; markRead(); }
    else if (log.scrollHeight - log.scrollTop - log.clientHeight > 400) showJump();
    closeMenu();
  }, { passive: true });
  let pressT;
  log.addEventListener("pointerdown", e => { const b = e.target.closest(".ck-msg"); if (!b || e.pointerType === "mouse") return; pressT = setTimeout(() => { navigator.vibrate?.(15); openMenu(b); }, 450); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(t => log.addEventListener(t, () => clearTimeout(pressT)));
  log.addEventListener("contextmenu", e => { const b = e.target.closest(".ck-msg"); if (b && matchMedia("(pointer: coarse)").matches) e.preventDefault(); });
  log.addEventListener("dblclick", e => { const b = e.target.closest(".ck-msg"); if (b) { const m = msgs.find(x => x.id === b.dataset.id); if (m && !m.deleted) setReply(m); } });

  root.addEventListener("click", async e => {
    const t = e.target;
    if (!t.closest(".ck-menu") && !t.closest(".ck-more")) closeMenu();
    if (!t.closest(".ck-pop") && !t.closest(".ck-emoji-btn") && !t.closest(".ck-attach-btn")) { $(".ck-emoji").hidden = true; $(".ck-attach").hidden = true; }
    if (t.closest(".ck-back")) return opts.onBack?.();
    if (t.closest("[data-request-human]") && me === "client") {
      try {
        await writeThread({ handoffRequested: true, handoffRequestedAt: fb.serverTimestamp(), handoffStatus: "requested", label: "pending", unreadAdmin: fb.increment(1) });
        toast("Your request has been sent. A member of the ProfJero team will reply here.");
        const btn = $(".ck-human-btn"); if (btn) { btn.disabled = true; btn.title = "Human reply requested"; }
      } catch (err) { toast(err.message || "Could not request a human reply."); }
      return;
    }
    if (t.closest(".ck-search-btn")) { $(".ck-search").hidden = false; $(".ck-search input").focus(); return; }
    if (t.closest(".ck-search-close")) { $(".ck-search").hidden = true; $(".ck-search input").value = ""; runSearch(); return; }
    const sNav = t.closest("[data-s]"); if (sNav && searchHits.length) { searchIdx = (searchIdx + Number(sNav.dataset.s) + searchHits.length) % searchHits.length; focusHit(); return; }
    if (t.closest(".ck-jump")) { log.scrollTo({ top: log.scrollHeight, behavior: "smooth" }); return; }
    if (t.closest(".ck-emoji-btn")) { $(".ck-emoji").hidden = !$(".ck-emoji").hidden; $(".ck-attach").hidden = true; return; }
    if (t.closest(".ck-attach-btn")) { $(".ck-attach").hidden = !$(".ck-attach").hidden; $(".ck-emoji").hidden = true; return; }
    const em = t.closest("[data-emoji]"); if (em) { const s = ta.selectionStart ?? ta.value.length; ta.setRangeText(em.dataset.emoji, s, ta.selectionEnd ?? s, "end"); ta.focus(); syncButtons(); return; }
    const qr = t.closest("[data-qr]"); if (qr) { ta.value = $(".ck-qr")._hits[+qr.dataset.qr].text; $(".ck-qr").hidden = true; ta.focus(); syncButtons(); return; }
    if (t.closest(".ck-reply-x")) { editing ? cancelEdit() : clearReply(); return; }
    if (t.closest(".ck-mic")) { startRec(); return; }
    if (t.closest(".ck-rec-x")) { recCancel = true; recorder?.stop(); return; }
    if (t.closest(".ck-rec-send")) { recorder?.stop(); return; }
    const more = t.closest(".ck-more"); if (more) { openMenu(more.closest(".ck-msg")); return; }
    const quote = t.closest("[data-jump]"); if (quote) { const el = root.querySelector(`.ck-msg[data-id="${CSS.escape(quote.dataset.jump)}"]`); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); } return; }
    const react = t.closest("[data-react]");
    if (react) {
      const id = $(".ck-menu").dataset.id, m = msgs.find(x => x.id === id); closeMenu();
      const next = m.reactions?.[me] === react.dataset.react ? fb.deleteField() : react.dataset.react;
      try { await fb.updateDoc(fb.doc(mCol, id), { [`reactions.${me}`]: next }); } catch (err) { toast(err.message, "error"); }
      return;
    }
    const act = t.closest("[data-mact]");
    if (act) {
      const id = $(".ck-menu").dataset.id, m = msgs.find(x => x.id === id); closeMenu();
      if (act.dataset.mact === "reply") setReply(m);
      if (act.dataset.mact === "copy") { await navigator.clipboard.writeText(m.text).catch(() => { }); toast("Copied"); }
      if (act.dataset.mact === "edit") startEdit(m);
      if (act.dataset.mact === "delete" && confirm("Delete this message for everyone?")) {
        try { await fb.updateDoc(fb.doc(mCol, id), { text: "", attachment: null, replyTo: null, deleted: true, deletedAt: fb.serverTimestamp() }); }
        catch { toast("Couldn't delete: messages can be deleted for everyone within 48 hours.", "error"); }
      }
      return;
    }
    const img = t.closest(".ck-img");
    if (img) { const src = img.dataset.url || await loadFile(img.dataset.file); if (src) openViewer(src); return; }
    const doc = t.closest(".ck-doc");
    if (doc) { const src = doc.dataset.url || await loadFile(doc.dataset.file); if (src) { const a = document.createElement("a"); a.href = src; a.download = doc.dataset.name; a.target = "_blank"; a.click(); } return; }
    const play = t.closest(".ck-play");
    if (play) {
      const box = play.closest(".ck-voice");
      if (box._audio) { box._audio.paused ? box._audio.play() : box._audio.pause(); return; }
      const src = box.dataset.url || await loadFile(box.dataset.file); if (!src) return;
      const a = new Audio(src); box._audio = a;
      const bar = box.querySelector(".ck-vbar span"), tt = box.querySelector(".ck-vt"), total = tt.textContent;
      a.ontimeupdate = () => { if (a.duration && isFinite(a.duration)) bar.style.width = `${(a.currentTime / a.duration) * 100}%`; tt.textContent = fmtDur(a.currentTime); };
      a.onplay = () => { play.innerHTML = '<i class="fa-solid fa-pause"></i>'; };
      a.onpause = () => { play.innerHTML = '<i class="fa-solid fa-play"></i>'; };
      a.onended = () => { bar.style.width = "0"; tt.textContent = total; };
      a.play();
    }
  });
  root.addEventListener("change", e => { const p = e.target.closest("[data-pick]"); if (!p) return; [...p.files].forEach(f => sendFile(f, p.dataset.pick)); p.value = ""; closePops(); });
  root.addEventListener("keydown", e => {
    if (e.target.closest(".ck-search input")) { if (e.key === "Enter") { e.preventDefault(); if (searchHits.length) { searchIdx = (searchIdx - 1 + searchHits.length) % searchHits.length; focusHit(); } } if (e.key === "Escape") root.querySelector(".ck-search-close").click(); }
    if (e.target.closest(".ck-b") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openMenu(e.target.closest(".ck-msg")); }
  });
  $(".ck-search input").addEventListener("input", runSearch);

  function openViewer(src) {
    const d = document.createElement("dialog"); d.className = "ck-viewer";
    d.innerHTML = `<button type="button" class="ck-viewer-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><a class="ck-viewer-dl" href="${src}" download="photo.jpg" aria-label="Download"><i class="fa-solid fa-download"></i></a><img src="${src}" alt="">`;
    document.body.append(d); d.showModal();
    d.addEventListener("click", ev => { if (ev.target === d || ev.target.closest(".ck-viewer-x")) d.close(); });
    d.addEventListener("close", () => d.remove());
  }

  if (me === "client" && "Notification" in window && Notification.permission === "default") setTimeout(() => Notification.requestPermission().catch(() => { }), 4000);
  syncButtons();
  ta.focus({ preventScroll: true });

  return {
    destroy() { unsubs.forEach(u => u()); clearInterval(heartbeat); clearInterval(statusTimer); document.removeEventListener("visibilitychange", onVis); removeEventListener("focus", onVis); recorder?.state === "recording" && (recCancel = true, recorder.stop()); },
    setQuickReplies(list) { opts.quickReplies = list; }
  };
}
