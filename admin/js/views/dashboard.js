import { $, fb, esc, num, fmtDate, emptyState, state } from "../core.js";
import { timeAgo, compact, yearsSince } from "/assets/js/utils.js";
import { mergeSettings } from "/assets/js/store.js";

const safe = p => p.catch(() => null);

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
  const [site, daily, posts, msgs, subs, settingsSnap, comments] = await Promise.all([
    safe(fb.getDoc(fb.doc(fb.db, "stats", "site"))),
    safe(fb.getDocs(fb.query(fb.collection(fb.db, "stats_daily"), fb.where("date", ">=", days[0])))),
    safe(fb.getDocs(fb.collection(fb.db, "posts"))),
    safe(fb.getDocs(fb.query(fb.collection(fb.db, "messages"), fb.orderBy("createdAt", "desc"), fb.limit(6)))),
    safe(fb.getCountFromServer(fb.collection(fb.db, "subscribers"))),
    safe(fb.getDoc(fb.doc(fb.db, "settings", "site"))),
    safe(fb.getDocs(fb.collectionGroup(fb.db, "comments")))
  ]);
  const s = mergeSettings(settingsSnap?.exists() ? settingsSnap.data() : {});
  const dmap = Object.fromEntries((daily?.docs || []).map(d => [d.id, d.data().visits || 0]));
  const series = days.map(date => ({ date, visits: dmap[date] || 0 }));
  const postList = (posts?.docs || []).map(d => ({ id: d.id, ...d.data() }));
  const totals = postList.reduce((a, p) => ({ views: a.views + (p.views || 0), likes: a.likes + (p.likes || 0), comments: a.comments + (p.commentCount || 0), shares: a.shares + (p.shares || 0) }), { views: 0, likes: 0, comments: 0, shares: 0 });
  const recentComments = (comments?.docs || []).map(d => ({ id: d.id, post: d.ref.parent.parent.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 6);
  const week = series.slice(-7).reduce((a, d) => a + d.visits, 0);
  const prev = series.slice(0, 7).reduce((a, d) => a + d.visits, 0);
  const trend = prev ? Math.round(((week - prev) / prev) * 100) : 0;
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  view.innerHTML = `
    <div class="card-head" style="margin-bottom:20px"><h2 style="font-size:1.4rem">${hello}, ${esc((state.user.displayName || "Admin").split(" ")[0])} 👋</h2>
      <a class="btn btn-primary btn-sm" href="#/posts/new"><i class="fa-solid fa-plus"></i> New post</a>
      <a class="btn btn-ghost btn-sm" href="#/projects"><i class="fa-solid fa-briefcase"></i> Add project</a>
      <p>Here's what's happening on your website. Experience shown on the site right now: <b>${yearsSince(s.careerStart)} years</b> (auto-calculated from ${esc(s.careerStart)}).</p></div>
    <div class="kpis">
      <div class="kpi" style="--c:var(--brand)"><i class="fa-solid fa-users"></i><small>Total visits</small><strong>${num(site?.data()?.visits)}</strong><span>${num(week)} this week ${trend ? `<b style="color:${trend > 0 ? "var(--green)" : "var(--red)"}">${trend > 0 ? "▲" : "▼"} ${Math.abs(trend)}%</b>` : ""}</span></div>
      <div class="kpi" style="--c:#7C3AED"><i class="fa-regular fa-eye"></i><small>Article views</small><strong>${compact(totals.views)}</strong><span>${postList.filter(p => p.status === "published").length} published posts</span></div>
      <div class="kpi" style="--c:var(--red)"><i class="fa-regular fa-heart"></i><small>Likes</small><strong>${compact(totals.likes)}</strong><span>${compact(totals.shares)} shares</span></div>
      <div class="kpi" style="--c:var(--green)"><i class="fa-regular fa-comments"></i><small>Comments</small><strong>${compact(totals.comments)}</strong><span><a href="#/comments">Moderate</a></span></div>
      <div class="kpi" style="--c:#D97706"><i class="fa-solid fa-inbox"></i><small>Unread messages</small><strong>${num(state.unread)}</strong><span><a href="#/messages">Open inbox</a></span></div>
      <div class="kpi" style="--c:#0891B2"><i class="fa-solid fa-envelope-open-text"></i><small>Subscribers</small><strong>${num(subs?.data().count)}</strong><span><a href="#/subscribers">View list</a></span></div>
    </div>
    ${postList.length ? "" : `<div class="callout" style="margin-bottom:18px"><i class="fa-solid fa-wand-magic-sparkles"></i><div><strong>Your database is empty.</strong> The website is currently showing built-in default content. Go to <a href="#/settings">Settings → Import default content</a> to copy everything (profile, projects, studios, 9 blog posts…) into Firestore so you can edit it and enable likes & comments.</div></div>`}
    <div class="grid-3">
      <div class="card"><div class="card-head"><h3>Visitors — last 14 days</h3><span class="muted small">${num(series.reduce((a, d) => a + d.visits, 0))} visits</span></div>${barChart(series)}</div>
      <div class="card"><div class="card-head"><h3>Top articles</h3><a class="small" href="#/posts">All posts</a></div>
        <div class="list">${postList.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map(p => `
          <a class="list-item" href="#/posts/${encodeURIComponent(p.id)}" style="color:inherit"><div class="grow"><div class="title">${esc(p.title)}</div><div class="sub"><i class="fa-regular fa-eye"></i> ${compact(p.views)} · <i class="fa-regular fa-heart"></i> ${compact(p.likes)} · <i class="fa-regular fa-comment"></i> ${compact(p.commentCount)}</div></div></a>`).join("") || emptyState("fa-regular fa-file-lines", "No posts yet.")}</div></div>
    </div>
    <div class="grid-2" style="margin-top:18px">
      <div class="card"><div class="card-head"><h3>Latest messages</h3><a class="small" href="#/messages">Inbox</a></div>
        <div class="list">${(msgs?.docs || []).map(d => { const m = d.data(); return `
          <a class="list-item" href="#/messages/${d.id}" style="color:inherit"><div class="grow"><div class="title">${m.status === "new" ? '<span class="status new" style="margin-right:6px">New</span>' : ""}${esc(m.name)} <span class="muted small">· ${esc(m.service || m.subject || "General")}</span></div><div class="sub">${esc(m.message)}</div></div><span class="muted small">${timeAgo(m.createdAt)}</span></a>`; }).join("") || emptyState("fa-solid fa-inbox", "No messages yet. Submissions from your contact forms appear here.")}</div></div>
      <div class="card"><div class="card-head"><h3>Recent comments</h3><a class="small" href="#/comments">Moderate</a></div>
        <div class="list">${recentComments.map(c => `
          <a class="list-item" href="/blog/${encodeURIComponent(c.post)}#c-${esc(c.id)}" target="_blank" style="color:inherit"><div class="grow"><div class="title">${esc(c.name)} <span class="muted small">on ${esc(c.post)}</span></div><div class="sub">${esc(c.deleted ? "[deleted]" : c.text)}</div></div><span class="muted small">${timeAgo(c.createdAt)}</span></a>`).join("") || emptyState("fa-regular fa-comments", "No comments yet.")}</div></div>
    </div>`;
}
