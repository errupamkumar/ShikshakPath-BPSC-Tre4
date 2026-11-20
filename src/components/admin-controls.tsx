"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PriceForm({ currentRupees }: { currentRupees: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentRupees));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceInRupees: Number(value) }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (res?.ok) {
      setMsg({ ok: true, text: "Saved. New orders use this price." });
      router.refresh();
    } else setMsg({ ok: false, text: data?.error ?? "Could not save." });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Price per test series (₹)
        <input className="input w-40" type="number" min={1} max={100000} step={1} value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button className="btn btn-primary py-3" disabled={busy}>
        {busy ? "Saving…" : "Save price"}
      </button>
      {msg && <p className={`w-full text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
    </form>
  );
}

export function AccessToggle({ uid, paid }: { uid: string; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!confirm(paid ? "Revoke access to ALL test series for this user?" : "Grant access to ALL test series without payment?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${uid}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: !paid }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else alert("Could not update access.");
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className="btn btn-ghost px-2 py-1 text-xs">
      {paid ? "Revoke all" : "Grant all"}
    </button>
  );
}

/** Grant one test series (exam + subject) to a user, or revoke one they have. */
export function SeriesAccess({
  uid,
  passes,
  options,
}: {
  uid: string;
  passes: { exam: string; subject: string; label: string; granted: boolean }[];
  options: { exam: string; subject: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  async function call(exam: string, subject: string, grant: boolean) {
    setBusy(true);
    const res = await fetch(`/api/admin/users/${uid}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam, subject, grant }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else alert("Could not update access.");
  }
  const free = options.filter((o) => !passes.some((p) => p.exam === o.exam && p.subject === o.subject));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {passes.map((p) => (
        <span key={`${p.exam}|${p.subject}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 py-0.5 pr-1 pl-2 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          {p.label}
          {p.granted && <span className="font-medium opacity-70">(granted)</span>}
          <button type="button" disabled={busy} onClick={() => confirm(`Revoke ${p.label}?`) && call(p.exam, p.subject, false)} className="grid size-4 place-items-center rounded-full hover:bg-emerald-200" aria-label={`Revoke ${p.label}`}>
            ×
          </button>
        </span>
      ))}
      {free.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded-lg border border-ink-300 bg-transparent px-1.5 py-1 text-xs dark:border-ink-600" aria-label="Series to grant">
            <option value="">+ series…</option>
            {free.map((o) => (
              <option key={`${o.exam}|${o.subject}`} value={`${o.exam}|${o.subject}`}>
                {o.label}
              </option>
            ))}
          </select>
          {pick && (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-ink-900 px-2 py-1 text-xs font-bold text-white dark:bg-brand-300 dark:text-ink-950"
              onClick={() => {
                const [exam, subject] = pick.split("|");
                setPick("");
                call(exam, subject, true);
              }}
            >
              Grant
            </button>
          )}
        </span>
      )}
    </div>
  );
}
