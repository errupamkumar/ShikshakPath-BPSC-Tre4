"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EBOOK_META, EBOOK_TYPES } from "@/lib/ebook-types";
import { ExamLogo } from "../exam-logo";
import { ChevronDown, MenuIcon, XIcon } from "../icons";
import { LanguageSwitch, useLang } from "../lang-provider";
import { ThemeToggle } from "../theme-toggle";
import { EBOOK_ICONS } from "./ebooks-menu";
import { NAV_LINKS, NAV_LINKS_END, type MenuExam } from "./types";

/** Burger button + full-height slide-in menu for phones and tablets. */
export function MobileNav({
  exams,
  loggedIn,
  isAdmin,
  phoneLabel,
}: {
  exams: MenuExam[];
  loggedIn: boolean;
  isAdmin: boolean;
  phoneLabel: string;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const close = () => setOpen(false);

  return (
    <>
      <button type="button" className="btn btn-secondary size-11 p-0 lg:hidden" aria-label={t("nav.openMenu")} aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon />
      </button>
      {/* Portal to <body>: the header's backdrop blur would otherwise trap this fixed overlay inside the header. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
            <button type="button" className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" aria-label={t("nav.closeMenu")} onClick={close} />
            <div className="absolute inset-y-0 right-0 flex w-[min(24rem,100vw)] flex-col overflow-y-auto bg-ink-50 shadow-2xl dark:bg-ink-950">
              <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-5 py-4 dark:border-ink-800">
                <span className="text-xs font-bold tracking-[0.25em] uppercase">{t("nav.menu")}</span>
                <div className="flex items-center gap-1">
                  <LanguageSwitch compact />
                  <ThemeToggle />
                  <button type="button" className="btn btn-ghost size-10 p-0" aria-label={t("nav.closeMenu")} onClick={close}>
                    <XIcon />
                  </button>
                </div>
              </div>

              <nav className="flex-1 px-5 py-4">
                <p className="eyebrow px-3">{t("nav.chooseExam")}</p>
                <div className="mt-2 grid gap-2">
                  {exams.map((e, i) => (
                    <details key={e.key} className="group rounded-2xl border border-ink-200 dark:border-ink-800" open={i === 0}>
                      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-3 py-3 hover:bg-ink-100 dark:hover:bg-ink-900">
                        <ExamLogo exam={e} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{e.short}</span>
                          <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{e.name}</span>
                        </span>
                        <ChevronDown width={18} height={18} className="shrink-0 transition group-open:rotate-180" />
                      </summary>
                      <ul className="grid grid-cols-2 gap-1 px-2 pb-2">
                        {e.subjects.map((s) => (
                          <li key={s.key}>
                            <Link
                              href={`/exams/${e.key}/${s.key}`}
                              onClick={close}
                              className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-ink-100 dark:hover:bg-ink-900 ${s.live ? "" : "text-ink-500 dark:text-ink-400"}`}
                            >
                              <span className={`grid size-6 shrink-0 place-items-center rounded-md text-[9px] font-black ring-1 ${s.tone}`}>{s.short}</span>
                              <span className="truncate">{s.name}</span>
                              {!s.live && <span className="ml-auto text-[9px] font-bold text-ink-400 uppercase">{t("common.soon")}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>

                <ul className="mt-5 grid gap-1">
                  {[...NAV_LINKS, ...NAV_LINKS_END].map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} onClick={close} className="block rounded-2xl px-3 py-3 text-lg font-bold tracking-tight hover:bg-ink-100 dark:hover:bg-ink-900">
                        {t(l.label)}
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow mt-5 px-3">{t("nav.ebooks")}</p>
                <ul className="mt-2 grid grid-cols-2 gap-1">
                  {EBOOK_TYPES.map((k) => {
                    const Icon = EBOOK_ICONS[k];
                    return (
                      <li key={k}>
                        <Link href={`/ebooks/${k}`} onClick={close} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-ink-100 dark:hover:bg-ink-900">
                          <Icon width={16} height={16} className="text-brand-600 dark:text-brand-300" />
                          {t(EBOOK_META[k].label)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="grid gap-2 border-t border-ink-200 p-5 dark:border-ink-800" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
                {loggedIn ? (
                  <>
                    <p className="text-sm text-ink-500 dark:text-ink-400">
                      {t("nav.loggedInAs")} {phoneLabel}
                    </p>
                    <Link href="/dashboard" onClick={close} className="btn btn-primary py-3">
                      {t("nav.myDashboard")}
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" onClick={close} className="btn btn-secondary py-3">
                        {t("nav.admin")}
                      </Link>
                    )}
                    <button type="button" onClick={logout} className="btn btn-ghost py-3">
                      {t("nav.logout")}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/exams" onClick={close} className="btn btn-primary py-3">
                      {t("nav.startFree")}
                    </Link>
                    <Link href="/login" onClick={close} className="btn btn-secondary py-3">
                      {t("nav.loginRegister")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
