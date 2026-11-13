import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/** Local development against the Firebase emulators (no Firebase account or keys needed). */
const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
export const usingStorageEmulator = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);

export function isFirebaseAdminConfigured(): boolean {
  if (usingEmulators) return Boolean(process.env.FIREBASE_PROJECT_ID);
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}

/** PDFs (Notes / Strategy guides) need a Cloud Storage bucket. */
export function isStorageConfigured(): boolean {
  return isFirebaseAdminConfigured() && Boolean(process.env.FIREBASE_STORAGE_BUCKET);
}

function readPrivateKey(): string {
  let key = process.env.FIREBASE_PRIVATE_KEY ?? "";
  // Accept the key with real newlines, with "\n" escapes, or wrapped in quotes.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (!isFirebaseAdminConfigured()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local (see README).",
    );
  }
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;
  if (usingEmulators) return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID, storageBucket });
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: readPrivateKey(),
    }),
    storageBucket,
  });
}

// Cached on globalThis: Next.js bundles each route separately, so a module-level
// variable would exist once per route while the Firestore instance is shared,
// and settings() may only be called once per process.
const g = globalThis as unknown as { __csTestSeriesFirestore?: Firestore };

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function db(): Firestore {
  if (!g.__csTestSeriesFirestore) {
    const firestore = getFirestore(getAdminApp());
    firestore.settings({ ignoreUndefinedProperties: true });
    g.__csTestSeriesFirestore = firestore;
  }
  return g.__csTestSeriesFirestore;
}

export function bucket() {
  return getStorage(getAdminApp()).bucket();
}
