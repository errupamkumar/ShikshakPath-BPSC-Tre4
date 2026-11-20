import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { patternFor } from "@config/test-series.config";
import { examByKey } from "@config/exams";
import { subjectByKey, subjectName } from "@config/subjects";
import { ExamLogo } from "@/components/exam-logo";
import { BookIcon, CheckIcon } from "@/components/icons";
import { RememberSeries } from "@/components/remember-series";
import { PriceCard } from "@/components/sections";
import { TestRow } from "@/components/test-row";
import { UnlockButton } from "@/components/unlock-button";
import { accessFor, canOpenSeries } from "@/lib/access";
import { getCatalog, isExamLive, isSeriesLive, subjectsForExam, testsFor } from "@/lib/catalog";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { rupees } from "@/lib/format";
import { getT } from "@/lib/lang";
import { patternSummary } from "@/lib/pattern-text";
import { getTestProgress } from "@/lib/progress";
import { listResources } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

type Props = { params: Promise<{ slug: string; subject: string }>; searchParams: Promise<{ tab?: string | string[] }> };

function resolve(slug: string, subjectKey: string) {
  const exam = examByKey.get(slug);
  const subject = subjectByKey.get(subjectKey);
  if (!exam || !subject) return null;
  if (exam.subjects && !exam.subjects.includes(subject.key)) return null;
  return { exam, subject };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subject } = await params;
  const r = resolve(slug, subject);
  if (!r) return { title: "Exam" };
  const live = isSeriesLive(await getCatalog(), r.exam.key, r.subject.key);
  return {
    title: `${r.exam.short} ${r.subject.name} test series, mock tests & PYQs`,
    description: `${r.exam.name}: ${r.subject.name}. Mock tests in the BPSC TRE pattern, previous-year questions with answers and explanations, and eBooks.`,
    robots: live ? undefined : { index: false }, // "coming soon" pages stay out of search results
  };
}

/** Step 3 of Exam → Subject → test series: the complete test series of one subject for one exam. */
export default async function ExamSubjectPage({ params, searchParams }: Props) {
  const [{ slug, subject: subjectKey }, sp] = await Promise.all([params, searchParams]);
  const r = resolve(slug, subjectKey);
  if (!r) notFound();
  const { exam, subject } = r;

  const user = await getSessionUser();
  const [cat, paid, pricePaise, progress, { lang, t }] = await Promise.all([getCatalog(), accessFor(user).then((a) => canOpenSeries(a, exam.key, subject.key)), getPriceInPaise(), getTestProgress(user?.uid), getT()]);
  if (!isExamLive(cat, exam.key) && !user?.isAdmin) notFound();
  const s = cat.stats;
  // Each exam is independent: only this exam's tests and counts.
  const ss = s.byExamSubject[exam.key]?.[subject.key];
  const sName = subjectName(subject.key, lang);
  const live = isSeriesLive(cat, exam.key, subject.key);
  const papers = testsFor(cat, { subject: subject.key, kind: "paper", examKey: exam.key });
  const mocks = testsFor(cat, { subject: subject.key, kind: "mock", examKey: exam.key });
  const tab = sp.tab === "papers" ? "papers" : "mocks";
  const switcher = subjectsForExam(cat, exam.key);
  const liveNames = switcher.filter((x) => x.live);
  const price = rupees(pricePaise);
  const freeTests = [...mocks, ...papers].filter((x) => x.free);
  const ebooks = isFirebaseAdminConfigured() ? (await listResources()).filter((x) => !x.subject || x.subject === subject.key).length : 0;
  const base = `/exams/${exam.key}/${subject.key}`;
  const pattern = patternFor(exam.key);
  const patternLine = patternSummary(pattern, t);

  return (
    <div className={paid || !live ? "" : "pb-24 lg:pb-0"}>
      {live && <RememberSeries exam={exam.key} subject={subject.key} />}
      <section className="border-b border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/40">
        <div className="container-page py-10 sm:py-14">
          <nav className="text-sm text-ink-500 dark:text-ink-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-900 dark:hover:text-white">{t("common.home")}</Link> /{" "}
            <Link href="/exams" className="hover:text-ink-900 dark:hover:text-white">{t("nav.exams")}</Link> /{" "}
            <Link href={`/exams/${exam.key}`} className="hover:text-ink-900 dark:hover:text-white">{exam.short}</Link> /{" "}
            <span className="text-ink-900 dark:text-ink-100">{sName}</span>
          </nav>

          <div className="mt-6 flex items-center gap-4">
            <ExamLogo exam={exam} size={64} />
            <div className="min-w-0">
              <p className="eyebrow">{live ? t("ex.step3") : exam.name}</p>
              <h1 className="display mt-1.5 max-w-4xl text-3xl leading-[1.04] sm:text-5xl">
                {exam.short} <span className="text-brand-500 dark:text-brand-300">{sName}</span>
              </h1>
            </div>
          </div>

          {live && ss ? (
            <>
              <p className="mt-5 max-w-3xl text-ink-600 dark:text-ink-300">{t("tp.intro", { exam: `${exam.short} (${exam.name})`, pattern: patternLine })}</p>
              <ul className="mt-5 flex flex-wrap gap-2 text-sm">
                {[
                  t("tp.bMocks", { n: mocks.length }),
                  ...(papers.length ? [t("tp.bPapers", { n: papers.length })] : []),
                  t("tp.bFree", { n: freeTests.length }),
                  t("tp.bQs", { n: ss.questions.toLocaleString("en-IN") }),
                  t("tp.bLang"),
                ].map((b) => (
                  <li key={b} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 font-semibold dark:border-ink-700 dark:bg-ink-900">
                    <CheckIcon width={14} height={14} className="text-brand-600 dark:text-brand-300" /> {b}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-5 max-w-2xl text-lg text-ink-600 dark:text-ink-300">{exam.posts}.</p>
          )}

          {switcher.length > 1 && (
            <div className="mt-7">
              <p className="text-xs font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400">{t("common.subject")}</p>
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {switcher.map((x) => (
                  <Link
                    key={x.key}
                    href={`/exams/${exam.key}/${x.key}`}
                    aria-current={x.key === subject.key ? "page" : undefined}
                    className={`btn shrink-0 px-4 py-1.5 ${x.key === subject.key ? "btn-primary" : "btn-secondary"} ${x.live ? "" : "opacity-60"}`}
                  >
                    {lang === "hi" ? x.nameHi : x.name}
                    {!x.live && <span className="text-[10px] font-bold uppercase opacity-70">{t("common.soon")}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {!live ? (
        <section className="container-page py-16">
          <div className="card mx-auto max-w-2xl p-8 text-center">
            <p className="eyebrow">{t("ex.soonEyebrow")}</p>
            <h2 className="display mt-3 text-3xl">{t("ex.soonTitle", { exam: exam.short, subject: sName })}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">
              {t("ex.soonText", { subject: sName })}{" "}
              {liveNames.length > 0 && t("ex.availableNow", { list: liveNames.map((x) => (lang === "hi" ? x.nameHi : x.name)).join(", ") })}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {liveNames[0] && (
                <Link href={`/exams/${exam.key}/${liveNames[0].key}`} className="btn btn-primary px-6 py-3">
                  {t("ex.practise", { subject: lang === "hi" ? liveNames[0].nameHi : liveNames[0].name })}
                </Link>
              )}
              <Link href={`/exams/${exam.key}`} className="btn btn-secondary px-6 py-3">
                {t("ex.another")}
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="inline-flex w-full rounded-full border border-ink-200 bg-white p-1 sm:w-auto dark:border-ink-700 dark:bg-ink-900" role="tablist">
              {[
                { key: "mocks", label: t("tp.tabMocks", { n: mocks.length }), href: base },
                { key: "papers", label: t("tp.tabPapers", { n: papers.length }), href: `${base}?tab=papers` },
              ].map((x) => (
                <Link
                  key={x.key}
                  href={x.href}
                  role="tab"
                  aria-selected={tab === x.key}
                  className={`flex-1 rounded-full px-4 py-2.5 text-center text-sm font-bold whitespace-nowrap transition sm:flex-none sm:px-6 ${tab === x.key ? "bg-ink-900 text-white dark:bg-brand-300 dark:text-ink-950" : "text-ink-600 hover:text-ink-900 dark:text-ink-300"}`}
                >
                  {x.label}
                </Link>
              ))}
            </div>

            {tab === "mocks" ? (
              <>
                <p className="mt-6 text-sm text-ink-600 dark:text-ink-300">
                  {t("tp.mocksIntro", { subject: sName, pattern: pattern.name })} {patternLine}.
                </p>
                <div className="mt-4 grid gap-3">
                  {mocks.map((x) => (
                    <TestRow key={x.id} test={x} unlocked={x.free || paid} progress={progress.get(x.id)} />
                  ))}
                  {mocks.length === 0 && <p className="card p-6 text-center text-ink-500">{t("tp.noMocks", { subject: sName })}</p>}
                </div>
              </>
            ) : papers.length ? (
              <div className="mt-6 grid gap-3">
                {papers.map((x) => (
                  <TestRow key={x.id} test={x} unlocked={x.free || paid} progress={progress.get(x.id)} />
                ))}
              </div>
            ) : (
              <div className="card mt-6 p-6">
                <p className="font-semibold">{t("ex.noPapers", { exam: exam.short, subject: sName })}</p>
                <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t("ex.noPapersText", { subject: sName, n: s.sourceExams })}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={base} className="btn btn-primary px-4 py-2">
                    {t("ex.allMocks", { n: mocks.length })}
                  </Link>
                  <Link href="/ebooks/pyq" className="btn btn-secondary px-4 py-2">
                    {t("pyq.pdfs")}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="grid gap-4 lg:sticky lg:top-28">
              <div className="hidden lg:block">
                <PriceCard
                  price={price}
                  paid={paid}
                  loggedIn={!!user}
                  series={{ exam: exam.key, subject: subject.key }}
                  seriesLabel={`${exam.short} · ${sName}`}
                  freeHref={freeTests[0] ? `/tests/${freeTests[0].id}` : base}
                  features={[
                    t("pc.f.mocks", { n: mocks.length, subject: sName }),
                    ...(papers.length ? [t("pc.f.papers", { n: papers.length, subject: sName })] : []),
                    t("pc.f.study"),
                    t("pc.f.allSubjects"),
                    t("pc.f.player"),
                  ]}
                />
              </div>
              <Link href={`/ebooks?subject=${subject.key}`} className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink-900/5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink-900 text-brand-300 dark:bg-brand-300 dark:text-ink-950">
                  <BookIcon width={22} height={22} />
                </span>
                <span>
                  <span className="block font-bold group-hover:text-brand-700 dark:group-hover:text-brand-300">
                    {t("tp.ebooks", { subject: sName })} {ebooks > 0 && <span className="text-ink-500">({ebooks})</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-600 dark:text-ink-300">{t("tp.ebooksText", { subject: sName })}</span>
                </span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile buy bar (Adda247-style) */}
      {!paid && live && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-ink-50/95 px-4 pt-3 backdrop-blur lg:hidden dark:border-ink-800 dark:bg-ink-950/95"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-lg leading-none font-black">{price}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">{t("tp.oneTime", { n: mocks.length + papers.length })}</p>
            </div>
            <UnlockButton series={{ exam: exam.key, subject: subject.key }} priceLabel={price} loggedIn={!!user} className="btn-primary" label={t("common.unlock")} />
          </div>
        </div>
      )}
    </div>
  );
}
