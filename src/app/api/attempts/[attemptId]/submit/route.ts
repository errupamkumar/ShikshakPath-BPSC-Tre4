import { NextResponse } from "next/server";
import { finalizeAttempt } from "@/lib/attempts";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { answers?: unknown; marked?: unknown; auto?: unknown };
  // Grading happens here, on the server, against the answer key the browser never saw.
  const attempt = await finalizeAttempt(user.uid, attemptId, body);
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  return NextResponse.json({ ok: true, resultUrl: `/results/${attempt.id}` });
}
