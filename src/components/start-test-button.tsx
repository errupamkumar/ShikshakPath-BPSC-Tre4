"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLang } from "./lang-provider";

export function StartTestButton({ testId, label, className = "" }: { testId: string; label: string; className?: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/tests/${testId}/start`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { attemptId?: string; error?: string };
      if (res.status === 401) {
        router.push(`/login?next=/tests/${testId}`);
        return;
      }
      if (!res.ok || !data.attemptId) throw new Error(data.error || "Could not start the test.");
      router.push(`/attempt/${data.attemptId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={start} disabled={busy} className={`btn btn-primary ${className}`}>
        {busy ? t("common.loading") : label}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
