import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isGoogleConfigured = Object.values(firebaseConfig).every(Boolean);

const app = isGoogleConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;
const analyticsPromise = app
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
  : Promise.resolve(null);

export const signInWithGoogle = async () => {
  if (!auth) {
    return null;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const result = await signInWithPopup(auth, provider);
  return {
    displayName: result.user.displayName,
    email: result.user.email,
    photoURL: result.user.photoURL,
    uid: result.user.uid,
  };
};

export const trackMarketplaceEvent = async (eventName, payload = {}) => {
  const analytics = await analyticsPromise;
  if (analytics) {
    logEvent(analytics, eventName, payload);
  }
};

export const saveListingSnapshot = async (listing) => {
  if (!db) {
    return null;
  }

  return addDoc(collection(db, "marketplace_listings"), {
    ...listing,
    createdAt: serverTimestamp(),
  });
};

export const uploadListingMetadata = async (listing) => {
  if (!storage) {
    return null;
  }

  const metadataRef = ref(storage, `marketplace/listings/${listing.id || Date.now()}.json`);
  return uploadString(metadataRef, JSON.stringify(listing, null, 2), "raw", {
    contentType: "application/json",
  });
};
