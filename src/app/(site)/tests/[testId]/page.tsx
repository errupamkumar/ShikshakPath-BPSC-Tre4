import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { patternFor, playerConfig } from "@config/test-series.config";
import { subjectName } from "@config/subjects";
import { LockIcon } from "@/components/icons";
import { PaletteLegend } from "@/components/palette";
import { StartTestButton } from "@/components/start-test-button";
import { UnlockButton } from "@/components/unlock-button";
import { canAccessTest } from "@/lib/access";
import { getRunningAttempt, patternOfTest, remainingMsOf } from "@/lib/attempts";
import { examShort, getCatalog, isOpenToStudents, paperSource, seriesLabel, seriesOf, seriesPath, seriesStats } from "@/lib/catalog";
import { fractionLabel, rupees } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

type Props = { params: Promise<{ testId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { testId } = await params;
  return { title: (await getCatalog()).testById.get(testId)?.title ?? "Test" };
}

export default async function TestPage({ params }: Props) {
  const { testId } = await params;
  const [cat, { lang, t }] = await Promise.all([getCatalog(), getT()]);
  const test = cat.testById.get(testId);
  const user = await getSessionUser();
  if (!test || (!isOpenToStudents(test) && !user?.isAdmin)) notFound();
  if (!user) redirect(`/login?next=/tests/${test.id}`);

  const access = await canAccessTest(user, test);

  if (!access) {
    const price = rupees(await getPriceInPaise());
    const freeTest = cat.tests.find((x) => x.free && x.subject === test.subject && x.examKey === test.examKey);
    return (
      <div className="container-page max-w-2xl py-12">
        <div className="card p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            <LockIcon width={26} height={26} />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{t("inst.locked", { title: test.title })}</h1>
          <p className="mt-2 text-ink-600 dark:text-ink-400">
            {t("inst.lockedText", {
              n: seriesStats(cat, test.examKey, test.subject).mockTests + seriesStats(cat, test.examKey, test.subject).paperTests,
              q: seriesStats(cat, test.examKey, test.subject).questions.toLocaleString("en-IN"),
              series: seriesLabel(test.examKey, test.subject, lang),
              price,
            })}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <UnlockButton series={seriesOf(test)} priceLabel={price} loggedIn />
            {freeTest && (
              <Link href={`/tests/${freeTest.id}`} className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                {t("inst.freeFirst")}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const running = await getRunningAttempt(user.uid, test.id);
  const minutesLeft = running ? Math.max(1, Math.round(remainingMsOf(running) / 60000)) : 0;
  // This test's exam pattern (each exam has its own).
  const p = patternOfTest(test);
  const examPat = patternFor(test.examKey);
  const neg = p.negative;
  const eLabel = lang === "hi" ? t("pl.optionE") : p.optionELabel;

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <Link href={seriesPath(cat, test.subject, test.examKey, test.kind === "paper" ? "?tab=papers" : "")} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
        ← {t("inst.allTests")}
      </Link>
      <p className="eyebrow mt-4">
        {examShort(test.examKey)} · {subjectName(test.subject, lang)} · {test.kind === "mock" ? t("inst.mockOf", { pattern: examPat.name }) : t("inst.paper", { exam: examShort(paperSource(test)) })}
      </p>
      <h1 className="display mt-2 text-3xl sm:text-4xl">{test.title}</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: t("inst.questions"), v: test.questionCount },
          { k: t("inst.time"), v: t("common.min", { n: test.durationMinutes }) },
          { k: t("inst.correct"), v: `+${fractionLabel(p.marks)}` },
          { k: t("inst.wrong"), v: neg ? `−${fractionLabel(neg)}` : "0" },
        ].map((x) => (
          <div key={x.k} className="card p-4">
            <dt className="text-xs text-ink-500 dark:text-ink-400">{x.k}</dt>
            <dd className="text-xl font-bold">{x.v}</dd>
          </div>
        ))}
      </dl>

      {p.sections.length > 1 && (
        <div className="card mt-6 p-6">
          <h2 className="font-bold">{t("inst.sections")}</h2>
          <ol className="mt-3 grid gap-2 text-sm">
            {p.sections.map((sec, i) => (
              <li key={sec.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 dark:bg-ink-800/60">
                <span className="font-semibold">
                  {i + 1}. {lang === "hi" ? sec.nameHi : sec.name}
                </span>
                <span className="text-ink-500 dark:text-ink-400">
                  {t("common.qs", { n: sec.count })} · +{fractionLabel(sec.marks)} / {sec.negative ? `−${fractionLabel(sec.negative)}` : "0"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card mt-6 p-6">
        <h2 className="font-bold">{t("inst.title")}</h2>
        <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-ink-700 dark:text-ink-300">
          <li>{playerConfig.allowPauseAndResume ? t("inst.l1pause") : t("inst.l1run")}</li>
          <li>{t("inst.l2")}</li>
          <li>{t("inst.l3")}</li>
          {p.optionE && <li>{t("inst.l4", { label: eLabel, p: fractionLabel(p.blankPenalty) })}</li>}
          {!neg && <li>{t("inst.noNeg")}</li>}
          <li>{t("inst.l5")}</li>
          <li>{t("inst.l6")}</li>
          <li>{t("inst.l7")}</li>
        </ul>
        <h3 className="mt-6 text-sm font-semibold">{t("inst.palette")}</h3>
        <div className="mt-3">
          <PaletteLegend />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <StartTestButton
          testId={test.id}
          label={running ? (running.pausedAt ? t("inst.resumePaused", { m: minutesLeft }) : t("inst.resume", { m: minutesLeft })) : t("inst.start")}
          className="w-full py-3.5 text-base sm:w-auto sm:px-10"
        />
        {test.kind === "paper" && (
          <Link href={`/pyq/${test.id}`} className="text-sm font-semibold text-brand-600 dark:text-brand-300">
            {t("inst.readPyq")}
          </Link>
        )}
      </div>
    </div>
  );
}
