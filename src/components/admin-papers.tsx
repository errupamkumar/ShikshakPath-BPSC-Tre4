"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookIcon, CheckIcon, TrophyIcon, UploadIcon } from "./icons";

type Kind = "mock" | "paper";
type Report = {
  testId: string;
  kind: Kind;
  number?: number;
  title: string;
  questionsInFile: number;
  valid: number;
  invalid: { index: number; reason: string }[];
  duplicatesInFile: number;
  alreadyInBank: number;
  newQuestions: number;
  withHindi?: number;
  free?: boolean;
  madeFreeAsFirstMock?: boolean;
};

const KINDS: { key: Kind; title: string; text: string; Icon: typeof BookIcon }[] = [
  { key: "mock", title: "Mock test / practice set", text: "Shown under Mock tests only (Mock Test N).", Icon: TrophyIcon },
  { key: "paper", title: "Previous-year paper (PYQ)", text: "Shown under Previous papers and in PYQs with answers.", Icon: BookIcon },
];

/** Admin: upload one JSON file → exactly ONE test (a mock test or a previous-year paper). */
export function UploadForm({
  subjects,
  exams,
  minutesPerQuestion,
}: {
  subjects: { key: string; name: string }[];
  exams: { key: string; short: string; on: boolean; subjects?: string[]; perMock: number; mockMinutes: number }[];
  minutesPerQuestion: number;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | "">("");
  const [fileName, setFileName] = useState("");
  const [questions, setQuestions] = useState<unknown[] | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [examKey, setExamKey] = useState(exams.find((e) => e.on)?.key ?? "");
  const [subject, setSubject] = useState(subjects[0]?.key ?? "");
  const exam = exams.find((e) => e.key === examKey);
  const allowedSubjects = subjects.filter((x) => !exam?.subjects || exam.subjects.includes(x.key));
  const [year, setYear] = useState("");
  const [duration, setDuration] = useState("");
  const [free, setFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  const suggestMinutes = (n: number, k: Kind | "") =>
    String(Math.max(1, Math.round(k === "mock" && exam ? (exam.mockMinutes * n) / exam.perMock : n * minutesPerQuestion)));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setReport(null);
    setQuestions(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setFileName(file.name);
    try {
      const data = JSON.parse(await file.text()) as unknown;
      if (!Array.isArray(data) || data.length === 0) throw new Error("The file must be a JSON array of questions.");
      const first = data[0] as { question?: unknown; source_file?: unknown };
      if (typeof first?.question !== "string") throw new Error("Each item needs question, options, answer (and explanation).");
      setQuestions(data);
      setPreview(first.question.slice(0, 140));
      const name = (typeof first.source_file === "string" && first.source_file) || file.name.replace(/\.json$/i, "");
      setTitle(name.replace(/_+/g, " ").replace(/\s+/g, " ").trim());
      const y = name.match(/\b(19|20)\d{2}\b/g);
      setYear(y ? y[y.length - 1] : "");
      // A name like "Practice Set-3" or "Mock 2" is almost certainly a mock test.
      const k = kind || (/practice|mock|model|set[\s-]*\d/i.test(name) ? "mock" : "");
      if (k && !kind) setKind(k);
      setDuration(suggestMinutes(data.length, k));
    } catch (err) {
      setError(err instanceof SyntaxError ? "This is not valid JSON." : (err as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!questions || !kind) return;
    setBusy(true);
    setError("");
    setReport(null);
    const res = await fetch("/api/admin/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, kind, title, examKey, subject, year: kind === "paper" && year ? Number(year) : undefined, durationMinutes: Number(duration), free, questions }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { report?: Report; error?: string } | undefined;
    setBusy(false);
    if (res?.ok && data?.report) {
      setReport(data.report);
      setQuestions(null);
      setFileName("");
      router.refresh();
    } else setError(data?.error ?? "Upload failed.");
  }

  const step = "flex items-center gap-2 text-sm font-bold";
  const num = "grid size-6 place-items-center rounded-full bg-ink-900 text-xs font-black text-white dark:bg-brand-300 dark:text-ink-950";

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid gap-6">
        {/* 1. Type */}
        <fieldset className="grid gap-3">
          <legend className={step}>
            <span className={num}>1</span> What is this file?
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {KINDS.map((k) => (
              <label
                key={k.key}
                className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${
                  kind === k.key ? "border-ink-900 bg-brand-50 dark:border-brand-300 dark:bg-brand-900/30" : "border-ink-200 hover:border-ink-400 dark:border-ink-700"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.key}
                  checked={kind === k.key}
                  onChange={() => {
                    setKind(k.key);
                    if (questions) setDuration(suggestMinutes(questions.length, k.key));
                  }}
                  className="sr-only"
                  required
                />
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${kind === k.key ? "bg-ink-900 text-brand-300 dark:bg-brand-300 dark:text-ink-950" : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"}`}>
                  <k.Icon width={18} height={18} />
                </span>
                <span>
                  <span className="flex items-center gap-1.5 font-bold">
                    {k.title} {kind === k.key && <CheckIcon width={15} height={15} className="text-emerald-600" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-600 dark:text-ink-400">{k.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 2. Exam + subject */}
        <fieldset className="grid gap-3">
          <legend className={step}>
            <span className={num}>2</span> Exam and subject
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Exam
              <select
                className="input"
                value={examKey}
                onChange={(e) => {
                  setExamKey(e.target.value);
                  const only = exams.find((x) => x.key === e.target.value)?.subjects;
                  if (only && !only.includes(subject)) setSubject(only[0]);
                }}
                required
              >
                <option value="">Choose exam…</option>
                {[
                  { label: "Shown on the site", on: true },
                  { label: "Switched off (Admin → Exams)", on: false },
                ].map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {exams
                      .filter((x) => x.on === g.on)
                      .map((x) => (
                        <option key={x.key} value={x.key}>
                          {x.short}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Subject
              <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required>
                {allowedSubjects.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        {/* 3. File + details */}
        <fieldset className="grid gap-3">
          <legend className={step}>
            <span className={num}>3</span> File and details
          </legend>
          <label className="mt-3 grid cursor-pointer place-items-center gap-2 rounded-[20px] border-2 border-dashed border-ink-300 bg-ink-50 px-4 py-7 text-center transition hover:border-brand-500 dark:border-ink-700 dark:bg-ink-900">
            <UploadIcon className="text-brand-600 dark:text-brand-300" />
            <span className="text-sm font-bold">{fileName || "Choose a question file (.json)"}</span>
            <span className="text-xs text-ink-500">An array of question, options (A–D), answer, explanation; optional question_hi / options_hi / explanation_hi and section</span>
            <input type="file" accept=".json,application/json" className="sr-only" onChange={onFile} />
          </label>
          {questions && (
            <p className="rounded-2xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
              <strong>{questions.length} questions</strong> found. First: “{preview}…”
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">
              Name shown to students
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "mock" ? "e.g. Practice Set 7" : "e.g. BPSC TRE 3.0 (2024) Computer Science"} required />
            </label>
            {kind !== "mock" && (
              <label className="grid gap-1 text-sm font-medium">
                Year (optional)
                <input className="input" type="number" min={1990} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
              </label>
            )}
            <label className="grid gap-1 text-sm font-medium">
              Time limit (minutes)
              <input className="input" type="number" min={1} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} required />
            </label>
            <label className="flex items-center gap-3 self-end rounded-2xl border border-ink-300 px-4 py-3 text-sm font-medium dark:border-ink-700">
              <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="size-4 accent-brand-600" />
              Free for everyone
            </label>
          </div>
        </fieldset>

        <button className="btn btn-primary py-3.5 text-base" disabled={!questions || !kind || busy}>
          {busy ? "Uploading…" : !kind ? "Choose what this file is (step 1)" : kind === "mock" ? "Upload & create mock test" : "Upload & create previous-year paper"}
        </button>
        {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      </form>

      {report && (
        <div className="rounded-[20px] border border-emerald-300 bg-emerald-50 p-5 text-sm dark:border-emerald-800 dark:bg-emerald-950/30" role="status">
          <p className="text-base font-bold text-emerald-800 dark:text-emerald-300">
            ✓ “{report.title}” is live as {report.kind === "mock" ? `Mock Test ${report.number ?? ""} (Mock tests tab)` : "a previous-year paper (Previous papers tab + PYQs)"}
          </p>
          <ul className="mt-3 grid gap-1 text-ink-700 dark:text-ink-200">
            <li>
              {report.valid} of {report.questionsInFile} questions accepted
              {report.duplicatesInFile ? ` (${report.duplicatesInFile} repeated inside the file)` : ""}.
            </li>
            <li>
              {report.newQuestions} new to this exam&apos;s question bank · {report.alreadyInBank} already in other tests of this exam
              {report.withHindi ? ` · ${report.withHindi} with Hindi` : ""}.
            </li>
            <li>
              {report.free ? "Free for every logged-in student" : "Paid: opens for students who unlocked this exam + subject"}
              {report.madeFreeAsFirstMock ? " (first mock test of this exam + subject, so it is free; change it under Tests)" : ""}.
            </li>
          </ul>
          {report.invalid.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300">{report.invalid.length} question(s) skipped: see why</summary>
              <ul className="mt-2 grid gap-1 text-xs">
                {report.invalid.map((x) => (
                  <li key={x.index}>
                    #{x.index}: {x.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <a href={`/tests/${report.testId}`} className="btn btn-secondary mt-4 px-4 py-2">
            Open the test →
          </a>
        </div>
      )}
    </div>
  );
}

async function send(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { error?: string; removedMocks?: number[] } | undefined;
  return { ok: !!res?.ok, error: data?.error, removedMocks: data?.removedMocks };
}

/**
 * Per-test admin buttons: free/paid, hide/show, rename, delete.
 * `uploadId`: an uploaded test (delete = delete the upload). `poolMock`: a mock built from the question pool.
 */
export function TestControls({
  testId,
  free,
  hidden,
  title,
  uploadId,
  poolMock = false,
}: {
  testId: string;
  free: boolean;
  hidden: boolean;
  title: string;
  uploadId?: string;
  poolMock?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) router.refresh();
    else alert(r.error ?? "Could not update the test.");
  }
  const cls = "rounded-lg px-2 py-1 text-xs font-semibold text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white";
  return (
    <div className="flex flex-wrap justify-end gap-0.5">
      <button type="button" disabled={busy} className={cls} onClick={() => run(() => send(`/api/admin/tests/${testId}`, { free: !free }))}>
        {free ? "Make paid" : "Make free"}
      </button>
      <button type="button" disabled={busy} className={cls} onClick={() => run(() => send(`/api/admin/tests/${testId}`, { hidden: !hidden }))}>
        {hidden ? "Show" : "Hide"}
      </button>
      <button
        type="button"
        disabled={busy}
        className={cls}
        onClick={() => {
          const t = prompt("New name for this test:", title);
          if (t && t.trim() && t !== title) run(() => send(`/api/admin/tests/${testId}`, { title: t }));
        }}
      >
        Rename
      </button>
      {(uploadId || poolMock) && (
        <button
          type="button"
          disabled={busy}
          className={`${cls} text-rose-600 hover:text-rose-700 dark:text-rose-400`}
          onClick={() => {
            if (confirm(`Delete “${title}”? Past results stay, but the test disappears for students.`)) {
              run(() => send(uploadId ? `/api/admin/papers/${uploadId}` : `/api/admin/mocks/${testId}`, undefined, "DELETE"));
            }
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

/** Uploaded file: switch it between mock test and previous-year paper (fixes older uploads that appeared twice). */
export function UploadKindSwitch({ uploadId, kind, title }: { uploadId: string; kind: Kind; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const to: Kind = kind === "mock" ? "paper" : "mock";
  return (
    <button
      type="button"
      disabled={busy}
      className="rounded-lg border border-ink-300 px-2.5 py-1 text-xs font-semibold transition hover:border-ink-900 disabled:opacity-50 dark:border-ink-600"
      onClick={async () => {
        const msg =
          to === "mock"
            ? `Make “${title}” a mock test?\n\nIt moves to the Mock tests tab. Mock tests that were built automatically from its questions are removed, so nothing appears twice.`
            : `Make “${title}” a previous-year paper?\n\nIt moves to the Previous papers tab and PYQs.`;
        if (!confirm(msg)) return;
        setBusy(true);
        const r = await send(`/api/admin/papers/${uploadId}`, { kind: to });
        setBusy(false);
        if (!r.ok) return alert(r.error ?? "Could not change it.");
        if (r.removedMocks?.length) alert(`Done. Removed the duplicate auto-built mock test(s): ${r.removedMocks.map((n) => `Mock Test ${n}`).join(", ")}.`);
        router.refresh();
      }}
    >
      {busy ? "Changing…" : to === "mock" ? "Make it a mock test" : "Make it a previous paper"}
    </button>
  );
}

export function CreateMockButton({ examKey, subject, pool, min }: { examKey: string; subject: string; pool: number; min: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy || pool < min}
      className="btn btn-secondary px-4 py-2"
      title={pool < min ? `Needs at least ${min} questions` : ""}
      onClick={async () => {
        if (!confirm("Build a mixed mock test from previous-paper questions that are in no mock test yet? Students will see these questions both in the papers and in the new mock.")) return;
        setBusy(true);
        const r = await send("/api/admin/mocks", { examKey, subject });
        setBusy(false);
        if (r.ok) router.refresh();
        else alert(r.error ?? "Could not create the mock test.");
      }}
    >
      {busy ? "Creating…" : "Build mixed mock"}
    </button>
  );
}
