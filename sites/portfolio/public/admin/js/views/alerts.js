// Alerts page: everything that's due, overdue or waiting, plus the thresholds that
// decide when an alert appears (Settings permission) and this device's notification prefs.
import { $, $$, esc, toast, can, emptyState } from "../core.js";
import { onAlerts, alertRow, dismiss, getThresholds, saveThresholds, THRESHOLD_FIELDS, DEFAULT_THRESHOLDS, getPrefs, setPrefs } from "../alerts.js";
import { AREAS } from "../nav.js";

let off = null;
export function destroy() { off?.(); off = null; }

export async function render(view) {
  let filter = "all", list = [];
  const t = getThresholds(), p = getPrefs();
  const fields = THRESHOLD_FIELDS.filter(f => can(f.area));
  const notif = "Notification" in window ? Notification.permission : "unsupported";
  view.innerHTML = `
    <div class="grid-2 alerts-layout">
      <section class="card">
        <div class="card-head"><h3>Your alerts</h3><span class="muted small" id="al-count"></span></div>
        <div class="pill-tabs" id="al-tabs" role="tablist"></div>
        <div id="al-list" style="margin-top:12px"></div>
      </section>
      <div>
        <section class="card">
          <div class="card-head"><h3><i class="fa-solid fa-sliders" style="color:var(--brand)"></i> When should I be alerted?</h3>
            <p class="muted small" style="margin:4px 0 0">Change a number to make an alert appear earlier or later. ${can("settings") ? "These apply to every admin." : "Only admins with the Settings permission can change these."}</p></div>
          <form id="th-form" class="th-grid" novalidate>
            ${fields.map(f => `<label class="th-row"><span>${esc(f.label)}</span><span class="th-input"><input type="number" min="0" step="1" name="${f.key}" value="${Number(t[f.key] ?? DEFAULT_THRESHOLDS[f.key])}" ${can("settings") ? "" : "disabled"} inputmode="numeric"><small>${esc(f.unit)}</small></span></label>`).join("") || '<p class="muted small">No alert types apply to your role.</p>'}
            ${can("settings") && fields.length ? `<div class="form-foot"><button class="btn btn-ghost btn-sm" type="button" id="th-reset">Reset to defaults</button><button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save thresholds</button></div>` : ""}
          </form>
        </section>
        <section class="card">
          <div class="card-head"><h3><i class="fa-solid fa-mobile-screen-button" style="color:var(--brand)"></i> On this device</h3></div>
          <label class="switch"><input type="checkbox" id="pf-desktop" ${p.desktop ? "checked" : ""}><span class="track"></span>Pop-up notifications for urgent alerts</label>
          <label class="switch" style="margin-top:10px"><input type="checkbox" id="pf-sound" ${p.sound ? "checked" : ""}><span class="track"></span>Play a sound for new alerts</label>
          <p class="muted small" style="margin:12px 0 0">${notif === "granted" ? '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Notifications are allowed in this browser.' : notif === "denied" ? "Notifications are blocked in this browser. Allow them in the site settings (padlock icon) to get pop-ups." : notif === "unsupported" ? "This browser doesn't support notifications." : '<button class="btn btn-ghost btn-sm" type="button" id="pf-allow"><i class="fa-regular fa-bell"></i> Allow notifications</button>'}</p>
          <p class="muted small" style="margin:10px 0 0">Alerts appear while the admin is open (in a tab or the installed app).</p>
        </section>
      </div>
    </div>`;

  const paint = () => {
    const areas = [...new Set(list.map(a => a.area))];
    $("#al-tabs").innerHTML = [["all", `All`], ...areas.map(a => [a, AREAS[a]?.label || a])].map(([k, l]) => `<button type="button" class="${filter === k ? "active" : ""}" data-f="${k}">${esc(l)}<span>${k === "all" ? list.length : list.filter(a => a.area === k).length}</span></button>`).join("");
    const shown = list.filter(a => filter === "all" || a.area === filter);
    $("#al-count").textContent = `${list.filter(a => a.level === "danger").length} urgent · ${list.filter(a => a.level === "warning").length} soon · ${list.filter(a => a.level === "info").length} FYI`;
    $("#al-list").innerHTML = shown.length ? `<div class="alert-list">${shown.map(a => alertRow(a)).join("")}</div>` : emptyState("fa-regular fa-circle-check", "All caught up. Nothing needs your attention.");
  };
  off = onAlerts(a => { list = a; if (!list.some(x => x.area === filter)) filter = "all"; paint(); });

  view.addEventListener("click", e => {
    const f = e.target.closest("[data-f]"); if (f) { filter = f.dataset.f; paint(); return; }
    const s = e.target.closest("[data-snooze]"); if (s) { dismiss(s.dataset.snooze); toast("Snoozed for a day"); return; }
    if (e.target.closest("#pf-allow")) Notification.requestPermission().then(() => render(view));
    if (e.target.closest("#th-reset")) $$("#th-form input").forEach(i => { i.value = DEFAULT_THRESHOLDS[i.name]; });
  });
  $("#pf-desktop").addEventListener("change", e => setPrefs({ desktop: e.target.checked }));
  $("#pf-sound").addEventListener("change", e => setPrefs({ sound: e.target.checked }));
  $("#th-form").addEventListener("submit", async e => {
    e.preventDefault();
    const next = {};
    $$("#th-form input").forEach(i => { next[i.name] = Math.max(0, Math.round(Number(i.value) || 0)); });
    try { await saveThresholds({ ...getThresholds(), ...next }); toast("Alert thresholds saved"); }
    catch (err) { toast(err.message, "error"); }
  });
}
