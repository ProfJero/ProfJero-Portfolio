import { $, $$, fb, esc, emptyState, confirmDialog, toast, uploadToCloudinary, fileSize, fmtDate } from "../core.js";
import { img } from "/assets/js/utils.js";

export async function render(view) {
  let items = [];
  view.innerHTML = `
    <label class="dropzone" id="drop"><i class="fa-solid fa-cloud-arrow-up"></i><p style="margin:6px 0 0"><b>Drop files here</b> or click to upload to Cloudinary</p><p class="small" style="margin:4px 0 0">Images, videos and PDFs up to 25 MB</p><input type="file" id="files" multiple hidden accept="image/*,video/*,application/pdf"></label>
    <div id="queue" style="margin-top:12px;display:grid;gap:8px"></div>
    <div class="toolbar" style="margin-top:22px"><span class="muted small" id="m-count"></span></div>
    <div class="media-grid" id="grid"></div>`;
  const load = async () => {
    const snap = await fb.getDocs(fb.query(fb.collection(fb.db, "media"), fb.orderBy("createdAt", "desc"), fb.limit(300)));
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    paint();
  };
  const paint = () => {
    $("#m-count").textContent = `${items.length} file${items.length === 1 ? "" : "s"}`;
    $("#grid").innerHTML = items.length ? items.map(m => `
      <div class="media-card" data-id="${esc(m.id)}">
        ${m.resourceType === "image" ? `<img src="${esc(img(m.url, 360))}" alt="${esc(m.name || "")}" loading="lazy">` : `<div class="file"><i class="fa-regular fa-file${m.resourceType === "video" ? "-video" : m.format === "pdf" ? "-pdf" : ""}"></i></div>`}
        <div class="meta"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name || m.format)}</span><span>${fileSize(m.bytes || 0)}</span></div>
        <div class="acts"><button class="icon-btn sm" data-copy title="Copy URL"><i class="fa-regular fa-copy"></i></button><a class="icon-btn sm" href="${esc(m.url)}" target="_blank" title="Open"><i class="fa-solid fa-up-right-from-square"></i></a><button class="icon-btn sm danger" data-del title="Remove from library"><i class="fa-regular fa-trash-can"></i></button></div>
      </div>`).join("") : emptyState("fa-regular fa-images", "No files yet.");
  };
  async function upload(files) {
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "card"; row.style.padding = "12px 16px";
      row.innerHTML = `<div class="small" style="display:flex;justify-content:space-between"><span>${esc(file.name)}</span><span data-p>0%</span></div><div class="upload-progress" style="margin-top:8px"><span></span></div>`;
      $("#queue").append(row);
      try {
        await uploadToCloudinary(file, { onProgress: p => { $("[data-p]", row).textContent = p + "%"; $(".upload-progress span", row).style.width = p + "%"; } });
        row.remove();
      } catch (e) { $("[data-p]", row).innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
    }
    toast("Upload finished");
    load();
  }
  const drop = $("#drop");
  $("#files").addEventListener("change", e => upload([...e.target.files]));
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("drag"); }));
  drop.addEventListener("drop", e => upload([...e.dataTransfer.files]));
  view.addEventListener("click", async e => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const m = items.find(x => x.id === card.dataset.id);
    if (e.target.closest("[data-copy]")) { await navigator.clipboard.writeText(m.url); toast("URL copied"); }
    if (e.target.closest("[data-del]") && await confirmDialog("Remove this file from your media library? (It stays in Cloudinary; delete it there to free space.)", { ok: "Remove" })) {
      await fb.deleteDoc(fb.doc(fb.db, "media", m.id)); items = items.filter(x => x !== m); paint();
    }
  });
  load().catch(err => { $("#grid").innerHTML = `<div class="callout warn"><i class="fa-solid fa-triangle-exclamation"></i>${esc(err.message)}</div>`; });
}
