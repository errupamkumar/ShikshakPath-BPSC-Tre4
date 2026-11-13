import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, isStorageConfigured } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

/**
 * Admin PDF upload, step 1: a short-lived Firebase custom token with { admin: true }.
 * The browser signs in with it and uploads the PDF straight to Cloud Storage
 * (storage.rules allow only admins, PDFs only), so large files never pass through
 * the server, which matters on Vercel (4.5 MB request limit).
 */
export async function POST() {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "File storage is not configured (FIREBASE_STORAGE_BUCKET). See README." }, { status: 503 });
  }
  const token = await adminAuth().createCustomToken(admin.uid, { admin: true });
  return NextResponse.json({ token, path: `resources/${randomUUID()}.pdf` });
}
