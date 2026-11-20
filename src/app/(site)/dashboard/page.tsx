import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { examByKey } from "@config/exams";
import { subjectName } from "@config/subjects";
import { ExamLogo } from "@/components/exam-logo";
import { ArrowRight, CheckIcon, LockIcon } from "@/components/icons";
import { UnlockButton } from "@/components/unlock-button";
import { accessFor, activePasses, canOpenSeries, getUserDoc, seriesKey } from "@/lib/access";
import { isExpired, listAttempts, remainingMsOf } from "@/lib/attempts";
import { getCatalog, isExamLive, isSeriesLive, seriesStats } from "@/lib/catalog";
import { clock, dateTime, duration, marks, prettyPhone, rupees } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const [profile, attempts, pricePaise, cat, access, { lang, t }] = await Promise.all([
    getUserDoc(user.uid),
    listAttempts(user.uid),
    getPriceInPaise(),
    getCatalog(),
    accessFor(user),
    getT(),
  ]);
  const done = attempts.filter((a) => a.status === "submitted" && a.result);
  const avgPct = done.length ? (done.reduce((s, a) => s + Math.max(0, a.result!.score / a.result!.maxScore), 0) / done.length) * 100 : 0;
  const bestPct = done.length ? Math.max(...done.map((a) => Math.max(0, a.result!.score / a.result!.maxScore))) * 100 : 0;
  const correct = done.reduce((s, a) => s + a.result!.correct, 0);
  const attempted = done.reduce((s, a) => s + a.result!.correct + a.result!.wrong, 0);
  const uniqueTests = new Set(done.map((a) => a.testId)).size;
  const price = rupees(pricePaise);

  // "My test series": what the student chose after signing up, plus anything they have unlocked.
  const series = new Map<string, { exam: string; subject: string }>();
  for (const i of profile?.interests ?? []) if (examByKey.has(i.exam) && isExamLive(cat, i.exam)) series.set(seriesKey(i.exam, i.subject), i);
  for (const p of activePasses(profile)) series.set(seriesKey(p.exam, p.subject), { exam: p.exam, subject: p.subject });
  const myTests = [...series.values()].reduce((n, x) => n + seriesStats(cat, x.exam, x.subject).mockTests + seriesStats(cat, x.exam, x.subject).paperTests, 0);

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("dash.eyebrow")}</p>
          <h1 className="display mt-2 text-3xl sm:text-5xl">{t("dash.title")}</h1>
        </div>
        <Link href="/onboarding" className="btn btn-secondary px-5 py-2.5">
          {t("dash.editSeries")}
        </Link>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="card p-5">
          <p className="text-sm text-ink-500 dark:text-ink-400">{t("nav.loggedInAs")}</p>
          <p className="text-lg font-bold">{prettyPhone(user.phone)}</p>
          {profile?.createdAt && <p className="text-xs text-ink-500">{t("dash.memberSince", { d: dateTime(profile.createdAt) })}</p>}
          <div className="mt-4">
            {user.isAdmin ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <CheckIcon width={16} height={16} /> {t("common.adminAccess")}
              </p>
            ) : access.all ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <CheckIcon width={16} height={16} /> {profile?.paidAt ? t("dash.fullSince", { d: dateTime(profile.paidAt) }) : t("common.fullAccess")}
              </p>
            ) : (
              <p className="text-sm text-ink-600 dark:text-ink-300">{access.any ? t("dash.unlockedN", { n: access.series.size }) : t("dash.freePlan")}</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: t("dash.taken"), v: done.length, hint: t("dash.different", { n: uniqueTests, t: myTests || cat.stats.totalTests }) },
            { k: t("dash.avg"), v: `${marks(avgPct)}%`, hint: t("dash.ofMax") },
            { k: t("dash.best"), v: `${marks(bestPct)}%`, hint: t("dash.single") },
            { k: t("dash.accuracy"), v: attempted ? `${marks((correct / attempted) * 100)}%` : "–", hint: t("dash.correctOf", { c: correct, a: attempted }) },
          ].map((x) => (
            <div key={x.k} className="card p-4">
              <dt className="text-xs text-ink-500 dark:text-ink-400">{x.k}</dt>
              <dd className="text-2xl font-bold">{x.v}</dd>
              <dd className="text-xs text-ink-500">{x.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* My test series */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("dash.mySeries")}</h2>
        {series.size === 0 ? (
          <div className="card mt-3 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{t("dash.noSeries")}</p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t("dash.noSeriesText")}</p>
            </div>
            <Link href="/onboarding" className="btn btn-primary shrink-0 px-5 py-2.5">
              {t("ob.cta")} <ArrowRight width={16} height={16} />
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...series.values()].map((x) => {
              const exam = examByKey.get(x.exam)!;
              const st = seriesStats(cat, x.exam, x.subject);
              const live = isSeriesLive(cat, x.exam, x.subject);
              const open = canOpenSeries(access, x.exam, x.subject);
              return (
                <div key={seriesKey(x.exam, x.subject)} className="card flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <ExamLogo exam={exam} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400">{exam.short}</p>
                      <p className="text-lg leading-tight font-bold">{subjectName(x.subject, lang)}</p>
                      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                        {live ? t("dash.seriesCounts", { m: st.mockTests, p: st.paperTests, q: st.questions.toLocaleString("en-IN") }) : t("common.comingSoon")}
                      </p>
                    </div>
                    {live &&
                      (open ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                          <CheckIcon width={12} height={12} /> {t("dash.unlocked")}
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                          <LockIcon width={12} height={12} /> {t("common.locked")}
                        </span>
                      ))}
                  </div>
                  <div className="mt-auto grid gap-2 pt-5">
                    <Link href={`/exams/${x.exam}/${x.subject}`} className="btn btn-secondary py-2.5">
                      {open || !live ? t("dash.openSeries") : t("dash.viewFree")} <ArrowRight width={16} height={16} />
                    </Link>
                    {live && !open && <UnlockButton series={x} priceLabel={price} loggedIn className="btn-primary w-full" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("dash.attempts")}</h2>
        {attempts.length === 0 ? (
          <div className="card mt-3 p-8 text-center">
            <p className="text-ink-600 dark:text-ink-300">{t("dash.none")}</p>
            <Link href={series.size ? `/exams/${[...series.values()][0].exam}/${[...series.values()][0].subject}` : "/exams"} className="btn btn-primary mt-4">
              {t("dash.startFree")}
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3">
            {attempts.map((a) => {
              const running = a.status === "in_progress" && !isExpired(a);
              const href = a.status === "submitted" ? `/results/${a.id}` : running ? `/tests/${a.testId}` : `/results/${a.id}`;
              const test = cat.testById.get(a.testId);
              return (
                <li key={a.id}>
                  <Link href={href} className="card flex flex-col gap-2 p-4 transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {a.testTitle}
                        {test && (
                          <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 align-middle text-[11px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                            {examByKey.get(test.examKey ?? "")?.short ?? ""} · {subjectName(test.subject, lang)}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-500">{dateTime(a.startedAt)}</p>
                    </div>
                    {a.status === "submitted" && a.result ? (
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                        <span>
                          <strong>{marks(a.result.score)}</strong> / {marks(a.result.maxScore)}
                        </span>
                        <span className="text-ink-500">{t("dash.acc", { p: marks(a.result.accuracy) })}</span>
                        <span className="text-ink-500">{duration(a.timeTakenSec ?? 0)}</span>
                        <span className="font-semibold text-brand-600 dark:text-brand-400">{t("dash.viewResult")}</span>
                      </div>
                    ) : running ? (
                      <span className="text-sm font-semibold text-amber-600">
                        {a.pausedAt ? t("dash.paused", { t: clock(remainingMsOf(a) / 1000) }) : t("dash.resume")}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-ink-500">{t("dash.timeOver")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
