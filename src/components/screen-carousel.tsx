"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "./icons";
import { useLang } from "./lang-provider";

export type Slide = { src: string; w: number; h: number; frame: string; title: string; titleHi: string; text: string; textHi: string };

/** Browser window chrome around a desktop screenshot. */
function BrowserFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-ink-200 bg-white shadow-2xl shadow-ink-900/20 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-ink-100 px-3 py-2 sm:px-4 sm:py-2.5 dark:border-ink-700 dark:bg-ink-800">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-rose-400 sm:size-3" />
          <span className="size-2.5 rounded-full bg-amber-400 sm:size-3" />
          <span className="size-2.5 rounded-full bg-emerald-400 sm:size-3" />
        </span>
        <span className="mx-auto max-w-[70%] truncate rounded-full bg-white px-3 py-0.5 text-[10px] font-medium text-ink-500 sm:px-4 sm:text-xs dark:bg-ink-900 dark:text-ink-400">{label}</span>
        <span className="w-10 sm:w-12" aria-hidden />
      </div>
      {children}
    </div>
  );
}

/** Phone body around a mobile screenshot. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-full w-auto rounded-[2.4rem] bg-ink-950 p-2 shadow-2xl shadow-ink-900/30 ring-1 ring-ink-700 sm:rounded-[2.8rem] sm:p-2.5" style={{ aspectRatio: "400 / 844" }}>
      <span aria-hidden className="absolute top-3.5 left-1/2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-ink-950 sm:top-4 sm:h-5 sm:w-20" />
      <div className="h-full overflow-hidden rounded-[1.9rem] bg-white sm:rounded-[2.2rem]">{children}</div>
    </div>
  );
}

/** Landing-page carousel of real test-screen screenshots (config: carouselConfig). */
export function ScreenCarousel({ slides, autoplaySeconds = 5, brand }: { slides: Slide[]; autoplaySeconds?: number; brand: string }) {
  const { t, lang } = useLang();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false); // hover / keyboard focus inside
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const auto = playing && !hold && !reduced && n > 1;
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => go(i + 1), autoplaySeconds * 1000);
    return () => clearTimeout(id);
  }, [auto, i, go, autoplaySeconds]);

  if (!n) return null;
  const s = slides[i];
  const title = (x: Slide) => (lang === "hi" ? x.titleHi : x.title);

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center xl:grid-cols-[minmax(0,1fr)_360px]"
      role="region"
      aria-roledescription="carousel"
      aria-label={t("home.carTitle")}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      {/* Stage */}
      <div
        className="relative aspect-[16/11] w-full select-none sm:aspect-[16/10.6]"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
          touchX.current = null;
        }}
      >
        <div aria-hidden className="absolute inset-[6%_4%] rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-[radial-gradient(circle_at_30%_20%,var(--color-brand-300),transparent_65%)] opacity-50 blur-2xl dark:opacity-25" />
        {slides.map((x, k) => (
          <div
            key={x.src}
            role="group"
            aria-roledescription="slide"
            aria-label={`${k + 1} / ${n}: ${title(x)}`}
            aria-hidden={k !== i}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-out ${k === i ? "opacity-100" : "pointer-events-none scale-[0.97] opacity-0"}`}
          >
            {x.frame === "phone" ? (
              <div className="h-[96%]">
                <PhoneFrame>
                  <Image src={x.src} alt={title(x)} width={x.w} height={x.h} sizes="(min-width: 1024px) 300px, 45vw" className="h-full w-full object-cover object-top" />
                </PhoneFrame>
              </div>
            ) : (
              <div className="w-full">
                <BrowserFrame label={`${brand} · ${title(x)}`}>
                  <Image src={x.src} alt={title(x)} width={x.w} height={x.h} sizes="(min-width: 1280px) 820px, (min-width: 1024px) 65vw, 100vw" className="block h-auto w-full" />
                </BrowserFrame>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Captions + controls */}
      <div>
        <ol className="grid gap-2">
          {slides.map((x, k) => (
            <li key={x.src}>
              <button
                type="button"
                onClick={() => go(k)}
                aria-current={k === i}
                aria-label={t("home.carGo", { n: k + 1 })}
                className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                  k === i ? "border-ink-900 bg-white shadow-lg shadow-ink-900/5 dark:border-brand-300 dark:bg-ink-900" : "border-transparent hover:bg-white/70 dark:hover:bg-ink-900/60"
                }`}
              >
                <span className="flex items-baseline gap-2.5">
                  <span className={`font-mono text-xs font-bold ${k === i ? "text-brand-600 dark:text-brand-300" : "text-ink-400"}`}>{String(k + 1).padStart(2, "0")}</span>
                  <span className={`font-bold ${k === i ? "" : "text-ink-600 dark:text-ink-300"}`}>{title(x)}</span>
                </span>
                {k === i && <span className="mt-1 block pl-7 text-sm leading-snug text-ink-600 dark:text-ink-300">{lang === "hi" ? x.textHi : x.text}</span>}
                {k === i && auto && (
                  <span aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-brand-500" style={{ animation: `carousel-progress ${autoplaySeconds}s linear forwards` }} />
                )}
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => go(i - 1)} className="btn btn-secondary size-11 p-0" aria-label={t("home.carPrev")}>
            <ChevronLeft width={18} height={18} />
          </button>
          <button type="button" onClick={() => go(i + 1)} className="btn btn-secondary size-11 p-0" aria-label={t("home.carNext")}>
            <ChevronRight width={18} height={18} />
          </button>
          {!reduced && (
            <button type="button" onClick={() => setPlaying((p) => !p)} className="btn btn-ghost px-3 py-2 text-sm" aria-pressed={!playing}>
              {playing ? `❚❚ ${t("home.carPause")}` : `▶ ${t("home.carPlay")}`}
            </button>
          )}
          <span className="ml-auto font-mono text-sm text-ink-500" aria-live="polite">
            {i + 1} / {n}
          </span>
        </div>
        <p className="sr-only" aria-live="polite">
          {title(s)}
        </p>
      </div>
    </div>
  );
}
