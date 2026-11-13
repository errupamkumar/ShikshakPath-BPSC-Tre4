import { NextResponse } from "next/server";
import { setExamEnabled, UploadError } from "@/lib/admin-catalog";
import { getSessionUser } from "@/lib/session";

/** Admin → Exams: switch an exam on (shown to students) or off. Body: { examKey, enabled }. */
export async function POST(req: Request) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { examKey?: unknown; enabled?: unknown } | null;
  if (!body || typeof body.examKey !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const enabled = await setExamEnabled(body.examKey, body.enabled, admin.phone);
    return NextResponse.json({ ok: true, enabled });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
