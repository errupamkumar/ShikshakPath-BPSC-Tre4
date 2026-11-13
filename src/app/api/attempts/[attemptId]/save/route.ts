import { NextResponse } from "next/server";
import { saveProgress } from "@/lib/attempts";
import { getSessionUser } from "@/lib/session";

const STATUS = { ok: 200, not_found: 404, submitted: 409, expired: 410 } as const;

// Also called with navigator.sendBeacon() when the tab is hidden or closed.
export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const result = await saveProgress(user.uid, attemptId, body);
  return NextResponse.json({ status: result }, { status: STATUS[result] });
}
