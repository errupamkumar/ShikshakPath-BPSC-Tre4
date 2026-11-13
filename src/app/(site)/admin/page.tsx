import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AggregateField } from "firebase-admin/firestore";
import { buildConfig, libraryConfig, patternFor, questionsPerTest } from "@config/test-series.config";
import { exams } from "@config/exams";
import { subjectName, subjects } from "@config/subjects";
import { AccessToggle, PriceForm } from "@/components/admin-controls";
import { ResourceControls, ResourceUploader } from "@/components/admin-library";
import { ExamToggle } from "@/components/admin-exams";
import { CreateMockButton, TestControls, UploadForm } from "@/components/admin-papers";
import { ExamLogo } from "@/components/exam-logo";
import { EBOOK_META } from "@/lib/ebook-types";
import { formatSize, listResources } from "@/lib/resources";
import { accessIsActive, type UserDoc } from "@/lib/access";
import { examShort, getCatalog, isExamLive } from "@/lib/catalog";
import { dateTime, prettyPhone, rupees } from "@/lib/format";
import { db, isStorageConfigured } from "@/lib/firebase-admin";
import type { PaymentDoc } from "@/lib/payments";
import { getSessionUser, normalizePhone } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const statusCls: Record<PaymentDoc["status"], string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  created: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "papers", label: "Papers & tests" },
  { key: "exams", label: "Exams" },
  { key: "library", label: "eBooks" },
  { key: "users", label: "Users" },
  { key: "payments", label: "Payments" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<{ tab?: string | string[]; phone?: string | string[] }> };

export default async function AdminPage({ searchParams }: Props) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) notFound(); // don't reveal that this page exists

  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const phone = typeof sp.phone === "string" ? sp.phone : "";
  const search = phone.trim() ? normalizePhone(phone) : "";
  const cat = await getCatalog();
  const s = cat.stats;
  const pools = Object.entries(cat.pool).filter(([, ids]) => ids.length > 0);
  const poolTotal = pools.reduce((n, [, ids]) => n + ids.length, 0);

  return (
    <div className="container-page py-8 sm:py-12">
      <p className="eyebrow">Admin</p>
      <h1 className="display mt-2 text-3xl sm:text-5xl">Control panel</h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        {s.totalQuestions.toLocaleString("en-IN")} questions · {s.mockTests} mock tests · {s.paperTests} papers · bundled bank built{" "}
        {dateTime(Date.parse(s.generatedAt))}
      </p>

      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin?tab=${t.key}`} className={`btn shrink-0 px-5 py-2 ${tab === t.key ? "btn-primary" : "btn-secondary"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "overview" && <Overview />}
        {tab === "papers" && <Papers />}
        {tab === "exams" && <Exams />}
        {tab === "library" && <Library />}
        {tab === "users" && <Users search={search} phone={phone} />}
        {tab === "payments" && <Payments search={search} phone={phone} />}
      </div>
    </div>
  );

  // ── Overview ──
  async function Overview() {
    const users = db().collection("users");
    const [userCount, paidCount, revenue, pricePaise] = await Promise.all([
      users.count().get(),
      users.where("paid", "==", true).count().get(),
      // Needs the (status, amount) index from firestore.indexes.json; shows "–" until it exists.
      db()
        .collection("payments")
        .where("status", "==", "paid")
        .aggregate({ total: AggregateField.sum("amount"), n: AggregateField.count() })
        .get()
        .then((x) => x.data())
        .catch((e) => {
          console.error("Revenue aggregate failed (create the Firestore index, see README):", e?.message);
          return null;
        }),
      getPriceInPaise(),
    ]);
    return (
      <div className="grid gap-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { k: "Users", v: userCount.data().count.toLocaleString("en-IN") },
            { k: "Paid users", v: paidCount.data().count.toLocaleString("en-IN") },
            { k: "Successful payments", v: revenue ? (revenue.n ?? 0).toLocaleString("en-IN") : "–" },
            { k: "Revenue", v: revenue ? rupees(revenue.total ?? 0) : "– (index needed)" },
            { k: "Mock tests", v: String(s.mockTests) },
            { k: "Previous-year papers", v: String(s.paperTests) },
            { k: "Uploaded papers", v: String(cat.uploads.length) },
            { k: "New questions waiting", v: String(poolTotal) },
          ].map((x) => (
            <div key={x.k} className="card p-4">
              <dt className="text-xs text-ink-500 dark:text-ink-400">{x.k}</dt>
              <dd className="text-2xl font-bold">{x.v}</dd>
            </div>
          ))}
        </dl>
        <section className="card p-5">
          <h2 className="font-bold">Price</h2>
          <p className="mb-4 text-sm text-ink-500">Current: {rupees(pricePaise)}. Changes apply to new orders within a minute.</p>
          <PriceForm currentRupees={pricePaise / 100} />
        </section>
      </div>
    );
  }

  // ── Papers & tests ──
  function Papers() {
    const uploadIdOf = (testId: string) => (testId.startsWith("u-") ? testId.slice(2) : undefined);
    const rows = cat.allTests;
    return (
      <div className="grid gap-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold">Upload a question paper</h2>
            <p className="mt-1 mb-5 text-sm text-ink-600 dark:text-ink-300">
              The paper becomes a <strong>previous-year paper test</strong> of the chosen exam right away. Its new questions (not already in
              that exam&apos;s bank) go to the exam + subject pool, and as soon as there are enough for every section of the exam&apos;s pattern
              they automatically become a new <strong>mock test</strong> of that exam. Each exam is independent. Existing tests are never
              reshuffled. Put a question in a section with <code>&quot;section&quot;: &quot;aptitude&quot;</code> in the JSON.
            </p>
            <UploadForm
              subjects={subjects.map((x) => ({ key: x.key, name: x.name }))}
              exams={exams.map((e) => ({ key: e.key, short: e.short, on: isExamLive(cat, e.key), subjects: e.subjects }))}
              minutesPerQuestion={buildConfig.paperMinutesPerQuestion}
            />
          </section>
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold">New-question pool (per exam + subject)</h2>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              Uploaded questions that are not in any mock test yet. A mock is created automatically when every section of the exam&apos;s
              pattern can be filled; you can also create a shorter one now (minimum {buildConfig.minQuestionsForLastTest}).
            </p>
            {pools.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">No new questions waiting.</p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {pools.map(([key, ids]) => {
                  const [examKey, subject] = key.split("|");
                  const per = questionsPerTest(patternFor(examKey));
                  return (
                    <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">
                      <span>
                        <strong>
                          {examShort(examKey)} · {subjectName(subject)}
                        </strong>
                        : {ids.length} waiting <span className="text-ink-500">(a mock needs {per})</span>
                      </span>
                      <CreateMockButton examKey={examKey} subject={subject} pool={ids.length} min={buildConfig.minQuestionsForLastTest} />
                    </li>
                  );
                })}
              </ul>
            )}
            <h3 className="mt-8 font-bold">Uploaded papers</h3>
            {cat.uploads.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">None yet. The {s.paperTests} papers listed below come from the bundled JSON files.</p>
            ) : (
              <ul className="mt-3 grid gap-2 text-sm">
                {[...cat.uploads].reverse().map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-ink-100 px-3 py-2 dark:bg-ink-800">
                    <span className="font-semibold">{cat.testById.get(`u-${u.id}`)?.title ?? u.title}</span>
                    <span className="text-ink-500 dark:text-ink-400">
                      {examShort(u.examKey)} · {subjectName(u.subject)} · {u.questionCount} Qs ({u.newQuestions} new) · {dateTime(u.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">All tests ({rows.length})</h2>
          <p className="px-5 text-sm text-ink-500">Hidden tests (and papers of exams switched off in the Exams tab) are invisible to students; their past results still work.</p>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[820px] text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Test</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Qs</th>
                  <th className="px-3 py-2 text-right font-medium">Min</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.map((t) => (
                  <tr key={t.id} className={t.hidden || t.examOff ? "opacity-55" : ""}>
                    <td className="px-5 py-2">
                      <Link href={`/tests/${t.id}`} className="font-semibold hover:text-brand-600">
                        {t.title}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-ink-400">{t.id}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-600 dark:text-ink-300">
                      {examShort(t.examKey)} · {subjectName(t.subject)} · {t.kind === "mock" ? "Mock" : `Paper${t.sourceExam ? ` (asked in ${examShort(t.sourceExam)})` : ""}`}
                      {t.origin === "uploaded" ? " · uploaded" : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.questionCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.durationMinutes}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.free ? <span className="font-semibold text-emerald-600">Free</span> : <span className="text-ink-500">Paid</span>}
                      {t.hidden && <span className="ml-2 font-semibold text-amber-600">Hidden</span>}
                      {t.examOff && <span className="ml-2 font-semibold text-ink-500">Exam off</span>}
                    </td>
                    <td className="px-5 py-2">
                      <TestControls testId={t.id} free={t.free} hidden={!!t.hidden} title={t.title} uploadId={uploadIdOf(t.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ── Exams shown to students ──
  function Exams() {
    const papersOf = (key: string) => cat.allTests.filter((x) => x.kind === "paper" && x.examKey === key).length;
    const list = [...exams].sort((a, b) => Number(isExamLive(cat, b.key)) - Number(isExamLive(cat, a.key)));
    return (
      <section className="card overflow-hidden">
        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-bold">Exams shown to students</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-600 dark:text-ink-300">
            Switched-on exams appear in the header menu, on the home page (Exam → Subject picker), on <Link href="/exams" className="underline">/exams</Link>{" "}
            and in the footer. Switching an exam <strong>off</strong> hides it and its previous-year papers from students. Its questions stay in the mock
            tests, and past results keep working. You can still upload papers for an exam that is off.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
              <tr>
                <th className="px-5 py-2 font-medium">Exam</th>
                <th className="px-3 py-2 font-medium">Posts</th>
                <th className="px-3 py-2 text-right font-medium">Papers</th>
                <th className="px-5 py-2 text-right font-medium">Shown to students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {list.map((e) => {
                const on = isExamLive(cat, e.key);
                return (
                  <tr key={e.key} className={on ? "" : "opacity-70"}>
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-3">
                        <ExamLogo exam={e} size={34} />
                        <span>
                          <Link href={`/exams/${e.key}`} className="font-semibold hover:text-brand-600">
                            {e.short}
                          </Link>
                          <span className="block text-xs text-ink-500">{e.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="max-w-sm px-3 py-2.5 text-ink-600 dark:text-ink-300">{e.posts}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{papersOf(e.key)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <ExamToggle examKey={e.key} on={on} name={e.short} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // ── eBooks (PDFs) ──
  async function Library() {
    const storageReady = isStorageConfigured();
    const items = storageReady ? await listResources({ includeHidden: true }) : [];
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-bold">Upload a PDF</h2>
          <p className="mt-1 mb-5 text-sm text-ink-600 dark:text-ink-300">
            Each PDF appears under <strong>eBooks</strong> in its type: Notes, PYQ, Strategy guides or Others. Paid PDFs open for students with the
            full pass; free ones for every logged-in student. Admins can open everything.
          </p>
          {storageReady ? (
            <ResourceUploader
              subjects={subjects.map((x) => ({ key: x.key, name: x.name }))}
              exams={exams.map((e) => ({ key: e.key, name: e.short }))}
              maxMb={libraryConfig.maxPdfMb}
            />
          ) : (
            <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              File storage isn&apos;t configured. Set <code>FIREBASE_STORAGE_BUCKET</code> and <code>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</code> (README → Storage).
            </p>
          )}
        </section>
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">Published PDFs ({items.length})</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[640px] text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {items.map((r) => (
                  <tr key={r.id} className={r.hidden ? "opacity-55" : ""}>
                    <td className="px-5 py-2">
                      <Link href={`/resources/${r.id}`} className="font-semibold hover:text-brand-600">
                        {r.title}
                      </Link>
                      <span className="block text-xs text-ink-500">
                        {[r.subject && subjectName(r.subject), r.author, dateTime(r.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{(EBOOK_META[r.type] ?? EBOOK_META.others).admin.replace(/ (.*)$/, "")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatSize(r.size)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.free ? <span className="font-semibold text-emerald-600">Free</span> : <span className="text-ink-500">Paid</span>}
                      {r.hidden && <span className="ml-2 font-semibold text-amber-600">Hidden</span>}
                    </td>
                    <td className="px-5 py-2">
                      <ResourceControls id={r.id} free={r.free} hidden={r.hidden} title={r.title} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-ink-500">No PDFs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ── Users ──
  async function Users({ search, phone }: { search: string; phone: string }) {
    const users = db().collection("users");
    const snap = search ? await users.where("phone", "==", search).limit(20).get() : await users.orderBy("createdAt", "desc").limit(100).get();
    const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserDoc & { grantedBy?: string }) }));
    return (
      <div className="grid gap-4">
        <SearchBox tab="users" phone={phone} search={search} />
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">{search ? `Users matching ${prettyPhone(search)}` : "Latest users"}</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[640px] text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                  <th className="px-3 py-2 font-medium">Last login</th>
                  <th className="px-3 py-2 font-medium">Access</th>
                  <th className="px-5 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.map((u) => (
                  <tr key={u.uid}>
                    <td className="px-5 py-2 font-medium whitespace-nowrap">{prettyPhone(u.phone)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-500">{u.createdAt ? dateTime(u.createdAt) : "–"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-500">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "–"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {accessIsActive(u) ? <span className="font-semibold text-emerald-600">Full{u.grantedBy ? " (granted)" : ""}</span> : <span className="text-ink-500">Free</span>}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <AccessToggle uid={u.uid} paid={!!u.paid} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-ink-500">No users.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ── Payments ──
  async function Payments({ search, phone }: { search: string; phone: string }) {
    const payments = db().collection("payments");
    const snap = search ? await payments.where("phone", "==", search).limit(50).get() : await payments.orderBy("createdAt", "desc").limit(100).get();
    const rows = snap.docs.map((d) => ({ orderId: d.id, ...(d.data() as PaymentDoc) })).sort((a, b) => b.createdAt - a.createdAt);
    return (
      <div className="grid gap-4">
        <SearchBox tab="payments" phone={phone} search={search} />
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">{search ? "Payments for this number" : "Latest payments"}</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[760px] text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Order id</th>
                  <th className="px-5 py-2 font-medium">Payment id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.map((p) => (
                  <tr key={p.orderId}>
                    <td className="px-5 py-2 whitespace-nowrap text-ink-500">{dateTime(p.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{prettyPhone(p.phone)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{rupees(p.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[p.status]}`}>
                        {p.status}
                        {p.verifiedVia ? ` · ${p.verifiedVia}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.orderId}</td>
                    <td className="px-5 py-2 font-mono text-xs">{p.paymentId ?? "–"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-ink-500">No payments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
}

function SearchBox({ tab, phone, search }: { tab: string; phone: string; search: string }) {
  return (
    <form className="flex flex-wrap gap-2" action="/admin">
      <input type="hidden" name="tab" value={tab} />
      <input name="phone" defaultValue={phone} placeholder="Search by mobile number" className="input max-w-xs" inputMode="numeric" />
      <button className="btn btn-secondary">Search</button>
      {search && (
        <Link href={`/admin?tab=${tab}`} className="btn btn-ghost">
          Clear
        </Link>
      )}
    </form>
  );
}
