"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Admin → Exams: on/off switch for one exam. */
export function ExamToggle({ examKey, on, name }: { examKey: string; on: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examKey, enabled: !on }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) return router.refresh();
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    alert(data?.error || "Could not update the exam.");
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Show ${name} to students`}
      disabled={busy}
      onClick={toggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${on ? "bg-emerald-500" : "bg-ink-300 dark:bg-ink-700"} ${busy ? "opacity-50" : ""}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
