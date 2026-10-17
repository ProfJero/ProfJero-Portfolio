// Single source of truth for the admin: every screen, which website it belongs to
// (scope), which permission it needs, and how the sidebar groups them.
// Permission areas are enforced again on the server by firestore.rules → can(area).

export const SCOPES = {
  hub: { label: "Hub", title: "ProfJero Hub (profjerohub.pages.dev)" },
  portfolio: { label: "Portfolio", title: "ProfJero portfolio (profjero.pages.dev)" },
  both: { label: "Both", title: "Used by both websites" }
};

export const AREAS = {
  blog: { label: "Blog", icon: "fa-solid fa-pen-nib", desc: "Write, publish and moderate blog posts and comments" },
  portfolio: { label: "Portfolio website", icon: "fa-solid fa-id-card", desc: "Profile & site, pricing, projects, skills, experience, team, testimonials" },
  hub: { label: "Hub website", icon: "fa-solid fa-cubes", desc: "Hub homepage, studios & services, branded products" },
  requests: { label: "Bookings & quotes", icon: "fa-regular fa-calendar-check", desc: "Confirm bookings, send quotes and update orders" },
  clients: { label: "Clients & projects", icon: "fa-solid fa-user-group", desc: "Client list, client projects and client testimonials" },
  invoices: { label: "Invoices", icon: "fa-solid fa-file-invoice-dollar", desc: "Create, send and record payments on invoices" },
  chat: { label: "Client chat", icon: "fa-regular fa-comments", desc: "Read and reply to client chats" },
  messages: { label: "Inbox & subscribers", icon: "fa-solid fa-inbox", desc: "Contact-form messages and newsletter subscribers" },
  media: { label: "Media library", icon: "fa-regular fa-images", desc: "Manage uploaded images, videos and files" },
  settings: { label: "Settings", icon: "fa-solid fa-sliders", desc: "Integrations, alert thresholds, import & backup" }
};

export const ROLES = {
  full: { label: "Full admin", desc: "Everything except managing admins", perms: Object.keys(AREAS) },
  editor: { label: "Content editor", desc: "Blog, both websites' content and media", perms: ["blog", "portfolio", "hub", "media"] },
  manager: { label: "Hub manager", desc: "Bookings, quotes, clients, invoices, chat and the inbox", perms: ["requests", "clients", "invoices", "chat", "messages", "hub", "media"] },
  support: { label: "Support agent", desc: "Client chat, inbox and bookings", perms: ["chat", "messages", "requests"] },
  accounts: { label: "Accounts", desc: "Invoices and the client list", perms: ["invoices", "clients"] },
  custom: { label: "Custom", desc: "Pick exactly what they can do", perms: [] }
};

// perm: null = any admin; "owner" = super admin only.
export const NAV = [
  { id: "overview", label: "Overview", icon: "fa-solid fa-house", items: [
    { key: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line", scope: "both", perm: null },
    { key: "alerts", label: "Alerts", icon: "fa-regular fa-bell", scope: "both", perm: null, badge: "alerts" },
    { key: "messages", label: "Inbox", icon: "fa-solid fa-inbox", scope: "both", perm: "messages", badge: "messages" }
  ] },
  { id: "sales", label: "Clients & sales", icon: "fa-solid fa-handshake", items: [
    { key: "bookings", label: "Bookings", icon: "fa-regular fa-calendar-check", scope: "hub", perm: "requests", badge: "bookings" },
    { key: "orders", label: "Quotes & orders", icon: "fa-solid fa-file-signature", scope: "hub", perm: "requests", badge: "orders" },
    { key: "invoices", label: "Invoices", icon: "fa-solid fa-file-invoice-dollar", scope: "both", perm: "invoices", badge: "invoices" },
    { key: "clientProjects", label: "Client projects", icon: "fa-solid fa-bars-progress", scope: "hub", perm: "clients" },
    { key: "clients", label: "Clients", icon: "fa-solid fa-user-group", scope: "hub", perm: "clients" },
    { key: "chat", label: "Client chat", icon: "fa-regular fa-comments", scope: "hub", perm: "chat", badge: "chat" },
    { key: "reviews", label: "Client testimonials", icon: "fa-regular fa-star", scope: "both", perm: "clients", badge: "reviews" }
  ] },
  { id: "hubsite", label: "Hub website", icon: "fa-solid fa-cubes", items: [
    { key: "hub", label: "Hub homepage", icon: "fa-solid fa-cubes", scope: "hub", perm: "hub" },
    { key: "studios", label: "Studios & services", icon: "fa-solid fa-building", scope: "both", perm: "hub" },
    { key: "products", label: "Branded products", icon: "fa-solid fa-gift", scope: "hub", perm: "hub" }
  ] },
  { id: "portfolio", label: "Portfolio website", icon: "fa-solid fa-id-card", items: [
    { key: "profile", label: "Profile, pricing & site", icon: "fa-solid fa-id-card", scope: "both", perm: "portfolio" },
    { key: "projects", label: "Projects & demos", icon: "fa-solid fa-briefcase", scope: "both", perm: "portfolio" },
    { key: "skills", label: "Skills", icon: "fa-solid fa-bolt", scope: "portfolio", perm: "portfolio" },
    { key: "experience", label: "Experience", icon: "fa-solid fa-timeline", scope: "portfolio", perm: "portfolio" },
    { key: "team", label: "Team", icon: "fa-solid fa-people-group", scope: "portfolio", perm: "portfolio" },
    { key: "testimonials", label: "Testimonials", icon: "fa-solid fa-quote-left", scope: "both", perm: "portfolio" }
  ] },
  { id: "blog", label: "Blog", icon: "fa-solid fa-pen-nib", items: [
    { key: "posts", label: "Blog posts", icon: "fa-solid fa-pen-nib", scope: "both", perm: "blog" },
    { key: "comments", label: "Blog comments", icon: "fa-regular fa-message", scope: "both", perm: "blog" }
  ] },
  { id: "system", label: "Media & settings", icon: "fa-solid fa-gear", items: [
    { key: "media", label: "Media library", icon: "fa-regular fa-images", scope: "both", perm: "media" },
    { key: "subscribers", label: "Subscribers", icon: "fa-solid fa-users", scope: "both", perm: "messages" },
    { key: "admins", label: "Admins & roles", icon: "fa-solid fa-user-shield", scope: "both", perm: "owner" },
    { key: "settings", label: "Settings", icon: "fa-solid fa-sliders", scope: "both", perm: "settings" },
    { key: "account", label: "My account", icon: "fa-solid fa-user-gear", scope: "both", perm: null }
  ] }
];

export const ITEMS = Object.fromEntries(NAV.flatMap(g => g.items.map(i => [i.key, { ...i, group: g.id }])));

/** What the signed-in admin may do. `rec` is their /admins/{email} document. */
export function accessFor(email, ownerEmail, rec) {
  if (email === ownerEmail) return { owner: true, role: "owner", roleLabel: "Super admin", perms: new Set(Object.keys(AREAS)), name: rec?.name || "" };
  const role = rec?.role === "admin" || !rec?.role ? "full" : rec.role;
  // Same logic as firestore.rules can(): "full" has every area, other roles use their saved perms map.
  const perms = role === "full" ? Object.keys(AREAS) : Object.keys(rec?.perms || {}).filter(k => rec.perms[k] === true);
  return { owner: false, role, roleLabel: ROLES[role]?.label || "Admin", perms: new Set(perms), name: rec?.name || "" };
}

export const allowed = (access, item) => !item || item.perm === null || (item.perm === "owner" ? access.owner : access.perms.has(item.perm));
