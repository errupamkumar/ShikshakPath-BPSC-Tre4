"use client";

import Link from "next/link";
import { subjectByKey } from "@config/subjects";
import { ArrowUpRight } from "./icons";
import { useLang } from "./lang-provider";

export type SubjectCardData = {
  key: string;
  name: string;
  short: string;
  tone: string;
  live: boolean;
  tests: number; // mock + paper tests in this subject
  questions: number;
  examPapers?: number; // previous papers of the selected exam in this subject
};

/** A subject to pick (Exam → Subject). Live subjects show counts; others show "Coming soon". */
export function SubjectCard({ s, href, active = false }: { s: SubjectCardData; href: string; active?: boolean }) {
  const { t, lang } = useLang();
  const name = lang === "hi" ? (subjectByKey.get(s.key)?.nameHi ?? s.name) : s.name;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`card group flex h-full flex-col p-5 transition duration-300 ${
        s.live ? "hover:-translate-y-1 hover:shadow-xl hover:shadow-ink-900/5" : "border-dashed opacity-80 hover:opacity-100"
      } ${active ? "ring-2 ring-ink-900 dark:ring-brand-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-2xl text-[13px] font-black ring-1 ${s.tone}`}>{s.short}</span>
        {s.live ? (
          <span className="grid size-8 place-items-center rounded-full border border-ink-200 text-ink-500 transition group-hover:border-ink-900 group-hover:bg-ink-900 group-hover:text-white dark:border-ink-700 dark:group-hover:bg-brand-300 dark:group-hover:text-ink-950">
            <ArrowUpRight width={15} height={15} />
          </span>
        ) : (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-ink-500 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-ink-800 dark:text-ink-400">
            {t("common.comingSoon")}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-[17px] leading-tight font-bold">{name}</h3>
      <p className="mt-auto pt-3 text-xs font-bold">
        {s.live ? (
          <span className="text-brand-700 dark:text-brand-300">
            {t("sc.stats", { t: s.tests, q: s.questions.toLocaleString("en-IN") })}
            {s.examPapers ? ` · ${t("sc.prevPapers", { n: s.examPapers })}` : ""}
          </span>
        ) : (
          <span className="text-ink-500 dark:text-ink-400">{t("sc.preparing")}</span>
        )}
      </p>
    </Link>
  );
}
