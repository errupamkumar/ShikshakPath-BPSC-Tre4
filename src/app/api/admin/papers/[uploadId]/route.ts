import { NextResponse } from "next/server";
import { deleteUpload } from "@/lib/admin-catalog";
import { getSessionUser } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { uploadId } = await params;
  if (!/^[A-Za-z0-9]{1,40}$/.test(uploadId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const r = await deleteUpload(uploadId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 409 });
}
