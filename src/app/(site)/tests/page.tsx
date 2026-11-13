import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { subjectByKey } from "@config/subjects";
import { getCatalog, isExamLive, seriesPath } from "@/lib/catalog";
import { SERIES_COOKIE } from "@/lib/series-cookie";

type Props = { searchParams: Promise<{ tab?: string | string[]; exam?: string | string[]; subject?: string | string[] }> };

/**
 * "Test Series": every test series lives at /exams/<exam>/<subject> (Exam → Subject → tests).
 * This address forwards to the student's last series, or to the exam picker.
 * Old links like /tests?subject=computer-science&tab=papers keep working.
 */
export default async function TestsPage({ searchParams }: Props) {
  const [sp, cat, jar] = await Promise.all([searchParams, getCatalog(), cookies()]);
  const tab = sp.tab === "papers" ? "?tab=papers" : "";
  const exam = typeof sp.exam === "string" ? sp.exam : undefined;
  // A subject (old links: ?subject=…), or just an exam (?exam=…): that exam's first live subject.
  const subject = typeof sp.subject === "string" && subjectByKey.has(sp.subject) ? sp.subject : exam && isExamLive(cat, exam) ? (cat.stats.liveByExam[exam]?.[0] ?? cat.stats.liveSubjects[0]) : undefined;
  if (subject) redirect(seriesPath(cat, subject, exam, tab));

  const [lastExam, lastSubject] = decodeURIComponent(jar.get(SERIES_COOKIE)?.value ?? "").split("/");
  if (lastSubject && subjectByKey.has(lastSubject) && isExamLive(cat, lastExam)) redirect(seriesPath(cat, lastSubject, lastExam, tab));
  redirect("/exams");
}
