import { NextResponse } from "next/server";
import { UploadError, uploadPaper, type UploadInput } from "@/lib/admin-catalog";
import { getSessionUser } from "@/lib/session";

/** Upload one JSON file → ONE new test: a mock test or a previous-year paper (body.kind). */
export async function POST(req: Request) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as UploadInput | null;
  if (!body) return NextResponse.json({ error: "The upload could not be read." }, { status: 400 });
  try {
    const report = await uploadPaper(body, admin.phone);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Upload failed", e);
    return NextResponse.json({ error: "Upload failed on the server. Please try again." }, { status: 500 });
  }
}
