"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckIcon, XIcon } from "./icons";
import { useLang } from "./lang-provider";
import { LogoMark } from "./logo";

const KEY = "sp-welcome-seen";
const SNOOZE_DAYS = 3;
const DELAY_MS = 1200;

/**
 * Landing-page greeting: welcomes the visitor, invites them to the free mock test and
 * makes the case for the full pass (with a link to pricing). Shown once, then again only
 * after SNOOZE_DAYS if they closed it. Never shown to students who have already paid.
 */
export function WelcomeModal({
  freeHref,
  price,
  compareAt,
  stats,
  loggedIn,
}: {
  freeHref: string;
  price: string;
  compareAt: string;
  stats: { mocks: number; papers: number; questions: string };
  loggedIn: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(12);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    try {
      const seen = Number(localStorage.getItem(KEY) ?? 0);
      if (seen && Date.now() - seen < SNOOZE_DAYS * 86_400_000) return;
    } catch {
      // storage blocked (private mode): show it this once
    }
    setHour(new Date().getHours());
    const id = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;
  const greet = hour < 12 ? t("wm.morning") : hour < 17 ? t("wm.afternoon") : t("wm.evening");

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <button type="button" className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" aria-label={t("wm.close")} onClick={close} />
      <div className="relative max-h-[92dvh] w-full max-w-[560px] animate-pop overflow-y-auto rounded-[28px] bg-ink-50 shadow-2xl dark:bg-ink-900">
        <button type="button" onClick={close} className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-white/80 text-ink-700 hover:bg-white dark:bg-ink-800 dark:text-ink-200" aria-label={t("wm.close")}>
          <XIcon width={18} height={18} />
        </button>

        {/* Greeting */}
        <div className="relative overflow-hidden rounded-t-[28px] bg-ink-950 px-5 pt-5 pb-5 text-ink-50 sm:px-8 sm:pt-7 sm:pb-6">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-brand-500/30 blur-3xl" />
          <LogoMark className="size-10 sm:size-12" tone="dark" />
          <p className="relative mt-3 text-sm font-semibold text-brand-300 sm:mt-4">{greet}</p>
          <h2 id="welcome-title" className="display relative mt-1 text-[1.65rem] leading-tight sm:text-4xl">
            {t("wm.title")}
          </h2>
          <p className="relative mt-2 text-sm leading-relaxed text-ink-200 sm:mt-3 sm:text-[15px]">{t("wm.text")}</p>
        </div>

        <div className="grid gap-4 p-5 sm:gap-5 sm:p-8">
          {/* Step 1: free test */}
          <div>
            <p className="text-xs font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400">{t("wm.step1")}</p>
            <Link ref={primary} href={freeHref} onClick={close} className="btn btn-primary mt-2 w-full py-3 text-base sm:py-3.5">
              {t("wm.freeCta")} <ArrowRight width={18} height={18} />
            </Link>
            <p className="mt-2 text-center text-xs text-ink-500 dark:text-ink-400">{loggedIn ? t("wm.freeNoteIn") : t("wm.freeNote")}</p>
          </div>

          {/* Step 2: why buy */}
          <div className="rounded-[20px] border-2 border-brand-300 bg-brand-50 p-4 sm:p-5 dark:border-brand-700 dark:bg-brand-900/30">
            <p className="text-xs font-bold tracking-wide text-brand-700 uppercase dark:text-brand-300">{t("wm.step2")}</p>
            <p className="mt-1 flex items-end gap-2">
              <span className="display text-3xl leading-none sm:text-4xl">{price}</span>
              <span className="pb-0.5 text-sm text-ink-500 line-through">{compareAt}</span>
              <span className="pb-0.5 text-sm font-semibold text-ink-600 dark:text-ink-300">{t("wm.once")}</span>
            </p>
            <ul className="mt-3 grid gap-1 text-[13px] sm:gap-1.5 sm:text-sm">
              {[
                t("wm.b1", { m: stats.mocks, p: stats.papers }),
                t("wm.b2", { q: stats.questions }),
                t("wm.b3"),
                t("wm.b4"),
              ].map((b) => (
                <li key={b} className="flex gap-2">
                  <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> {b}
                </li>
              ))}
            </ul>
            <Link href="/#pricing" onClick={close} className="btn btn-accent mt-4 w-full py-3">
              {t("wm.buyCta", { price })} <ArrowRight width={16} height={16} />
            </Link>
          </div>

          <button type="button" onClick={close} className="mx-auto text-sm font-semibold text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white">
            {t("wm.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
