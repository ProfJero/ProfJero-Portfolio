// Firestore security rules tests.
// Run:  npm i -D firebase-tools @firebase/rules-unit-testing firebase
//       npx firebase emulators:exec --only firestore "node tests/rules.test.mjs"
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, increment, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "jerohub-1",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 }
});

const owner = env.authenticatedContext("owner", { email: "profjero947@gmail.com", email_verified: true }).firestore();
const fakeOwner = env.authenticatedContext("fake", { email: "profjero947@gmail.com", email_verified: false }).firestore();
const alice = env.authenticatedContext("alice").firestore();
const bob = env.authenticatedContext("bob").firestore();
const anon = env.unauthenticatedContext().firestore();

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; }
}

await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, "posts/hello"), { title: "Hello", status: "published", views: 0, likes: 0, shares: 0, commentCount: 0 });
  await setDoc(doc(db, "posts/secret"), { title: "Draft", status: "draft", views: 0 });
  await setDoc(doc(db, "settings/site"), { name: "x" });
  await setDoc(doc(db, "messages/m1"), { name: "A", email: "a@b.co", message: "hi", status: "new" });
});

console.log("Content");
await t("anyone reads settings", () => assertSucceeds(getDoc(doc(anon, "settings/site"))));
await t("visitor cannot write settings", () => assertFails(setDoc(doc(alice, "settings/site"), { name: "hack" })));
await t("owner writes settings", () => assertSucceeds(setDoc(doc(owner, "settings/site"), { name: "Benjamin" }, { merge: true })));
await t("unverified owner email is rejected", () => assertFails(setDoc(doc(fakeOwner, "settings/site"), { name: "x" })));
await t("visitor cannot write projects", () => assertFails(setDoc(doc(alice, "projects/p"), { title: "x" })));
await t("anyone reads team", () => assertSucceeds(getDoc(doc(anon, "team/benjamin"))));
await t("visitor cannot edit team", () => assertFails(setDoc(doc(alice, "team/benjamin"), { name: "x" })));
await t("owner edits team", () => assertSucceeds(setDoc(doc(owner, "team/benjamin"), { name: "Benjamin" })));
await t("private config hidden from public", () => assertFails(getDoc(doc(anon, "private/integrations"))));
await t("owner reads private config", () => assertSucceeds(getDoc(doc(owner, "private/integrations"))));

console.log("Posts");
await t("published post readable", () => assertSucceeds(getDoc(doc(anon, "posts/hello"))));
await t("draft hidden from public", () => assertFails(getDoc(doc(anon, "posts/secret"))));
await t("published query allowed", () => assertSucceeds(getDocs(query(collection(anon, "posts"), where("status", "==", "published")))));
await t("unfiltered list denied", () => assertFails(getDocs(collection(anon, "posts"))));
await t("view +1 allowed", () => assertSucceeds(updateDoc(doc(anon, "posts/hello"), { views: increment(1) })));
await t("view +5 denied", () => assertFails(updateDoc(doc(anon, "posts/hello"), { views: increment(5) })));
await t("cannot edit title", () => assertFails(updateDoc(doc(alice, "posts/hello"), { title: "pwned" })));
await t("share +1 allowed", () => assertSucceeds(updateDoc(doc(anon, "posts/hello"), { shares: increment(1) })));

console.log("Likes");
const like = (db, uid, on) => { const b = writeBatch(db); const r = doc(db, `posts/hello/likes/${uid}`); on ? b.set(r, { createdAt: serverTimestamp() }) : b.delete(r); b.update(doc(db, "posts/hello"), { likes: increment(on ? 1 : -1) }); return b.commit(); };
await t("alice likes", () => assertSucceeds(like(alice, "alice", true)));
await t("alice cannot like twice", () => assertFails(like(alice, "alice", true)));
await t("counter bump without like doc denied", () => assertFails(updateDoc(doc(bob, "posts/hello"), { likes: increment(1) })));
await t("bob cannot like as alice", () => assertFails(setDoc(doc(bob, "posts/hello/likes/alice"), { createdAt: serverTimestamp() })));
await t("alice unlikes", () => assertSucceeds(like(alice, "alice", false)));

console.log("Comments");
const comment = (db, uid, id, extra = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, `posts/hello/comments/${id}`), { uid, name: "Alice", photo: "", text: "Great post!", parentId: null, likes: 0, pinned: false, isAuthor: false, deleted: false, createdAt: serverTimestamp(), ...extra });
  b.update(doc(db, "posts/hello"), { commentCount: increment(1), lastCommentId: id });
  return b.commit();
};
await t("signed-in visitor comments", () => assertSucceeds(comment(alice, "alice", "c1")));
await t("anonymous (no auth) cannot comment", () => assertFails(comment(anon, "x", "c2")));
await t("cannot impersonate uid", () => assertFails(comment(bob, "alice", "c3")));
await t("visitor cannot fake author badge", () => assertFails(comment(bob, "bob", "c4", { isAuthor: true })));
await t("visitor cannot pre-like / pin", () => assertFails(comment(bob, "bob", "c5", { likes: 99 })));
await t("owner can post as author", () => assertSucceeds(comment(owner, "owner", "c6", { isAuthor: true })));
await t("bump commentCount without comment denied", () => assertFails(updateDoc(doc(bob, "posts/hello"), { commentCount: increment(1), lastCommentId: "nope" })));
await t("bob cannot delete alice's comment", () => assertFails(deleteDoc(doc(bob, "posts/hello/comments/c1"))));
await t("bob cannot pin", () => assertFails(updateDoc(doc(bob, "posts/hello/comments/c1"), { pinned: true })));
await t("bob likes alice's comment", async () => {
  const b = writeBatch(bob);
  b.set(doc(bob, "posts/hello/comments/c1/likes/bob"), { createdAt: serverTimestamp() });
  b.update(doc(bob, "posts/hello/comments/c1"), { likes: increment(1) });
  await assertSucceeds(b.commit());
});
await t("alice deletes own comment (count -1)", async () => {
  const b = writeBatch(alice);
  b.delete(doc(alice, "posts/hello/comments/c1"));
  b.update(doc(alice, "posts/hello"), { commentCount: increment(-1), lastCommentId: "c1" });
  await assertSucceeds(b.commit());
});
await t("comment on draft denied", async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, "posts/secret/comments/z"), { uid: "alice", name: "Alice", photo: "", text: "hi there", parentId: null, likes: 0, pinned: false, isAuthor: false, deleted: false, createdAt: serverTimestamp() });
  await assertFails(b.commit());
});

console.log("Messages & subscribers");
const msg = { name: "Kofi Mensah", email: "kofi@example.com", phone: "", service: "Web Development", budget: "", subject: "", message: "I need a website.", source: "portfolio", page: "https://profjero.pages.dev/", status: "new", createdAt: serverTimestamp() };
await t("visitor sends contact form", () => assertSucceeds(setDoc(doc(anon, "messages/new1"), msg)));
await t("invalid email rejected", () => assertFails(setDoc(doc(anon, "messages/new2"), { ...msg, email: "nope" })));
await t("cannot pre-mark as replied", () => assertFails(setDoc(doc(anon, "messages/new3"), { ...msg, status: "replied" })));
await t("unknown fields rejected", () => assertFails(setDoc(doc(anon, "messages/new4"), { ...msg, admin: true })));
await t("visitor cannot read messages", () => assertFails(getDoc(doc(anon, "messages/m1"))));
await t("owner reads messages", () => assertSucceeds(getDoc(doc(owner, "messages/m1"))));
await t("subscribe", () => assertSucceeds(setDoc(doc(anon, "subscribers/kofi@example.com"), { email: "kofi@example.com", source: "portfolio", page: "/", createdAt: serverTimestamp() })));
await t("cannot overwrite subscriber", () => assertFails(setDoc(doc(anon, "subscribers/kofi@example.com"), { email: "kofi@example.com", source: "x", page: "/", createdAt: serverTimestamp() })));
await t("cannot read subscribers", () => assertFails(getDoc(doc(anon, "subscribers/kofi@example.com"))));

console.log("Admins & stats");
await t("visitor cannot make self admin", () => assertFails(setDoc(doc(alice, "admins/alice@x.com"), { role: "admin" })));
await t("owner adds admin", () => assertSucceeds(setDoc(doc(owner, "admins/editor@gmail.com"), { role: "admin" })));
const editor = env.authenticatedContext("ed", { email: "editor@gmail.com", email_verified: true }).firestore();
await t("added admin can edit content", () => assertSucceeds(setDoc(doc(editor, "projects/new"), { title: "New" })));
await t("added admin cannot add admins", () => assertFails(setDoc(doc(editor, "admins/x@gmail.com"), { role: "admin" })));
await t("visit counter create =1", () => assertSucceeds(setDoc(doc(anon, "stats/site"), { visits: increment(1) }, { merge: true })));
await t("visit counter +1", () => assertSucceeds(setDoc(doc(anon, "stats/site"), { visits: increment(1) }, { merge: true })));
await t("visit counter +100 denied", () => assertFails(setDoc(doc(anon, "stats/site"), { visits: increment(100) }, { merge: true })));
await t("stats hidden from public", () => assertFails(getDoc(doc(anon, "stats/site"))));

console.log("Hub: bookings");
const booking = (extra = {}) => ({ ref: "PJB7K2M9QX", studio: "digital-studio", studioName: "Digital Studio", service: "Web Development", mode: "remote", date: "2026-11-02", time: "10:00", name: "Kofi Mensah", email: "kofi@example.com", phone: "0531207256", company: "", notes: "Need a site", uid: null, status: "pending", source: "hub", createdAt: serverTimestamp(), ...extra });
await t("guest books", () => assertSucceeds(setDoc(doc(anon, "bookings/PJB7K2M9QX"), booking())));
await t("guest tracks by ref", () => assertSucceeds(getDoc(doc(anon, "bookings/PJB7K2M9QX"))));
await t("guest cannot list bookings", () => assertFails(getDocs(collection(anon, "bookings"))));
await t("cannot pre-confirm booking", () => assertFails(setDoc(doc(anon, "bookings/PJBAAAAAAA"), booking({ ref: "PJBAAAAAAA", status: "confirmed" }))));
await t("ref must match id", () => assertFails(setDoc(doc(anon, "bookings/PJBBBBBBBB"), booking({ ref: "OTHER12345" }))));
await t("cannot book as someone else's uid", () => assertFails(setDoc(doc(bob, "bookings/PJBCCCCCCC"), booking({ ref: "PJBCCCCCCC", uid: "alice" }))));
await t("alice books with account", () => assertSucceeds(setDoc(doc(alice, "bookings/PJBDDDDDDD"), booking({ ref: "PJBDDDDDDD", uid: "alice" }))));
await t("alice lists own bookings", () => assertSucceeds(getDocs(query(collection(alice, "bookings"), where("uid", "==", "alice")))));
await t("bob cannot list alice's", () => assertFails(getDocs(query(collection(bob, "bookings"), where("uid", "==", "alice")))));
const kofi = env.authenticatedContext("kofi", { email: "kofi@example.com", email_verified: true }).firestore();
await t("verified email sees guest bookings", () => assertSucceeds(getDocs(query(collection(kofi, "bookings"), where("email", "==", "kofi@example.com")))));
await t("alice cancels own booking", () => assertSucceeds(updateDoc(doc(alice, "bookings/PJBDDDDDDD"), { status: "cancelled", updatedAt: serverTimestamp() })));
await t("client cannot confirm", () => assertFails(updateDoc(doc(kofi, "bookings/PJB7K2M9QX"), { status: "confirmed" })));
await t("bob cannot cancel others", () => assertFails(updateDoc(doc(bob, "bookings/PJB7K2M9QX"), { status: "cancelled" })));
await t("admin confirms", () => assertSucceeds(updateDoc(doc(owner, "bookings/PJB7K2M9QX"), { status: "confirmed", adminNote: "See you" })));

console.log("Hub: orders");
const order = (extra = {}) => ({ ref: "PJO4R8T2LV", productId: "custom-mugs", product: "Custom Mugs", category: "Drinkware", quantity: 50, method: "Sublimation", colors: "2", artworkUrl: "", deadline: "2026-11-20", budget: "", name: "Ama Owusu", email: "ama@example.com", phone: "", company: "Ama Ltd", notes: "", uid: "alice", status: "requested", source: "hub", createdAt: serverTimestamp(), ...extra });
await t("client requests quote", () => assertSucceeds(setDoc(doc(alice, "orders/PJO4R8T2LV"), order())));
await t("quantity must be int", () => assertFails(setDoc(doc(alice, "orders/PJO4R8T2LX"), order({ ref: "PJO4R8T2LX", quantity: "50" }))));
await t("client cannot set quote amount", () => assertFails(updateDoc(doc(alice, "orders/PJO4R8T2LV"), { quoteAmount: 1 })));
await t("client cannot approve before quote", () => assertFails(updateDoc(doc(alice, "orders/PJO4R8T2LV"), { status: "approved" })));
await t("admin quotes", () => assertSucceeds(updateDoc(doc(owner, "orders/PJO4R8T2LV"), { status: "quoted", quoteAmount: 1500 })));
await t("client approves quote", () => assertSucceeds(updateDoc(doc(alice, "orders/PJO4R8T2LV"), { status: "approved", updatedAt: serverTimestamp() })));
await t("client cannot mark delivered", () => assertFails(updateDoc(doc(alice, "orders/PJO4R8T2LV"), { status: "delivered" })));

console.log("Hub: portal");
await t("alice creates profile", () => assertSucceeds(setDoc(doc(alice, "users/alice"), { name: "Alice", email: "a@x.com", phone: "", company: "", createdAt: serverTimestamp() })));
await t("cannot set role", () => assertFails(setDoc(doc(alice, "users/alice"), { name: "Alice", role: "admin" })));
await t("bob cannot read alice profile", () => assertFails(getDoc(doc(bob, "users/alice"))));
await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "clientProjects/p1"), { uid: "alice", title: "School site", progress: 40 }); });
await t("alice reads her project", () => assertSucceeds(getDoc(doc(alice, "clientProjects/p1"))));
await t("bob cannot read alice project", () => assertFails(getDoc(doc(bob, "clientProjects/p1"))));
await t("alice cannot edit project", () => assertFails(updateDoc(doc(alice, "clientProjects/p1"), { progress: 100 })));
await t("alice opens thread", () => assertSucceeds(setDoc(doc(alice, "threads/alice"), { uid: "alice", name: "Alice", email: "a@x.com", lastMessage: "Hi", lastAt: serverTimestamp(), lastFrom: "client", unreadAdmin: 1, unreadClient: 0 })));
await t("alice sends message", () => assertSucceeds(setDoc(doc(alice, "threads/alice/messages/m1"), { from: "client", text: "Hello", name: "Alice", createdAt: serverTimestamp() })));
await t("alice cannot fake admin message", () => assertFails(setDoc(doc(alice, "threads/alice/messages/m2"), { from: "admin", text: "Paid", createdAt: serverTimestamp() })));
await t("bob cannot read alice thread", () => assertFails(getDocs(collection(bob, "threads/alice/messages"))));
await t("admin replies", () => assertSucceeds(setDoc(doc(owner, "threads/alice/messages/m3"), { from: "admin", text: "Hi Alice", createdAt: serverTimestamp() })));
await t("anyone reads products", () => assertSucceeds(getDocs(collection(anon, "products"))));
await t("visitor cannot add product", () => assertFails(setDoc(doc(alice, "products/x"), { name: "x" })));

console.log("Hub: client testimonials");
const review = (extra = {}) => ({ uid: "kofi", email: "kofi@example.com", name: "Kofi Mensah", role: "Head, Bright Future School", text: "ProfJero built our school system on time and trained our staff well.", rating: 5, studio: "digital-studio", photo: "", status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
const unverified = env.authenticatedContext("ama", { email: "ama@example.com", email_verified: false }).firestore();
await t("verified client submits testimonial", () => assertSucceeds(setDoc(doc(kofi, "reviews/kofi"), review())));
await t("unverified client cannot submit", () => assertFails(setDoc(doc(unverified, "reviews/ama"), review({ uid: "ama", email: "ama@example.com" }))));
await t("anonymous cannot submit", () => assertFails(setDoc(doc(anon, "reviews/anon"), review({ uid: "anon" }))));
await t("cannot self-approve", () => assertFails(setDoc(doc(kofi, "reviews/kofi"), review({ status: "approved" }))));
await t("cannot write for someone else", () => assertFails(setDoc(doc(kofi, "reviews/alice"), review({ uid: "alice" }))));
await t("rating must be 1-5", () => assertFails(setDoc(doc(kofi, "reviews/kofi"), review({ rating: 9 }))));
await t("text too short rejected", () => assertFails(setDoc(doc(kofi, "reviews/kofi"), review({ text: "Great" }))));
await t("bob cannot read kofi's review", () => assertFails(getDoc(doc(bob, "reviews/kofi"))));
await t("admin approves", () => assertSucceeds(updateDoc(doc(owner, "reviews/kofi"), { status: "approved" })));
await t("client edit goes back to pending", () => assertSucceeds(updateDoc(doc(kofi, "reviews/kofi"), { text: "Updated: fantastic work on our school system and staff training.", status: "pending", updatedAt: serverTimestamp() })));
await t("client cannot publish testimonial directly", () => assertFails(setDoc(doc(kofi, "testimonials/review-kofi"), { name: "Kofi", text: "x", visible: true })));
await t("admin publishes testimonial", () => assertSucceeds(setDoc(doc(owner, "testimonials/review-kofi"), { name: "Kofi", text: "x", visible: true })));

console.log("Roles & permissions");
await t("owner adds a blog-only admin", () => assertSucceeds(setDoc(doc(owner, "admins/writer@gmail.com"), { role: "custom", perms: { blog: true, media: true }, name: "Writer" })));
const writer = env.authenticatedContext("wr", { email: "writer@gmail.com", email_verified: true }).firestore();
await t("blog admin creates a post", () => assertSucceeds(setDoc(doc(writer, "posts/new-post"), { title: "New", status: "draft" })));
await t("blog admin cannot edit pricing/settings", () => assertFails(setDoc(doc(writer, "settings/site"), { name: "x" }, { merge: true })));
await t("blog admin cannot read contact messages", () => assertFails(getDoc(doc(writer, "messages/m1"))));
await t("blog admin cannot confirm bookings", () => assertFails(updateDoc(doc(writer, "bookings/PJB7K2M9QX"), { status: "confirmed" })));
await t("blog admin cannot create invoices", () => assertFails(setDoc(doc(writer, "invoices/abcdefghijklmnopqrstu"), { status: "draft" })));
await t("blog admin can read client list (for pickers)", () => assertSucceeds(getDoc(doc(writer, "users/alice"))));
await t("admin may rename self", () => assertSucceeds(updateDoc(doc(writer, "admins/writer@gmail.com"), { name: "Ama Writer" })));
await t("admin cannot grant self permissions", () => assertFails(updateDoc(doc(writer, "admins/writer@gmail.com"), { perms: { blog: true, settings: true } })));
await t("disabled admin loses access", async () => {
  await setDoc(doc(owner, "admins/writer@gmail.com"), { disabled: true }, { merge: true });
  await assertFails(setDoc(doc(writer, "posts/another"), { title: "x", status: "draft" }));
  await setDoc(doc(owner, "admins/writer@gmail.com"), { disabled: false }, { merge: true });
});
await t("legacy 'admin' role keeps full access", () => assertSucceeds(setDoc(doc(editor, "settings/hub"), { heroTitle: "x" }, { merge: true })));

console.log("Invoices");
const INV = "inv_k3J9xQ2mZr8LpT5wYb7N";
const invoice = (extra = {}) => ({ number: "INV-2026-0001", status: "sent", uid: "alice", email: "a@x.com", clientName: "Alice", items: [], total: 1200, ...extra });
await t("owner creates invoice", () => assertSucceeds(setDoc(doc(owner, `invoices/${INV}`), invoice())));
await t("owner creates a draft", () => assertSucceeds(setDoc(doc(owner, "invoices/inv_DRAFTdraftDRAFTdraft1"), invoice({ status: "draft" }))));
await t("anyone with the link views a sent invoice", () => assertSucceeds(getDoc(doc(anon, `invoices/${INV}`))));
await t("drafts are private", () => assertFails(getDoc(doc(anon, "invoices/inv_DRAFTdraftDRAFTdraft1"))));
await t("viewer records a view", () => assertSucceeds(updateDoc(doc(anon, `invoices/${INV}`), { viewedAt: serverTimestamp(), viewCount: 1 })));
await t("viewer cannot mark it paid", () => assertFails(updateDoc(doc(anon, `invoices/${INV}`), { status: "paid" })));
await t("client lists own invoices", () => assertSucceeds(getDocs(query(collection(alice, "invoices"), where("uid", "==", "alice"), where("status", "in", ["sent", "paid", "partial", "overdue"])))));
await t("bob cannot list alice's invoices", () => assertFails(getDocs(query(collection(bob, "invoices"), where("uid", "==", "alice")))));
await t("owner uses invoice counter", () => assertSucceeds(setDoc(doc(owner, "counters/invoices"), { year: 2026, next: 2 })));
await t("visitor cannot touch counter", () => assertFails(setDoc(doc(alice, "counters/invoices"), { next: 1 })));

console.log("Chat: edit, delete, react, presence");
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, "threads/alice/messages/old"), { from: "client", text: "Old", createdAt: new Date(Date.now() - 3 * 864e5) });
});
await t("client edits own message within 15 min", () => assertSucceeds(updateDoc(doc(alice, "threads/alice/messages/m1"), { text: "Hello (edited)", editedAt: serverTimestamp() })));
await t("client cannot edit admin's message", () => assertFails(updateDoc(doc(alice, "threads/alice/messages/m3"), { text: "x", editedAt: serverTimestamp() })));
await t("cannot edit after 15 minutes", () => assertFails(updateDoc(doc(alice, "threads/alice/messages/old"), { text: "late", editedAt: serverTimestamp() })));
await t("cannot delete for everyone after 48h", () => assertFails(updateDoc(doc(alice, "threads/alice/messages/old"), { text: "", attachment: null, replyTo: null, deleted: true, deletedAt: serverTimestamp() })));
await t("client deletes own message for everyone", () => assertSucceeds(updateDoc(doc(alice, "threads/alice/messages/m1"), { text: "", attachment: null, replyTo: null, deleted: true, deletedAt: serverTimestamp() })));
await t("client reacts to admin message", () => assertSucceeds(updateDoc(doc(alice, "threads/alice/messages/m3"), { reactions: { client: "👍" } })));
await t("client cannot react as admin", () => assertFails(updateDoc(doc(alice, "threads/alice/messages/m3"), { reactions: { client: "👍", admin: "❤️" } })));
await t("client sends a photo", () => assertSucceeds(setDoc(doc(alice, "threads/alice/messages/m4"), { from: "client", text: "", name: "Alice", createdAt: serverTimestamp(), attachment: { url: "https://res.cloudinary.com/x/image/upload/a.jpg", type: "image", name: "a.jpg" }, replyTo: { id: "m3", text: "Hi Alice", from: "admin" }, reactions: {} })));
await t("empty message rejected", () => assertFails(setDoc(doc(alice, "threads/alice/messages/m5"), { from: "client", text: "", name: "Alice", createdAt: serverTimestamp() })));
await t("client sets typing and read markers", () => assertSucceeds(updateDoc(doc(alice, "threads/alice"), { clientTyping: serverTimestamp(), clientReadAt: serverTimestamp(), clientOnline: true })));
await t("client cannot clear admin unread count", () => assertFails(updateDoc(doc(alice, "threads/alice"), { unreadAdmin: 0 })));
await t("client cannot set admin read marker", () => assertFails(updateDoc(doc(alice, "threads/alice"), { adminReadAt: serverTimestamp() })));
await t("blog-only admin cannot read chats", () => assertFails(getDocs(collection(writer, "threads/alice/messages"))));

console.log("Chat files & quick replies");
await t("client uploads a chat file", () => assertSucceeds(setDoc(doc(alice, "threads/alice/files/f1"), { data: "data:image/jpeg;base64,AAAA", mime: "image/jpeg", name: "a.jpg", size: 3, by: "client", createdAt: serverTimestamp() })));
await t("client sends a message pointing at the file", () => assertSucceeds(setDoc(doc(alice, "threads/alice/messages/m6"), { from: "client", text: "", name: "Alice", createdAt: serverTimestamp(), attachment: { fileId: "f1", type: "image", name: "a.jpg", size: 3, thumb: "data:image/jpeg;base64,AA" }, reactions: {} })));
await t("client cannot upload as admin", () => assertFails(setDoc(doc(alice, "threads/alice/files/f2"), { data: "x", mime: "image/jpeg", by: "admin", createdAt: serverTimestamp() })));
await t("oversized chat file rejected", () => assertFails(setDoc(doc(alice, "threads/alice/files/f3"), { data: "A".repeat(970000), mime: "application/pdf", by: "client", createdAt: serverTimestamp() })));
await t("bob cannot read alice's files", () => assertFails(getDoc(doc(bob, "threads/alice/files/f1"))));
await t("chat admin edits quick replies", () => assertSucceeds(setDoc(doc(owner, "private/chat"), { quickReplies: [{ key: "hi", text: "Hello!" }] })));
await t("blog admin cannot edit quick replies", () => assertFails(setDoc(doc(writer, "private/chat"), { quickReplies: [] })));

console.log("Photos");
const photo = "data:image/jpeg;base64," + "A".repeat(60000);
await t("client saves a profile photo (data URL)", () => assertSucceeds(setDoc(doc(alice, "users/alice"), { name: "Alice", email: "a@x.com", photo }, { merge: true })));
await t("oversized photo rejected", () => assertFails(setDoc(doc(alice, "users/alice"), { name: "Alice", photo: "data:image/jpeg;base64," + "A".repeat(210000) }, { merge: true })));

await env.cleanup();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
