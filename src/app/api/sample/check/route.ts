import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

// Reveals the answer for the 3 landing-page sample questions only (after the
// visitor has picked an option). Every other question's answer stays on the server.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const cat = await getCatalog();
  const q = cat.stats.sampleQuestionIds.includes(id) ? cat.questions.get(id) : undefined;
  if (!q) return NextResponse.json({ error: "Not a sample question" }, { status: 400 });
  return NextResponse.json({ answer: q.answer, explanation: q.explanation });
}
