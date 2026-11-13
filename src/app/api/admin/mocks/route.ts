import { NextResponse } from "next/server";
import { createMocksNow, UploadError } from "@/lib/admin-catalog";
import { BUNDLED_EXAM } from "@/lib/catalog";
import { getSessionUser } from "@/lib/session";
import { DEFAULT_SUBJECT, subjectByKey } from "@config/subjects";

/** Make mock test(s) now from the uploaded questions of one exam + subject waiting in the pool. */
export async function POST(req: Request) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { subject?: unknown; examKey?: unknown };
  const subject = typeof body.subject === "string" && subjectByKey.has(body.subject) ? body.subject : DEFAULT_SUBJECT;
  const exam = typeof body.examKey === "string" && body.examKey ? body.examKey : BUNDLED_EXAM;
  try {
    const r = await createMocksNow(exam, subject);
    if (!r.created.length) {
      return NextResponse.json({ error: `Not enough new questions yet (${r.poolRemaining} waiting).` }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
