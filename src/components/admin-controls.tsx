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
        Price for “Unlock all” (₹)
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
    if (!confirm(paid ? "Revoke full access for this user?" : "Grant full access to this user without payment?")) return;
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
      {paid ? "Revoke" : "Grant"}
    </button>
  );
}
