import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { adminAuth, isFirebaseAdminConfigured } from "./firebase-admin";

export const SESSION_COOKIE = "__session"; // the only cookie name Firebase Hosting forwards; harmless on Vercel
export const SESSION_DAYS = 14; // Firebase allows 5 minutes to 14 days

export type SessionUser = { uid: string; phone: string; isAdmin: boolean };

/** "+91 98765 43210", "9876543210" and "919876543210" all become "+919876543210". */
export function normalizePhone(input: string | undefined | null): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export function isAdminPhone(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const admins = (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => normalizePhone(p))
    .filter(Boolean);
  return admins.includes(normalizePhone(phone));
}

/**
 * The logged-in user, verified on the server from the httpOnly session cookie.
 * Returns null when logged out (or when Firebase isn't configured yet).
 * Cached per request.
 */
export const getSessionUser = cache(async (checkRevoked = false): Promise<SessionUser | null> => {
  // Read the cookie FIRST, even when Firebase isn't configured: this is what tells
  // Next.js these pages are per-request (never prerendered at build time).
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isFirebaseAdminConfigured()) return null;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, checkRevoked);
    const phone = decoded.phone_number ?? "";
    return { uid: decoded.uid, phone, isAdmin: isAdminPhone(phone) };
  } catch {
    return null;
  }
});
