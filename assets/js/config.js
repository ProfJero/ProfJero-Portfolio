// Public configuration shared by the portfolio, the admin dashboard, Cloudflare
// Pages Functions and (optionally) ProfJero Hub. Firebase web config is safe to
// expose: access is enforced by Firestore security rules (see firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyCWY3uIJwE8Icl-L7GR4ueHKmzSxm2K3_8",
  authDomain: "jerohub-1.firebaseapp.com",
  projectId: "jerohub-1",
  storageBucket: "jerohub-1.firebasestorage.app",
  messagingSenderId: "345123605276",
  appId: "1:345123605276:web:016927fa42dfc79f6288d9",
  measurementId: "G-HGGPTYFB6B"
};

export const SITE = {
  id: "portfolio",                       // identifies this site in shared collections (messages.source, posts.sites)
  url: "https://profjero.pages.dev",
  hubUrl: "https://profjerohub.pages.dev",
  portfolioUrl: "https://profjero.pages.dev",
  adminUrl: "/admin/",
  blogBase: "",                          // article links are relative on the portfolio
  name: "ProfJero",
  ownerEmail: "profjero947@gmail.com"    // always treated as admin (must match firestore.rules)
};

// Firebase JS SDK served from Google's CDN (no build step needed).
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2";
