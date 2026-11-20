import { NextResponse } from "next/server";
import { deleteMock } from "@/lib/admin-catalog";
import { getSessionUser } from "@/lib/session";

/** Delete a mock test that was built from the question pool. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ mockId: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { mockId } = await params;
  if (!/^[A-Za-z0-9-]{1,80}$/.test(mockId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  return (await deleteMock(mockId)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
