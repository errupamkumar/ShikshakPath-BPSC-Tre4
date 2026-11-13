import { NextResponse } from "next/server";
import { canAccessTest } from "@/lib/access";
import { startAttempt } from "@/lib/attempts";
import { getCatalog, isOpenToStudents } from "@/lib/catalog";
import { getSessionUser } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const test = (await getCatalog()).testById.get(testId);
  if (!test || (!isOpenToStudents(test) && !user.isAdmin)) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  // Paid access is checked here, on the server, every time a test is started.
  if (!(await canAccessTest(user, test))) {
    return NextResponse.json({ error: "This test is locked. Unlock all tests to continue." }, { status: 403 });
  }
  const attemptId = await startAttempt(user.uid, test);
  return NextResponse.json({ attemptId });
}
