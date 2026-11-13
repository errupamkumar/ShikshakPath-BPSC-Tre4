"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EBOOK_META, EBOOK_TYPES, type EbookType } from "@/lib/ebook-types";
import { uploadPdf } from "@/lib/firebase-client";
import { UploadIcon } from "./icons";

type Opt = { key: string; name: string };

/** Admin: upload a PDF as an eBook: Notes, PYQ, Strategy guide or Others (straight to Cloud Storage, with progress). */
export function ResourceUploader({ subjects, exams, maxMb }: { subjects: Opt[]; exams: Opt[]; maxMb: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<EbookType>("notes");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [examKey, setExamKey] = useState("");
  const [free, setFree] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setDone("");
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setError("Please choose a PDF file.");
    if (f.size > maxMb * 1024 * 1024) return setError(`This PDF is larger than ${maxMb} MB.`);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setDone("");
    setProgress(0);
    try {
      const tok = await fetch("/api/admin/resources/token", { method: "POST" });
      const tokData = (await tok.json().catch(() => ({}))) as { token?: string; path?: string; error?: string };
      if (!tok.ok || !tokData.token || !tokData.path) throw new Error(tokData.error || "Could not start the upload.");
      await uploadPdf(file, tokData.token, tokData.path, setProgress);
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, author, description, subject, examKey, free, path: tokData.path, fileName: file.name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save the PDF.");
      setDone(`“${title}” is published.`);
      setFile(null);
      setTitle("");
      setAuthor("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid cursor-pointer place-items-center gap-2 rounded-[20px] border-2 border-dashed border-ink-300 bg-ink-50 px-4 py-8 text-center transition hover:border-brand-500 dark:border-ink-700 dark:bg-ink-900">
        <UploadIcon className="text-brand-600 dark:text-brand-300" />
        <span className="text-sm font-bold">{file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : "Choose a PDF"}</span>
        <span className="text-xs text-ink-500">Up to {maxMb} MB</span>
        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onFile} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Type
          <select className="input" value={type} onChange={(e) => setType(e.target.value as EbookType)}>
            {EBOOK_TYPES.map((k) => (
              <option key={k} value={k}>
                {EBOOK_META[k].admin}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} placeholder="e.g. DBMS complete notes" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Author / expert (optional)
          <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. A. Kumar, BPSC TRE selected teacher" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Subject
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Exam (optional)
          <select className="input" value={examKey} onChange={(e) => setExamKey(e.target.value)}>
            <option value="">Any exam</option>
            {exams.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 self-end rounded-2xl border border-ink-300 px-4 py-3 text-sm font-medium dark:border-ink-700">
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="size-4 accent-brand-600" />
          Free for every logged-in student
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Short description (optional)
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
        </label>
      </div>
      {progress !== null && (
        <div className="h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <button className="btn btn-primary py-3" disabled={!file || progress !== null}>
        {progress !== null ? `Uploading… ${progress}%` : "Upload PDF"}
      </button>
      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {done && (
        <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" role="status">
          ✓ {done}
        </p>
      )}
    </form>
  );
}

/** Admin buttons for one PDF: free/paid, hide/show, delete. */
export function ResourceControls({ id, free, hidden, title }: { id: string; free: boolean; hidden: boolean; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function call(method: "POST" | "DELETE", body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/admin/resources/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else alert("Could not update the PDF.");
  }
  const cls = "btn btn-ghost px-2 py-1 text-xs";
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button type="button" disabled={busy} className={cls} onClick={() => call("POST", { free: !free })}>
        {free ? "Make paid" : "Make free"}
      </button>
      <button type="button" disabled={busy} className={cls} onClick={() => call("POST", { hidden: !hidden })}>
        {hidden ? "Show" : "Hide"}
      </button>
      <button type="button" disabled={busy} className={`${cls} text-rose-600`} onClick={() => confirm(`Delete “${title}” permanently?`) && call("DELETE")}>
        Delete
      </button>
    </div>
  );
}
