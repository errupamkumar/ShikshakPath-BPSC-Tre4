import type { Metadata } from "next";
import Link from "next/link";
import { examByKey, exams } from "@config/exams";
import { subjectByKey, subjectName } from "@config/subjects";
import { ExamLogo } from "@/components/exam-logo";
import { BookIcon, LockIcon } from "@/components/icons";
import { accessFor, canOpenSeries } from "@/lib/access";
import { getCatalog, isExamLive, liveExams, paperSource, seriesPath, subjectsForExam, testsFor } from "@/lib/catalog";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "PYQs with answers & explanations",
  description: "Previous-year questions for BPSC TRE 4.0 and Bihar STET, paper by paper, with correct answers and explanations.",
};

type Props = { searchParams: Promise<{ exam?: string | string[]; subject?: string | string[]; from?: string | string[] }> };

/** PYQ study mode: Exam → Subject → papers (grouped by the exam each paper was asked in). */
export default async function PyqIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const [cat, { lang, t }, user] = await Promise.all([getCatalog(), getT(), getSessionUser()]);
  const access = await accessFor(user);
  const examsOn = liveExams(cat);
  const examKey = typeof sp.exam === "string" && isExamLive(cat, sp.exam) ? sp.exam : (examsOn.find((e) => (cat.stats.papersByExam[e.key] ?? 0) > 0) ?? examsOn[0])?.key;
  const subjects = examKey ? subjectsForExam(cat, examKey).filter((s) => s.live) : [];
  const subject =
    typeof sp.subject === "string" && subjectByKey.has(sp.subject)
      ? sp.subject
      : (subjects.find((s) => s.examPapers > 0)?.key ?? subjects[0]?.key ?? cat.stats.liveSubjects[0] ?? "computer-science");
  const allPapers = examKey ? testsFor(cat, { subject, kind: "paper", examKey }) : [];
  const from = typeof sp.from === "string" && examByKey.has(sp.from) ? sp.from : "";
  const papers = allPapers.filter((p) => !from || paperSource(p) === from);
  const sources = exams.filter((e) => allPapers.some((p) => paperSource(p) === e.key));
  const groups = sources.map((e) => ({ exam: e, papers: papers.filter((p) => paperSource(p) === e.key) })).filter((g) => g.papers.length);
  const href = (o: Record<string, string>) => `/pyq?${new URLSearchParams({ ...(examKey ? { exam: examKey } : {}), subject, ...o }).toString()}`;
  const examShortName = examKey ? (examByKey.get(examKey)?.short ?? "") : "";

  return (
    <>
      <section className="border-b border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/40">
        <div className="container-page py-12 sm:py-16">
          <p className="eyebrow">{t("pyq.eyebrow")}</p>
          <h1 className="display mt-3 max-w-4xl text-4xl leading-[1.03] sm:text-6xl">{t("pyq.title")}</h1>
          <p className="mt-4 max-w-2xl text-ink-600 dark:text-ink-300">{t("pyq.text")}</p>

          {examsOn.length > 1 && (
            <div className="mt-7 flex flex-wrap gap-2" role="tablist" aria-label={t("nav.exams")}>
              {examsOn.map((e) => (
                <Link
                  key={e.key}
                  href={`/pyq?exam=${e.key}`}
                  role="tab"
                  aria-selected={e.key === examKey}
                  className={`inline-flex items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1 text-sm font-bold transition ${
                    e.key === examKey ? "border-ink-900 bg-brand-50 dark:border-brand-300 dark:bg-brand-900/30" : "border-ink-200 bg-white hover:border-ink-400 dark:border-ink-700 dark:bg-ink-900"
                  }`}
                >
                  <ExamLogo exam={e} size={30} />
                  {e.short}
                  <span className="font-medium opacity-60">{cat.stats.papersByExam[e.key] ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
          {subjects.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <Link key={s.key} href={`/pyq?exam=${examKey}&subject=${s.key}`} className={`btn px-4 py-1.5 ${s.key === subject ? "btn-primary" : "btn-secondary"}`}>
                  {lang === "hi" ? s.nameHi : s.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="container-page py-10">
        {sources.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href={href({})} className={`btn shrink-0 px-4 py-1.5 ${!from ? "btn-primary" : "btn-secondary"}`}>
              {t("pyq.allSources")}
            </Link>
            {sources.map((e) => (
              <Link key={e.key} href={href({ from: e.key })} className={`btn shrink-0 px-4 py-1.5 ${from === e.key ? "btn-primary" : "btn-secondary"}`}>
                {e.short} <span className="opacity-60">{allPapers.filter((p) => paperSource(p) === e.key).length}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-10">
          {groups.map((g) => (
            <section key={g.exam.key}>
              <h2 className="text-xl font-bold">
                {g.exam.key === examKey ? `${g.exam.short} · ${subjectName(subject, lang)}` : t("pyq.askedInGroup", { exam: g.exam.short, subject: subjectName(subject, lang) })}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {g.papers.map((p) => {
                  const open = p.free || canOpenSeries(access, p.examKey, p.subject);
                  return (
                    <Link key={p.id} href={`/pyq/${p.id}`} className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink-900/5">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${open ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200" : "bg-ink-100 text-ink-500 dark:bg-ink-800"}`}>
                        {open ? <BookIcon width={20} height={20} /> : <LockIcon width={18} height={18} />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold">{p.title}</p>
                        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                          {t("pyq.qCount", { n: p.questionCount })}
                          {p.free && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">{t("common.free.badge")}</span>}
                        </p>
                        <p className="mt-2 text-sm font-bold text-brand-600 dark:text-brand-300">{open ? t("pyq.read") : t("pyq.preview")} →</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
          {groups.length === 0 && (
            <div className="card mx-auto max-w-2xl p-8 text-center">
              <p className="font-semibold">{t("pyq.none", { subject: subjectName(subject, lang), exams: examShortName })}</p>
              <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t("pyq.noneText")}</p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href={seriesPath(cat, subject, examKey)} className="btn btn-primary px-5 py-2.5">
                  {t("nav.testSeries")}
                </Link>
                <Link href="/ebooks/pyq" className="btn btn-secondary px-5 py-2.5">
                  {t("pyq.pdfs")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
