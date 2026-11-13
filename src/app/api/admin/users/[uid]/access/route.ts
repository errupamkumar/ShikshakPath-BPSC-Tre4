import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

/** Manually grant or revoke full access (refunds, offline payments, support cases). */
export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { uid } = await params;
  const body = (await req.json().catch(() => null)) as { paid?: unknown } | null;
  if (typeof body?.paid !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const ref = db().doc(`users/${uid}`);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await ref.update(
    body.paid
      ? { paid: true, paidAt: Date.now(), grantedBy: admin.phone }
      : { paid: false, revokedAt: Date.now(), revokedBy: admin.phone, grantedBy: FieldValue.delete() },
  );
  return NextResponse.json({ ok: true });
}
