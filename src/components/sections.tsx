"use client";

import Link from "next/link";
import { ArrowRight, CheckIcon } from "./icons";
import { useLang } from "./lang-provider";
import { UnlockButton } from "./unlock-button";

/** Nova-style section header: big title left, short description + link right. */
export function SectionHeading({
  eyebrow,
  title,
  text,
  href,
  linkLabel,
  center = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  text?: string;
  href?: string;
  linkLabel?: string;
  center?: boolean;
}) {
  if (center) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="display mt-3 text-3xl leading-[1.05] sm:text-5xl">{title}</h2>
        {text && <p className="mt-4 text-ink-600 dark:text-ink-300">{text}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-end">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="display mt-3 text-3xl leading-[1.05] sm:text-5xl">{title}</h2>
      </div>
      {(text || href) && (
        <div className="lg:text-right">
          {text && <p className="text-ink-600 lg:ml-auto lg:max-w-md dark:text-ink-300">{text}</p>}
          {href && (
            <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold hover:text-brand-600 dark:hover:text-brand-300">
              {linkLabel} <ArrowRight width={16} height={16} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function FaqList({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <div className="mx-auto mt-10 grid max-w-3xl gap-3">
      {faqs.map((f, i) => (
        <details key={f.q} className="card group px-5 py-4 sm:px-6" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            {f.q}
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink-200 text-lg leading-none text-ink-500 transition group-open:rotate-45 dark:border-ink-700">
              +
            </span>
          </summary>
          <p className="mt-3 text-ink-600 dark:text-ink-300">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Dark price card: "Unlock all" (Adda247-style buy box). */
export function PriceCard({
  price,
  compareAt,
  features,
  paid,
  loggedIn,
  freeHref = "/exams",
}: {
  price: string;
  compareAt?: string;
  features: string[];
  paid: boolean;
  loggedIn: boolean;
  /** Where "Try a free mock test" goes (a subject's free test, or the exam picker). */
  freeHref?: string;
}) {
  const { t } = useLang();
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-ink-950 p-6 text-ink-100 shadow-2xl shadow-ink-900/20 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand-500/25 blur-3xl" />
      <p className="relative text-xs font-bold tracking-[0.2em] text-brand-300 uppercase">{t("pc.eyebrow")}</p>
      <p className="relative mt-4 flex items-end gap-3">
        <span className="display text-6xl leading-none text-white">{price}</span>
        {compareAt && <span className="pb-1 text-lg text-ink-400 line-through">{compareAt}</span>}
      </p>
      <p className="relative mt-1 text-sm text-ink-300">{t("pc.oneTime")}</p>
      <ul className="relative mt-6 grid gap-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-brand-300" /> {f}
          </li>
        ))}
      </ul>
      <div className="relative mt-7 grid gap-3">
        {paid ? (
          <p className="rounded-full bg-emerald-500/15 px-4 py-3 text-center text-sm font-bold text-emerald-300">✓ {t("common.fullAccess")}</p>
        ) : (
          <UnlockButton priceLabel={price} loggedIn={loggedIn} className="btn-accent w-full" />
        )}
        <Link href={paid ? "/tests" : freeHref} className="btn btn-light w-full py-3">
          {paid ? t("pc.goSeries") : t("pc.tryFree")}
        </Link>
      </div>
      <p className="relative mt-4 text-center text-xs text-ink-400">{t("pc.secure")}</p>
    </div>
  );
}
