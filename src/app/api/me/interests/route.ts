import { NextResponse } from "next/server";
import { examByKey } from "@config/exams";
import { subjectByKey } from "@config/subjects";
import type { Interest } from "@/lib/access";
import { getCatalog, isExamLive } from "@/lib/catalog";
import { db } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

/** Save the exams + subjects the student is preparing for. Body: { interests: [{ exam, subject }] }. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { interests?: unknown } | null;
  if (!Array.isArray(body?.interests)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const cat = await getCatalog();
  const seen = new Set<string>();
  const interests: Interest[] = [];
  for (const x of body.interests.slice(0, 40)) {
    const exam = typeof x?.exam === "string" ? examByKey.get(x.exam) : undefined;
    const subject = typeof x?.subject === "string" && subjectByKey.has(x.subject) ? x.subject : "";
    if (!exam || !subject || !isExamLive(cat, exam.key) || (exam.subjects && !exam.subjects.includes(subject))) continue;
    const k = `${exam.key}|${subject}`;
    if (seen.has(k)) continue;
    seen.add(k);
    interests.push({ exam: exam.key, subject });
  }
  if (!interests.length) return NextResponse.json({ error: "Choose at least one exam and subject." }, { status: 400 });
  await db().doc(`users/${user.uid}`).set({ interests, onboardedAt: Date.now() }, { merge: true });
  return NextResponse.json({ ok: true, interests });
}
