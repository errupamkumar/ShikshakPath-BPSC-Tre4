"use client";

import Link from "next/link";
import { ExamLogo } from "../exam-logo";
import { ArrowRight, BookIcon, ChevronDown, LayersIcon, TrophyIcon } from "../icons";
import { useLang } from "../lang-provider";
import type { MenuExam } from "./types";
import { navButtonClass, useDropdown } from "./use-dropdown";

/** Desktop "Exams" mega menu: each exam (official logo + name) with its subjects (Exam → Subject). */
export function ExamsMenu({ exams, freeTestHref }: { exams: MenuExam[]; freeTestHref: string }) {
  const { t } = useLang();
  const { open, setOpen, wrap, onMouseEnter, onMouseLeave } = useDropdown();

  return (
    <div ref={wrap} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button type="button" className={navButtonClass} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        {t("nav.exams")} <ChevronDown width={16} height={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 px-4 pt-2 sm:px-6 lg:px-10 2xl:px-16">
          <div className="card mx-auto max-w-[1632px] animate-pop p-6 shadow-2xl shadow-ink-900/10" role="menu">
            <div className={`grid gap-6 ${exams.length > 1 ? "lg:grid-cols-[1fr_1fr_300px] xl:grid-cols-[1fr_1fr_340px]" : "lg:grid-cols-[1fr_340px]"}`}>
              {exams.map((e) => {
                const live = e.subjects.filter((s) => s.live);
                const soon = e.subjects.filter((s) => !s.live).slice(0, Math.max(0, 8 - live.length));
                return (
                  <div key={e.key} className="rounded-[20px] border border-ink-200 p-4 dark:border-ink-800">
                    <Link href={`/exams/${e.key}`} role="menuitem" className="group flex items-center gap-3">
                      <ExamLogo exam={e} size={48} />
                      <span className="min-w-0">
                        <span className="block text-lg leading-tight font-black group-hover:text-brand-700 dark:group-hover:text-brand-300">{e.short}</span>
                        <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{e.name}</span>
                      </span>
                    </Link>
                    <p className="mt-3 text-[11px] font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400">{t("home.step2")}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {[...live, ...soon].map((s) => (
                        <li key={s.key}>
                          <Link
                            href={`/exams/${e.key}/${s.key}`}
                            role="menuitem"
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold transition ${
                              s.live
                                ? "border-ink-900 bg-ink-900 text-white hover:bg-ink-700 dark:border-brand-300 dark:bg-brand-300 dark:text-ink-950"
                                : "border-ink-200 text-ink-500 hover:border-ink-400 dark:border-ink-700 dark:text-ink-400"
                            }`}
                          >
                            {s.name}
                            {s.live ? <span className="text-[10px] font-bold opacity-75">{s.tests}</span> : <span className="text-[9px] font-bold uppercase">{t("common.soon")}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/exams/${e.key}`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-600 dark:text-brand-300">
                      {t("nav.allSubjectsOf", { exam: e.short })}
                    </Link>
                  </div>
                );
              })}
              {/* Quick start */}
              <div className="flex flex-col gap-2 rounded-[20px] bg-ink-950 p-4 text-ink-100">
                <p className="text-xs font-bold tracking-[0.2em] text-brand-300 uppercase">{t("nav.quickStart")}</p>
                {[
                  { href: freeTestHref, icon: TrophyIcon, label: t("nav.freeMock") },
                  { href: "/pyq", icon: BookIcon, label: t("nav.pyqLong") },
                  { href: "/ebooks", icon: LayersIcon, label: t("nav.ebooks") },
                ].map((x) => (
                  <Link key={x.href} href={x.href} role="menuitem" className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold transition hover:bg-white/10">
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-400 text-ink-950">
                      <x.icon width={16} height={16} />
                    </span>
                    {x.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-ink-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800">
              <p className="text-sm text-ink-600 dark:text-ink-300">{t("nav.pickExamThenSubject")}</p>
              <Link href="/exams" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 dark:text-brand-300">
                {t("nav.chooseExam")} <ArrowRight width={16} height={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
