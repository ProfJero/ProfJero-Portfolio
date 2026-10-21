// Firebase initialisation shared by every page. Imported lazily so the first
// paint never waits on the SDK.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, increment, serverTimestamp,
  Timestamp, onSnapshot, collectionGroup, getCountFromServer, runTransaction, arrayUnion, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signOut, updateProfile, connectAuthEmulator, createUserWithEmailAndPassword, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, linkWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./config.js";

export const app = initializeApp(firebaseConfig);

// Local development only: open any page with ?emulator=1 on localhost to use the
// Firebase Emulator Suite (firebase emulators:start) instead of the live project.
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
let useEmulator = false;
try {
  if (local && new URLSearchParams(location.search).has("emulator")) sessionStorage.setItem("pj_emulator", "1");
  useEmulator = local && sessionStorage.getItem("pj_emulator") === "1";
} catch { }

// initializeFirestore() must run AT MOST ONCE per app. If the first call throws
// (e.g. persistent cache is blocked), the app may already be registered — so the
// fallback MUST use getFirestore() to reuse that instance. Calling
// initializeFirestore() a second time with different options always throws
// "initializeFirestore() has already been called with different options".
let db;
if (useEmulator) {
  try {
    db = initializeFirestore(app, {});
  } catch {
    db = getFirestore(app);
  }
  try { connectFirestoreEmulator(db, "127.0.0.1", 8080); } catch { /* already connected */ }
} else {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch {
    db = getFirestore(app);
  }
}
export { db };

export const auth = getAuth(app);
if (useEmulator) {
  try { connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); } catch { /* already connected */ }
}

// Analytics loads after the page is idle and only where supported.
export function startAnalytics() {
  if (useEmulator) return;
  const run = async () => {
    try {
      const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js");
      if (await isSupported()) getAnalytics(app);
    } catch { /* analytics is optional */ }
  };
  ("requestIdleCallback" in window) ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 2500);
}

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, increment, serverTimestamp,
  Timestamp, onSnapshot, collectionGroup, getCountFromServer, runTransaction, arrayUnion, deleteField,
  onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signOut, updateProfile, createUserWithEmailAndPassword, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, linkWithCredential
};

/** Resolves with the current user once Firebase has restored the session. */
export function currentUser() {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, u => { off(); resolve(u); });
  });
}

/**
 * Returns a signed-in user for public interactions (likes, comments).
 * Uses anonymous auth silently; falls back to Google if anonymous sign-in is disabled.
 */
export async function ensureVisitor() {
  const u = await currentUser();
  if (u) return u;
  try {
    return (await signInAnonymously(auth)).user;
  } catch (e) {
    if (e?.code === "auth/operation-not-allowed" || e?.code === "auth/admin-restricted-operation") {
      return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
    }
    throw e;
  }
}

export async function signInWithGoogle() {
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}
