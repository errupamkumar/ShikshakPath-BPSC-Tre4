import { NextResponse } from "next/server";
import { deleteUpload, setUploadKind, UploadError } from "@/lib/admin-catalog";
import { getSessionUser } from "@/lib/session";

/** Change what an upload is: { kind: "mock" | "paper" }. */
export async function POST(req: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { uploadId } = await params;
  if (!/^[A-Za-z0-9]{1,40}$/.test(uploadId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { kind?: unknown } | null;
  if (body?.kind !== "mock" && body?.kind !== "paper") return NextResponse.json({ error: "kind must be mock or paper" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await setUploadKind(uploadId, body.kind)) });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { uploadId } = await params;
  if (!/^[A-Za-z0-9]{1,40}$/.test(uploadId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const r = await deleteUpload(uploadId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 409 });
}
