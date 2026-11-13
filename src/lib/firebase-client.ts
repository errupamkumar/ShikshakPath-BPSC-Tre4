"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken, signOut, type Auth } from "firebase/auth";

// NEXT_PUBLIC_* values are safe to expose: they identify the Firebase project,
// they are not secrets. Security comes from the server-side checks.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

// Local development only: talk to the emulators.
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
const storageEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST;

/** Local test mode only: read the OTP the Auth emulator "sent" so it can be shown on screen. */
export async function getEmulatorOtp(phoneE164: string): Promise<string | null> {
  if (!emulatorHost) return null;
  try {
    const res = await fetch(`http://${emulatorHost}/emulator/v1/projects/${firebaseConfig.projectId}/verificationCodes`);
    const data = (await res.json()) as { verificationCodes?: { phoneNumber: string; code: string }[] };
    return data.verificationCodes?.filter((v) => v.phoneNumber === phoneE164).pop()?.code ?? null;
  } catch {
    return null;
  }
}

export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  const app = getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.languageCode = "en";
  if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  return auth;
}

// ── Admin PDF upload (separate app instance, so it never touches the student login) ──

let uploadApp: FirebaseApp | null = null;
let uploadEmulatorsConnected = false;

/**
 * Upload a PDF straight to Cloud Storage with a one-time admin token from the server.
 * Resolves when the file is stored; reports progress 0–100.
 */
export async function uploadPdf(file: File, token: string, path: string, onProgress: (pct: number) => void): Promise<void> {
  if (!firebaseConfig.storageBucket) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.");
  const { connectStorageEmulator, getStorage, ref, uploadBytesResumable } = await import("firebase/storage");
  uploadApp ??= getApps().find((a) => a.name === "admin-upload") ?? initializeApp(firebaseConfig, "admin-upload");
  const upAuth = getAuth(uploadApp);
  const storage = getStorage(uploadApp);
  if (!uploadEmulatorsConnected) {
    if (emulatorHost) connectAuthEmulator(upAuth, `http://${emulatorHost}`, { disableWarnings: true });
    if (storageEmulatorHost) {
      const [host, port] = storageEmulatorHost.split(":");
      connectStorageEmulator(storage, host, Number(port));
    }
    uploadEmulatorsConnected = true;
  }
  await signInWithCustomToken(upAuth, token);
  try {
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(ref(storage, path), file, { contentType: "application/pdf" });
      task.on("state_changed", (s) => onProgress(Math.round((s.bytesTransferred / Math.max(1, s.totalBytes)) * 100)), reject, () => resolve());
    });
  } finally {
    await signOut(upAuth).catch(() => {});
  }
}
