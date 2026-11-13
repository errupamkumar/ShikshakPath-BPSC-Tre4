"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { clock, fractionLabel } from "@/lib/format";
import { SKIP, type OptionKey, type PublicQuestion } from "@/lib/types";
import { ChevronLeft, ChevronRight, ClockIcon, FlagIcon, GridIcon, LogoutIcon, XIcon } from "./icons";
import { LanguageSwitch, useLang } from "./lang-provider";
import { PaletteLegend, statusStyle, type QStatus } from "./palette";

type Snapshot = {
  answers: Record<string, OptionKey>;
  marked: string[];
  visited: string[];
  current: number;
  savedAt: number;
};

type Props = {
  attemptId: string;
  testId: string;
  title: string;
  questions: PublicQuestion[];
  initial: Snapshot;
  deadlineAt: number;
  serverNow: number;
  optionELabel: string | null; // null = Option E disabled
  marking: string;
  blankPenalty: number;
  allowPause: boolean;
  /** Sections of the test in question order (one section = no section tabs). */
  sections?: { name: string; nameHi: string; count: number }[];
};

const SAVE_DEBOUNCE_MS = 2500;
const storageKey = (id: string) => `cts-attempt-${id}`;

export function TestPlayer({ attemptId, testId, title, questions, initial, deadlineAt, serverNow, optionELabel, marking, blankPenalty, allowPause, sections = [] }: Props) {
  const router = useRouter();
  const { t, lang } = useLang();
  const total = questions.length;
  const clamp = (i: number) => Math.min(Math.max(0, i), total - 1);
  const eLabel = optionELabel ? (lang === "hi" ? t("pl.optionE") : optionELabel) : null;
  // Sections: first question index of each, and the section of every question.
  const secs = useMemo(() => {
    let start = 0;
    return sections.map((sec) => {
      const r = { ...sec, start, end: start + sec.count };
      start += sec.count;
      return r;
    });
  }, [sections]);
  const multi = secs.length > 1;
  const secName = (sec: { name: string; nameHi: string }) => (lang === "hi" ? sec.nameHi : sec.name);
  const sectionOf = (i: number) => secs.find((sec) => i >= sec.start && i < sec.end);

  const [answers, setAnswers] = useState<Record<string, OptionKey>>(initial.answers);
  const [marked, setMarked] = useState<Set<string>>(() => new Set(initial.marked));
  const [visited, setVisited] = useState<Set<string>>(() => new Set(initial.visited));
  const [current, setCurrent] = useState(() => clamp(initial.current));
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((deadlineAt - serverNow) / 1000)));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");

  const offset = useRef(0); // server clock minus browser clock
  const restored = useRef(false);
  const skipFirstPersist = useRef(true);
  const dirty = useRef(false);
  const submitted = useRef(false); // also set while exiting, to stop saves & the timer
  const nextAutoRetry = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Snapshot>(initial);
  const actions = useRef({ flush: async () => {}, submit: async (_auto: boolean) => {}, go: (_i: number) => {}, choose: (_k: OptionKey) => {} });

  const q = questions[current];
  const keys = useMemo(() => {
    const k = Object.keys(q?.options ?? {}) as OptionKey[];
    return optionELabel ? [...k, SKIP] : k;
  }, [q, optionELabel]);

  // Hindi content when chosen and available; otherwise English.
  const wantHi = lang === "hi";
  const qText = wantHi && q?.hi?.question ? q.hi.question : q?.question;
  const optText = (k: OptionKey) => (wantHi && q?.hi?.options?.[k]) || q?.options[k];
  const hindiMissing = wantHi && !!q && !q.hi?.question;

  function statusOf(id: string): QStatus {
    const a = !!answers[id];
    const m = marked.has(id);
    if (a && m) return "answered_marked";
    if (m) return "marked";
    if (a) return "answered";
    if (visited.has(id)) return "not_answered";
    return "not_visited";
  }
  const counts = useMemo(() => {
    const c: Record<QStatus, number> = { not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0 };
    for (const qq of questions) c[statusOf(qq.id)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, marked, visited, questions]);
  const unanswered = total - counts.answered - counts.answered_marked;

  // ── 1. Restore newer progress from this device (e.g. after a reload while offline) ──
  useEffect(() => {
    offset.current = serverNow - Date.now();
    try {
      const raw = localStorage.getItem(storageKey(attemptId));
      if (raw) {
        const local = JSON.parse(raw) as Snapshot;
        if (local.savedAt > initial.savedAt) {
          const ids = new Set(questions.map((x) => x.id));
          setAnswers(Object.fromEntries(Object.entries(local.answers ?? {}).filter(([k]) => ids.has(k))));
          setMarked(new Set((local.marked ?? []).filter((k) => ids.has(k))));
          setVisited(new Set((local.visited ?? []).filter((k) => ids.has(k))));
          setCurrent(clamp(local.current ?? 0));
        }
      }
    } catch {}
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Persist every change: instantly to this device, debounced to the server ──
  useEffect(() => {
    if (!restored.current) return;
    // Skip the mount run: it would overwrite newer device progress before the restore lands.
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    const snap: Snapshot = { answers, marked: [...marked], visited: [...visited], current, savedAt: Date.now() };
    latest.current = snap;
    try {
      localStorage.setItem(storageKey(attemptId), JSON.stringify(snap));
    } catch {}
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => actions.current.flush(), SAVE_DEBOUNCE_MS);
  }, [answers, marked, visited, current, attemptId]);

  // Mark the question on screen as visited.
  useEffect(() => {
    const id = questions[current]?.id;
    if (id && !visited.has(id)) setVisited((v) => new Set(v).add(id));
  }, [current, questions, visited]);

  async function flush() {
    if (!dirty.current || submitted.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest.current),
      });
      if (res.status === 409) return router.replace(`/results/${attemptId}`);
      if (res.status === 410) return void actions.current.submit(true);
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      dirty.current = true;
      setSaveState("offline");
    }
  }

  async function submit(auto: boolean) {
    if (submitted.current) return;
    submitted.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSubmitting(true);
    setSubmitError("");
    setConfirmOpen(false);
    setExitOpen(false);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: latest.current.answers, marked: latest.current.marked, auto }),
      });
      const data = (await res.json().catch(() => ({}))) as { resultUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      try {
        localStorage.removeItem(storageKey(attemptId));
      } catch {}
      router.replace(data.resultUrl ?? `/results/${attemptId}`);
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      nextAutoRetry.current = Date.now() + 5000;
      setSubmitError(`${(e as Error).message || "Network error."} ${t("pl.safe")}; ${auto ? t("pl.retrying") : t("pl.tryAgain")}.`);
    }
  }

  /** Exit: save everything, pause the timer (if allowed) and go back to the test page. */
  async function exitTest() {
    if (submitted.current) return;
    submitted.current = true; // stop autosave & the timer while leaving
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setExiting(true);
    const snap: Snapshot = { answers, marked: [...marked], visited: [...visited], current, savedAt: Date.now() };
    try {
      localStorage.setItem(storageKey(attemptId), JSON.stringify(snap));
    } catch {}
    try {
      const res = await fetch(`/api/attempts/${attemptId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snap),
      });
      if (res.status === 409) return router.replace(`/results/${attemptId}`);
      if (res.status === 410) {
        submitted.current = false;
        return void submit(true);
      }
      if (!res.ok) throw new Error();
      router.push(`/tests/${testId}`);
      router.refresh();
    } catch {
      submitted.current = false;
      setExiting(false);
      setSubmitError(`${t("pl.safe")}; ${t("pl.tryAgain")}.`);
    }
  }

  function go(i: number) {
    setCurrent(clamp(i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function choose(key: OptionKey) {
    if (!q || !keys.includes(key)) return;
    setAnswers((a) => ({ ...a, [q.id]: key }));
  }
  function clearResponse() {
    if (!q) return;
    setAnswers((a) => {
      const { [q.id]: _removed, ...rest } = a;
      return rest;
    });
  }
  function markAndNext() {
    if (!q) return;
    setMarked((m) => {
      const n = new Set(m);
      if (n.has(q.id)) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
    if (!marked.has(q.id) && current < total - 1) go(current + 1);
  }

  useEffect(() => {
    actions.current = { flush, submit, go, choose };
  });

  // ── 3. Timer, synced to the server clock. Auto-submits at 00:00. ──
  useEffect(() => {
    const tick = () => {
      if (submitted.current) return;
      const left = Math.max(0, Math.floor((deadlineAt - (Date.now() + offset.current)) / 1000));
      setRemaining(left);
      if (left <= 0 && Date.now() >= nextAutoRetry.current) actions.current.submit(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  // ── 4. Save when the tab is hidden/closed, and retry when back online ──
  useEffect(() => {
    const beacon = () => {
      if (!dirty.current || submitted.current) return;
      const blob = new Blob([JSON.stringify(latest.current)], { type: "application/json" });
      if (navigator.sendBeacon?.(`/api/attempts/${attemptId}/save`, blob)) dirty.current = false;
    };
    const onVisibility = () => document.visibilityState === "hidden" && beacon();
    const onOnline = () => actions.current.flush();
    const retry = setInterval(() => dirty.current && actions.current.flush(), 15000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", beacon);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(retry);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", beacon);
      window.removeEventListener("online", onOnline);
    };
  }, [attemptId]);

  // ── 5. Keyboard: A–E / 1–5 choose, ← → navigate (desktop) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen || exitOpen || paletteOpen || submitting || exiting || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") actions.current.go(current + 1);
      else if (e.key === "ArrowLeft") actions.current.go(current - 1);
      else {
        const k = e.key.toUpperCase();
        const byNumber: Record<string, OptionKey> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" };
        const key = (byNumber[k] ?? k) as OptionKey;
        if (["A", "B", "C", "D", "E"].includes(key)) actions.current.choose(key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, exitOpen, paletteOpen, submitting, exiting, current]);

  if (!q) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <p>
          {t("pl.noQuestions")}{" "}
          <Link href="/tests" className="text-brand-600 underline">
            {t("pl.backToTests")}
          </Link>
        </p>
      </div>
    );
  }

  const lowTime = remaining <= 300;
  const isMarked = marked.has(q.id);
  const statusText = (s: QStatus) => t(`pal.${s}` as const);

  const palette = (
    <div className="grid gap-4">
      <PaletteLegend counts={counts} />
      <div className="grid max-h-[50dvh] grid-cols-6 gap-2 overflow-y-auto p-1 sm:grid-cols-8 lg:max-h-[calc(100dvh-22rem)] lg:grid-cols-6">
        {questions.map((qq, i) => {
          const s = statusOf(qq.id);
          const head = multi ? secs.find((sec) => sec.start === i) : undefined;
          return (
            <Fragment key={qq.id}>
            {head && (
              <p className="col-span-full mt-1 border-b border-ink-200 pb-1 text-xs font-bold tracking-wide text-ink-600 uppercase first:mt-0 dark:border-ink-700 dark:text-ink-300">
                {secName(head)} <span className="font-medium text-ink-400">({head.count})</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                go(i);
                setPaletteOpen(false);
              }}
              aria-label={`${t("pl.questionOf", { n: i + 1, total })}: ${statusText(s)}`}
              aria-current={i === current ? "true" : undefined}
              data-status={s}
              className={`relative grid h-10 place-items-center rounded-lg border text-sm font-semibold ${statusStyle[s]} ${i === current ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-ink-900" : ""}`}
            >
              {i + 1}
              {s === "answered_marked" && (
                <span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-ink-900" />
              )}
            </button>
            </Fragment>
          );
        })}
      </div>
      <button type="button" className="btn btn-primary w-full py-3" onClick={() => { setPaletteOpen(false); setConfirmOpen(true); }}>
        {t("pl.submitTest")}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-2 px-3 sm:px-4 lg:px-6">
          <button type="button" className="btn btn-ghost px-2 py-2" onClick={() => setExitOpen(true)} aria-label={t("pl.exit")} title={t("pl.exit")}>
            <LogoutIcon width={18} height={18} className="rotate-180" />
            <span className="hidden sm:inline">{t("pl.exit")}</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
            <p className="text-[11px] text-ink-500 dark:text-ink-400">
              {saveState === "saving" ? t("pl.saving") : saveState === "offline" ? t("pl.offline") : t("pl.saved")}
            </p>
          </div>
          <LanguageSwitch compact />
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${lowTime ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100"}`}
            aria-live="off"
            title={t("pl.timeLeft")}
          >
            <ClockIcon width={16} height={16} /> {clock(remaining)}
          </span>
          <button type="button" className="btn btn-secondary px-2.5 py-2 lg:hidden" onClick={() => setPaletteOpen(true)} aria-label={t("pl.openPalette")}>
            <GridIcon width={18} height={18} />
          </button>
          <button type="button" className="btn btn-primary hidden px-4 py-2 sm:inline-flex" onClick={() => setConfirmOpen(true)}>
            {t("pl.submit")}
          </button>
        </div>
      </header>

      {submitError && <div className="bg-rose-50 px-4 py-2 text-center text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{submitError}</div>}

      <div className="mx-auto flex w-full max-w-[1680px] flex-1 gap-5 px-3 py-4 sm:px-4 lg:px-6 lg:py-6 2xl:gap-8">
        {/* Question */}
        <main className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
          {multi && (
            <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label={t("pl.sections")}>
              {secs.map((sec) => {
                const active = current >= sec.start && current < sec.end;
                const done = questions.slice(sec.start, sec.end).filter((qq) => answers[qq.id]).length;
                return (
                  <button
                    key={sec.start}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => go(sec.start)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                      active ? "border-ink-900 bg-ink-900 text-white dark:border-brand-300 dark:bg-brand-300 dark:text-ink-950" : "border-ink-200 bg-white hover:border-ink-400 dark:border-ink-700 dark:bg-ink-900"
                    }`}
                  >
                    {secName(sec)} <span className="opacity-70">{done}/{sec.count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <article className="card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">
                {t("pl.questionOf", { n: current + 1, total })}
              </p>
              <div className="flex items-center gap-2 text-xs">
                {isMarked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    <FlagIcon width={12} height={12} /> {t("pl.marked")}
                  </span>
                )}
                <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">{marking}</span>
              </div>
            </div>
            <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
              {multi && sectionOf(current) && <span className="mr-2 rounded bg-ink-100 px-1.5 py-0.5 font-bold text-ink-700 dark:bg-ink-800 dark:text-ink-200">{secName(sectionOf(current)!)}</span>}
              {q.sources.join(" · ")}
            </p>
            {hindiMissing && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t("pl.hindiMissing")}</p>}

            <div className="q-text mt-4 text-[15px] leading-relaxed sm:text-lg" lang={wantHi && q.hi?.question ? "hi" : "en"}>
              {qText}
            </div>

            <div className="mt-6 grid gap-2.5" role="radiogroup" aria-label={t("pl.questionOf", { n: current + 1, total })}>
              {keys.map((key) => {
                const selected = answers[q.id] === key;
                const isSkip = key === SKIP && !!eLabel;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(key)}
                    className={[
                      "flex w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition sm:px-4",
                      isSkip ? "border-dashed" : "",
                      selected
                        ? "border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/50"
                        : "border-ink-200 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:hover:border-ink-600 dark:hover:bg-ink-800/60",
                    ].join(" ")}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${selected ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200"}`}
                    >
                      {key}
                    </span>
                    <span className={`q-text pt-0.5 ${isSkip ? "text-ink-500 italic dark:text-ink-400" : ""}`}>{isSkip ? eLabel : optText(key)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={clearResponse} disabled={!answers[q.id]} className="btn btn-ghost px-3 py-1.5 text-sm">
                {t("pl.clear")}
              </button>
            </div>
          </article>

          {/* Navigation (fixed at the bottom on phones) */}
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-white/95 p-3 backdrop-blur lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0 dark:border-ink-800 dark:bg-ink-900/95 lg:dark:bg-transparent">
            <div className="mx-auto grid max-w-[1680px] grid-cols-[auto_1fr_1fr] gap-2">
              <button type="button" className="btn btn-secondary px-3" onClick={() => go(current - 1)} disabled={current === 0} aria-label={t("pl.previous")}>
                <ChevronLeft width={18} height={18} />
                <span className="hidden sm:inline">{t("pl.previous")}</span>
              </button>
              <button
                type="button"
                className="btn border border-violet-300 bg-violet-50 px-2 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                onClick={markAndNext}
              >
                <FlagIcon width={16} height={16} />
                {isMarked ? (
                  t("pl.unmark")
                ) : (
                  <>
                    <span className="sm:hidden">{t("pl.mark")}</span>
                    <span className="hidden sm:inline">{t("pl.markNext")}</span>
                  </>
                )}
              </button>
              {current < total - 1 ? (
                <button type="button" className="btn btn-primary px-2" onClick={() => go(current + 1)}>
                  {t("pl.saveNext")} <ChevronRight width={18} height={18} />
                </button>
              ) : (
                <button type="button" className="btn btn-primary px-2" onClick={() => setConfirmOpen(true)}>
                  {t("pl.submitTest")}
                </button>
              )}
            </div>
          </nav>
        </main>

        {/* Palette: sidebar on desktop */}
        <aside className="hidden w-80 shrink-0 lg:block 2xl:w-96">
          <div className="card sticky top-20 p-4">{palette}</div>
        </aside>
      </div>

      {/* Palette: drawer on phones/tablets */}
      {paletteOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("pl.questions")}>
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label={t("pl.close")} onClick={() => setPaletteOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(22rem,90vw)] overflow-y-auto bg-white p-4 shadow-xl dark:bg-ink-900">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold">{t("pl.questions")}</p>
              <button type="button" className="btn btn-ghost px-2" onClick={() => setPaletteOpen(false)} aria-label={t("pl.close")}>
                <XIcon />
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="submit-title" className="text-xl font-bold">
              {t("pl.submitTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
              {t("pl.timeLeft")}: {clock(remaining)}
            </p>
            <div className="mt-4">
              <PaletteLegend counts={counts} />
            </div>
            {unanswered > 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {t("pl.blankWarn", { n: unanswered })}{" "}
                {eLabel && blankPenalty > 0 ? t("pl.blankPenalty", { p: fractionLabel(blankPenalty), label: eLabel }) : ""}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" className="btn btn-secondary py-3" onClick={() => setConfirmOpen(false)}>
                {t("pl.backToTest")}
              </button>
              <button type="button" className="btn btn-primary py-3" onClick={() => submit(false)}>
                {t("pl.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit (pause) confirmation */}
      {exitOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="exit-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="exit-title" className="text-xl font-bold">
              {t("pl.exitTitle")}
            </h2>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{allowPause ? t("pl.exitPause", { t: clock(remaining) }) : t("pl.exitRun")}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn btn-secondary py-3" onClick={() => setExitOpen(false)} disabled={exiting}>
                {t("pl.continue")}
              </button>
              <button type="button" className="btn btn-primary py-3" onClick={exitTest} disabled={exiting}>
                {exiting ? t("pl.exiting") : t("pl.saveExit")}
              </button>
            </div>
            <button type="button" className="btn btn-ghost mt-2 w-full py-2 text-sm" onClick={() => { setExitOpen(false); setConfirmOpen(true); }} disabled={exiting}>
              {t("pl.submitTest")}
            </button>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-white/80 backdrop-blur-sm dark:bg-ink-950/80">
          <p className="text-lg font-semibold">{remaining <= 0 ? t("pl.timeUp") : t("pl.submitting")}</p>
        </div>
      )}
    </div>
  );
}
