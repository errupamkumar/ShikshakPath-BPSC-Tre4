import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@config/test-series.config";
import { getCatalog, liveExams } from "@/lib/catalog";

export const metadata: Metadata = { title: "About us" };

// ⚠ Template copy. Rewrite it in your own words (who you are, why you built this).
export default async function AboutPage() {
  const cat = await getCatalog();
  const s = cat.stats;
  const examNames = liveExams(cat).map((e) => e.short).join(" and ");
  return (
    <>
      <section className="container-page py-14 sm:py-20">
        <p className="eyebrow">About us</p>
        <h1 className="display mt-4 max-w-4xl text-4xl leading-[1.02] sm:text-6xl">
          Built for Bihar&apos;s teacher aspirants, <span className="text-brand-500 dark:text-brand-300">by people who prepared for the same exams.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-600 dark:text-ink-300">
          {siteConfig.name} prepares students for {examNames}, subject by subject. We collect real previous-year questions, clean them, remove
          duplicates and turn them into timed tests in the BPSC TRE pattern, with answers, explanations, rank and eBooks.
        </p>
      </section>
      <section className="rounded-[32px] bg-ink-950 text-ink-50 sm:mx-3 lg:mx-4">
        <dl className="container-page grid grid-cols-2 gap-8 py-12 lg:grid-cols-4">
          {[
            { v: s.totalQuestions.toLocaleString("en-IN"), k: "Unique questions" },
            { v: String(s.mockTests), k: "Mock tests" },
            { v: String(s.sourceExams), k: "Exams the questions come from" },
            { v: String(s.liveSubjects.length), k: "Subjects live" },
          ].map((x) => (
            <div key={x.k} className="text-center">
              <dd className="display text-4xl text-brand-300 sm:text-5xl">{x.v}</dd>
              <dt className="mt-2 text-sm text-ink-200">{x.k}</dt>
            </div>
          ))}
        </dl>
      </section>
      <section className="container-page grid gap-6 py-16 md:grid-cols-3">
        {[
          { t: "Real questions only", d: "Every question comes from an actual past paper and shows which exam asked it." },
          { t: "Honest practice", d: "Same marking as the real exam, including negative marking and Option E, so your score means something." },
          { t: "Affordable", d: "One low price for every subject, test and eBook, instead of buying a separate book for each." },
        ].map((x, i) => (
          <div key={x.t} className="card p-6">
            <span className="font-mono text-sm text-brand-600 dark:text-brand-300">{String(i + 1).padStart(2, "0")}.</span>
            <h2 className="mt-3 text-xl font-bold">{x.t}</h2>
            <p className="mt-2 text-ink-600 dark:text-ink-300">{x.d}</p>
          </div>
        ))}
      </section>
      <section className="container-page pb-8 text-center">
        <Link href="/policies/contact" className="btn btn-secondary px-6 py-3">
          Contact us
        </Link>
      </section>
    </>
  );
}
