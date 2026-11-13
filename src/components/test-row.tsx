"use client";

import Link from "next/link";
import { patternFor } from "@config/test-series.config";
import { examLabel } from "@config/exams";
import { clock, marks } from "@/lib/format";
import type { TestDef } from "@/lib/types";
import { CheckIcon, ClockIcon, LockIcon } from "./icons";
import { useLang } from "./lang-provider";

export type RowProgress = { best: number | null; max: number; count: number; running: boolean; paused: boolean; remainingSec: number };

/** One test in a list (Adda247-style row): name, Qs · marks · time, status and action. */
export function TestRow({ test, unlocked, progress, showExam = false }: { test: TestDef; unlocked: boolean; progress?: RowProgress; showExam?: boolean }) {
  const { t } = useLang();
  const totalMarks = marks(test.questionCount * patternFor(test.examKey).marksPerQuestion);
  const action = !unlocked ? t("common.unlock") : progress?.running ? t("common.resume") : progress?.count ? t("common.reattempt") : t("common.startNow");
  return (
    <Link
      href={`/tests/${test.id}`}
      className="card group flex flex-col gap-3 p-4 transition hover:border-ink-300 hover:shadow-lg hover:shadow-ink-900/5 sm:flex-row sm:items-center sm:gap-5 sm:p-5 dark:hover:border-ink-600"
    >
      <span
        className={`hidden size-12 shrink-0 place-items-center rounded-2xl text-sm font-black sm:grid ${unlocked ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800" : "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400"}`}
      >
        {unlocked ? (test.kind === "mock" ? `M${test.number}` : (test.year ?? "PYQ")) : <LockIcon width={18} height={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{test.title}</h3>
          {test.free && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">{t("common.free.badge")}</span>}
          {test.kind === "paper" && test.sourceExam && test.sourceExam !== test.examKey && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{t("tr.askedIn", { exam: examLabel(test.sourceExam) })}</span>
          )}
          {showExam && test.examKey && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{examLabel(test.examKey)}</span>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500 dark:text-ink-400">
          <span>{t("common.qs", { n: test.questionCount })}</span>
          <span>{t("common.marks", { n: totalMarks })}</span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon width={14} height={14} /> {t("common.min", { n: test.durationMinutes })}
          </span>
          {test.kind === "mock" && <span>{t("common.papersMixed", { n: test.paperCount })}</span>}
        </p>
        {progress && (progress.running || progress.count > 0) && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink-700 dark:text-ink-200">
            {progress.running ? (
              progress.paused ? (
                <>⏸ {t("common.paused")} · {clock(progress.remainingSec)}</>
              ) : (
                <>⏳ {t("common.inProgress")}</>
              )
            ) : (
              <>
                <CheckIcon width={14} height={14} className="text-emerald-600" /> {t("common.bestOf", { score: marks(progress.best ?? 0), max: marks(progress.max) })} ·{" "}
                {t("common.attempts", { n: progress.count })}
              </>
            )}
          </p>
        )}
      </div>
      <span className={`btn shrink-0 px-5 ${unlocked ? (progress?.running ? "btn-accent" : "btn-primary") : "btn-secondary"} w-full sm:w-auto`}>
        {!unlocked && <LockIcon width={15} height={15} />} {action}
      </span>
    </Link>
  );
}
