// Small, dependency-free Markdown renderer. Input is HTML-escaped first, so the
// output is safe to inject. Supports: ## / ### / #### headings (with anchor ids),
// paragraphs, - and 1. lists, **bold**, *italic*, ~~strike~~, `code`, fenced code
// blocks, > blockquotes, [links](url), ![images](url), --- rules, pipe tables and
// video embeds written on their own line as @[video](url).
import { esc, safeUrl, slugify, parseVideo, img } from "./utils.js";

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
    const u = safeUrl(url.replace(/&amp;/g, "&"));
    return u ? `<img src="${esc(img(u, 1200))}" alt="${alt}" loading="lazy" decoding="async">` : "";
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
    const u = safeUrl(url.replace(/&amp;/g, "&"));
    if (!u) return text;
    const ext = /^https?:/i.test(u) && !/profjero/i.test(u);
    return `<a href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|\W)_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

function videoEmbed(url) {
  const v = parseVideo(url);
  if (!v) return "";
  if (!v.embed) return `<p><a href="${esc(v.url)}" target="_blank" rel="noopener">Watch the video</a></p>`;
  const src = v.embed.replace("autoplay=1", "autoplay=0");
  if (v.provider === "file") return `<figure class="md-video"><video src="${esc(src)}" controls preload="metadata" playsinline></video></figure>`;
  return `<figure class="md-video${v.vertical ? " is-vertical" : ""}"><iframe src="${esc(src)}" title="Embedded video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></figure>`;
}

/** Returns { html, toc } where toc lists h2/h3 headings for a table of contents. */
export function renderMarkdown(md = "") {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  const out = [], toc = [], used = new Set();
  let i = 0;
  const isBlockStart = l => /^(#{1,4}\s|```|>\s?|[-*]\s|\d+\.\s|---\s*$|\|.*\|\s*$|@\[video\])/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^```\s*([\w+-]*)/))) {
      const lang = m[1], buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<div class="code-block"><div class="code-head"><span>${esc(lang || "code")}</span><button type="button" class="copy-code" aria-label="Copy code"><i class="fa-regular fa-copy"></i> Copy</button></div><pre><code class="lang-${esc(lang)}">${esc(buf.join("\n"))}</code></pre></div>`);
      continue;
    }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      const level = Math.min(4, Math.max(2, m[1].length));
      const text = m[2].trim();
      let id = slugify(text) || "section", n = 2;
      while (used.has(id)) id = `${slugify(text)}-${n++}`;
      used.add(id);
      if (level <= 3) toc.push({ id, text, level });
      out.push(`<h${level} id="${id}">${inline(esc(text))}</h${level}>`);
      i++; continue;
    }
    if (/^---\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if ((m = line.match(/^@\[video\]\(([^)\s]+)\)\s*$/))) { out.push(videoEmbed(m[1])); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${inline(esc(buf.join(" ")))}</p></blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^[-*]\s+/, ""));
      out.push(`<ul>${buf.map(b => {
        const t = b.match(/^\[( |x)\]\s+(.*)/i);
        return t ? `<li class="task"><input type="checkbox" disabled${t[1].toLowerCase() === "x" ? " checked" : ""}> ${inline(esc(t[2]))}</li>` : `<li>${inline(esc(b))}</li>`;
      }).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      const start = parseInt(line, 10);
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\d+\.\s+/, ""));
      out.push(`<ol${start > 1 ? ` start="${start}"` : ""}>${buf.map(b => `<li>${inline(esc(b))}</li>`).join("")}</ol>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${inline(esc(h))}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(esc(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlockStart(lines[i]))) buf.push(lines[i++]);
    out.push(`<p>${inline(esc(buf.join(" ")))}</p>`);
  }
  return { html: out.join("\n"), toc };
}

/** Plain text version (for descriptions, search and llms output). */
export function markdownToText(md = "") {
  return String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/@\[video\]\([^)]*\)/g, " ")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
