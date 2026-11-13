"use client";

import Link from "next/link";
import { EBOOK_META, EBOOK_TYPES, type EbookType } from "@/lib/ebook-types";
import { BookIcon, ChevronDown, LayersIcon, SparkIcon, TrophyIcon } from "../icons";
import { useLang } from "../lang-provider";
import { navButtonClass, useDropdown } from "./use-dropdown";

export const EBOOK_ICONS: Record<EbookType, typeof BookIcon> = { notes: BookIcon, pyq: TrophyIcon, strategy: SparkIcon, others: LayersIcon };

/** Desktop "eBooks" dropdown: Notes / PYQ / Strategy guides / Others. */
export function EbooksMenu() {
  const { t } = useLang();
  const { open, setOpen, wrap, onMouseEnter, onMouseLeave } = useDropdown();
  return (
    <div ref={wrap} className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button type="button" className={navButtonClass} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        {t("nav.ebooks")} <ChevronDown width={16} height={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-50 w-[min(380px,90vw)] -translate-x-1/2 pt-2">
          <div className="card animate-pop p-2 shadow-2xl shadow-ink-900/10" role="menu">
            {EBOOK_TYPES.map((k) => {
              const Icon = EBOOK_ICONS[k];
              return (
                <Link key={k} href={`/ebooks/${k}`} role="menuitem" className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-ink-100 dark:hover:bg-ink-800">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-300 dark:bg-brand-300 dark:text-ink-950">
                    <Icon width={17} height={17} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{t(EBOOK_META[k].label)}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-500 dark:text-ink-400">{t(EBOOK_META[k].text)}</span>
                  </span>
                </Link>
              );
            })}
            <Link href="/ebooks" role="menuitem" className="mt-1 block rounded-2xl border-t border-ink-200 px-3 py-2.5 text-sm font-bold text-brand-600 dark:border-ink-800 dark:text-brand-300">
              {t("nav.allEbooks")} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
