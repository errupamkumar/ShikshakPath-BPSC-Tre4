import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { examByKey } from "@config/exams";
import { ExamCard } from "@/components/exam-card";
import { ExamLogo } from "@/components/exam-logo";
import { SubjectCard } from "@/components/subject-card";
import { getCatalog, isExamLive, liveExams, subjectsForExam } from "@/lib/catalog";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = examByKey.get((await params).slug);
  return e ? { title: `${e.short} test series: choose your subject`, description: `${e.name}: ${e.posts}. Mock tests, previous-year questions and eBooks, subject by subject.` } : { title: "Exam" };
}

/** Step 2 of Exam → Subject → test series: pick the subject for this exam. */
export default async function ExamPage({ params }: Props) {
  const exam = examByKey.get((await params).slug);
  if (!exam) notFound();
  const [cat, { t }, user] = await Promise.all([getCatalog(), getT(), getSessionUser()]);
  // Exams switched off in Admin → Exams are not shown to students (admins can still preview them).
  if (!isExamLive(cat, exam.key) && !user?.isAdmin) notFound();
  // Exams with a single subject (e.g. ISRO → Computer Science) go straight to it.
  if (exam.subjects?.length === 1) redirect(`/exams/${exam.key}/${exam.subjects[0]}`);

  const s = cat.stats;
  const subjectCards = subjectsForExam(cat, exam.key);
  const others = liveExams(cat).filter((e) => e.key !== exam.key);
  const papers = s.papersByExam[exam.key] ?? 0;

  return (
    <>
      <section className="border-b border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/40">
        <div className="container-page py-12 sm:py-16">
          <nav className="text-sm text-ink-500 dark:text-ink-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-900 dark:hover:text-white">{t("common.home")}</Link> /{" "}
            <Link href="/exams" className="hover:text-ink-900 dark:hover:text-white">{t("nav.exams")}</Link> / <span className="text-ink-900 dark:text-ink-100">{exam.short}</span>
          </nav>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
            <ExamLogo exam={exam} size={88} />
            <div>
              <p className="eyebrow">
                {exam.name}
                {exam.region ? ` · ${exam.region}` : ""}
              </p>
              <h1 className="display mt-2 max-w-4xl text-4xl leading-[1.02] sm:text-6xl">
                {exam.short} <span className="text-brand-500 dark:text-brand-300">{t("ex.testSeries")}</span>
              </h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-lg text-ink-600 dark:text-ink-300">{exam.posts}.</p>
          {papers > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              <li className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 dark:border-ink-700 dark:bg-ink-900">{t("ex.papersChip", { n: papers })}</li>
            </ul>
          )}
        </div>
      </section>

      <section className="container-page py-12">
        <p className="eyebrow">{t("ex.step")}</p>
        <h2 className="display mt-2 text-3xl sm:text-4xl">{t("ex.choose")}</h2>
        <p className="mt-2 max-w-2xl text-ink-600 dark:text-ink-300">{t("ex.chooseText", { exam: exam.short })}</p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          {subjectCards.map((sc) => (
            <SubjectCard key={sc.key} href={`/exams/${exam.key}/${sc.key}`} s={{ ...sc, tests: sc.stats.mockTests + sc.examPapers, questions: sc.stats.questions }} />
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section className="container-page pb-8">
          <h2 className="display text-2xl sm:text-3xl">{t("ex.related")}</h2>
          <div className="mt-5 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
            {others.map((e) => (
              <ExamCard
                key={e.key}
                exam={{ key: e.key, short: e.short, name: e.name, posts: e.posts, region: e.region, logo: e.logo }}
                liveSubjects={subjectsForExam(cat, e.key).filter((x) => x.live).length}
                papers={s.papersByExam[e.key] ?? 0}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
