import { $, $$, fb, esc, emptyState, confirmDialog, toast, uploadToCloudinary, fileSize, fmtDate } from "../core.js";
import { img } from "/assets/js/utils.js";

export async function render(view) {
  let items = [], q = "", kind = "all";
  view.innerHTML = `
    <label class="dropzone up-zone" id="drop">
      <span class="up-ico"><i class="fa-solid fa-cloud-arrow-up"></i></span>
      <span class="up-text"><b>Drag &amp; drop files here</b><span>or choose them from your device</span></span>
      <span class="btn btn-primary up-btn"><i class="fa-solid fa-plus"></i> Choose files</span>
      <span class="up-types"><span><i class="fa-regular fa-image"></i> Images</span><span><i class="fa-regular fa-file-video"></i> Videos</span><span><i class="fa-regular fa-file-pdf"></i> PDFs</span><span>Up to 25 MB each</span></span>
      <input type="file" id="files" multiple hidden accept="image/*,video/*,application/pdf"></label>
    <div id="queue" class="up-queue"></div>
    <div class="toolbar media-tools"><label class="search"><i class="fa-solid fa-magnifying-glass"></i><input id="m-q" type="search" placeholder="Search files"></label>
      <div class="pill-tabs" id="m-kind">${[["all", "All"], ["image", "Images"], ["video", "Videos"], ["raw", "Documents"]].map(([k, l]) => `<button data-kind="${k}" class="${k === "all" ? "active" : ""}">${l}</button>`).join("")}</div>
      <span class="muted small" id="m-count" style="margin-left:auto"></span></div>
    <div class="media-grid" id="grid"></div>`;
  const load = async () => {
    const snap = await fb.getDocs(fb.query(fb.collection(fb.db, "media"), fb.orderBy("createdAt", "desc"), fb.limit(300)));
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    paint();
  };
  const paint = () => {
    const list = items.filter(m => (kind === "all" || (kind === "raw" ? !["image", "video"].includes(m.resourceType) : m.resourceType === kind)) && (!q || `${m.name} ${m.format}`.toLowerCase().includes(q)));
    $("#m-count").textContent = `${list.length} of ${items.length} file${items.length === 1 ? "" : "s"}`;
    $("#grid").innerHTML = list.length ? list.map(m => `
      <div class="media-card" data-id="${esc(m.id)}">
        ${m.resourceType === "image" ? `<img src="${esc(img(m.url, 360))}" alt="${esc(m.name || "")}" loading="lazy">` : `<div class="file"><i class="fa-regular fa-file${m.resourceType === "video" ? "-video" : m.format === "pdf" ? "-pdf" : ""}"></i></div>`}
        <div class="meta"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name || m.format)}</span><span>${fileSize(m.bytes || 0)}</span></div>
        <div class="acts"><button class="icon-btn sm" data-copy title="Copy URL"><i class="fa-regular fa-copy"></i></button><a class="icon-btn sm" href="${esc(m.url)}" target="_blank" title="Open"><i class="fa-solid fa-up-right-from-square"></i></a><button class="icon-btn sm danger" data-del title="Remove from library"><i class="fa-regular fa-trash-can"></i></button></div>
      </div>`).join("") : emptyState("fa-regular fa-images", items.length ? "No files match." : "No files yet. Upload your first one above.");
  };
  async function upload(files) {
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "up-row";
      row.innerHTML = `<span class="up-row-i"><i class="fa-regular fa-file${file.type.startsWith("image/") ? "-image" : file.type.startsWith("video/") ? "-video" : "-pdf"}"></i></span><div style="flex:1;min-width:0"><div class="small" style="display:flex;justify-content:space-between;gap:10px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(file.name)}</span><span data-p>0%</span></div><div class="upload-progress" style="margin-top:8px"><span></span></div></div>`;
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
  $("#m-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); paint(); });
  view.addEventListener("click", async e => {
    const k = e.target.closest("[data-kind]");
    if (k) { kind = k.dataset.kind; $$("#m-kind button").forEach(b => b.classList.toggle("active", b === k)); paint(); return; }
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
