import Link from "next/link";
import { cookies } from "next/headers";
import { carouselConfig, examPattern, landingConfig, patternFor, siteConfig } from "@config/test-series.config";
import { ExamLogo } from "@/components/exam-logo";
import { ExamPicker } from "@/components/exam-picker";
import { ArrowUpRight, BookIcon, ChartIcon, CheckIcon, ClockIcon, DeviceIcon, LayersIcon, TargetIcon, TrophyIcon } from "@/components/icons";
import { SampleQuiz } from "@/components/sample-quiz";
import { ScreenCarousel } from "@/components/screen-carousel";
import { FaqList, PriceCard, SectionHeading } from "@/components/sections";
import { SubjectCard } from "@/components/subject-card";
import { WelcomeModal } from "@/components/welcome-modal";
import { fullAccess } from "@/lib/access";
import { getCatalog, liveExams, seriesPath, subjectsForExam, toPublicQuestion } from "@/lib/catalog";
import { menuExams } from "@/lib/exam-menu";
import { fractionLabel, rupees } from "@/lib/format";
import { patternSummary } from "@/lib/pattern-text";
import { getT } from "@/lib/lang";
import { SERIES_COOKIE } from "@/lib/series-cookie";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

export default async function HomePage() {
  const [cat, pricePaise, user, { lang, t }, jar] = await Promise.all([getCatalog(), getPriceInPaise(), getSessionUser(), getT(), cookies()]);
  const paid = await fullAccess(user);
  const s = cat.stats;
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const price = rupees(pricePaise);
  const bookTotal = landingConfig.bookComparison.reduce((sum, b) => sum + b.price, 0);
  const samples = s.sampleQuestionIds
    .map((id) => cat.questions.get(id))
    .filter((q) => q !== undefined)
    .map((q) => toPublicQuestion(cat, q));
  const neg = fractionLabel(examPattern.negativeMarksPerWrong);
  const exams = liveExams(cat);
  const pickerExams = menuExams(cat, lang);
  const [lastExam, lastSubject] = decodeURIComponent(jar.get(SERIES_COOKIE)?.value ?? "").split("/");
  const subjectCards = subjectsForExam(cat, exams[0]?.key);
  const liveNames = subjectCards.filter((x) => x.live).map((x) => (lang === "hi" ? x.nameHi : x.name));
  const and = lang === "hi" ? " और " : " and ";
  const liveLabel = liveNames.length > 1 ? `${liveNames.slice(0, -1).join(", ")}${and}${liveNames[liveNames.length - 1]}` : (liveNames[0] ?? "");
  const faqs = lang === "hi" ? landingConfig.faqsHi : landingConfig.faqs;
  const freeMock = cat.tests.find((x) => x.kind === "mock" && x.free);

  const features = [
    { icon: BookIcon, title: t("home.f1t"), text: t("home.f1d", { q: fmt(s.totalQuestions), e: s.sourceExams }) },
    { icon: TargetIcon, title: t("home.f2t"), text: t("home.f2d", { n: examPattern.questionsPerTest, m: examPattern.durationMinutes, neg }) },
    { icon: ChartIcon, title: t("home.f3t"), text: t("home.f3d") },
    { icon: LayersIcon, title: t("home.f4t"), text: t("home.f4d", { m: s.mockTests }) },
    { icon: ClockIcon, title: t("home.f5t"), text: t("home.f5d") },
    { icon: DeviceIcon, title: t("home.f6t"), text: t("home.f6d") },
  ];
  const study = [
    { href: "/pyq", icon: BookIcon, title: t("nav.pyqLong"), text: t("home.pyqCard") },
    { href: "/tests", icon: TrophyIcon, title: t("nav.testSeries"), text: t("home.testCard") },
    { href: "/ebooks", icon: LayersIcon, title: t("nav.ebooks"), text: t("home.ebooksCard") },
  ];

  return (
    <>
      {!paid && (
        <WelcomeModal
          freeHref={freeMock ? `/tests/${freeMock.id}` : "/exams"}
          price={price}
          compareAt={`₹${fmt(bookTotal)}`}
          stats={{ mocks: s.mockTests, papers: s.paperTests, questions: fmt(s.totalQuestions) }}
          loggedIn={!!user}
        />
      )}
      {/* ── Hero: headline + Exam → Subject picker ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute top-[-10rem] right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-700/20" />
        {/* Phones: headline → picker → text. Desktop: text column left, picker right. */}
        <div className="relative container-page grid gap-x-10 gap-y-8 py-10 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:grid-rows-[auto_auto] lg:py-16 xl:gap-x-16">
          <div className="animate-fade-up lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="eyebrow">{t("home.eyebrow")}</p>
            <h1 className="display mt-4 text-[2.25rem] leading-[1.03] sm:mt-5 sm:text-6xl xl:text-[4.1rem]">
              {t("home.title1")}
              <span className="block text-brand-500 dark:text-brand-300">{t("home.title2")}</span>
            </h1>
          </div>
          <div className="animate-fade-up [animation-delay:120ms] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <ExamPicker exams={pickerExams} initial={lastExam && lastSubject ? { exam: lastExam, subject: lastSubject } : undefined} />
          </div>
          <div className="animate-fade-up lg:col-start-1 lg:row-start-2 lg:self-start">
            <p className="max-w-xl text-lg leading-relaxed text-ink-600 dark:text-ink-300">{t("home.text")}</p>
            <ul className="mt-7 flex flex-wrap gap-2 text-sm font-semibold">
              {[t("home.trust1"), t("home.trust2"), t("home.trust3")].map((x) => (
                <li key={x} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 dark:border-ink-700 dark:bg-ink-900">
                  <CheckIcon width={14} height={14} className="text-emerald-600 dark:text-emerald-400" /> {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Prepare for: the exams (official logo + name) and the real pattern ── */}
      <section className="border-y border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/40">
        <div className="container-page flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
            <span className="text-xs font-bold tracking-[0.2em] text-ink-500 uppercase dark:text-ink-400">{t("home.prepFor")}</span>
            {exams.map((e) => (
              <Link key={e.key} href={`/exams/${e.key}`} className="group flex items-center gap-3">
                <ExamLogo exam={e} size={46} />
                <span>
                  <span className="block leading-tight font-black group-hover:text-brand-700 dark:group-hover:text-brand-300">{e.short}</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">{e.name}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-brand-700 dark:text-brand-300">{patternSummary(patternFor(e.key), t)}</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="rounded-full bg-ink-900 px-4 py-2 text-center text-xs font-bold text-ink-50 sm:text-sm dark:bg-brand-300 dark:text-ink-950">{t("home.ownPattern")}</p>
        </div>
      </section>

      {/* ── Carousel: real test screens ── */}
      <section className="container-page pt-16 sm:pt-24">
        <SectionHeading eyebrow={t("home.carEyebrow")} title={t("home.carTitle")} text={t("home.carText")} />
        <div className="mt-10">
          <ScreenCarousel slides={carouselConfig.slides} autoplaySeconds={carouselConfig.autoplaySeconds} brand={siteConfig.name} />
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="mt-16 rounded-[32px] bg-ink-950 text-ink-50 sm:mx-3 sm:mt-24 lg:mx-4">
        <dl className="container-page grid grid-cols-2 gap-y-8 py-12 lg:grid-cols-4 lg:py-14">
          {[
            { v: fmt(s.totalQuestions), k: t("home.sQuestions") },
            { v: String(s.mockTests), k: t("home.sMocks") },
            { v: String(exams.length), k: t("home.sExamsBihar") },
            { v: t("home.sFreeValue"), k: t("home.sFree") },
          ].map((x, i) => (
            <div key={x.k} className={`px-2 text-center ${i % 2 ? "border-l border-white/15" : ""} ${i === 2 ? "lg:border-l lg:border-white/15" : ""}`}>
              <dd className="display text-4xl text-brand-300 sm:text-6xl">{x.v}</dd>
              <dt className="mt-2 text-sm text-ink-200">{x.k}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Study material (portal) ── */}
      <section className="container-page pt-20 sm:pt-28">
        <SectionHeading eyebrow={t("home.studyEyebrow")} title={t("home.studyTitle")} text={t("home.studyText")} />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {study.map((x) => (
            <Link key={x.href} href={x.href} className="card group p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-ink-900/5">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-ink-900 text-brand-300 dark:bg-brand-300 dark:text-ink-950">
                  <x.icon width={22} height={22} />
                </span>
                <ArrowUpRight width={18} height={18} className="text-ink-400 transition group-hover:text-brand-600" />
              </div>
              <h3 className="mt-6 text-lg font-bold">{x.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{x.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Subjects ── */}
      <section className="container-page pt-20 sm:pt-28">
        <SectionHeading eyebrow={t("home.subjEyebrow")} title={t("home.subjTitle")} text={t("home.subjText", { live: liveLabel })} />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {subjectCards.map((x) => (
            <SubjectCard key={x.key} href={seriesPath(cat, x.key)} s={{ ...x, tests: x.stats.mockTests + x.examPapers, questions: x.stats.questions }} />
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="container-page py-20 sm:py-28">
        <SectionHeading eyebrow={t("home.featEyebrow")} title={t("home.featTitle")} text={t("home.featText")} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="card group p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-ink-900/5">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-800">
                  <f.icon width={20} height={20} />
                </span>
                <ArrowUpRight width={18} height={18} className="text-ink-400 transition group-hover:text-brand-600" />
              </div>
              <h3 className="mt-6 text-lg font-bold">
                <span className="mr-1 font-mono text-sm text-brand-600 dark:text-brand-300">{String(i + 1).padStart(2, "0")}.</span> {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="scroll-mt-28 bg-white py-20 sm:py-28 dark:bg-ink-900/40">
        <div className="container-page grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="eyebrow">{t("home.priceEyebrow")}</p>
            <h2 className="display mt-3 text-3xl leading-[1.05] sm:text-5xl">{t("home.priceTitle")}</h2>
            <p className="mt-4 max-w-xl text-ink-600 dark:text-ink-300">{t("home.priceText")}</p>
            <div className="card mt-8 p-6">
              <p className="text-sm font-bold">{t("home.books")}</p>
              <ul className="mt-3 divide-y divide-ink-100 text-sm dark:divide-ink-800">
                {landingConfig.bookComparison.map((b) => (
                  <li key={b.title} className="flex justify-between gap-4 py-2.5">
                    <span className="text-ink-600 dark:text-ink-300">{b.title}</span>
                    <span className="font-semibold whitespace-nowrap">₹{fmt(b.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-ink-200 pt-3 font-bold dark:border-ink-700">
                <span>{t("home.booksTotal")}</span>
                <span className="text-rose-600 line-through decoration-2">₹{fmt(bookTotal)}</span>
              </div>
            </div>
          </div>
          <PriceCard
            price={price}
            compareAt={`₹${fmt(bookTotal)}`}
            paid={paid}
            loggedIn={!!user}
            features={[
              s.paperTests > 0 ? t("pc.f.tests", { t: s.totalTests, m: s.mockTests, p: s.paperTests }) : t("pc.f.testsMocks", { t: s.totalTests }),
              t("pc.f.questions", { q: fmt(s.totalQuestions) }),
              t("pc.f.study"),
              t("pc.f.rank"),
              t("pc.f.allSubjects"),
              t("pc.f.devices"),
            ]}
          />
        </div>
      </section>

      {/* ── Sample questions ── */}
      {samples.length > 0 && (
        <section className="container-page py-20 sm:py-28">
          <SectionHeading eyebrow={t("home.sampleEyebrow")} title={t("home.sampleTitle", { n: samples.length })} text={t("home.sampleText")} />
          <div className="mt-10">
            <SampleQuiz questions={samples} />
          </div>
        </section>
      )}

      {/* ── How it works ── */}
      <section className="container-page pb-20 sm:pb-28">
        <SectionHeading center eyebrow={t("home.howEyebrow")} title={t("home.howTitle")} />
        <ol className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { t: t("home.h1t"), d: t("home.h1d") },
            { t: t("home.h2t"), d: t("home.h2d") },
            { t: t("home.h3t"), d: t("home.h3d") },
            { t: t("home.h4t", { price }), d: t("home.h4d") },
          ].map((x, i) => (
            <li key={x.t} className="relative rounded-[20px] border border-dashed border-ink-300 p-6 dark:border-ink-700">
              <span className="display text-5xl text-brand-300 dark:text-brand-700">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-4 font-bold">{x.t}</p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{x.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="#choose" className="btn btn-primary px-7 py-3.5 text-base">
            {t("home.step1")} →
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="container-page pb-8">
        <SectionHeading center eyebrow={t("home.faqEyebrow")} title={t("home.faqTitle")} />
        <FaqList faqs={faqs} />
      </section>
    </>
  );
}
