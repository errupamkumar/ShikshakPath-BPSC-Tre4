import { NextResponse } from "next/server";
import { libraryConfig } from "@config/test-series.config";
import { examByKey } from "@config/exams";
import { subjectByKey } from "@config/subjects";
import { bucket, db } from "@/lib/firebase-admin";
import { isResourceType, type ResourceDoc } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Admin PDF upload, step 2: register the uploaded file as an eBook (Notes, PYQ, Strategy guide or Others). */
export async function POST(req: Request) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const type = b.type;
  if (!isResourceType(type)) return NextResponse.json({ error: "Choose the type: Notes, PYQ, Strategy guide or Others." }, { status: 400 });
  const title = str(b.title, 140);
  if (title.length < 3) return NextResponse.json({ error: "Enter a title (at least 3 characters)." }, { status: 400 });
  const subject = typeof b.subject === "string" && subjectByKey.has(b.subject) ? b.subject : "";
  const examKey = typeof b.examKey === "string" && examByKey.has(b.examKey) ? b.examKey : "";
  const storagePath = typeof b.path === "string" ? b.path : "";
  if (!/^resources\/[0-9a-f-]{36}\.pdf$/.test(storagePath)) return NextResponse.json({ error: "Bad file path." }, { status: 400 });

  // The file must really exist and be a PDF within the size limit.
  const file = bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) return NextResponse.json({ error: "The file was not uploaded. Please try again." }, { status: 400 });
  const [meta] = await file.getMetadata();
  const size = Number(meta.size ?? 0);
  if (meta.contentType !== "application/pdf" || size > libraryConfig.maxPdfMb * 1024 * 1024) {
    await file.delete().catch(() => {});
    return NextResponse.json({ error: `Only PDF files up to ${libraryConfig.maxPdfMb} MB.` }, { status: 400 });
  }

  const doc: ResourceDoc = {
    type,
    title,
    description: str(b.description, 600),
    author: str(b.author, 120),
    subject,
    examKey,
    free: b.free === true,
    hidden: false,
    storagePath,
    fileName: str(b.fileName, 200) || "document.pdf",
    size,
    createdAt: Date.now(),
    uploadedBy: admin.phone,
  };
  const ref = await db().collection("resources").add(doc);
  return NextResponse.json({ ok: true, id: ref.id });
}
