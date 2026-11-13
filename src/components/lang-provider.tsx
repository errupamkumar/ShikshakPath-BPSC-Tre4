"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useTransition } from "react";
import { LANG_COOKIE, makeT, type Lang, type TFn } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; t: TFn }>({ lang: "en", t: makeT("en") });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** EN | हिं toggle. Saves the choice in a cookie (1 year) and re-renders the page. */
export function LanguageSwitch({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const { lang } = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  function set(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }
  const base = dark ? "border-white/20 bg-white/5" : "border-ink-300 bg-white dark:border-ink-700 dark:bg-ink-900";
  return (
    <div
      role="group"
      aria-label="Language / भाषा"
      className={`inline-flex shrink-0 items-center rounded-full border p-0.5 text-xs font-bold ${base} ${pending ? "opacity-60" : ""}`}
    >
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={lang === l}
          lang={l}
          className={`rounded-full ${compact ? "px-2 py-1" : "px-2.5 py-1.5"} transition ${
            lang === l ? (dark ? "bg-white text-ink-950" : "bg-ink-900 text-white dark:bg-brand-300 dark:text-ink-950") : dark ? "text-ink-200" : "text-ink-600 dark:text-ink-300"
          }`}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
