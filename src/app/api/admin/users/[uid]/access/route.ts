import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { examByKey } from "@config/exams";
import { subjectByKey } from "@config/subjects";
import { seriesKey } from "@/lib/access";
import { db } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

/**
 * Manually grant or revoke access (refunds, offline payments, support cases).
 *   { paid: true|false }                          all test series
 *   { exam, subject, grant: true|false }          one test series
 */
export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { uid } = await params;
  const body = (await req.json().catch(() => null)) as { paid?: unknown; exam?: unknown; subject?: unknown; grant?: unknown } | null;
  const ref = db().doc(`users/${uid}`);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (typeof body?.grant === "boolean") {
    const exam = typeof body.exam === "string" && examByKey.has(body.exam) ? body.exam : "";
    const subject = typeof body.subject === "string" && subjectByKey.has(body.subject) ? body.subject : "";
    if (!exam || !subject) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const k = seriesKey(exam, subject);
    if (body.grant) {
      await ref.set({ passes: { [k]: { exam, subject, paidAt: Date.now(), grantedBy: admin.phone } } }, { merge: true });
    } else {
      await ref.set({ passes: { [k]: FieldValue.delete() } }, { merge: true });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.paid !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await ref.update(
    body.paid
      ? { paid: true, paidAt: Date.now(), grantedBy: admin.phone }
      : { paid: false, revokedAt: Date.now(), revokedBy: admin.phone, grantedBy: FieldValue.delete() },
  );
  return NextResponse.json({ ok: true });
}
