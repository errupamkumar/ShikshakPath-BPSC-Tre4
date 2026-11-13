"use client";

import Link from "next/link";
import { useState } from "react";
import type { MenuExam } from "./header/types";
import { ExamLogo } from "./exam-logo";
import { ArrowRight, CheckIcon } from "./icons";
import { useLang } from "./lang-provider";

/**
 * Landing page: Step 1 choose the exam → Step 2 choose the subject → open that test series
 * (/exams/<exam>/<subject>). `initial` = the student's last choice (series cookie).
 */
export function ExamPicker({ exams, initial }: { exams: MenuExam[]; initial?: { exam: string; subject: string } }) {
  const { t } = useLang();
  const start = exams.find((e) => e.key === initial?.exam) ?? exams[0];
  const [examKey, setExamKey] = useState(start?.key ?? "");
  const [subjectKey, setSubjectKey] = useState(start && initial?.exam === start.key ? initial.subject : "");
  const exam = exams.find((e) => e.key === examKey);
  const subject = exam?.subjects.find((s) => s.key === subjectKey);
  if (!exam) return null;

  const stepLabel = (n: number, text: string, done: boolean) => (
    <p className="flex items-center gap-2 text-sm font-bold">
      <span className={`grid size-6 place-items-center rounded-full text-xs font-black ${done ? "bg-emerald-500 text-white" : "bg-ink-900 text-white dark:bg-brand-300 dark:text-ink-950"}`}>
        {done ? <CheckIcon width={13} height={13} /> : n}
      </span>
      {text}
    </p>
  );

  return (
    <div id="choose" className="card scroll-mt-28 p-5 shadow-2xl shadow-ink-900/10 sm:p-7">
      <p className="eyebrow">{t("home.pickTitle")}</p>

      <div className="mt-4">{stepLabel(1, t("home.step1"), true)}</div>
      <div className={`mt-3 grid gap-3 ${exams.length > 1 ? "sm:grid-cols-2" : ""}`} role="radiogroup" aria-label={t("home.step1")}>
        {exams.map((e) => {
          const active = e.key === examKey;
          return (
            <button
              key={e.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setExamKey(e.key);
                if (!e.subjects.some((s) => s.key === subjectKey)) setSubjectKey("");
              }}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                active ? "border-ink-900 bg-brand-50 dark:border-brand-300 dark:bg-brand-900/30" : "border-ink-200 hover:border-ink-400 dark:border-ink-700 dark:hover:border-ink-500"
              }`}
            >
              <ExamLogo exam={e} size={44} />
              <span className="min-w-0">
                <span className="block leading-tight font-black">{e.short}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500 dark:text-ink-400">{e.name}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">{stepLabel(2, t("home.step2"), !!subject)}</div>
      <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1 sm:max-h-none" role="radiogroup" aria-label={t("home.step2")}>
        {exam.subjects.map((s) => {
          const active = s.key === subjectKey;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSubjectKey(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? "border-ink-900 bg-ink-900 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-ink-950"
                  : s.live
                    ? "border-ink-300 bg-white hover:border-ink-900 dark:border-ink-600 dark:bg-ink-900 dark:hover:border-ink-300"
                    : "border-dashed border-ink-300 text-ink-500 hover:border-ink-500 dark:border-ink-700 dark:text-ink-400"
              }`}
            >
              {s.name}
              {s.live ? (
                <span className={`rounded-full px-1.5 text-[10px] font-black uppercase ${active ? "bg-white/20" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"}`}>{t("home.live")}</span>
              ) : (
                <span className="text-[10px] font-bold uppercase opacity-70">{t("common.soon")}</span>
              )}
            </button>
          );
        })}
      </div>

      {subject ? (
        <Link href={`/exams/${exam.key}/${subject.key}`} className="btn btn-primary mt-6 w-full py-3.5 text-base">
          {t("home.go", { exam: exam.short, subject: subject.name })} <ArrowRight width={18} height={18} />
        </Link>
      ) : (
        <button type="button" disabled className="btn btn-primary mt-6 w-full cursor-not-allowed py-3.5 text-base opacity-50">
          {t("home.pickSubject")}
        </button>
      )}
    </div>
  );
}
