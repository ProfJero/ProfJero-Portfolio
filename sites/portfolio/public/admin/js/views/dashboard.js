// Dashboard: a personal greeting, what needs attention (from alerts), quick actions
// and key numbers — only for the areas this admin is allowed to use.
import { fb, esc, num, emptyState, state, firstName, can } from "../core.js";
import { timeAgo, compact, yearsSince, toDate } from "/assets/js/utils.js";
import { mergeSettings } from "/assets/js/store.js";
import { onAlerts, alertRow, dismiss } from "../alerts.js";

const safe = p => p.catch(() => null);
const cedi = n => `GH₵ ${(Number(n) || 0).toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
let off = null;
export function destroy() { off?.(); off = null; }

function barChart(days) {
  const w = 700, h = 220, pad = 28, bw = (w - pad * 2) / days.length;
  const max = Math.max(5, ...days.map(d => d.visits));
  const y = v => h - pad - (v / max) * (h - pad * 2);
  const ticks = [0, Math.round(max / 2), max];
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Visits over the last ${days.length} days">
    ${ticks.map(t => `<line class="grid-line" x1="${pad}" x2="${w - 8}" y1="${y(t)}" y2="${y(t)}"/><text x="0" y="${y(t) + 4}">${t}</text>`).join("")}
    ${days.map((d, i) => `<g><rect class="bar-rect" x="${pad + i * bw + 3}" y="${y(d.visits)}" width="${Math.max(2, bw - 6)}" height="${Math.max(0, h - pad - y(d.visits))}" rx="4"><title>${d.date}: ${d.visits} visits</title></rect>
      ${i % 2 === 0 ? `<text x="${pad + i * bw + bw / 2}" y="${h - 8}" text-anchor="middle">${d.date.slice(8)}/${d.date.slice(5, 7)}</text>` : ""}</g>`).join("")}
  </svg>`;
}

export async function render(view) {
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
  const [site, daily, posts, msgs, subs, settingsSnap, invoices] = await Promise.all([
    safe(fb.getDoc(fb.doc(fb.db, "stats", "site"))),
    safe(fb.getDocs(fb.query(fb.collection(fb.db, "stats_daily"), fb.where("date", ">=", days[0])))),
    can("blog") ? safe(fb.getDocs(fb.collection(fb.db, "posts"))) : null,
    can("messages") ? safe(fb.getDocs(fb.query(fb.collection(fb.db, "messages"), fb.orderBy("createdAt", "desc"), fb.limit(6)))) : null,
    can("messages") ? safe(fb.getCountFromServer(fb.collection(fb.db, "subscribers"))) : null,
    safe(fb.getDoc(fb.doc(fb.db, "settings", "site"))),
    can("invoices") ? safe(fb.getDocs(fb.query(fb.collection(fb.db, "invoices"), fb.where("status", "in", ["sent", "partial", "paid"])))) : null
  ]);
  const s = mergeSettings(settingsSnap?.exists() ? settingsSnap.data() : {});
  const dmap = Object.fromEntries((daily?.docs || []).map(d => [d.id, d.data().visits || 0]));
  const series = days.map(date => ({ date, visits: dmap[date] || 0 }));
  const postList = (posts?.docs || []).map(d => ({ id: d.id, ...d.data() }));
  const totals = postList.reduce((a, p) => ({ views: a.views + (p.views || 0), likes: a.likes + (p.likes || 0), comments: a.comments + (p.commentCount || 0), shares: a.shares + (p.shares || 0) }), { views: 0, likes: 0, comments: 0, shares: 0 });
  const week = series.slice(-7).reduce((a, d) => a + d.visits, 0);
  const prev = series.slice(0, 7).reduce((a, d) => a + d.visits, 0);
  const trend = prev ? Math.round(((week - prev) / prev) * 100) : 0;
  const now = new Date(), hour = now.getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const inv = (invoices?.docs || []).map(d => d.data());
  const outstanding = inv.filter(i => i.status !== "paid").reduce((t, i) => t + Math.max(0, (Number(i.total) || 0) - (Number(i.amountPaid) || 0)), 0);
  const overdue = inv.filter(i => i.status !== "paid" && i.dueDate && new Date(`${i.dueDate}T23:59`) < now).length;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidMonth = inv.reduce((t, i) => t + (i.payments || []).filter(p => new Date(p.date) >= monthStart).reduce((a, p) => a + (Number(p.amount) || 0), 0), 0);

  const actions = [
    can("invoices") && ['#/invoices/new', "fa-solid fa-file-invoice-dollar", "New invoice"],
    can("clients") && ['#/clientProjects', "fa-solid fa-bars-progress", "Client project"],
    can("blog") && ['#/posts/new', "fa-solid fa-pen-nib", "New blog post"],
    can("portfolio") && ['#/projects', "fa-solid fa-briefcase", "Add portfolio project"],
    can("chat") && ['#/chat', "fa-regular fa-comments", "Client chat"]
  ].filter(Boolean);

  const kpi = (show, c, icon, label, value, sub) => show ? `<div class="kpi" style="--c:${c}"><i class="${icon}"></i><small>${label}</small><strong>${value}</strong><span>${sub}</span></div>` : "";
  view.innerHTML = `
    <section class="hello-card">
      <div><p class="hello-date">${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <h2>${hello}, ${esc(firstName())} <span aria-hidden="true">👋</span></h2>
        <p class="muted">Signed in as <b>${esc(state.access.roleLabel)}</b>${can("portfolio") ? ` · The website shows <b>${yearsSince(s.careerStart)} years</b> of experience (counted from ${esc(s.careerStart)})` : ""}.</p></div>
      <div class="hello-actions">${actions.map(([h, i, l]) => `<a class="quick" href="${h}"><i class="${i}"></i><span>${l}</span></a>`).join("")}</div>
    </section>
    <div class="card attention" id="attention"><div class="card-head"><h3><i class="fa-regular fa-bell" style="color:var(--brand)"></i> Needs your attention</h3><a class="small" href="#/alerts">All alerts &amp; thresholds</a></div><div id="att-list"></div></div>
    <div class="kpis" style="margin-top:18px">
      ${kpi(true, "var(--brand)", "fa-solid fa-users", "Total visits", num(site?.data()?.visits), `${num(week)} this week ${trend ? `<b style="color:${trend > 0 ? "var(--green)" : "var(--red)"}">${trend > 0 ? "▲" : "▼"} ${Math.abs(trend)}%</b>` : ""}`)}
      ${kpi(can("invoices"), "#0D9488", "fa-solid fa-sack-dollar", "Outstanding", cedi(outstanding), `${overdue ? `<b style="color:var(--red)">${overdue} overdue</b> · ` : ""}<a href="#/invoices">Invoices</a>`)}
      ${kpi(can("invoices"), "#16A34A", "fa-solid fa-circle-check", "Paid this month", cedi(paidMonth), `<a href="#/invoices">Record a payment</a>`)}
      ${kpi(can("requests"), "#0A60EE", "fa-regular fa-calendar-check", "Pending bookings", num(state.pendingBookings), `<a href="#/bookings">Manage</a>`)}
      ${kpi(can("requests"), "#7C3AED", "fa-solid fa-file-signature", "New quote requests", num(state.newOrders), `<a href="#/orders">Send quotes</a>`)}
      ${kpi(can("chat"), "#08BC6F", "fa-regular fa-comments", "Unread client chats", num(state.unreadChats), `<a href="#/chat">Reply</a>`)}
      ${kpi(can("messages"), "#D97706", "fa-solid fa-inbox", "Unread messages", num(state.unread), `<a href="#/messages">Open inbox</a>`)}
      ${kpi(can("messages"), "#0891B2", "fa-solid fa-envelope-open-text", "Subscribers", num(subs?.data().count), `<a href="#/subscribers">View list</a>`)}
      ${kpi(can("blog"), "#7C3AED", "fa-regular fa-eye", "Article views", compact(totals.views), `${postList.filter(p => p.status === "published").length} published · ${compact(totals.likes)} likes`)}
    </div>
    ${can("settings") && can("blog") && !postList.length ? `<div class="callout" style="margin-top:18px"><i class="fa-solid fa-wand-magic-sparkles"></i><div><strong>Your database is empty.</strong> The website is showing built-in default content. Go to <a href="#/settings">Settings → Import default content</a> to copy everything into the database so you can edit it.</div></div>` : ""}
    <div class="grid-3" style="margin-top:18px">
      <div class="card"><div class="card-head"><h3>Visitors — last 14 days</h3><span class="muted small">${num(series.reduce((a, d) => a + d.visits, 0))} visits</span></div>${barChart(series)}</div>
      ${can("blog") ? `<div class="card"><div class="card-head"><h3>Top articles</h3><a class="small" href="#/posts">All posts</a></div>
        <div class="list">${[...postList].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map(p => `
          <a class="list-item" href="#/posts/${encodeURIComponent(p.id)}" style="color:inherit"><div class="grow"><div class="title">${esc(p.title)}</div><div class="sub"><i class="fa-regular fa-eye"></i> ${compact(p.views)} · <i class="fa-regular fa-heart"></i> ${compact(p.likes)} · <i class="fa-regular fa-comment"></i> ${compact(p.commentCount)}</div></div></a>`).join("") || emptyState("fa-regular fa-file-lines", "No posts yet.")}</div></div>` : ""}
    </div>
    ${can("messages") ? `<div class="card" style="margin-top:18px"><div class="card-head"><h3>Latest messages</h3><a class="small" href="#/messages">Inbox</a></div>
      <div class="list">${(msgs?.docs || []).map(d => { const m = d.data(); return `
        <a class="list-item" href="#/messages/${d.id}" style="color:inherit"><div class="grow"><div class="title">${m.status === "new" ? '<span class="status new" style="margin-right:6px">New</span>' : ""}${esc(m.name)} <span class="muted small">· ${esc(m.service || m.subject || "General")}</span></div><div class="sub">${esc(m.message)}</div></div><span class="muted small">${timeAgo(m.createdAt)}</span></a>`; }).join("") || emptyState("fa-solid fa-inbox", "No messages yet. Submissions from your contact forms appear here.")}</div></div>` : ""}`;

  off = onAlerts(list => {
    const box = view.querySelector("#att-list");
    if (!box) return;
    box.innerHTML = list.length ? `<div class="alert-list">${list.slice(0, 6).map(a => alertRow(a)).join("")}</div>${list.length > 6 ? `<a class="btn btn-ghost btn-sm" href="#/alerts" style="margin-top:10px">See ${list.length - 6} more</a>` : ""}`
      : `<p class="all-good"><i class="fa-regular fa-circle-check"></i> You're all caught up. Nothing needs your attention right now.</p>`;
  });
  view.addEventListener("click", e => { const s = e.target.closest("[data-snooze]"); if (s) dismiss(s.dataset.snooze); });
}
