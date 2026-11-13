import { NextResponse } from "next/server";
import { setTestOverride } from "@/lib/admin-catalog";
import { getCatalog } from "@/lib/catalog";
import { getSessionUser } from "@/lib/session";

/** Make a test free/paid, hide/show it, or rename it. */
export async function POST(req: Request, { params }: { params: Promise<{ testId: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { testId } = await params;
  if (!(await getCatalog()).testById.has(testId)) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { free?: unknown; hidden?: unknown; title?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await setTestOverride(testId, {
    free: typeof body.free === "boolean" ? body.free : undefined,
    hidden: typeof body.hidden === "boolean" ? body.hidden : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
  });
  return NextResponse.json({ ok: true });
}
