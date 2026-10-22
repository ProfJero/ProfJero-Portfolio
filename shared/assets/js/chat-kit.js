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
import { CHAT_API_URL } from "./config.js";
import { formatChat, plainText, hasFormatting, CHAT_COLORS } from "./chat-format.js";

const EDIT_MS = 15 * 6e4, DELETE_MS = 48 * 36e5, TYPING_MS = 6000, ONLINE_MS = 2.5 * 6e4;
const MAX_FILE = 680 * 1024;
const AI_CHAT_ENDPOINT = window.PROFJERO_CHAT_API || CHAT_API_URL;
// The automated assistant's public identity. Stored messages keep name "ProfJero AI" (the rules check it).
export const AI_NAME = "ProfJero Assistant";
const AI_ROLE = "Virtual assistant · automated reply";
const HUMAN_HOLD_MS = 2 * 36e5;   // after a team member replies, the assistant stays quiet for 2 hours
const GROUP_MS = 5 * 6e4;         // messages from the same sender within 5 minutes are grouped
const AI_AV = '<span class="ck-ai-av" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles"></i></span>';
const FMT_KEY = "ck_fmt_open";
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
  let lastTyping = 0, heartbeat, searchHits = [], searchIdx = 0, recorder = null, recChunks = [], recStart = 0, recTimer = null, recCancel = false, aiThinking = false;
  const toast = opts.toast || ((m) => console.log(m));

  root.innerHTML = `<div class="ck">
    <header class="ck-head">
      ${opts.onBack ? '<button type="button" class="ck-ib ck-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>' : ""}
      <span class="ck-av">${opts.peer.avatar || ""}</span>
      <div class="ck-who"><strong>${esc(opts.peer.name)}</strong><small class="ck-status">${esc(opts.peer.sub || "")}</small></div>
      ${me === "client" ? `<button type="button" class="ck-human-btn" data-request-human title="Talk to a person"><i class="fa-solid fa-headset"></i><span>Talk to a person</span></button>` : ""}
      <div class="ck-tools">${opts.header || ""}
        <button type="button" class="ck-ib ck-search-btn" aria-label="Search this chat" title="Search"><i class="fa-solid fa-magnifying-glass"></i><span class="ck-tool-label">Search messages</span></button></div>
      <button type="button" class="ck-ib ck-kebab" aria-label="More options" aria-expanded="false" title="More"><i class="fa-solid fa-ellipsis-vertical"></i></button>
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
      <div class="ck-fmt" role="toolbar" aria-label="Text formatting" hidden>
        <button type="button" data-fmt="bold" title="Bold (Ctrl+B)" aria-label="Bold"><i class="fa-solid fa-bold"></i></button>
        <button type="button" data-fmt="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i class="fa-solid fa-italic"></i></button>
        <button type="button" data-fmt="underline" title="Underline (Ctrl+U)" aria-label="Underline"><i class="fa-solid fa-underline"></i></button>
        <button type="button" data-fmt="strike" title="Strikethrough (Ctrl+Shift+X)" aria-label="Strikethrough"><i class="fa-solid fa-strikethrough"></i></button>
        <span class="ck-fmt-sep"></span>
        <span class="ck-colors" role="group" aria-label="Text colour">${CHAT_COLORS.map(([k, l]) => `<button type="button" class="ck-sw sw-${k}" data-color="${k}" title="${l} text" aria-label="${l} text"></button>`).join("")}</span>
        <span class="ck-fmt-sep"></span>
        <button type="button" data-fmt="ul" title="Bulleted list" aria-label="Bulleted list"><i class="fa-solid fa-list-ul"></i></button>
        <button type="button" data-fmt="ol" title="Numbered list" aria-label="Numbered list"><i class="fa-solid fa-list-ol"></i></button>
        <button type="button" data-fmt="quote" title="Quote" aria-label="Quote"><i class="fa-solid fa-quote-left"></i></button>
        <button type="button" data-fmt="code" title="Code" aria-label="Code"><i class="fa-solid fa-code"></i></button>
        <span class="ck-fmt-sep"></span>
        <button type="button" data-fmt="clear" title="Remove formatting" aria-label="Remove formatting"><i class="fa-solid fa-text-slash"></i></button>
      </div>
      <div class="ck-preview" hidden><span class="ck-preview-k">Preview</span><div class="ck-text"></div></div>
      <form class="ck-composer" novalidate>
        <div class="ck-input">
          <button type="button" class="ck-ib ck-emoji-btn" aria-label="Emoji" title="Emoji"><i class="fa-regular fa-face-smile"></i></button>
          <textarea rows="1" maxlength="4000" placeholder="Type a message" title="${me === "admin" ? "Tip: type / for quick replies" : ""}" aria-label="Message"></textarea>
          <button type="button" class="ck-ib ck-fmt-btn" aria-label="Text formatting" aria-pressed="false" title="Formatting: bold, italic, colour…"><i class="fa-solid fa-font"></i></button>
          <button type="button" class="ck-ib ck-attach-btn" aria-label="Attach a photo or document" title="Attach"><i class="fa-solid fa-paperclip"></i></button>
        </div>
        <button type="button" class="ck-send ck-mic" aria-label="Record a voice note" title="Tap to record a voice note"><i class="fa-solid fa-microphone"></i></button>
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
    if (peerSeen() >= t || Date.now() - ms(thread?.[`${peerSide}SeenAt`]) < ONLINE_MS) return '<span class="ck-tick" title="Delivered / recipient online"><i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i></span>';
    return '<span class="ck-tick" title="Sent"><i class="fa-solid fa-check"></i></span>';
  };
  const attHtml = (a, m) => {
    if (!a) return "";
    if (a.type === "image") return `<button type="button" class="ck-img" data-file="${esc(a.fileId || "")}" data-url="${esc(a.url || "")}" style="aspect-ratio:${a.w && a.h ? `${a.w}/${a.h}` : "4/3"}"><img alt="${esc(a.name || "Photo")}" ${a.url ? `src="${esc(a.url)}"` : a.thumb ? `src="${esc(a.thumb)}" class="blur"` : ""}></button>`;
    if (a.type === "audio") return `<div class="ck-voice" data-file="${esc(a.fileId || "")}" data-url="${esc(a.url || "")}"><button type="button" class="ck-play" aria-label="Play voice note"><i class="fa-solid fa-play"></i></button><span class="ck-vbar"><span></span></span><span class="ck-vt">${fmtDur(a.duration || 0)}</span></div>`;
    return `<button type="button" class="ck-doc" data-file="${esc(a.fileId || "")}" data-url="${esc(a.url || "")}" data-name="${esc(a.name || "file")}"><span class="ck-doc-i"><i class="fa-regular fa-file${/pdf/.test(a.mime || a.name || "") ? "-pdf" : /sheet|xls|csv/.test(a.mime || a.name || "") ? "-excel" : /word|doc/.test(a.mime || a.name || "") ? "-word" : ""}"></i></span><span class="ck-doc-t"><b>${esc(a.name || "Document")}</b><small>${a.size ? fmtSize(a.size) : ""} · tap to download</small></span></button>`;
  };
  // Our side sits on the right: the admin's view counts the assistant as "us" (it answers for
  // the business); the client's view keeps only the client's own messages on the right.
  const ours = from => me === "admin" ? from === "admin" || from === "ai" : from === me;
  const nameOf = (from, name) => from === "ai" ? AI_NAME : from === me && (from !== "admin" || !name || name === opts.myName) ? "You" : from === "admin" ? (name || "ProfJero") : (opts.peer.name || "Client");
  const avatarOf = m => m.from === "ai" ? AI_AV : opts.peer.avatar || "";
  const groupKey = m => `${m.from}|${m.from === "admin" ? m.name || "" : ""}`;
  const sameGroup = (a, b) => a && b && !a.deleted && !b.deleted && groupKey(a) === groupKey(b) && Math.abs(ms(b.createdAt) - ms(a.createdAt)) < GROUP_MS && dayLabel(toDate(a.createdAt) || new Date()) === dayLabel(toDate(b.createdAt) || new Date());
  const senderLine = m => {
    if (m.from === "ai") return `<span class="ck-sender ai">${esc(AI_NAME)}<span class="ck-badge" title="${esc(AI_ROLE)}"><i class="fa-solid fa-robot"></i> Automated reply</span></span>`;
    if (m.from === "admin" && (me === "client" || (m.name && m.name !== opts.myName))) return `<span class="ck-sender">${esc(m.name || "ProfJero")}${me === "client" ? '<span class="ck-badge team"><i class="fa-solid fa-circle-check"></i> ProfJero team</span>' : ""}</span>`;
    return "";
  };
  const bubble = (m, first = true, last = true) => {
    const mine = m.from === me, out = ours(m.from), t = toDate(m.createdAt) || new Date();
    const hit = searchHits.includes(m.id);
    const rx = Object.values(m.reactions || {}).filter(Boolean);
    const cls = `ck-msg ${out ? "out" : "in"} ${mine ? "me" : "them"} from-${esc(m.from)}${first ? " first" : ""}${last ? " last" : ""}`;
    const av = out ? "" : `<span class="ck-mav">${first ? avatarOf(m) : ""}</span>`;
    if (m.deleted) return `<div class="${cls}" data-id="${esc(m.id)}">${av}<div class="ck-stack"><div class="ck-b deleted"><i class="fa-solid fa-ban"></i> ${mine ? "You deleted this message" : "This message was deleted"}<span class="ck-meta">${clock(t)}</span></div></div></div>`;
    return `<div class="${cls}${hit ? " hit" : ""}${m.attachment && !m.text ? " media" : ""}" data-id="${esc(m.id)}">${av}
      <div class="ck-stack">
      <div class="ck-b" tabindex="0">
        ${first ? senderLine(m) : ""}
        ${m.replyTo ? `<button type="button" class="ck-quote" data-jump="${esc(m.replyTo.id || "")}"><b>${esc(nameOf(m.replyTo.from))}</b><span>${esc(plainText(m.replyTo.text) || "📎 Attachment")}</span></button>` : ""}
        ${attHtml(m.attachment, m)}
        ${m.text ? `<div class="ck-text">${formatChat(m.text)}</div>` : ""}
        <span class="ck-meta">${m.editedAt ? '<em>edited</em> ' : ""}${clock(t)} ${ticks(m)}</span>
        <button type="button" class="ck-more" aria-label="Message options"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
      ${rx.length ? `<div class="ck-rx">${rx.join("")}${rx.length > 1 ? ` <small>${rx.length}</small>` : ""}</div>` : ""}
      </div>
    </div>`;
  };
  // A "typing…" bubble at the end of the conversation (the team member, or the assistant preparing a reply).
  function paintTyping() {
    const peerTyping = Date.now() - ms(thread?.[`${peerSide}Typing`]) < TYPING_MS;
    const who = me === "client" && aiThinking ? "ai" : peerTyping ? peerSide : null;
    let el = log.querySelector(".ck-typing-row");
    if (!who) { el?.remove(); return; }
    if (el?.dataset.who === who) return;
    el?.remove();
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
    log.insertAdjacentHTML("beforeend", `<div class="ck-msg in them from-${who} first last ck-typing-row" data-who="${who}" aria-label="${esc(nameOf(who))} is typing"><span class="ck-mav">${avatarOf({ from: who })}</span><div class="ck-stack"><div class="ck-b">${who === "ai" ? `<span class="ck-sender ai">${esc(AI_NAME)}</span>` : ""}<span class="ck-dots"><i></i><i></i><i></i></span></div></div></div>`);
    if (near) log.scrollTop = log.scrollHeight;
  }
  function paint() {
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    if (firstPaint) {
      const read = myRead();
      unreadFrom = msgs.find(m => m.from === peerSide && ms(m.createdAt) > read)?.id || null;
    }
    let html = "", lastDay = "";
    const unreadCount = unreadFrom ? msgs.length - msgs.findIndex(m => m.id === unreadFrom) : 0;
    msgs.forEach((m, i) => {
      const d = toDate(m.createdAt) || new Date(), label = dayLabel(d);
      if (label !== lastDay) { html += `<div class="ck-day"><span>${esc(label)}</span></div>`; lastDay = label; }
      if (m.id === unreadFrom) html += `<div class="ck-unread"><span>${unreadCount} unread message${unreadCount === 1 ? "" : "s"}</span></div>`;
      const prev = msgs[i - 1], next = msgs[i + 1];
      html += bubble(m, !sameGroup(prev, m) || m.id === unreadFrom, !sameGroup(m, next) || next?.id === unreadFrom);
    });
    const handoff = thread?.handoffRequested ? handoffBanner() : "";
    log.innerHTML = html ? handoff + html : `<div class="ck-empty"><span class="ck-empty-i">${me === "client" ? AI_AV : '<i class="fa-regular fa-comments"></i>'}</span><p>${me === "client" ? `<b>Hi there 👋</b><br>Ask anything about our services, prices or your project. <b>${AI_NAME}</b> replies instantly, and you can tap <b>Talk to a person</b> any time to reach Benjamin.` : "No messages yet."}</p></div>`;
    hydrateMedia();
    paintTyping();
    if (firstPaint) {
      const u = unreadFrom && log.querySelector(".ck-unread");
      u ? u.scrollIntoView({ block: "center" }) : (log.scrollTop = log.scrollHeight);
      firstPaint = false;
    } else if (atBottom) log.scrollTop = log.scrollHeight;
    paintStatus();
  }
  function paintStatus() {
    const st = $(".ck-status");
    paintTyping();
    if (aiThinking && me === "client") { st.innerHTML = `<span class="ck-typing">${esc(AI_NAME)} is typing<i></i><i></i><i></i></span>`; st.classList.remove("on"); return; }
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
  unsubs.push(fb.onSnapshot(tRef, s => {
    thread = s.exists() ? s.data({ serverTimestamps: "estimate" }) : null;
    opts.onThread?.(thread);
    const handoff = $(".ck-human-btn");
    if (handoff) {
      handoff.disabled = !!thread?.handoffRequested;
      handoff.classList.toggle("requested", !!thread?.handoffRequested);
      handoff.innerHTML = thread?.handoffRequested ? '<i class="fa-solid fa-hourglass-half"></i><span>Human reply requested</span>' : '<i class="fa-solid fa-headset"></i><span>Talk to a person</span>';
    }
    const banner = $(".ck-handoff-banner");
    if (thread?.handoffRequested && !banner && msgs.length) log.insertAdjacentHTML("afterbegin", handoffBanner());
    if (!thread?.handoffRequested) banner?.remove();
    paintTicksAndStatus();
  }, () => { }));
  const statusTimer = setInterval(paintStatus, 4000);
  function paintTicksAndStatus() {
    // Re-render only the meta of my messages (cheap) so ticks turn blue live.
    $$(".ck-msg.me").forEach(el => { const m = msgs.find(x => x.id === el.dataset.id); const meta = el.querySelector(".ck-meta"); if (m && meta && !m.deleted) meta.innerHTML = `${m.editedAt ? "<em>edited</em> " : ""}${clock(toDate(m.createdAt) || new Date())} ${ticks(m)}`; });
    paintStatus();
  }

  function handoffBanner() {
    return me === "client"
      ? '<div class="ck-handoff-banner"><i class="fa-solid fa-user-check"></i><div><strong>A team member is on the way</strong><span>Benjamin (ProfJero) has been notified and will reply here. The automated assistant is paused.</span></div></div>'
      : '<div class="ck-handoff-banner"><i class="fa-solid fa-hand"></i><div><strong>This client asked to talk to a person</strong><span>The automated assistant is paused. Reply here, then click “Mark handled”.</span></div></div>';
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
      const n = new Notification(opts.notify?.title || opts.peer.name, { body: m.deleted ? "Message deleted" : (m.from === "ai" ? `${AI_NAME}: ` : "") + plainText(m.text) || (m.attachment?.type === "audio" ? "🎤 Voice note" : m.attachment?.type === "image" ? "📷 Photo" : "📄 Document"), icon: opts.notify?.icon, tag: `chat-${threadId}` });
      n.onclick = () => { focus(); n.close(); };
    }
  }

  async function requestAiReply(userText) {
    if (me !== "client" || thread?.handoffRequested) return;
    // A team member is already in the conversation: let them answer.
    const lastHuman = [...msgs].reverse().find(m => m.from === "admin" && !m.deleted);
    if (lastHuman && Date.now() - ms(lastHuman.createdAt) < HUMAN_HOLD_MS) return;
    if (!AI_CHAT_ENDPOINT) { toast("AI chat is not connected yet. Please tap “Talk to a person” so Benjamin can help.", "info", 7000); return; }
    aiThinking = true; paintStatus();
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
      const history = msgs.filter(m => !m.deleted && m.text && ["client", "ai", "admin"].includes(m.from) && !(m.from === "client" && m.text === userText)).slice(-8).map(m => ({role: m.from === "client" ? "user" : "assistant", content: plainText(m.text).slice(0, 1000)}));
      const response = await fetch(AI_CHAT_ENDPOINT, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({message: plainText(userText), context, history})});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.answer) throw new Error(result.error || "AI could not respond.");
      const latest = await fb.getDoc(tRef).catch(() => null);
      if (latest?.exists() && latest.data().handoffRequested) return;
      await fb.setDoc(fb.doc(mCol), {from: "ai", text: String(result.answer).trim().slice(0, 3900), name: "ProfJero AI", createdAt: fb.serverTimestamp(), reactions: {}, clientId: "profjero-ai"});
      await fb.updateDoc(tRef, {lastMessage: plainText(result.answer).slice(0, 200), lastAt: fb.serverTimestamp(), lastFrom: "ai"});
    } catch (error) { toast(`${AI_NAME} couldn't answer just now. Tap “Talk to a person” and Benjamin will reply.`, "info", 6000); }
    finally { aiThinking = false; paintStatus(); }
  }

  // ---------- sending ----------
  async function send({ text = "", attachment = null } = {}) {
    text = text.trim().slice(0, 4000);
    if (!text && !attachment) return;
    const ref = fb.doc(mCol);
    const msg = { from: me, text, name: (opts.myName || "").slice(0, 100), createdAt: fb.serverTimestamp(), reactions: {} };
    if (attachment) msg.attachment = attachment;
    if (replyTo) msg.replyTo = { id: replyTo.id, text: plainText(replyTo.text || "").slice(0, 140), from: replyTo.from };
    clearReply();
    const preview = plainText(text) || (attachment?.type === "audio" ? "🎤 Voice note" : attachment?.type === "image" ? "📷 Photo" : `📄 ${attachment?.name || "Document"}`);
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
  const syncButtons = () => { const has = !!ta.value.trim(); $(".ck-go").hidden = !has && !editing; $(".ck-mic").hidden = has || !!editing; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; paintPreview(); };

  // ---------- formatting ----------
  // The toolbar wraps the selection in markers (or inserts a pair and puts the cursor inside);
  // pressing the same button again on wrapped text removes them. A live preview shows the result.
  const MARK = { bold: ["**", "**"], italic: ["_", "_"], underline: ["__", "__"], strike: ["~~", "~~"], code: ["`", "`"] };
  function paintPreview() {
    const box = $(".ck-preview"), v = ta.value;
    const show = !!v.trim() && hasFormatting(v);
    box.hidden = !show;
    if (show) box.querySelector(".ck-text").innerHTML = formatChat(v);
  }
  function wrap(open, close = open) {
    const s0 = ta.selectionStart, e0 = ta.selectionEnd, v = ta.value, sel = v.slice(s0, e0);
    if (v.slice(s0 - open.length, s0) === open && v.slice(e0, e0 + close.length) === close) {
      ta.setRangeText(sel, s0 - open.length, e0 + close.length, "select");
    } else if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
      ta.setRangeText(sel.slice(open.length, sel.length - close.length), s0, e0, "select");
    } else {
      // Keep spaces outside the markers ("**word** " not "**word **").
      const lead = sel.match(/^\s*/)[0], trail = sel.slice(lead.length).match(/\s*$/)[0], core = sel.trim();
      ta.setRangeText(lead + open + core + close + trail, s0, e0, "end");
      const at = s0 + lead.length + open.length;
      ta.setSelectionRange(at, at + core.length);
    }
    ta.focus(); syncButtons();
  }
  function prefixLines(kind) {
    const v = ta.value, s0 = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    let e0 = v.indexOf("\n", ta.selectionEnd); if (e0 < 0) e0 = v.length;
    const lines = v.slice(s0, e0).split("\n");
    const re = { ul: /^\s*[-•]\s+/, ol: /^\s*\d{1,3}[.)]\s+/, quote: /^>\s?/ }[kind];
    const on = lines.every(l => re.test(l) || !l.trim());
    const out = lines.map((l, i) => on ? l.replace(re, "") : !l.trim() && lines.length > 1 ? l : (kind === "ul" ? "- " : kind === "ol" ? `${i + 1}. ` : "> ") + l.replace(/^\s*([-•]|\d{1,3}[.)]|>)\s?/, ""));
    ta.setRangeText(out.join("\n"), s0, e0, "end");
    ta.focus(); syncButtons();
  }
  function colorize(c) {
    const s0 = ta.selectionStart, e0 = ta.selectionEnd, v = ta.value;
    let sel = v.slice(s0, e0).replace(/\[color=\w+\]|\[\/color\]/g, "");
    const before = v.slice(0, s0).match(/\[color=\w+\]$/), after = v.slice(e0).match(/^\[\/color\]/);
    if (before && after) { ta.setRangeText(`[color=${c}]${sel}[/color]`, s0 - before[0].length, e0 + after[0].length, "end"); const at = s0 - before[0].length + c.length + 8; ta.setSelectionRange(at, at + sel.length); }
    else { ta.setRangeText(`[color=${c}]${sel}[/color]`, s0, e0, "end"); const at = s0 + c.length + 8; ta.setSelectionRange(at, at + sel.length); }
    ta.focus(); syncButtons();
  }
  function clearFormatting() {
    const s0 = ta.selectionStart, e0 = ta.selectionEnd;
    if (s0 !== e0) ta.setRangeText(plainText(ta.value.slice(s0, e0)), s0, e0, "select");
    else ta.value = plainText(ta.value);
    ta.focus(); syncButtons();
  }
  function toggleFmt(open = $(".ck-fmt").hidden) {
    $(".ck-fmt").hidden = !open;
    $(".ck-fmt-btn").classList.toggle("on", open); $(".ck-fmt-btn").setAttribute("aria-pressed", open);
    try { localStorage.setItem(FMT_KEY, open ? "1" : ""); } catch { }
  }
  try { if (localStorage.getItem(FMT_KEY) && matchMedia("(min-width: 700px)").matches) toggleFmt(true); } catch { }
  ta.addEventListener("input", () => {
    syncButtons();
    if (Date.now() - lastTyping > 2500 && ta.value.trim()) { lastTyping = Date.now(); if (thread || me === "admin") writeThread({ [`${me}Typing`]: fb.serverTimestamp() }); }
    if (me === "admin") quickReplyMenu();
  });
  ta.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b" || k === "i" || k === "u" || (k === "x" && e.shiftKey)) { e.preventDefault(); wrap(...MARK[{ b: "bold", i: "italic", u: "underline", x: "strike" }[k]]); return; }
    }
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
  function setReply(m) { replyTo = m; $(".ck-reply").hidden = false; $(".ck-reply-body").innerHTML = `<b>${esc(nameOf(m.from, m.name))}</b><span>${esc(plainText(m.text) || "📎 Attachment")}</span>`; ta.focus(); }
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
    let left = (ours(m.from) ? r.right - mw : r.left) - box.left, top = r.bottom - box.top + 6;
    if (top + mh > box.height) top = r.top - box.top - mh - 6;
    menu.style.left = `${Math.max(8, Math.min(left, box.width - mw - 8))}px`; menu.style.top = `${Math.max(8, top)}px`;
  }
  const closeMenu = () => { $(".ck-menu").hidden = true; };

  // ---------- search ----------
  function runSearch() {
    const q = $(".ck-search input").value.trim().toLowerCase();
    searchHits = q ? msgs.filter(m => !m.deleted && plainText(m.text || "").toLowerCase().includes(q)).map(m => m.id) : [];
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
    if (!t.closest(".ck-tools") && !t.closest(".ck-kebab")) { $(".ck-head").classList.remove("tools-open"); $(".ck-kebab").setAttribute("aria-expanded", "false"); }
    if (t.closest(".ck-kebab")) { const open = $(".ck-head").classList.toggle("tools-open"); $(".ck-kebab").setAttribute("aria-expanded", open); return; }
    if (t.closest(".ck-fmt-btn")) { toggleFmt(); ta.focus(); return; }
    const fmt = t.closest("[data-fmt]");
    if (fmt) { const k = fmt.dataset.fmt; if (MARK[k]) wrap(...MARK[k]); else if (k === "clear") clearFormatting(); else prefixLines(k); return; }
    const sw = t.closest("[data-color]"); if (sw) { colorize(sw.dataset.color); return; }
    if (t.closest("[data-request-human]") && me === "client") {
      try {
        await writeThread({ handoffRequested: true, handoffRequestedAt: fb.serverTimestamp(), handoffStatus: "requested", label: "pending", unreadAdmin: fb.increment(1) });
        toast("Request sent. Benjamin (ProfJero) will reply in this chat.");
        const btn = $(".ck-human-btn");
        if (btn) { btn.disabled = true; btn.title = "Human reply requested"; btn.classList.add("requested"); btn.innerHTML = '<i class="fa-solid fa-hourglass-half"></i><span>Human reply requested</span>'; }
        if (!$(".ck-handoff-banner")) log.insertAdjacentHTML("afterbegin", handoffBanner());
      } catch (err) { toast(err.message || "Could not request a human reply."); }
      return;
    }
    if (t.closest(".ck-search-btn")) { $(".ck-head").classList.remove("tools-open"); $(".ck-search").hidden = false; $(".ck-search input").focus(); return; }
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
      if (act.dataset.mact === "copy") { await navigator.clipboard.writeText(plainText(m.text)).catch(() => { }); toast("Copied"); }
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
