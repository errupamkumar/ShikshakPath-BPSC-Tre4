"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "../icons";
import { useLang } from "../lang-provider";

export function AccountMenu({ phoneLabel, isAdmin }: { phoneLabel: string; isAdmin: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const initials = phoneLabel.replace(/\D/g, "").slice(-2);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full border border-ink-300 py-1 pr-2.5 pl-1 transition hover:border-ink-900 dark:border-ink-700 dark:hover:border-ink-300"
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand-400 text-xs font-black text-ink-950">{initials || "Me"}</span>
        <ChevronDown width={16} height={16} />
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-64 animate-pop p-2 shadow-xl" role="menu">
          <p className="px-3 pt-2 pb-3 text-xs text-ink-500 dark:text-ink-400">
            {t("nav.loggedInAs")}
            <br />
            <span className="text-sm font-bold text-ink-900 dark:text-ink-50">{phoneLabel}</span>
            {isAdmin && <span className="mt-1 block font-semibold text-emerald-600">{t("common.adminAccess")}</span>}
          </p>
          {[
            { href: "/dashboard", label: t("nav.myDashboard") },
            { href: "/tests", label: t("nav.myTests") },
            { href: "/onboarding", label: t("nav.mySeries") },
            ...(isAdmin ? [{ href: "/admin", label: t("nav.admin") }] : []),
          ].map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-ink-100 dark:hover:bg-ink-800">
              {l.label}
            </Link>
          ))}
          <button type="button" role="menuitem" onClick={logout} className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
            {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
