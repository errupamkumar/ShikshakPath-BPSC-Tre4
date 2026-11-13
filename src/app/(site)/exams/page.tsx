import type { Metadata } from "next";
import Link from "next/link";
import { ExamCard } from "@/components/exam-card";
import { getCatalog, liveExams, subjectsForExam } from "@/lib/catalog";
import { getT } from "@/lib/lang";

export const metadata: Metadata = {
  title: "Choose your exam: BPSC TRE 4.0 or Bihar STET",
  description: "Step 1: choose your exam. Then pick your subject to open its mock tests, previous-year questions and eBooks.",
};

/** Step 1 of Exam → Subject → test series: pick the exam (only exams switched on in Admin → Exams). */
export default async function ExamsPage() {
  const [cat, { t }] = await Promise.all([getCatalog(), getT()]);
  const s = cat.stats;
  const list = liveExams(cat);
  return (
    <>
      <section className="border-b border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/40">
        <div className="container-page py-12 sm:py-16">
          <nav className="text-sm text-ink-500 dark:text-ink-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-900 dark:hover:text-white">{t("common.home")}</Link> / <span className="text-ink-900 dark:text-ink-100">{t("nav.exams")}</span>
          </nav>
          <p className="eyebrow mt-5">{t("ex.indexEyebrow")}</p>
          <h1 className="display mt-3 max-w-4xl text-4xl leading-[1.02] sm:text-6xl">
            {t("ex.indexTitle1")} <span className="text-brand-500 dark:text-brand-300">{t("ex.indexTitle2")}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-ink-600 dark:text-ink-300">{t("ex.indexText")}</p>
        </div>
      </section>

      <div className="container-page py-12">
        <div className={`mx-auto grid gap-5 ${list.length > 1 ? "max-w-5xl md:grid-cols-2" : "max-w-xl"}`}>
          {list.map((e) => (
            <ExamCard
              key={e.key}
              exam={{ key: e.key, short: e.short, name: e.name, posts: e.posts, region: e.region, logo: e.logo }}
              liveSubjects={subjectsForExam(cat, e.key).filter((x) => x.live).length}
              papers={s.papersByExam[e.key] ?? 0}
            />
          ))}
        </div>
      </div>
    </>
  );
}
