import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Without config (e.g. a build missing the VITE_FIREBASE_* secrets) getAuth() would throw at import
// time and leave a blank page; use a dummy key so the Login page can render and explain the problem.
export const app = initializeApp(firebaseConfigured ? firebaseConfig : { apiKey: "missing", projectId: "missing" });
export const auth = getAuth(app);

// IndexedDB-backed offline cache (the modern replacement for enableIndexedDbPersistence):
// the app opens and shows the last-synced data with no connection.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
