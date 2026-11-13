"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPTION_KEYS_CLIENT } from "@/lib/option-keys";
import type { HindiText, OptionKey, Options } from "@/lib/types";
import { CheckIcon } from "./icons";
import { useLang } from "./lang-provider";

export type PyqItem = {
  n: number;
  id: string;
  question: string;
  options: Options;
  answer: OptionKey;
  explanation: string;
  hi?: HindiText;
  sources: string[];
};

/** Study mode: questions with "Show answer" toggles. Admins can edit any question. */
export function PyqViewer({ items, canEdit }: { items: PyqItem[]; canEdit: boolean }) {
  const { t, lang } = useLang();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const allShown = shown.size === items.length && items.length > 0;
  const hi = lang === "hi";
  const toggle = (id: string) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="btn btn-secondary px-4 py-2" onClick={() => setShown(allShown ? new Set() : new Set(items.map((i) => i.id)))}>
          {allShown ? t("pyq.hideAll") : t("pyq.showAll")}
        </button>
      </div>
      <ol className="mt-4 grid gap-4">
        {items.map((item) => {
          const open = shown.has(item.id);
          const qText = (hi && item.hi?.question) || item.question;
          const expl = (hi && item.hi?.explanation) || item.explanation;
          if (editing === item.id) return <QuestionEditor key={item.id} item={item} onDone={() => setEditing(null)} />;
          return (
            <li key={item.id} id={`q${item.n}`} className="card scroll-mt-28 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">Q{item.n}</p>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => setEditing(item.id)}>
                      ✎ {t("pyq.edit")}
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary px-3 py-1 text-xs" onClick={() => toggle(item.id)} aria-expanded={open}>
                    {open ? t("pyq.hideAnswer") : t("pyq.showAnswer")}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                {t("rev.askedIn")} {item.sources.join(" · ")}
              </p>
              <p className="q-text mt-3 leading-relaxed">{qText}</p>
              <ul className="mt-4 grid gap-2">
                {(Object.entries(item.options) as [OptionKey, string][]).map(([key, text]) => {
                  const correct = open && key === item.answer;
                  return (
                    <li
                      key={key}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${correct ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-ink-200 dark:border-ink-700"}`}
                    >
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${correct ? "bg-emerald-500 text-white" : "bg-ink-100 dark:bg-ink-800"}`}>
                        {correct ? <CheckIcon width={14} height={14} /> : key}
                      </span>
                      <span className="q-text flex-1">{(hi && item.hi?.options?.[key]) || text}</span>
                    </li>
                  );
                })}
              </ul>
              {open && (
                <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/60">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {t("pyq.answer")}: {item.answer}
                  </p>
                  {expl && (
                    <>
                      <p className="mt-2 font-semibold">{t("pyq.explanation")}</p>
                      <p className="q-text mt-1 text-ink-700 dark:text-ink-300">{expl}</p>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Admin "write": correct a question's text, options, answer key, explanation and Hindi version. */
function QuestionEditor({ item, onDone }: { item: PyqItem; onDone: () => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState(item.question);
  const [options, setOptions] = useState<Options>({ ...item.options });
  const [answer, setAnswer] = useState<OptionKey>(item.answer);
  const [explanation, setExplanation] = useState(item.explanation);
  const [qHi, setQHi] = useState(item.hi?.question ?? "");
  const [oHi, setOHi] = useState<Options>({ ...(item.hi?.options ?? {}) });
  const [eHi, setEHi] = useState(item.hi?.explanation ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keys = OPTION_KEYS_CLIENT.filter((k) => k !== "E" || options.E !== undefined);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/questions/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, options, answer, explanation, question_hi: qHi, options_hi: oHi, explanation_hi: eHi }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (res?.ok) {
      onDone();
      router.refresh();
    } else setError(data?.error ?? "Could not save.");
  }

  const area = "input min-h-24 text-sm";
  return (
    <li className="card border-brand-400 p-4 ring-2 ring-brand-300/40 sm:p-6">
      <p className="font-bold">Edit Q{item.n} (admin)</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <p className="text-xs font-bold tracking-wide text-ink-500 uppercase">English</p>
          <textarea className={area} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Question" />
          {keys.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`ans-${item.id}`} checked={answer === k} onChange={() => setAnswer(k)} className="size-4 accent-emerald-600" aria-label={`Correct answer ${k}`} />
              <span className="w-5 font-bold">{k}</span>
              <input className="input py-2 text-sm" value={options[k] ?? ""} onChange={(e) => setOptions((o) => ({ ...o, [k]: e.target.value }))} />
            </label>
          ))}
          <textarea className={area} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explanation" aria-label="Explanation" />
        </div>
        <div className="grid gap-3" lang="hi">
          <p className="text-xs font-bold tracking-wide text-ink-500 uppercase">हिंदी (optional)</p>
          <textarea className={area} value={qHi} onChange={(e) => setQHi(e.target.value)} placeholder="प्रश्न" aria-label="Question in Hindi" />
          {keys.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <span className="w-5 font-bold">{k}</span>
              <input className="input py-2 text-sm" value={oHi[k] ?? ""} onChange={(e) => setOHi((o) => ({ ...o, [k]: e.target.value }))} placeholder={`विकल्प ${k}`} />
            </label>
          ))}
          <textarea className={area} value={eHi} onChange={(e) => setEHi(e.target.value)} placeholder="व्याख्या" aria-label="Explanation in Hindi" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save for everyone"}
        </button>
      </div>
      <p className="mt-2 text-right text-xs text-ink-500">Changes apply to every test and result that uses this question.</p>
    </li>
  );
}
