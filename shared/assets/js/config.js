// Public configuration shared by both sites (portfolio + ProfJero Hub), the admin
// dashboard and Cloudflare Pages Functions. The Firebase web config is safe to
// expose: access is enforced by Firestore security rules (see firestore.rules).
import { SITE_ID } from "./site.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCWY3uIJwE8Icl-L7GR4ueHKmzSxm2K3_8",
  authDomain: "jerohub-1.firebaseapp.com",
  projectId: "jerohub-1",
  storageBucket: "jerohub-1.firebasestorage.app",
  messagingSenderId: "345123605276",
  appId: "1:345123605276:web:016927fa42dfc79f6288d9",
  measurementId: "G-HGGPTYFB6B"
};

const common = {
  hubUrl: "https://profjerohub.pages.dev",
  portfolioUrl: "https://profjero.pages.dev",
  ownerEmail: "profjero947@gmail.com"    // always treated as admin (must match firestore.rules)
};

// `id` tags shared data with the site it came from (messages.source, posts.sites, stats).
export const SITES = {
  portfolio: { ...common, id: "portfolio", name: "ProfJero", url: "https://profjero.pages.dev", adminUrl: "/admin/", blogBase: "" },
  hub: { ...common, id: "hub", name: "ProfJero Hub", url: "https://profjerohub.pages.dev", adminUrl: "https://profjero.pages.dev/admin/", blogBase: "https://profjero.pages.dev" }
};

export const SITE = SITES[SITE_ID] || SITES.portfolio;

// Set this to the deployed Cloudflare Worker URL ending in /api/chat.
// Example: "https://profjero-chat-api.<your-subdomain>.workers.dev/api/chat"
export const CHAT_API_URL = "https://profjero-chat-api.profjero947.workers.dev/api/chat";

// Firebase JS SDK served from Google's CDN (no bundler needed).
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2";
