import { NextResponse } from "next/server";
import { pauseAttempt } from "@/lib/attempts";
import { getSessionUser } from "@/lib/session";

const STATUS = { paused: 200, saved: 200, not_found: 404, submitted: 409, expired: 410 } as const;

/** "Exit" from the test player: save answers and pause the timer (if allowed in config). */
export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const result = await pauseAttempt(user.uid, attemptId, body);
  return NextResponse.json({ status: result }, { status: STATUS[result] });
}
