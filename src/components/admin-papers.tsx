"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadIcon } from "./icons";

type Report = {
  testId: string;
  title: string;
  questionsInFile: number;
  valid: number;
  invalid: { index: number; reason: string }[];
  duplicatesInFile: number;
  alreadyInBank: number;
  newQuestions: number;
  mocksCreated: number[];
  poolRemaining: number;
};

/** Admin: upload one question paper (JSON) → it becomes a test automatically. */
export function UploadForm({
  subjects,
  exams,
  minutesPerQuestion,
}: {
  subjects: { key: string; name: string }[];
  exams: { key: string; short: string; on: boolean; subjects?: string[] }[];
  minutesPerQuestion: number;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [questions, setQuestions] = useState<unknown[] | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [examKey, setExamKey] = useState("");
  const [subject, setSubject] = useState(subjects[0]?.key ?? "");
  const allowedSubjects = subjects.filter((x) => !examKey || !exams.find((e) => e.key === examKey)?.subjects || exams.find((e) => e.key === examKey)!.subjects!.includes(x.key));
  const [year, setYear] = useState("");
  const [duration, setDuration] = useState("");
  const [free, setFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

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
      setDuration(String(Math.max(1, Math.round(data.length * minutesPerQuestion))));
    } catch (err) {
      setError(err instanceof SyntaxError ? "This is not valid JSON." : (err as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!questions) return;
    setBusy(true);
    setError("");
    setReport(null);
    const res = await fetch("/api/admin/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, title, examKey, subject, year: year ? Number(year) : undefined, durationMinutes: Number(duration), free, questions }),
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

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid cursor-pointer place-items-center gap-2 rounded-[20px] border-2 border-dashed border-ink-300 bg-ink-50 px-4 py-8 text-center transition hover:border-brand-500 dark:border-ink-700 dark:bg-ink-900">
          <UploadIcon className="text-brand-600 dark:text-brand-300" />
          <span className="text-sm font-bold">{fileName || "Choose a question file (.json)"}</span>
          <span className="text-xs text-ink-500">Same format as your files: an array of question, options (A–D), answer, explanation</span>
          <input type="file" accept=".json,application/json" className="sr-only" onChange={onFile} />
        </label>
        {questions && (
          <p className="rounded-2xl bg-ink-100 p-3 text-sm dark:bg-ink-800">
            <strong>{questions.length} questions</strong> found. First: “{preview}…”
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Paper name (shown to students)
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. BPSC TRE 3.0 (2024) Computer Science, Class 11–12" required />
          </label>
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
          <label className="grid gap-1 text-sm font-medium">
            Year (optional)
            <input className="input" type="number" min={1990} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Time limit (minutes)
            <input className="input" type="number" min={1} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </label>
          <label className="flex items-center gap-3 self-end rounded-2xl border border-ink-300 px-4 py-3 text-sm font-medium dark:border-ink-700">
            <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="size-4 accent-brand-600" />
            Free for everyone
          </label>
        </div>
        <button className="btn btn-primary py-3" disabled={!questions || busy}>
          {busy ? "Uploading & building tests…" : "Upload & create test"}
        </button>
        {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      </form>

      {report && (
        <div className="rounded-[20px] border border-emerald-300 bg-emerald-50 p-5 text-sm dark:border-emerald-800 dark:bg-emerald-950/30" role="status">
          <p className="text-base font-bold text-emerald-800 dark:text-emerald-300">✓ “{report.title}” is live as a test</p>
          <ul className="mt-3 grid gap-1 text-ink-700 dark:text-ink-200">
            <li>
              {report.valid} of {report.questionsInFile} questions accepted
              {report.duplicatesInFile ? ` (${report.duplicatesInFile} repeated inside the file)` : ""}.
            </li>
            <li>
              {report.newQuestions} new to the question bank · {report.alreadyInBank} already in other papers.
            </li>
            <li>
              {report.mocksCreated.length
                ? `New mock test${report.mocksCreated.length > 1 ? "s" : ""} created: ${report.mocksCreated.map((n) => `Mock Test ${n}`).join(", ")}. `
                : "No new mock test yet. "}
              {report.poolRemaining} new question{report.poolRemaining === 1 ? "" : "s"} waiting for the next mock.
            </li>
          </ul>
          {report.invalid.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300">
                {report.invalid.length} question(s) skipped: see why
              </summary>
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
  const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
  return { ok: !!res?.ok, error: data?.error };
}

/** Per-test admin buttons: free/paid, hide/show, rename, delete (uploads only). */
export function TestControls({ testId, free, hidden, title, uploadId }: { testId: string; free: boolean; hidden: boolean; title: string; uploadId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) router.refresh();
    else alert(r.error ?? "Could not update the test.");
  }
  const cls = "btn btn-ghost px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap justify-end gap-1">
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
      {uploadId && (
        <button
          type="button"
          disabled={busy}
          className={`${cls} text-rose-600`}
          onClick={() => {
            if (confirm(`Delete the uploaded paper “${title}”? Past results stay, but the test disappears.`)) {
              run(() => send(`/api/admin/papers/${uploadId}`, undefined, "DELETE"));
            }
          }}
        >
          Delete
        </button>
      )}
    </div>
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
      title={pool < min ? `Needs at least ${min} new questions` : ""}
      onClick={async () => {
        setBusy(true);
        const r = await send("/api/admin/mocks", { examKey, subject });
        setBusy(false);
        if (r.ok) router.refresh();
        else alert(r.error ?? "Could not create the mock test.");
      }}
    >
      {busy ? "Creating…" : "Create mock now"}
    </button>
  );
}
