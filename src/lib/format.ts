// Small formatting helpers, safe for both server and browser.

export function rupees(paise: number): string {
  const r = paise / 100;
  return "₹" + r.toLocaleString("en-IN", { maximumFractionDigits: r % 1 === 0 ? 0 : 2 });
}

export function marks(n: number): string {
  // 26.666… → "26.67", 30 → "30", -0.333 → "-0.33"
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? "0" : String(v);
}

/** 1/3 → "⅓", 0.25 → "¼", otherwise a decimal. */
export function fractionLabel(n: number): string {
  const known: [number, string][] = [
    [1 / 3, "⅓"],
    [1 / 4, "¼"],
    [1 / 2, "½"],
    [2 / 3, "⅔"],
    [1, "1"],
  ];
  for (const [v, label] of known) if (Math.abs(n - v) < 1e-6) return label;
  return marks(n);
}

export function duration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function dateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}xxxx${d.slice(6)}` : phone;
}

export function prettyPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone;
}

/** Only allow same-site relative redirects like "/tests/2". */
export function safeNext(next: string | null | undefined, fallback = "/tests"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
