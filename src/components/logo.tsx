import Link from "next/link";
import { siteConfig } from "@config/test-series.config";

type Tone = "default" | "dark" | "onColor";

const TONES: Record<Tone, { bg: string; page: string; page2: string; road: string; sun: string }> = {
  // header (light / dark theme)
  default: {
    bg: "fill-ink-900 dark:fill-brand-300",
    page: "fill-brand-300 dark:fill-ink-950",
    page2: "fill-brand-400 dark:fill-ink-800",
    road: "fill-ink-900 dark:fill-brand-300",
    sun: "fill-brand-300 dark:fill-ink-950",
  },
  // footer (always dark background)
  dark: { bg: "fill-brand-400", page: "fill-ink-950", page2: "fill-ink-800", road: "fill-brand-400", sun: "fill-ink-950" },
  // on a coloured surface (eBook covers)
  onColor: { bg: "fill-white/95", page: "fill-ink-900", page2: "fill-ink-700", road: "fill-white/95", sun: "fill-ink-900" },
};

/**
 * The ShikshakPath mark: an open book with a path running up its spine towards a
 * rising sun, i.e. the road from study to a teaching job.
 */
export function LogoMark({ className = "size-10", tone = "default" }: { className?: string; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <rect width="40" height="40" rx="11" className={c.bg} />
      <circle cx="20" cy="9.2" r="3.1" className={c.sun} />
      <path d="M6.5 14.2c4.6-2 9.1-1.6 13.5 1.3v16c-4.4-2.7-8.9-3.1-13.5-1.3z" className={c.page} />
      <path d="M33.5 14.2c-4.6-2-9.1-1.6-13.5 1.3v16c4.4-2.7 8.9-3.1 13.5-1.3z" className={c.page2} />
      <path d="M17.3 32.4 19.55 15.6h.9l2.25 16.8z" className={c.road} />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  const { title, accent, subtitle } = siteConfig.logo;
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={`${siteConfig.name}: home`}>
      <span className="transition group-hover:-rotate-6">
        <LogoMark tone={dark ? "dark" : "default"} />
      </span>
      <span className="leading-none">
        <span className={`block text-[19px] font-black tracking-tight ${dark ? "text-white" : ""}`}>
          {title}
          <span className={dark ? "text-brand-300" : "text-brand-600 dark:text-brand-300"}>{accent}</span>
        </span>
        <span className={`mt-1 block text-[9.5px] font-bold tracking-[0.22em] uppercase ${dark ? "text-ink-300" : "text-ink-500 dark:text-ink-400"}`}>{subtitle}</span>
      </span>
    </Link>
  );
}
