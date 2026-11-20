import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { subjectName } from "@config/subjects";
import { ResultReview, type ReviewItem } from "@/components/result-review";
import { StartTestButton } from "@/components/start-test-button";
import { UnlockButton } from "@/components/unlock-button";
import { accessFor, canOpenSeries } from "@/lib/access";
import { attemptPattern, finalizeAttempt, getAttempt, getRankInfo, isExpired } from "@/lib/attempts";
import { examShort, getCatalog, primaryExamKey, seriesLabel, seriesOf, seriesPath, seriesStats, sourceNames } from "@/lib/catalog";
import { dateTime, duration, marks, rupees } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

export const metadata: Metadata = { title: "Result" };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/results/${attemptId}`);
  const { lang, t } = await getT();

  let attempt = await getAttempt(user.uid, attemptId);
  if (!attempt) notFound();
  if (attempt.status !== "submitted") {
    if (!isExpired(attempt)) redirect(`/attempt/${attempt.id}`); // still running (or paused): no answers yet
    attempt = await finalizeAttempt(user.uid, attempt.id);
    if (!attempt) notFound();
  }
  const r = attempt.result!;
  const cat = await getCatalog();
  const stats = cat.stats;
  const test = cat.testById.get(attempt.testId);
  const rank = await getRankInfo(attempt.testId, r.score);

  // Answers and explanations are only sent now, after submission.
  const items: ReviewItem[] = [];
  const byExam = new Map<string, { total: number; correct: number; wrong: number }>();
  attempt.questionIds.forEach((qid, i) => {
    const q = cat.questions.get(qid);
    if (!q) return;
    const status = attempt.graded?.[qid] ?? "blank";
    items.push({
      n: i + 1,
      id: q.id,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      ...(q.hi ? { hi: q.hi } : {}),
      sources: sourceNames(cat, q),
      chosen: attempt.answers?.[qid] ?? null,
      status,
    });
    const exam = examShort(primaryExamKey(cat, q));
    const e = byExam.get(exam) ?? { total: 0, correct: 0, wrong: 0 };
    e.total++;
    if (status === "correct") e.correct++;
    if (status === "wrong") e.wrong++;
    byExam.set(exam, e);
  });

  const pct = r.maxScore ? Math.max(0, (r.score / r.maxScore) * 100) : 0;
  const access = await accessFor(user);
  const paid = test ? canOpenSeries(access, test.examKey, test.subject) : access.all;
  const price = paid ? "" : rupees(await getPriceInPaise());
  const ap = attemptPattern(cat, attempt);
  const optionELabel = ap.optionE ? ap.optionELabel : null;
  const zero = t("res.zero");

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <Link href="/dashboard" className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
        ← {t("res.dashboard")}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          {test && <p className="eyebrow">{subjectName(test.subject, lang)}</p>}
          <h1 className="display mt-1 text-3xl sm:text-4xl">{t("res.title", { title: attempt.testTitle })}</h1>
        </div>
        <p className="text-sm text-ink-500">
          {dateTime(attempt.submittedAt ?? attempt.startedAt)}
          {attempt.autoSubmitted ? ` · ${t("res.auto")}` : ""}
        </p>
      </div>

      {/* Score */}
      <section className="mt-6 grid gap-4 md:grid-cols-[1.2fr_2fr]">
        <div className="card flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-ink-500 dark:text-ink-400">{t("res.score")}</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight">
            {marks(r.score)}
            <span className="text-2xl font-semibold text-ink-400"> / {marks(r.maxScore)}</span>
          </p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-500">{t("res.ofMax", { p: marks(pct) })}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { k: t("res.accuracy"), v: `${marks(r.accuracy)}%`, hint: t("res.accHint") },
            { k: t("res.time"), v: duration(attempt.timeTakenSec ?? 0), hint: t("res.of", { d: duration(attempt.durationSec) }) },
            { k: t("res.correct"), v: r.correct, hint: r.correct ? `+${marks(r.correct * r.marksPerQuestion)}` : zero, cls: "text-emerald-600" },
            {
              k: t("res.wrong"),
              v: r.wrong,
              hint: !r.negativeMarksPerWrong ? t("res.noPenalty") : r.wrong ? `−${marks(r.wrong * r.negativeMarksPerWrong)}` : zero,
              cls: "text-rose-600",
            },
            ...(optionELabel ? [{ k: t("res.skipped"), v: r.skipped, hint: zero }] : []),
            { k: t("res.blank"), v: r.blank, hint: r.blankPenalty && r.blank ? `−${marks(r.blank * r.blankPenalty)}` : zero, cls: r.blank && r.blankPenalty ? "text-amber-600" : "" },
          ].map((x) => (
            <div key={x.k} className="card p-4">
              <dt className="text-xs text-ink-500 dark:text-ink-400">{x.k}</dt>
              <dd className={`text-2xl font-bold ${x.cls ?? ""}`}>{x.v}</dd>
              <dd className="text-xs text-ink-500">{x.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Rank (first attempts of all students) */}
      {rank && (
        <section className="mt-4 overflow-hidden rounded-[24px] bg-ink-950 p-5 text-ink-50 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-[0.2em] text-brand-300 uppercase">{t("res.rankTitle")}</p>
            <p className="text-xs text-ink-400">{t("res.basedOn", { n: rank.total.toLocaleString("en-IN") })}</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: t("res.rank"), v: `${rank.rank.toLocaleString("en-IN")} / ${rank.total.toLocaleString("en-IN")}` },
              { k: t("res.percentile"), v: marks(rank.percentile) },
              { k: t("res.topper"), v: marks(rank.topper) },
              { k: t("res.average"), v: marks(rank.average) },
            ].map((x) => (
              <div key={x.k}>
                <dt className="text-xs text-ink-300">{x.k}</dt>
                <dd className="display text-3xl text-brand-300">{x.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* By section (tests with more than one section) */}
      {r.sections && r.sections.length > 1 && (
        <section className="card mt-4 overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">{t("res.bySection")}</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
                <tr>
                  <th className="px-5 py-2 font-medium">{t("res.section")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("res.score")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("res.correctCol")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("res.wrong")}</th>
                  <th className="px-5 py-2 text-right font-medium">{t("res.accuracyCol")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {r.sections.map((sec) => (
                  <tr key={sec.key}>
                    <td className="px-5 py-2 font-semibold">{lang === "hi" ? sec.nameHi : sec.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {marks(sec.score)} / {marks(sec.maxScore)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{sec.correct}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{sec.wrong}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{sec.correct + sec.wrong ? `${Math.round((sec.correct / (sec.correct + sec.wrong)) * 100)}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* By exam */}
      <section className="card mt-4 overflow-hidden">
        <h2 className="px-5 pt-5 font-bold">{t("res.byExam")}</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
              <tr>
                <th className="px-5 py-2 font-medium">{t("res.exam")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("res.questions")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("res.correctCol")}</th>
                <th className="px-5 py-2 text-right font-medium">{t("res.accuracyCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {[...byExam.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .map(([exam, e]) => (
                  <tr key={exam}>
                    <td className="px-5 py-2">{exam}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.correct}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{e.correct + e.wrong ? `${Math.round((e.correct / (e.correct + e.wrong)) * 100)}%` : "–"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <section className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {test && (test.free || paid) && <StartTestButton testId={test.id} label={t("res.reattempt")} className="w-full sm:w-auto" />}
        <Link href={test ? seriesPath(cat, test.subject, test.examKey) : "/tests"} className="btn btn-secondary">
          {t("res.allTests")}
        </Link>
      </section>

      {!paid && (
        <section className="mt-6 flex flex-col gap-4 rounded-2xl bg-brand-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">{t("res.upsellTitle")}</p>
            <p className="text-sm text-brand-100">{test
                ? t("res.upsellSeries", {
                    series: seriesLabel(test.examKey, test.subject, lang),
                    t: seriesStats(cat, test.examKey, test.subject).mockTests + seriesStats(cat, test.examKey, test.subject).paperTests,
                    q: seriesStats(cat, test.examKey, test.subject).questions.toLocaleString("en-IN"),
                    price,
                  })
                : t("res.upsellText", { t: stats.totalTests, q: stats.totalQuestions.toLocaleString("en-IN"), price })}</p>
          </div>
          {test && <UnlockButton series={seriesOf(test)} priceLabel={price} loggedIn />}
        </section>
      )}

      {/* Review */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("res.review")}</h2>
        <ResultReview items={items} optionELabel={optionELabel} />
      </section>
    </div>
  );
}
