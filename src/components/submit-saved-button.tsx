"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "./lang-provider";

/** Submit a running or paused test right now, with the answers already saved (no need to resume first). */
export function SubmitSavedButton({ attemptId }: { attemptId: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json().catch(() => ({}))) as { resultUrl?: string; error?: string };
      if (!res.ok || !data.resultUrl) throw new Error(data.error || "Could not submit.");
      router.push(data.resultUrl);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="btn btn-secondary w-full py-3.5 text-base sm:w-auto sm:px-8">
        {t("inst.submitNow")}
      </button>
    );
  }
  return (
    <div className="grid gap-2 rounded-2xl border border-ink-200 p-3 dark:border-ink-700">
      <p className="text-sm text-ink-600 dark:text-ink-300">{t("inst.submitNowText")}</p>
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="btn btn-primary px-5 py-2.5">
          {busy ? t("pl.submitting") : t("pl.submit")}
        </button>
        <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="btn btn-ghost px-4 py-2.5">
          {t("common.cancel")}
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
