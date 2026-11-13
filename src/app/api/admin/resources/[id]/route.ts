import { NextResponse } from "next/server";
import { bucket, db } from "@/lib/firebase-admin";
import { getResource } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";

/** Admin: make a PDF free/paid, hide/show or rename it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!(await getResource(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof b.free === "boolean") patch.free = b.free;
  if (typeof b.hidden === "boolean") patch.hidden = b.hidden;
  if (typeof b.title === "string" && b.title.trim().length >= 3) patch.title = b.title.trim().slice(0, 140);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  await db().doc(`resources/${id}`).update(patch);
  return NextResponse.json({ ok: true });
}

/** Admin: delete a PDF (file and listing). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const r = await getResource(id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await bucket().file(r.storagePath).delete().catch(() => {});
  await db().doc(`resources/${id}`).delete();
  return NextResponse.json({ ok: true });
}
