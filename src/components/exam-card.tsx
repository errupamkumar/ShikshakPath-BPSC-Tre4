"use client";

import Link from "next/link";
import { ExamLogo } from "./exam-logo";
import { ArrowRight } from "./icons";
import { useLang } from "./lang-provider";

export type ExamCardData = { key: string; short: string; name: string; posts: string; region?: string; logo?: string };

/** Step 1 of Exam → Subject: an exam with its official logo and name. */
export function ExamCard({ exam, liveSubjects, papers }: { exam: ExamCardData; liveSubjects: number; papers: number }) {
  const { t } = useLang();
  return (
    <Link href={`/exams/${exam.key}`} className="card group flex h-full flex-col p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-ink-900/5">
      <div className="flex items-center gap-4">
        <ExamLogo exam={exam} size={68} />
        <div className="min-w-0">
          <h3 className="text-xl leading-tight font-black tracking-tight sm:text-2xl">{exam.short}</h3>
          <p className="mt-1 text-sm font-semibold text-ink-600 dark:text-ink-300">{exam.name}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{exam.posts}.</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="text-xs font-bold text-brand-700 dark:text-brand-300">
          {t("ec.subjects", { live: liveSubjects })}
          {papers > 0 ? ` · ${t("ex.papersChip", { n: papers })}` : ""}
        </span>
        <span className="btn btn-primary px-4 py-2 text-sm">
          {t("ec.choose")} <ArrowRight width={15} height={15} className="transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
