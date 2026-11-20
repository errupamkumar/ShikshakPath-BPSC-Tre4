import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { libraryConfig } from "@config/test-series.config";
import { subjectName } from "@config/subjects";
import { LockIcon } from "@/components/icons";
import { PyqViewer, type PyqItem } from "@/components/pyq-viewer";
import { UnlockButton } from "@/components/unlock-button";
import { accessFor, canOpenSeries } from "@/lib/access";
import { examShort, getCatalog, isOpenToStudents, paperSource, seriesOf, sourceNames } from "@/lib/catalog";
import { rupees } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

type Props = { params: Promise<{ testId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const test = (await getCatalog()).testById.get((await params).testId);
  return { title: test ? `${test.title}: answers & explanations` : "PYQ" };
}

/** Study mode for one previous-year paper. Answers are intentionally shown here. */
export default async function PyqPaperPage({ params }: Props) {
  const { testId } = await params;
  const [cat, { lang, t }, user] = await Promise.all([getCatalog(), getT(), getSessionUser()]);
  const test = cat.testById.get(testId);
  if (!test || test.kind !== "paper" || (!isOpenToStudents(test) && !user?.isAdmin)) notFound();

  // Full paper: logged in AND (free paper OR paid OR admin). Otherwise a short preview.
  const full = !!user && (test.free || canOpenSeries(await accessFor(user), test.examKey, test.subject));
  const ids = full ? test.questionIds : test.questionIds.slice(0, libraryConfig.pyqPreviewQuestions);
  const items: PyqItem[] = ids
    .map((id, i) => {
      const q = cat.questions.get(id);
      if (!q) return null;
      return { n: i + 1, id: q.id, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation, ...(q.hi ? { hi: q.hi } : {}), sources: sourceNames(cat, q) };
    })
    .filter((x): x is PyqItem => x !== null);
  const price = full ? "" : rupees(await getPriceInPaise());

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <Link href={`/pyq?exam=${test.examKey}&subject=${test.subject}`} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
        ← {t("pyq.back")}
      </Link>
      <p className="eyebrow mt-4">
        {examShort(test.examKey)} · {subjectName(test.subject, lang)}
        {paperSource(test) !== test.examKey ? ` · ${t("tr.askedIn", { exam: examShort(paperSource(test)) })}` : ""}
      </p>
      <h1 className="display mt-2 text-3xl sm:text-5xl">{test.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-ink-200 bg-white px-3 py-1.5 font-semibold dark:border-ink-700 dark:bg-ink-900">{t("pyq.qCount", { n: test.questionCount })}</span>
        <Link href={`/tests/${test.id}`} className="btn btn-primary px-4 py-2">
          {t("pyq.practise")}
        </Link>
      </div>

      <div className="mt-8">
        <PyqViewer items={items} canEdit={!!user?.isAdmin} />
      </div>

      {!full && (
        <div className="card mt-6 p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            <LockIcon width={22} height={22} />
          </span>
          <p className="mt-3 font-semibold">{t("pyq.previewNote", { n: items.length, total: test.questionCount })}</p>
          <div className="mt-4 flex flex-col items-center gap-2">
            {user ? (
              <UnlockButton series={seriesOf(test)} priceLabel={price} loggedIn />
            ) : (
              <Link href={`/login?next=/pyq/${test.id}`} className="btn btn-primary px-6 py-3">
                {t("lib.loginToRead")}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
