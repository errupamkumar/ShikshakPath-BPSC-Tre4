"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MenuExam } from "./header/types";
import { ExamLogo } from "./exam-logo";
import { ArrowRight, CheckIcon } from "./icons";
import { useLang } from "./lang-provider";

const key = (exam: string, subject: string) => `${exam}|${subject}`;

/** After sign-up: pick one or more exams, and the subjects for each (multi-select). */
export function OnboardingForm({ exams, initial, next }: { exams: MenuExam[]; initial: { exam: string; subject: string }[]; next: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial.map((i) => key(i.exam, i.subject))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (k: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  async function save() {
    setBusy(true);
    setError("");
    const interests = [...picked].map((k) => {
      const [exam, subject] = k.split("|");
      return { exam, subject };
    });
    const res = await fetch("/api/me/interests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interests }) }).catch(() => null);
    if (res?.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setError(data?.error || t("ob.error"));
    setBusy(false);
  }

  return (
    <div className="grid gap-5">
      {exams.map((e) => {
        const count = e.subjects.filter((s) => picked.has(key(e.key, s.key))).length;
        return (
          <section key={e.key} className={`card p-5 transition sm:p-6 ${count ? "ring-2 ring-ink-900 dark:ring-brand-300" : ""}`}>
            <div className="flex flex-wrap items-center gap-4">
              <ExamLogo exam={e} size={56} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black tracking-tight">{e.short}</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400">{e.name}</p>
              </div>
              {count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <CheckIcon width={14} height={14} /> {t("ob.selected", { n: count })}
                </span>
              )}
            </div>
            <p className="mt-4 text-xs font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400">{t("ob.subjects")}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${e.short}: ${t("ob.subjects")}`}>
              {e.subjects.map((s) => {
                const on = picked.has(key(e.key, s.key));
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(key(e.key, s.key))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                      on
                        ? "border-ink-900 bg-ink-900 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-ink-950"
                        : s.live
                          ? "border-ink-300 bg-white hover:border-ink-900 dark:border-ink-600 dark:bg-ink-900"
                          : "border-dashed border-ink-300 text-ink-500 hover:border-ink-500 dark:border-ink-700 dark:text-ink-400"
                    }`}
                  >
                    {on && <CheckIcon width={14} height={14} />}
                    {s.name}
                    {!s.live && <span className="text-[10px] font-bold uppercase opacity-70">{t("common.soon")}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-ink-200 bg-ink-50/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 dark:border-ink-800 dark:bg-ink-950/95">
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={save} disabled={busy || picked.size === 0} className="btn btn-primary px-8 py-3.5 text-base disabled:opacity-50">
            {busy ? t("ob.saving") : picked.size ? t("ob.continue", { n: picked.size }) : t("ob.pickOne")} <ArrowRight width={18} height={18} />
          </button>
          <p className="text-sm text-ink-500 dark:text-ink-400">{t("ob.note")}</p>
        </div>
      </div>
    </div>
  );
}
