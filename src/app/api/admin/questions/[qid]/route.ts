import { NextResponse } from "next/server";
import { saveQuestionEdit, UploadError } from "@/lib/admin-catalog";
import { getSessionUser } from "@/lib/session";

/** Admin: correct a question (text, options, answer key, explanation, Hindi). */
export async function POST(req: Request, { params }: { params: Promise<{ qid: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { qid } = await params;
  if (!/^[0-9a-fx]{6,40}$/.test(qid)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    await saveQuestionEdit(qid, body, admin.phone);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
