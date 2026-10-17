// Schema-driven form builder for the admin dashboard.
// Field: { key, label, type, help, options, placeholder, full, max, round, fields (list), min, step }
// Types: text email url number tel textarea markdown select toggle range image file tags color icon
//        date time month datetime (real date/time pickers) combo (pick an existing value or add a new one)
//        client (Hub client picker) video list strings
import { $, $$, esc, uploadToCloudinary, toast, openDialog, fb, fileSize } from "./core.js";
import { parseVideo, img } from "/assets/js/utils.js";
import { clientPickerHtml, readClientPicker, bindClientPickers } from "./clientpicker.js";

const specs = new Map(); // repeater id -> fields
let uid = 0;
const nid = () => "f" + (++uid);

function attr(v) { return esc(v ?? ""); }

/** Accepts "2026-10-20", a Date or a Firestore Timestamp; returns "YYYY-MM-DD" for <input type=date>. */
function toDateInput(v) {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (isNaN(d)) return "";
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toLocalInput(v) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  if (!d || isNaN(d)) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 16);
}

function videoPreview(url) {
  const v = parseVideo(url);
  if (!v) return url ? `<p class="help" style="color:var(--red)">Unrecognised video link. Use a YouTube, TikTok, Vimeo or direct video URL.</p>` : "";
  if (!v.embed) return `<p class="help">TikTok short links can't be embedded — open the video and copy the full link (tiktok.com/@user/video/…).</p>`;
  const src = v.embed.replace("autoplay=1", "autoplay=0");
  return `<div class="video-preview${v.vertical ? " vertical" : ""}">${v.provider === "file" ? `<video src="${esc(src)}" controls style="width:100%"></video>` : `<iframe src="${esc(src)}" loading="lazy" allowfullscreen title="Preview"></iframe>`}</div><p class="help"><i class="fa-solid fa-circle-check" style="color:var(--green)"></i> ${esc(v.provider)} video detected${v.vertical ? " (vertical)" : ""}</p>`;
}

function fieldHtml(f, value) {
  const id = nid();
  const v = value ?? f.default ?? (f.type === "list" || f.type === "strings" || f.type === "tags" ? [] : "");
  const label = f.label ? `<label for="${id}">${esc(f.label)}${f.max ? `<span class="count" data-count-for="${id}">${String(v || "").length}/${f.max}</span>` : ""}</label>` : "";
  const help = f.help ? `<span class="help">${f.help}</span>` : "";
  const wrap = (inner, extra = "") => `<div class="f${f.full ? " full" : ""}" data-field="${esc(f.key)}" data-type="${f.type}" ${extra}>${label}${inner}${help}</div>`;
  const ph = f.placeholder ? ` placeholder="${attr(f.placeholder)}"` : "";
  const mx = f.max ? ` maxlength="${f.max}"` : "";
  switch (f.type) {
    case "textarea":
    case "markdown":
      return wrap(`<textarea id="${id}" rows="${f.rows || (f.type === "markdown" ? 8 : 4)}"${ph}${mx}>${esc(v)}</textarea>`);
    case "select":
      return wrap(`<select id="${id}">${(f.options || []).map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${attr(val)}"${String(val) === String(v) ? " selected" : ""}>${esc(lab)}</option>`; }).join("")}</select>`);
    case "toggle":
      return `<div class="f${f.full ? " full" : ""}" data-field="${esc(f.key)}" data-type="toggle"><label class="switch" for="${id}"><input type="checkbox" id="${id}"${v === true || (v === "" && f.default !== false && f.defaultOn) ? " checked" : ""}><span class="track"></span>${esc(f.label)}</label>${help}</div>`;
    case "range":
      return wrap(`<div class="range-row"><input type="range" id="${id}" min="${f.min ?? 0}" max="${f.maxValue ?? 100}" step="${f.step ?? 1}" value="${attr(v || 0)}"><output>${esc(v || 0)}${f.unit ?? "%"}</output></div>`);
    case "image":
    case "file":
      return wrap(`<div class="img-field">
          ${f.type === "image" ? `<div class="img-preview${f.round ? " round" : ""}" style="${v ? `background-image:url('${attr(img(v, 300))}')` : ""}">${v ? "" : '<i class="fa-regular fa-image"></i>'}</div>` : ""}
          <div class="stack">
            <input id="${id}" type="text" inputmode="url" data-url value="${attr(v)}" placeholder="${f.type === "image" ? "https://… or upload" : "https://… or upload a file"}">
            <div class="btns">
              <label class="btn btn-ghost btn-sm" style="cursor:pointer"><i class="fa-solid fa-cloud-arrow-up"></i> Upload<input type="file" hidden accept="${f.accept || (f.type === "image" ? "image/*" : "")}" data-upload></label>
              <button class="btn btn-ghost btn-sm" type="button" data-library><i class="fa-regular fa-images"></i> Library</button>
              ${v ? `<a class="btn btn-ghost btn-sm" href="${attr(v)}" target="_blank" rel="noopener" data-open><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}
              <button class="btn btn-ghost btn-sm" type="button" data-clear title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="upload-progress" hidden><span></span></div>
          </div></div>`);
    case "tags":
      return wrap(`<div class="tags-input" data-tags>${(v || []).map(t => `<span class="tag" data-v="${attr(t)}">${esc(t)}<button type="button" aria-label="Remove ${attr(t)}">&times;</button></span>`).join("")}<input id="${id}" placeholder="${attr(f.placeholder || "Type and press Enter")}"></div>`);
    case "color":
      return wrap(`<div class="color-row"><input type="color" value="${attr(v || "#0A60EE")}" data-color><input id="${id}" value="${attr(v || "#0A60EE")}" maxlength="9"></div>`);
    case "icon":
      return wrap(`<div class="f-inline"><input id="${id}" value="${attr(v)}" placeholder="fa-solid fa-laptop-code"><span class="icon-preview"><i class="${attr(v)}"></i></span></div>`);
    case "month":
      return wrap(`<input id="${id}" type="month" value="${attr(v)}">`);
    case "date":
      return wrap(`<div class="picker-row"><input id="${id}" type="date" value="${attr(toDateInput(v))}"${f.min ? ` min="${attr(f.min)}"` : ""}>${f.quick ? `<span class="date-quick">${f.quick.map(([l, d]) => `<button type="button" class="chip-btn" data-quick-days="${d}">${esc(l)}</button>`).join("")}</span>` : ""}</div>`);
    case "time":
      return wrap(`<input id="${id}" type="time" value="${attr(v)}" step="${f.step || 300}">`);
    case "combo": {
      const lid = nid();
      return wrap(`<div class="combo"><input id="${id}" value="${attr(v)}" list="${lid}" autocomplete="off"${ph}${mx}><datalist id="${lid}">${(f.options || []).map(o => `<option value="${attr(o)}"></option>`).join("")}</datalist><i class="fa-solid fa-chevron-down combo-caret" aria-hidden="true"></i></div>`);
    }
    case "client":
      return `<div class="f full" data-field="${esc(f.key)}" data-type="client">${f.label ? `<label>${esc(f.label)}</label>` : ""}${clientPickerHtml(v || {}, { extra: f.extra || [] })}${help}</div>`;
    case "datetime":
      return wrap(`<input id="${id}" type="datetime-local" value="${attr(toLocalInput(v))}">`);
    case "video":
      return wrap(`<input id="${id}" type="url" value="${attr(v)}" placeholder="https://youtube.com/watch?v=… or https://www.tiktok.com/@user/video/…" data-video><div data-video-preview>${videoPreview(v)}</div>`);
    case "strings": {
      const rid = nid();
      specs.set(rid, { strings: true, f });
      return wrap(`<div class="repeater" data-repeater="${rid}">${(v || []).map((s, i) => stringItem(s, f, i)).join("")}</div><button class="btn btn-ghost btn-sm" type="button" data-add="${rid}" style="justify-self:start;margin-top:4px"><i class="fa-solid fa-plus"></i> Add ${esc(f.itemLabel || "item")}</button>`);
    }
    case "list": {
      const rid = nid();
      specs.set(rid, { f });
      return wrap(`<div class="repeater" data-repeater="${rid}">${(v || []).map((item, i) => listItem(item, f, i)).join("")}</div><button class="btn btn-ghost btn-sm" type="button" data-add="${rid}" style="justify-self:start;margin-top:4px"><i class="fa-solid fa-plus"></i> Add ${esc(f.itemLabel || "item")}</button>`);
    }
    default:
      return wrap(`<input id="${id}" type="${["email", "url", "number", "tel"].includes(f.type) ? f.type : "text"}" value="${attr(v)}"${ph}${mx}${f.min !== undefined ? ` min="${f.min}"` : ""}${f.step ? ` step="${f.step}"` : ""}>`);
  }
}

const itemHead = (label, i) => `<div class="rep-head"><span>${esc(label)} <span data-idx>${i + 1}</span></span><span class="spacer"></span>
  <button class="icon-btn sm" type="button" data-move="-1" title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
  <button class="icon-btn sm" type="button" data-move="1" title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
  <button class="icon-btn sm danger" type="button" data-remove title="Remove"><i class="fa-regular fa-trash-can"></i></button></div>`;

function stringItem(s, f) {
  const big = f.multiline;
  return `<div class="rep-item" data-scope style="padding:10px"><div class="f-inline">${big ? `<textarea rows="3" data-str>${esc(s)}</textarea>` : `<input data-str value="${attr(s)}" placeholder="${attr(f.placeholder || "")}">`}
    <span class="order-btns"><button type="button" data-move="-1" aria-label="Move up">▲</button><button type="button" data-move="1" aria-label="Move down">▼</button></span>
    <button class="icon-btn sm danger" type="button" data-remove title="Remove"><i class="fa-regular fa-trash-can"></i></button></div></div>`;
}
function listItem(item, f, i) {
  return `<div class="rep-item" data-scope>${itemHead(f.itemLabel || "Item", i)}<div class="fields">${f.fields.map(sf => fieldHtml(sf, item?.[sf.key])).join("")}</div></div>`;
}

export function renderFields(fields, data = {}) {
  return `<div class="fields">${fields.map(f => fieldHtml(f, data?.[f.key])).join("")}</div>`;
}

function renumber(rep) { $$(":scope > .rep-item", rep).forEach((it, i) => { const n = $("[data-idx]", it); if (n) n.textContent = i + 1; }); }

/** Wires up dynamic behaviour. Call once per form root (event delegation). */
export function bindFields(root, onChange = () => { }) {
  bindClientPickers(root);
  // Quick date buttons: "Today", "+7 days"…
  root.addEventListener("click", e => {
    const q = e.target.closest("[data-quick-days]");
    if (!q) return;
    const d = new Date(); d.setDate(d.getDate() + Number(q.dataset.quickDays));
    const input = q.closest(".picker-row").querySelector("input");
    input.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  root.addEventListener("input", e => {
    const t = e.target;
    const cnt = t.id && $(`[data-count-for="${t.id}"]`, root);
    if (cnt) cnt.textContent = `${t.value.length}/${t.maxLength}`;
    if (t.type === "range") t.nextElementSibling.textContent = t.value + (t.closest("[data-field]") ? "%" : "");
    if (t.matches("[data-color]")) t.nextElementSibling.value = t.value;
    if (t.closest('[data-type="color"]') && !t.matches("[data-color]") && /^#[0-9a-f]{6}$/i.test(t.value)) t.previousElementSibling.value = t.value;
    if (t.closest('[data-type="icon"]')) $(".icon-preview i", t.closest(".f")).className = t.value;
    if (t.closest('[data-type="image"]') && t.matches("[data-url]")) setPreview(t.closest(".f"), t.value);
    if (t.matches("[data-video]")) { clearTimeout(t._t); t._t = setTimeout(() => { $("[data-video-preview]", t.closest(".f")).innerHTML = videoPreview(t.value.trim()); }, 400); }
    onChange();
  });
  root.addEventListener("change", e => {
    if (e.target.matches("[data-upload]")) handleUpload(e.target);
    onChange();
  });
  root.addEventListener("keydown", e => {
    const inp = e.target.closest("[data-tags] input");
    if (!inp) return;
    if ((e.key === "Enter" || e.key === ",") && inp.value.trim()) {
      e.preventDefault();
      inp.value.split(",").map(s => s.trim()).filter(Boolean).forEach(t => addTag(inp, t));
      inp.value = "";
      onChange();
    } else if (e.key === "Backspace" && !inp.value) {
      inp.previousElementSibling?.remove(); onChange();
    }
  });
  root.addEventListener("focusout", e => {
    const inp = e.target.closest("[data-tags] input");
    if (inp && inp.value.trim()) { inp.value.split(",").map(s => s.trim()).filter(Boolean).forEach(t => addTag(inp, t)); inp.value = ""; onChange(); }
  });
  root.addEventListener("click", async e => {
    const t = e.target;
    if (t.closest(".tag button")) { t.closest(".tag").remove(); onChange(); return; }
    if (t.closest("[data-tags]") && t.matches("[data-tags]")) { $("input", t).focus(); return; }
    const add = t.closest("[data-add]");
    if (add) {
      const rep = $(`[data-repeater="${add.dataset.add}"]`, root);
      const s = specs.get(add.dataset.add);
      const n = $$(":scope > .rep-item", rep).length;
      rep.insertAdjacentHTML("beforeend", s.strings ? stringItem("", s.f) : listItem({}, s.f, n));
      $("input, textarea", rep.lastElementChild)?.focus();
      onChange(); return;
    }
    const rm = t.closest("[data-remove]");
    if (rm) { const it = rm.closest(".rep-item"); const rep = it.parentElement; it.remove(); renumber(rep); onChange(); return; }
    const mv = t.closest("[data-move]");
    if (mv) {
      const it = mv.closest(".rep-item");
      if (+mv.dataset.move < 0 && it.previousElementSibling) it.parentElement.insertBefore(it, it.previousElementSibling);
      if (+mv.dataset.move > 0 && it.nextElementSibling) it.parentElement.insertBefore(it.nextElementSibling, it);
      renumber(it.parentElement); onChange(); return;
    }
    if (t.closest("[data-clear]")) { const f = t.closest(".f"); $("input[data-url]", f).value = ""; setPreview(f, ""); onChange(); return; }
    if (t.closest("[data-library]")) {
      const f = t.closest(".f");
      const url = await pickFromLibrary(f.dataset.type === "image");
      if (url) { $("input[data-url]", f).value = url; setPreview(f, url); onChange(); }
    }
  });
}

function addTag(inp, t) {
  const exists = $$(".tag", inp.parentElement).some(x => x.dataset.v.toLowerCase() === t.toLowerCase());
  if (!exists) inp.insertAdjacentHTML("beforebegin", `<span class="tag" data-v="${attr(t)}">${esc(t)}<button type="button" aria-label="Remove">&times;</button></span>`);
}

function setPreview(f, url) {
  const p = $(".img-preview", f);
  if (!p) return;
  p.style.backgroundImage = url ? `url('${img(url, 300)}')` : "";
  p.innerHTML = url ? "" : '<i class="fa-regular fa-image"></i>';
}

async function handleUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const f = input.closest(".f");
  const bar = $(".upload-progress", f);
  bar.hidden = false;
  try {
    const item = await uploadToCloudinary(file, { onProgress: p => $("span", bar).style.width = p + "%" });
    $("input[data-url]", f).value = item.url;
    setPreview(f, item.url);
    $("input[data-url]", f).dispatchEvent(new Event("input", { bubbles: true }));
    toast("Uploaded to Cloudinary");
  } catch (e) {
    toast(e.message, "error", 6000);
  } finally {
    bar.hidden = true; $("span", bar).style.width = "0"; input.value = "";
  }
}

export async function pickFromLibrary(imagesOnly = true) {
  let snap;
  try { snap = await fb.getDocs(fb.query(fb.collection(fb.db, "media"), fb.orderBy("createdAt", "desc"), fb.limit(120))); }
  catch { toast("Couldn't load the media library.", "error"); return null; }
  const items = snap.docs.map(d => d.data()).filter(m => !imagesOnly || m.resourceType === "image");
  let chosen = null;
  await openDialog({
    title: "Choose from media library", size: "wide",
    body: items.length ? `<div class="media-grid">${items.map((m, i) => `<button type="button" class="media-card pick" data-i="${i}" style="padding:0;text-align:left">${m.resourceType === "image" ? `<img src="${esc(img(m.url, 320))}" alt="" loading="lazy">` : `<div class="file"><i class="fa-regular fa-file"></i></div>`}<div class="meta"><span>${esc(m.name || m.format)}</span><span>${fileSize(m.bytes || 0)}</span></div></button>`).join("")}</div>`
      : `<div class="empty"><i class="fa-regular fa-images"></i><p>No uploads yet. Use “Upload” to add files.</p></div>`,
    actions: [{ label: "Cancel", value: null, cls: "btn-ghost" }],
    onOpen: body => body.addEventListener("click", e => {
      const c = e.target.closest("[data-i]");
      if (c) { chosen = items[+c.dataset.i].url; $("#dlg [data-close]").click(); }
    })
  });
  return chosen;
}

function fieldEls(root, key) {
  return $$(`[data-field="${CSS.escape(key)}"]`, root).filter(el => el.parentElement.closest("[data-scope]") === root);
}

/** Reads values for `fields` inside `root` (root must carry data-scope). */
export function readFields(fields, root) {
  const out = {};
  for (const f of fields) {
    const el = fieldEls(root, f.key)[0];
    if (!el) continue;
    const input = $("input:not([data-color]):not([type=file]), textarea, select", el);
    switch (f.type) {
      case "toggle": out[f.key] = $("input", el).checked; break;
      case "number": out[f.key] = input.value === "" ? 0 : Number(input.value); break;
      case "range": out[f.key] = Number($("input", el).value); break;
      case "tags": out[f.key] = $$(".tag", el).map(t => t.dataset.v); break;
      case "datetime": out[f.key] = input.value ? new Date(input.value) : null; break;
      case "client": out[f.key] = readClientPicker(el); break;
      case "strings": out[f.key] = $$(":scope > .repeater > .rep-item", el).map(it => $("[data-str]", it).value.trim()).filter(Boolean); break;
      case "list": out[f.key] = $$(":scope > .repeater > .rep-item", el).map(it => readFields(f.fields, it)); break;
      default: out[f.key] = (input?.value ?? "").trim();
    }
  }
  return out;
}

/** Validates required fields; focuses the first invalid one. */
export function validate(fields, root) {
  for (const f of fields.filter(x => x.type === "client")) {
    const v = readClientPicker(fieldEls(root, f.key)[0]);
    if (!v?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { $('[data-cp="email"]', fieldEls(root, f.key)[0])?.focus(); toast("Choose a client or enter their email address.", "error"); return false; }
    if (!v.name) { $('[data-cp="name"]', fieldEls(root, f.key)[0])?.focus(); toast("Enter the client's name.", "error"); return false; }
  }
  for (const f of fields.filter(x => x.required)) {
    const el = fieldEls(root, f.key)[0];
    const input = el && $("input, textarea, select", el);
    if (input && !input.value.trim()) { input.focus(); toast(`${f.label} is required.`, "error"); return false; }
  }
  return true;
}
