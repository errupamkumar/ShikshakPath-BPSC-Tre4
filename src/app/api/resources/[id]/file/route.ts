import { NextResponse } from "next/server";
import { fullAccess } from "@/lib/access";
import { bucket, usingStorageEmulator } from "@/lib/firebase-admin";
import { getResource } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";

/**
 * Open a Note / Strategy guide PDF. Access is checked on the server (free PDFs need
 * login; others need the full pass; admins see everything). The file itself is
 * served through a 10-minute signed link, so the bucket stays private.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=/resources/${id}`, req.url));
  const r = await getResource(id);
  if (!r || (r.hidden && !user.isAdmin)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!r.free && !(await fullAccess(user))) return NextResponse.json({ error: "Locked" }, { status: 403 });

  const file = bucket().file(r.storagePath);
  const download = new URL(req.url).searchParams.get("download") === "1";
  const disposition = `${download ? "attachment" : "inline"}; filename="${r.fileName.replace(/["\\\r\n]/g, "")}"`;

  if (usingStorageEmulator) {
    // Local test mode: signed URLs don't work with the emulator, so stream the bytes.
    const [buf] = await file.download();
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": disposition, "Cache-Control": "private, no-store" },
    });
  }
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
    responseDisposition: disposition,
    responseType: "application/pdf",
  });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
}
