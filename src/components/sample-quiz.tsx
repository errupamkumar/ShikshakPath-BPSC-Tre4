"use client";

import { useState } from "react";
import type { OptionKey, PublicQuestion } from "@/lib/types";
import { CheckIcon, XIcon } from "./icons";
import { useLang } from "./lang-provider";

type Checked = { chosen: OptionKey; answer: OptionKey; explanation: string };

export function SampleQuiz({ questions }: { questions: PublicQuestion[] }) {
  const { t } = useLang();
  const [checked, setChecked] = useState<Record<string, Checked>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function choose(q: PublicQuestion, key: OptionKey) {
    if (checked[q.id] || loading) return;
    setLoading(q.id);
    try {
      const res = await fetch("/api/sample/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { answer: OptionKey; explanation: string };
      setChecked((c) => ({ ...c, [q.id]: { chosen: key, ...data } }));
    } catch {
      alert("Could not check the answer. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {questions.map((q, i) => {
        const c = checked[q.id];
        return (
          <div key={q.id} className="card flex flex-col p-5">
            <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-400">
              {t("sq.sample", { n: i + 1 })} · {q.sources[0]}
            </p>
            <p className="q-text mt-2 font-medium">{q.question}</p>
            <div className="mt-4 grid gap-2">
              {(Object.entries(q.options) as [OptionKey, string][]).map(([key, text]) => {
                const isAnswer = c && key === c.answer;
                const isWrongPick = c && key === c.chosen && c.chosen !== c.answer;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!!c || loading === q.id}
                    onClick={() => choose(q, key)}
                    className={[
                      "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                      isAnswer
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                        : isWrongPick
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
                          : "border-ink-200 hover:border-brand-400 hover:bg-brand-50/50 dark:border-ink-700 dark:hover:bg-ink-800",
                    ].join(" ")}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-bold dark:bg-ink-800">
                      {isAnswer ? <CheckIcon width={14} height={14} /> : isWrongPick ? <XIcon width={14} height={14} /> : key}
                    </span>
                    <span className="q-text">{text}</span>
                  </button>
                );
              })}
            </div>
            {c && (
              <div className="mt-4 rounded-xl bg-ink-50 p-3 text-sm text-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
                <p className={`font-semibold ${c.chosen === c.answer ? "text-emerald-600" : "text-rose-600"}`}>
                  {c.chosen === c.answer ? t("sq.correct") : t("sq.correctAnswer", { a: c.answer })}
                </p>
                <p className="q-text mt-1">{c.explanation}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
