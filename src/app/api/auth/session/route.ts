import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, db, isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

/**
 * Exchange a fresh Firebase ID token (from the phone-OTP sign-in in the browser)
 * for a 14-day httpOnly session cookie. All later auth checks use that cookie.
 */
export async function POST(req: Request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Login is not configured on the server yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { idToken?: unknown } | null;
  const idToken = typeof body?.idToken === "string" ? body.idToken : "";
  if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    // Only accept tokens from a sign-in that just happened.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ error: "Please log in again." }, { status: 401 });
    }
    const phone = decoded.phone_number;
    if (!phone) return NextResponse.json({ error: "Phone login required." }, { status: 400 });

    const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });

    // Create or update the user's profile.
    const ref = db().doc(`users/${decoded.uid}`);
    const now = Date.now();
    const onboarded = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) tx.update(ref, { phone, lastLoginAt: now });
      else tx.set(ref, { phone, createdAt: now, lastLoginAt: now, paid: false });
      // Has the student chosen exams + subjects (onboarding) yet?
      return Boolean(snap.get("onboardedAt"));
    });

    (await cookies()).set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });
    return NextResponse.json({ ok: true, onboarded });
  } catch (e) {
    console.error("Session creation failed", e);
    return NextResponse.json({ error: "Could not verify your login. Please try again." }, { status: 401 });
  }
}
