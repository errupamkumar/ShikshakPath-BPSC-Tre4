"use client";

import { useState } from "react";
import type { HindiText, OptionKey, Options } from "@/lib/types";
import { CheckIcon, XIcon } from "./icons";
import { useLang } from "./lang-provider";

export type ReviewItem = {
  n: number;
  id: string;
  question: string;
  options: Options;
  answer: OptionKey;
  explanation: string;
  hi?: HindiText;
  sources: string[];
  chosen: OptionKey | null;
  status: "correct" | "wrong" | "skipped" | "blank";
};

const FILTERS = ["all", "wrong", "correct", "unattempted"] as const;
type FilterKey = (typeof FILTERS)[number];

const badgeCls: Record<ReviewItem["status"], string> = {
  correct: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  wrong: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  skipped: "bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
  blank: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
};

export function ResultReview({ items, optionELabel }: { items: ReviewItem[]; optionELabel: string | null }) {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState<FilterKey>("all");
  const hi = lang === "hi";
  const eLabel = optionELabel ? (hi ? t("pl.optionE") : optionELabel) : null;
  const matches = (i: ReviewItem, f: FilterKey) =>
    f === "all" ? true : f === "unattempted" ? i.status === "skipped" || i.status === "blank" : i.status === f;
  const shown = items.filter((i) => matches(i, filter));
  const label: Record<FilterKey, string> = { all: t("rev.all"), wrong: t("rev.wrong"), correct: t("rev.correct"), unattempted: t("rev.unattempted") };
  const badge: Record<ReviewItem["status"], string> = { correct: t("rev.bCorrect"), wrong: t("rev.bWrong"), skipped: t("rev.bSkipped"), blank: t("rev.bBlank") };

  return (
    <div>
      <div className="sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto bg-ink-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0 dark:bg-ink-950/95">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`btn shrink-0 rounded-full px-4 py-1.5 ${filter === f ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900" : "btn-secondary"}`}
          >
            {label[f]} <span className="opacity-70">{items.filter((i) => matches(i, f)).length}</span>
          </button>
        ))}
      </div>

      <ol className="mt-2 grid gap-4">
        {shown.map((item) => {
          const qText = (hi && item.hi?.question) || item.question;
          const expl = (hi && item.hi?.explanation) || item.explanation;
          return (
            <li key={item.id} className="card p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">Q{item.n}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeCls[item.status]}`}>{badge[item.status]}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                {t("rev.askedIn")} {item.sources.join(" · ")}
              </p>
              <p className="q-text mt-3 leading-relaxed">{qText}</p>

              <ul className="mt-4 grid gap-2">
                {(Object.entries(item.options) as [OptionKey, string][]).map(([key, text]) => {
                  const isAnswer = key === item.answer;
                  const isWrongPick = key === item.chosen && !isAnswer;
                  return (
                    <li
                      key={key}
                      className={[
                        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm",
                        isAnswer ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : isWrongPick ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40" : "border-ink-200 dark:border-ink-700",
                      ].join(" ")}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${isAnswer ? "bg-emerald-500 text-white" : isWrongPick ? "bg-rose-500 text-white" : "bg-ink-100 dark:bg-ink-800"}`}
                      >
                        {isAnswer ? <CheckIcon width={14} height={14} /> : isWrongPick ? <XIcon width={14} height={14} /> : key}
                      </span>
                      <span className="q-text flex-1">{(hi && item.hi?.options?.[key]) || text}</span>
                      {key === item.chosen && <span className="shrink-0 text-xs font-semibold text-ink-500">{t("rev.yourAnswer")}</span>}
                    </li>
                  );
                })}
                {item.chosen === "E" && eLabel && (
                  <li className="rounded-xl border border-dashed border-ink-300 px-3 py-2.5 text-sm text-ink-500 italic dark:border-ink-700">{t("rev.choseE", { label: eLabel })}</li>
                )}
              </ul>

              {expl && (
                <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/60">
                  <p className="font-semibold">{t("rev.answerExpl", { a: item.answer })}</p>
                  <p className="q-text mt-1 text-ink-700 dark:text-ink-300">{expl}</p>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="card p-6 text-center text-ink-500">{t("rev.nothing")}</li>}
      </ol>
    </div>
  );
}
