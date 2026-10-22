// Chat text formatting. Messages are stored as plain text with light markers, so they stay
// readable in notifications and old clients, and can't carry HTML:
//   **bold**  *italic* or _italic_  __underline__  ~~strike~~  `code`
//   [color=red]text[/color]  "- " / "1. " lists  "> " quotes  [label](https://link)
// formatChat() escapes first, then turns the markers into a fixed set of tags.
import { esc } from "./utils.js";

export const CHAT_COLORS = [
  ["red", "Red"], ["orange", "Orange"], ["green", "Green"], ["blue", "Blue"], ["purple", "Purple"], ["pink", "Pink"], ["gray", "Grey"]
];
const COLOR_RE = new RegExp(`\\[color=(${CHAT_COLORS.map(c => c[0]).join("|")})\\]([\\s\\S]+?)\\[\\/color\\]`, "g");
const LEGACY_AI = /^\s*🤖\s*ProfJero AI \(automated reply\)\s*\n?/;

function inline(s, keep) {
  // Code spans and links are swapped for placeholders so nothing inside them is reformatted.
  s = s.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${c}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`));
  s = s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, u => keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`));
  s = s.replace(COLOR_RE, (_, c, t) => `<span class="tc tc-${c}">${t}</span>`);
  s = s.replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(?=\S)([\s\S]+?)(?<=\S)__/g, "<u>$1</u>");
  s = s.replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, "<s>$1</s>");
  s = s.replace(/(^|[^\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w])_(?=\S)([^_\n]+?)(?<=\S)_(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w~])~(?=\S)([^~\n]+?)(?<=\S)~(?![\w~])/g, "$1<s>$2</s>");
  return s;
}

/** Safe HTML for a chat message. */
export function formatChat(text = "") {
  const kept = [];
  const keep = h => `\u0000${kept.push(h) - 1}\u0000`;
  const lines = esc(String(text).replace(LEGACY_AI, "")).split("\n");
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  lines.forEach((raw, i) => {
    let m;
    if ((m = raw.match(/^\s*(?:[-•*])\s+(.*)$/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1], keep)}</li>`; return; }
    if ((m = raw.match(/^\s*\d{1,3}[.)]\s+(.*)$/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1], keep)}</li>`; return; }
    close();
    if ((m = raw.match(/^&gt;\s?(.*)$/))) { html += `<blockquote>${inline(m[1], keep)}</blockquote>`; return; }
    if ((m = raw.match(/^#{1,6}\s+(.*)$/))) { html += `<strong class="ck-h">${inline(m[1], keep)}</strong>`; return; }
    html += inline(raw, keep) + (i < lines.length - 1 && !/^\s*([-•*]|\d{1,3}[.)]|&gt;)\s/.test(lines[i + 1] || "") ? "<br>" : "");
  });
  close();
  return html.replace(/\u0000(\d+)\u0000/g, (_, n) => kept[n]);
}

/** The words only — for previews, notifications, search and quotes. */
export function plainText(text = "") {
  return String(text).replace(LEGACY_AI, "")
    .replace(/\[color=\w+\]|\[\/color\]/g, "")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/g, "$1$2")
    .replace(/(^|[^\w])_(?=\S)([^_\n]+?)(?<=\S)_(?!\w)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^&gt;\s?|^>\s?/gm, "")
    .trim();
}

/** True when the text uses any formatting marker (used to show the live preview). */
export const hasFormatting = text => /\*\S|_\S|~\S|`|\[color=|^\s*([-•]|\d+[.)]|>)\s/m.test(text);
