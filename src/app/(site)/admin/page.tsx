import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AggregateField } from "firebase-admin/firestore";
import { buildConfig, libraryConfig, patternFor, questionsPerTest } from "@config/test-series.config";
import { examByKey, exams } from "@config/exams";
import { subjectByKey, subjectName, subjects } from "@config/subjects";
import { AccessToggle, PriceForm, SeriesAccess } from "@/components/admin-controls";
import { ExamToggle } from "@/components/admin-exams";
import { ResourceControls, ResourceUploader } from "@/components/admin-library";
import { CreateMockButton, TestControls, UploadForm, UploadKindSwitch } from "@/components/admin-papers";
import { ExamLogo } from "@/components/exam-logo";
import { ArrowRight, BookIcon, ChartIcon, LayersIcon, SearchIcon, ShieldIcon, TargetIcon, UnlockIcon, UploadIcon } from "@/components/icons";
import { accessIsActive, activePasses, type UserDoc } from "@/lib/access";
import { examShort, getCatalog, isExamLive, liveExams, seriesLabel } from "@/lib/catalog";
import { EBOOK_META } from "@/lib/ebook-types";
import { dateTime, prettyPhone, rupees } from "@/lib/format";
import { db, isStorageConfigured } from "@/lib/firebase-admin";
import type { PaymentDoc } from "@/lib/payments";
import { formatSize, listResources } from "@/lib/resources";
import { getSessionUser, normalizePhone } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";
import type { TestDef } from "@/lib/types";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const statusCls: Record<PaymentDoc["status"], string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  created: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
};

const TABS = [
  { key: "overview", label: "Overview", Icon: ChartIcon, text: "Key numbers, quick actions and the price." },
  { key: "upload", label: "Upload", Icon: UploadIcon, text: "Add a mock test or a previous-year paper from a JSON file." },
  { key: "tests", label: "Tests", Icon: LayersIcon, text: "Every test: free/paid, hide, rename, delete." },
  { key: "exams", label: "Exams", Icon: TargetIcon, text: "Which exams students see." },
  { key: "library", label: "eBooks", Icon: BookIcon, text: "PDF notes, PYQs, strategy guides and more." },
  { key: "users", label: "Students", Icon: ShieldIcon, text: "Find a student and grant or revoke test series." },
  { key: "payments", label: "Payments", Icon: UnlockIcon, text: "Razorpay orders and their status." },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const th = "px-3 py-2.5 text-left text-[11px] font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400";
const td = "px-3 py-3 align-middle";
const pill = (cls: string) => `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`;

export default async function AdminPage({ searchParams }: Props) {
  const admin = await getSessionUser(true);
  if (!admin?.isAdmin) notFound(); // don't reveal that this page exists

  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const rawTab = str("tab") === "papers" ? "tests" : str("tab"); // old links
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "overview";
  const phone = str("phone");
  const search = phone.trim() ? normalizePhone(phone) : "";
  const cat = await getCatalog();
  const s = cat.stats;
  const current = TABS.find((t) => t.key === tab)!;
  const counts: Partial<Record<Tab, number>> = { tests: cat.allTests.length, exams: cat.enabledExams.length, upload: cat.uploads.length };
  const poolMock = (t: TestDef) => t.kind === "mock" && t.origin === "uploaded" && !t.id.startsWith("u-");

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-8">
        {/* Sidebar (phones: a scrolling tab row) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="lg:card lg:p-3">
            <div className="hidden px-3 pt-2 pb-4 lg:block">
              <p className="eyebrow">Admin</p>
              <p className="mt-1 text-lg font-black tracking-tight">Control panel</p>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{prettyPhone(admin.phone)}</p>
            </div>
            <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0" aria-label="Admin sections">
              {TABS.map((t) => {
                const active = t.key === tab;
                return (
                  <Link
                    key={t.key}
                    href={`/admin?tab=${t.key}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      active ? "bg-ink-900 text-white dark:bg-brand-300 dark:text-ink-950" : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-100 lg:border-0 lg:bg-transparent dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800 lg:dark:bg-transparent"
                    }`}
                  >
                    <t.Icon width={16} height={16} className={active ? "" : "text-ink-400"} />
                    {t.label}
                    {counts[t.key] !== undefined && <span className={`ml-auto rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white/20" : "bg-ink-100 text-ink-500 dark:bg-ink-800"}`}>{counts[t.key]}</span>}
                  </Link>
                );
              })}
            </nav>
            <Link href="/" className="mt-3 hidden items-center gap-1 px-3 pb-2 text-xs font-bold text-brand-600 lg:flex dark:text-brand-300">
              View the website <ArrowRight width={13} height={13} />
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-ink-200 pb-5 dark:border-ink-800">
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{current.label}</h1>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{current.text}</p>
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {s.totalQuestions.toLocaleString("en-IN")} questions · {s.mockTests} mocks · {s.paperTests} papers
            </p>
          </header>
          {tab === "overview" && <Overview />}
          {tab === "upload" && <Upload />}
          {tab === "tests" && <Tests />}
          {tab === "exams" && <Exams />}
          {tab === "library" && <Library />}
          {tab === "users" && <Users />}
          {tab === "payments" && <Payments />}
        </main>
      </div>
    </div>
  );

  // ── Overview ──
  async function Overview() {
    const users = db().collection("users");
    const [userCount, allAccess, revenue, pricePaise] = await Promise.all([
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
    const kpis = [
      { k: "Students", v: userCount.data().count.toLocaleString("en-IN"), Icon: ShieldIcon },
      { k: "Successful payments", v: revenue ? (revenue.n ?? 0).toLocaleString("en-IN") : "–", Icon: UnlockIcon },
      { k: "Revenue", v: revenue ? rupees(revenue.total ?? 0) : "– (index needed)", Icon: ChartIcon },
      { k: "All-access students", v: allAccess.data().count.toLocaleString("en-IN"), Icon: ShieldIcon },
      { k: "Tests live", v: String(s.totalTests), Icon: LayersIcon },
      { k: "Questions", v: s.totalQuestions.toLocaleString("en-IN"), Icon: BookIcon },
    ];
    const actions = [
      { href: "/admin?tab=upload", label: "Upload a test", text: "Mock test or previous paper (JSON)", Icon: UploadIcon },
      { href: "/admin?tab=library", label: "Add an eBook", text: "PDF notes, PYQs, guides", Icon: BookIcon },
      { href: "/admin?tab=exams", label: "Exams on the site", text: "Switch exams on or off", Icon: TargetIcon },
      { href: "/admin?tab=users", label: "Find a student", text: "Grant or revoke access", Icon: ShieldIcon },
    ];
    return (
      <div className="grid gap-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((x) => (
            <div key={x.k} className="card p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold text-ink-500 dark:text-ink-400">
                <x.Icon width={14} height={14} /> {x.k}
              </dt>
              <dd className="mt-1 text-2xl font-black tracking-tight">{x.v}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-ink-500 uppercase dark:text-ink-400">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink-900/5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-300 dark:bg-brand-300 dark:text-ink-950">
                  <a.Icon width={18} height={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold group-hover:text-brand-700 dark:group-hover:text-brand-300">{a.label}</span>
                  <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{a.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 font-bold">Content by exam (on the site)</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[520px] text-sm">
                <thead className="border-y border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60">
                  <tr>
                    <th className={`${th} pl-5`}>Exam</th>
                    <th className={th}>Live subjects</th>
                    <th className={`${th} text-right`}>Mocks</th>
                    <th className={`${th} pr-5 text-right`}>Papers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {liveExams(cat).map((e) => {
                    const m = s.byExamSubject[e.key] ?? {};
                    const sum = (f: "mockTests" | "paperTests") => Object.values(m).reduce((n, x) => n + x[f], 0);
                    return (
                      <tr key={e.key}>
                        <td className={`${td} pl-5`}>
                          <span className="flex items-center gap-2.5">
                            <ExamLogo exam={e} size={30} />
                            <span className="font-semibold">{e.short}</span>
                          </span>
                        </td>
                        <td className={`${td} text-ink-600 dark:text-ink-300`}>{(s.liveByExam[e.key] ?? []).map((k) => subjectName(k)).join(", ") || "None yet"}</td>
                        <td className={`${td} text-right tabular-nums`}>{sum("mockTests")}</td>
                        <td className={`${td} pr-5 text-right tabular-nums`}>{sum("paperTests")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card p-5">
            <h2 className="font-bold">Price per test series</h2>
            <p className="mt-1 mb-4 text-sm text-ink-500">
              One test series = one exam + one subject. Current: <strong>{rupees(pricePaise)}</strong>. Changes apply to new orders within a minute.
            </p>
            <PriceForm currentRupees={pricePaise / 100} />
          </section>
        </div>
      </div>
    );
  }

  // ── Upload ──
  function Upload() {
    const pools = Object.entries(cat.pool).filter(([, ids]) => ids.length > 0);
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-bold">Upload a JSON file</h2>
          <p className="mt-1 mb-6 text-sm text-ink-600 dark:text-ink-300">
            Each file becomes <strong>one</strong> test of the chosen exam and subject: a <strong>mock test</strong> (Mock tests tab) or a{" "}
            <strong>previous-year paper</strong> (Previous papers tab and PYQs). Each exam is independent.
          </p>
          <UploadForm
            subjects={subjects.map((x) => ({ key: x.key, name: x.name }))}
            exams={exams.map((e) => {
              const p = patternFor(e.key);
              return { key: e.key, short: e.short, on: isExamLive(cat, e.key), subjects: e.subjects, perMock: questionsPerTest(p), mockMinutes: p.durationMinutes };
            })}
            minutesPerQuestion={buildConfig.paperMinutesPerQuestion}
          />
        </section>

        <div className="grid content-start gap-6">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="font-bold">Uploaded files ({cat.uploads.length})</h2>
            </div>
            {cat.uploads.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-500">None yet. The bundled tests come from the JSON files in the project.</p>
            ) : (
              <ul className="mt-3 max-h-[70dvh] divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
                {[...cat.uploads].reverse().map((u) => {
                  const test = cat.testById.get(`u-${u.id}`);
                  return (
                    <li key={u.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {test ? (
                              <Link href={`/tests/${test.id}`} className="hover:text-brand-600">
                                {test.title}
                              </Link>
                            ) : (
                              u.title
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                            {examShort(u.examKey)} · {subjectName(u.subject)} · {u.questionCount} Qs · {dateTime(u.createdAt)}
                          </p>
                        </div>
                        <span className={pill(u.kind === "mock" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" : "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300")}>
                          {u.kind === "mock" ? `Mock Test ${test?.number ?? ""}` : "Previous paper"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <UploadKindSwitch uploadId={u.id} kind={u.kind} title={test?.title ?? u.title} />
                        {test && <TestControls testId={test.id} free={test.free} hidden={!!test.hidden} title={test.title} uploadId={u.id} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {pools.length > 0 && (
            <section className="card p-5">
              <h2 className="font-bold">Mixed mocks from previous papers (optional)</h2>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                Questions of previous-year papers that are in no mock test. You can build a mixed mock from them; students will then see those questions in
                both the papers and the mock.
              </p>
              <ul className="mt-4 grid gap-2">
                {pools.map(([key, ids]) => {
                  const [examKey, subject] = key.split("|");
                  return (
                    <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">
                      <span>
                        <strong>{seriesLabel(examKey, subject)}</strong>: {ids.length} questions{" "}
                        <span className="text-ink-500">(a full mock needs {questionsPerTest(patternFor(examKey))})</span>
                      </span>
                      <CreateMockButton examKey={examKey} subject={subject} pool={ids.length} min={buildConfig.minQuestionsForLastTest} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ── Tests (filterable) ──
  function Tests() {
    const fExam = examByKey.has(str("exam")) ? str("exam") : "";
    const fSubject = subjectByKey.has(str("subject")) ? str("subject") : "";
    const fType = str("type") === "mock" || str("type") === "paper" ? str("type") : "";
    const q = str("q").trim().toLowerCase();
    const rows = cat.allTests.filter(
      (t) => (!fExam || t.examKey === fExam) && (!fSubject || t.subject === fSubject) && (!fType || t.kind === fType) && (!q || t.title.toLowerCase().includes(q) || t.id.includes(q)),
    );
    const usedExams = exams.filter((e) => cat.allTests.some((t) => t.examKey === e.key));
    const usedSubjects = subjects.filter((x) => cat.allTests.some((t) => t.subject === x.key));
    return (
      <div className="grid gap-4">
        <form action="/admin" className="card flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="tab" value="tests" />
          <label className="grid gap-1 text-xs font-semibold text-ink-500">
            Exam
            <select name="exam" defaultValue={fExam} className="input py-2 text-sm">
              <option value="">All exams</option>
              {usedExams.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.short}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ink-500">
            Subject
            <select name="subject" defaultValue={fSubject} className="input py-2 text-sm">
              <option value="">All subjects</option>
              {usedSubjects.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ink-500">
            Type
            <select name="type" defaultValue={fType} className="input py-2 text-sm">
              <option value="">Mocks and papers</option>
              <option value="mock">Mock tests</option>
              <option value="paper">Previous papers</option>
            </select>
          </label>
          <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-ink-500">
            Search
            <span className="relative">
              <SearchIcon width={15} height={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
              <input name="q" defaultValue={str("q")} placeholder="Test name or id" className="input py-2 pl-9 text-sm" />
            </span>
          </label>
          <button className="btn btn-primary px-5 py-2.5">Filter</button>
          {(fExam || fSubject || fType || q) && (
            <Link href="/admin?tab=tests" className="btn btn-ghost px-3 py-2.5">
              Clear
            </Link>
          )}
        </form>

        <section className="card overflow-hidden">
          <p className="px-5 pt-4 text-sm text-ink-500">
            {rows.length} of {cat.allTests.length} tests. Hidden tests, and tests of exams that are switched off, are invisible to students; past results still work.
          </p>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[900px] text-sm">
              <thead className="border-y border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60">
                <tr>
                  <th className={`${th} pl-5`}>Test</th>
                  <th className={th}>Exam · subject</th>
                  <th className={th}>Type</th>
                  <th className={`${th} text-right`}>Qs</th>
                  <th className={`${th} text-right`}>Min</th>
                  <th className={th}>Status</th>
                  <th className={`${th} pr-5 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.slice(0, 400).map((t) => (
                  <tr key={t.id} className={`transition hover:bg-ink-50/70 dark:hover:bg-ink-900/40 ${t.hidden || t.examOff ? "opacity-55" : ""}`}>
                    <td className={`${td} pl-5`}>
                      <Link href={`/tests/${t.id}`} className="font-semibold hover:text-brand-600">
                        {t.title}
                      </Link>
                      <span className="block font-mono text-[11px] text-ink-400">{t.id}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink-600 dark:text-ink-300`}>{seriesLabel(t.examKey, t.subject)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {t.kind === "mock" ? (
                        <span className={pill("bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300")}>Mock {t.number}</span>
                      ) : (
                        <span className={pill("bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300")}>Paper{t.sourceExam ? ` · asked in ${examShort(t.sourceExam)}` : ""}</span>
                      )}
                      {t.origin === "uploaded" && <span className="ml-1.5 text-[11px] text-ink-400">uploaded</span>}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{t.questionCount}</td>
                    <td className={`${td} text-right tabular-nums`}>{t.durationMinutes}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {t.free ? <span className={pill("bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300")}>Free</span> : <span className={pill("bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300")}>Paid</span>}
                      {t.hidden && <span className={`ml-1 ${pill("bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300")}`}>Hidden</span>}
                      {t.examOff && <span className={`ml-1 ${pill("bg-ink-100 text-ink-500 dark:bg-ink-800")}`}>Exam off</span>}
                    </td>
                    <td className={`${td} pr-5`}>
                      <TestControls testId={t.id} free={t.free} hidden={!!t.hidden} title={t.title} uploadId={t.id.startsWith("u-") ? t.id.slice(2) : undefined} poolMock={poolMock(t)} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-ink-500">
                      No tests match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ── Exams shown to students ──
  function Exams() {
    const testsOf = (key: string) => cat.allTests.filter((x) => x.examKey === key).length;
    const list = [...exams].sort((a, b) => Number(isExamLive(cat, b.key)) - Number(isExamLive(cat, a.key)));
    return (
      <section className="card overflow-hidden">
        <p className="max-w-3xl p-5 text-sm text-ink-600 dark:text-ink-300">
          Switched-on exams appear in the header menu, the home page (Exam → Subject picker), <Link href="/exams" className="underline">/exams</Link> and the footer.
          Switching an exam <strong>off</strong> hides it and all its tests from students; past results keep working. You can still upload tests for an exam that is
          off. Each exam has its own pattern (config <code>examPatterns</code>).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-y border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60">
              <tr>
                <th className={`${th} pl-5`}>Exam</th>
                <th className={th}>Pattern</th>
                <th className={`${th} text-right`}>Tests</th>
                <th className={`${th} pr-5 text-right`}>Shown to students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {list.map((e) => {
                const on = isExamLive(cat, e.key);
                const p = patternFor(e.key);
                return (
                  <tr key={e.key} className={on ? "" : "opacity-70"}>
                    <td className={`${td} pl-5`}>
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
                    <td className={`${td} text-xs text-ink-600 dark:text-ink-300`}>
                      {questionsPerTest(p)} Qs · {p.durationMinutes} min · {p.negativeMarksPerWrong ? `−${Math.round(p.negativeMarksPerWrong * 100) / 100}` : "no negative"}
                      {p.sections.length > 1 ? ` · ${p.sections.length} sections` : ""}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{testsOf(e.key)}</td>
                    <td className={`${td} pr-5 text-right`}>
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
            Each PDF appears under <strong>eBooks</strong> in its type: Notes, PYQ, Strategy guides or Others. A paid PDF of an exam + subject opens for
            students who unlocked that test series; free ones for every logged-in student. Admins can open everything.
          </p>
          {storageReady ? (
            <ResourceUploader subjects={subjects.map((x) => ({ key: x.key, name: x.name }))} exams={exams.map((e) => ({ key: e.key, name: e.short }))} maxMb={libraryConfig.maxPdfMb} />
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
              <thead className="border-y border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60">
                <tr>
                  <th className={`${th} pl-5`}>Title</th>
                  <th className={th}>Type</th>
                  <th className={th}>Size</th>
                  <th className={th}>Status</th>
                  <th className={`${th} pr-5 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {items.map((r) => (
                  <tr key={r.id} className={r.hidden ? "opacity-55" : ""}>
                    <td className={`${td} pl-5`}>
                      <Link href={`/resources/${r.id}`} className="font-semibold hover:text-brand-600">
                        {r.title}
                      </Link>
                      <span className="block text-xs text-ink-500">
                        {[r.examKey && examShort(r.examKey), r.subject && subjectName(r.subject), r.author, dateTime(r.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{(EBOOK_META[r.type] ?? EBOOK_META.others).admin.replace(/ \(.*\)$/, "")}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatSize(r.size)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.free ? <span className={pill("bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300")}>Free</span> : <span className={pill("bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300")}>Paid</span>}
                      {r.hidden && <span className={`ml-1 ${pill("bg-amber-100 text-amber-700")}`}>Hidden</span>}
                    </td>
                    <td className={`${td} pr-5`}>
                      <ResourceControls id={r.id} free={r.free} hidden={r.hidden} title={r.title} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-ink-500">
                      No PDFs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ── Students ──
  async function Users() {
    const users = db().collection("users");
    const snap = search ? await users.where("phone", "==", search).limit(20).get() : await users.orderBy("createdAt", "desc").limit(100).get();
    const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserDoc) }));
    const options = liveExams(cat).flatMap((e) => (s.liveByExam[e.key] ?? []).map((subject) => ({ exam: e.key, subject, label: seriesLabel(e.key, subject) })));
    return (
      <div className="grid gap-4">
        <SearchBox tab="users" />
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">{search ? `Students matching ${prettyPhone(search)}` : "Latest students"}</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[920px] text-sm">
              <thead className="border-y border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60">
                <tr>
                  <th className={`${th} pl-5`}>Phone</th>
                  <th className={th}>Preparing for</th>
                  <th className={th}>Joined / last login</th>
                  <th className={th}>Unlocked test series</th>
                  <th className={`${th} pr-5 text-right`}>All access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.map((u) => (
                  <tr key={u.uid}>
                    <td className={`${td} pl-5 font-semibold whitespace-nowrap`}>{prettyPhone(u.phone)}</td>
                    <td className={`${td} max-w-56 text-xs text-ink-600 dark:text-ink-300`}>{(u.interests ?? []).map((i) => seriesLabel(i.exam, i.subject)).join(", ") || "–"}</td>
                    <td className={`${td} text-xs whitespace-nowrap text-ink-500`}>
                      {u.createdAt ? dateTime(u.createdAt) : "–"}
                      <span className="block">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "–"}</span>
                    </td>
                    <td className={td}>
                      {accessIsActive(u) ? (
                        <span className={pill("bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300")}>All test series{u.grantedBy ? " (granted)" : ""}</span>
                      ) : (
                        <SeriesAccess
                          uid={u.uid}
                          passes={activePasses(u).map((p) => ({ exam: p.exam, subject: p.subject, label: seriesLabel(p.exam, p.subject), granted: !!p.grantedBy }))}
                          options={options}
                        />
                      )}
                    </td>
                    <td className={`${td} pr-5 text-right`}>
                      <AccessToggle uid={u.uid} paid={!!u.paid} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-ink-500">
                      No students.
                    </td>
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
  async function Payments() {
    const payments = db().collection("payments");
    const snap = search ? await payments.where("phone", "==", search).limit(50).get() : await payments.orderBy("createdAt", "desc").limit(100).get();
    const rows = snap.docs.map((d) => ({ orderId: d.id, ...(d.data() as PaymentDoc) })).sort((a, b) => b.createdAt - a.createdAt);
    return (
      <div className="grid gap-4">
        <SearchBox tab="payments" />
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-bold">{search ? "Payments for this number" : "Latest payments"}</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[860px] text-sm">
              <thead className="border-y border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60">
                <tr>
                  <th className={`${th} pl-5`}>Created</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Test series</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Status</th>
                  <th className={th}>Order id</th>
                  <th className={`${th} pr-5`}>Payment id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.map((p) => (
                  <tr key={p.orderId}>
                    <td className={`${td} pl-5 whitespace-nowrap text-ink-500`}>{dateTime(p.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>{prettyPhone(p.phone)}</td>
                    <td className={`${td} whitespace-nowrap`}>{p.exam && p.subject ? seriesLabel(p.exam, p.subject) : "All (older order)"}</td>
                    <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{rupees(p.amount)}</td>
                    <td className={td}>
                      <span className={pill(statusCls[p.status])}>
                        {p.status}
                        {p.verifiedVia ? ` · ${p.verifiedVia}` : ""}
                      </span>
                    </td>
                    <td className={`${td} font-mono text-xs`}>{p.orderId}</td>
                    <td className={`${td} pr-5 font-mono text-xs`}>{p.paymentId ?? "–"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-ink-500">
                      No payments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  function SearchBox({ tab: t }: { tab: string }) {
    return (
      <form className="card flex flex-wrap items-center gap-2 p-3" action="/admin">
        <input type="hidden" name="tab" value={t} />
        <span className="relative min-w-56 flex-1">
          <SearchIcon width={15} height={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <input name="phone" defaultValue={phone} placeholder="Search by mobile number" className="input py-2 pl-9" inputMode="numeric" />
        </span>
        <button className="btn btn-primary px-5 py-2.5">Search</button>
        {search && (
          <Link href={`/admin?tab=${t}`} className="btn btn-ghost px-3 py-2.5">
            Clear
          </Link>
        )}
      </form>
    );
  }
}
