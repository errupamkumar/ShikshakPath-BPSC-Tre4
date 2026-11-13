import Link from "next/link";
import { siteConfig } from "@config/test-series.config";
import { getCatalog } from "@/lib/catalog";
import { menuExams } from "@/lib/exam-menu";
import { prettyPhone } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";
import { AccountMenu } from "./header/account-menu";
import { EbooksMenu } from "./header/ebooks-menu";
import { ExamsMenu } from "./header/exams-menu";
import { MobileNav } from "./header/mobile-nav";
import { NAV_LINKS, NAV_LINKS_END, type NavLink } from "./header/types";
import { ArrowRight } from "./icons";
import { LanguageSwitch } from "./lang-provider";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const [user, cat, { lang, t }] = await Promise.all([getSessionUser(), getCatalog(), getT()]);
  const examsMenu = menuExams(cat, lang);
  const freeMock = cat.tests.find((x) => x.kind === "mock" && x.free);
  const freeTestHref = freeMock ? `/tests/${freeMock.id}` : "/exams";
  const a = siteConfig.announcement;
  const announcement = lang === "hi" && a.textHi ? a.textHi : a.text;
  const phoneLabel = user ? prettyPhone(user.phone) : "";
  const navLink = (l: NavLink) => (
    <Link
      key={l.href}
      href={l.href}
      className={`${l.wide ? "hidden 2xl:inline-flex" : "inline-flex"} rounded-full px-2.5 py-2 text-[15px] font-semibold whitespace-nowrap text-ink-800 transition hover:text-brand-600 xl:px-3 dark:text-ink-100 dark:hover:text-brand-300`}
    >
      {t(l.label)}
    </Link>
  );

  return (
    <>
      {announcement && (
        <div className="bg-ink-950 text-ink-100">
          <div className="container-page flex min-h-10 items-center justify-between gap-3 py-2 text-[13px]">
            <p className="line-clamp-2 sm:truncate">
              <span className="mr-2 inline-block size-1.5 -translate-y-0.5 rounded-full bg-brand-400 align-middle" />
              {announcement}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="lg:hidden">
                <LanguageSwitch compact dark />
              </span>
              <Link href={a.href} className="hidden shrink-0 items-center gap-1 rounded-full bg-brand-400 px-3 py-1 text-xs font-bold text-ink-950 transition hover:bg-brand-300 sm:inline-flex">
                {t("nav.startFree")} <ArrowRight width={14} height={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-ink-50/90 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/90">
        <div className="container-page flex h-[72px] items-center justify-between gap-3">
          <Logo />
          <nav className="hidden items-center lg:flex" aria-label="Main">
            <ExamsMenu exams={examsMenu} freeTestHref={freeTestHref} />
            {NAV_LINKS.map(navLink)}
            <EbooksMenu />
            {NAV_LINKS_END.map(navLink)}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 lg:flex">
              <LanguageSwitch />
              <ThemeToggle />
            </span>
            {user ? (
              <>
                <Link href="/dashboard" className="btn btn-secondary hidden md:inline-flex">
                  {t("nav.dashboard")}
                </Link>
                <span className="hidden lg:block">
                  <AccountMenu phoneLabel={phoneLabel} isAdmin={user.isAdmin} />
                </span>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden px-2 text-[15px] font-semibold hover:text-brand-600 md:inline dark:hover:text-brand-300">
                  {t("nav.login")}
                </Link>
                <Link href="/exams" className="btn btn-primary hidden sm:inline-flex">
                  {t("nav.startFree")}
                </Link>
              </>
            )}
            <MobileNav exams={examsMenu} loggedIn={!!user} isAdmin={!!user?.isAdmin} phoneLabel={phoneLabel} />
          </div>
        </div>
      </header>
    </>
  );
}
