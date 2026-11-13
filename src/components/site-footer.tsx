import Link from "next/link";
import { siteConfig } from "@config/test-series.config";
import { subjectName, subjects } from "@config/subjects";
import { getCatalog, liveExams, seriesPath } from "@/lib/catalog";
import { EBOOK_META, EBOOK_TYPES } from "@/lib/ebook-types";
import { getT } from "@/lib/lang";
import { ExamLogo } from "./exam-logo";
import { InstagramIcon, MailIcon, PhoneIcon, TelegramIcon, WhatsappIcon, YoutubeIcon } from "./icons";
import { Logo } from "./logo";

export async function SiteFooter({ showCta = true }: { showCta?: boolean }) {
  const [cat, { lang, t }] = await Promise.all([getCatalog(), getT()]);
  const s = siteConfig.social;
  const socials = [
    { href: s.youtube, label: "YouTube", Icon: YoutubeIcon },
    { href: s.telegram, label: "Telegram", Icon: TelegramIcon },
    { href: s.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: s.whatsapp, label: "WhatsApp", Icon: WhatsappIcon },
  ].filter((x) => x.href);
  const examList = liveExams(cat);
  const st = cat.stats;

  const col = "text-sm text-ink-300 transition hover:text-white";
  const head = "text-xs font-bold tracking-[0.2em] text-brand-300 uppercase";
  return (
    <footer className="relative mt-20 overflow-hidden rounded-t-[32px] bg-ink-950 text-ink-100">
      {/* soft copper glow, like Nova's closing section */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />

      {showCta && (
        <div className="relative container-page border-b border-white/10 py-16 text-center sm:py-20">
          <p className="flex items-center justify-center gap-3 text-xs font-bold tracking-[0.25em] text-brand-300 uppercase">
            <span className="h-px w-8 bg-brand-300/60" /> {t("footer.ctaEyebrow")} <span className="h-px w-8 bg-brand-300/60" />
          </p>
          <h2 className="display mx-auto mt-5 max-w-3xl text-4xl leading-[1.05] text-white sm:text-6xl">{t("footer.ctaTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-300">
            {t("footer.ctaText", { q: st.totalQuestions.toLocaleString("en-IN"), t: st.totalTests })}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/exams" className="btn btn-accent px-7 py-3.5 text-base">
              {t("nav.startFree")}
            </Link>
            <Link href="/ebooks" className="btn btn-light px-7 py-3.5 text-base">
              {t("nav.ebooks")}
            </Link>
          </div>
        </div>
      )}

      <div className="relative container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-300">{siteConfig.tagline}</p>
          <ul className="mt-5 grid gap-2 text-sm">
            <li>
              <a href={`mailto:${siteConfig.business.email}`} className="inline-flex items-center gap-2 text-ink-200 hover:text-white">
                <MailIcon width={16} height={16} className="text-brand-300" /> {siteConfig.business.email}
              </a>
            </li>
            <li>
              <a href={`tel:${siteConfig.business.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-ink-200 hover:text-white">
                <PhoneIcon width={16} height={16} className="text-brand-300" /> {siteConfig.business.phone}
              </a>
            </li>
          </ul>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-full border border-white/15 text-ink-200 transition hover:border-brand-300 hover:text-brand-300">
                  <Icon width={18} height={18} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className={head}>{t("footer.popularExams")}</p>
          <ul className="mt-4 grid gap-2.5">
            {examList.map((e) => (
              <li key={e.key}>
                <Link href={`/exams/${e.key}`} className={`${col} flex items-center gap-2.5`}>
                  <ExamLogo exam={e} size={28} />
                  <span>
                    <span className="block font-semibold text-ink-100">{e.short}</span>
                    <span className="block text-xs text-ink-400">{e.name}</span>
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/exams" className="text-sm font-bold text-brand-300 hover:text-brand-200">
                {t("footer.chooseExam")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className={head}>{t("footer.study")}</p>
          <ul className="mt-4 grid gap-2.5">
            <li><Link href="/pyq" className={col}>{t("nav.pyqLong")}</Link></li>
            <li><Link href="/tests" className={col}>{t("nav.testSeries")}</Link></li>
            {EBOOK_TYPES.map((k) => (
              <li key={k}>
                <Link href={`/ebooks/${k}`} className={col}>
                  {t("nav.ebooks")}: {t(EBOOK_META[k].label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={head}>{t("footer.subjects")}</p>
          <ul className="mt-4 grid gap-2.5">
            {st.liveSubjects.map((k) => (
              <li key={k}>
                <Link href={seriesPath(cat, k)} className={col}>
                  {subjectName(k, lang)}
                </Link>
              </li>
            ))}
            <li className="text-sm text-ink-500">{t("common.comingSoon")}: {subjects.filter((x) => !st.liveSubjects.includes(x.key)).slice(0, 4).map((x) => subjectName(x.key, lang)).join(", ")}…</li>
          </ul>
        </div>

        <div>
          <p className={head}>{t("footer.company")}</p>
          <ul className="mt-4 grid gap-2.5">
            <li><Link href="/about" className={col}>{t("footer.aboutUs")}</Link></li>
            <li><Link href="/#pricing" className={col}>{t("nav.pricing")}</Link></li>
            <li><Link href="/policies/contact" className={col}>{t("footer.contact")}</Link></li>
            <li><Link href="/policies/terms" className={col}>{t("footer.terms")}</Link></li>
            <li><Link href="/policies/privacy" className={col}>{t("footer.privacy")}</Link></li>
            <li><Link href="/policies/refund" className={col}>{t("footer.refund")}</Link></li>
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div
          className="container-page flex flex-col gap-2 py-6 text-xs text-ink-400 md:flex-row md:items-center md:justify-between"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. {t("footer.rights")}
          </p>
          {siteConfig.themeCredit && (
            <p className="shrink-0">
              Design based on Nova by{" "}
              <a href="https://webscale.pl/" target="_blank" rel="noopener noreferrer" className="text-ink-200 hover:text-white">WebScale</a> · Distributed by{" "}
              <a href="https://themewagon.com/" target="_blank" rel="noopener noreferrer" className="text-ink-200 hover:text-white">ThemeWagon</a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
