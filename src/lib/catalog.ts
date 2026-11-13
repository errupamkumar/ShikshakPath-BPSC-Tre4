import "server-only";
// The question bank contains the correct answers. `server-only` makes the build
// fail if any browser (client component) code ever imports this file.
import bankJson from "@/data/generated/bank.json";
import testsJson from "@/data/generated/tests.json";
import statsJson from "@/data/generated/stats.json";
import { buildConfig, patternFor, questionsPerTest, type ExamPattern } from "@config/test-series.config";
import { describeSource } from "@config/exam-sources";
import { DEFAULT_ENABLED_EXAMS, examByKey, exams, type ExamInfo } from "@config/exams";
import { DEFAULT_SUBJECT, subjectByKey, subjectName, subjects, type SubjectInfo } from "@config/subjects";
import { db, isFirebaseAdminConfigured } from "./firebase-admin";
import { DedupeIndex } from "./question-utils";
import type { BankQuestion, BuildStats, HindiText, OptionKey, Options, PublicQuestion, TestDef, TestSection } from "./types";

/**
 * The live catalogue = tests built from the bundled JSON files (npm run build:bank)
 * + papers uploaded from the Admin page (Firestore) + admin overrides.
 *
 * Every exam is independent: questions, mock tests, pools and duplicate matching are kept
 * per exam + subject. The bundled files belong to `buildConfig.exam` (BPSC TRE 4.0).
 *
 * Firestore layout:
 *   uploads/{id}        one uploaded paper: title, examKey, subject, questions[] …
 *   catalog/mocks       mock tests created from uploaded questions (per exam + subject)
 *   catalog/overrides   { [testId]: { free?, hidden?, title? } }
 *   catalog/exams       { enabled: string[] } exams shown to students (Admin → Exams)
 *   catalog/meta        { version } bumped on every change, so every server instance reloads
 */

/** The exam the bundled JSON files (and older data without an exam) belong to. */
export const BUNDLED_EXAM = buildConfig.exam;

export type UploadQuestion = { id: string; question: string; options: Options; answer: OptionKey; explanation: string; hi?: HindiText; section?: string };
/** Admin correction of a question (Firestore questionEdits/{qid}); overrides the bank. */
export type QuestionEdit = {
  question?: string;
  options?: Options;
  answer?: OptionKey;
  explanation?: string;
  hi?: HindiText;
  updatedAt?: number;
  updatedBy?: string;
};
export type UploadDoc = {
  title: string;
  examKey: string;
  subject?: string; // older uploads (before subjects existed) are Computer Science
  year?: number;
  free: boolean;
  durationMinutes: number;
  fileName: string;
  createdAt: number;
  uploadedBy: string;
  questions: UploadQuestion[];
};
export type AppendedMock = {
  id: string;
  number: number;
  subject?: string;
  examKey?: string; // older mocks (before exams were independent) belong to BUNDLED_EXAM
  free?: boolean;
  questionIds: string[];
  sections?: TestSection[];
  durationMinutes: number;
  createdAt: number;
};
export type TestOverride = { free?: boolean; hidden?: boolean; title?: string };

export type SubjectStats = { questions: number; mockTests: number; paperTests: number; freeTests: number };

export type CatalogStats = {
  totalQuestions: number;
  mockTests: number;
  paperTests: number;
  freeTests: number;
  totalTests: number;
  examsWithPapers: number;
  /** exam (test series) → number of previous-year papers students can see */
  papersByExam: Record<string, number>;
  /** source exam (where questions were asked) → number of questions */
  questionsByExam: Record<string, number>;
  /** exam → subject → number of previous-year papers */
  papersByExamSubject: Record<string, Record<string, number>>;
  /** All exams together, per subject. */
  bySubject: Record<string, SubjectStats>;
  /** exam → subject → counts (each exam is independent). */
  byExamSubject: Record<string, Record<string, SubjectStats>>;
  /** Subjects with at least one visible test in any exam, in config order. */
  liveSubjects: string[];
  /** exam → subjects with at least one visible test. */
  liveByExam: Record<string, string[]>;
  /** Number of different exams the question bank's questions were asked in. */
  sourceExams: number;
  sampleQuestionIds: string[];
  rawQuestions: number;
  duplicatesRemoved: number;
  generatedAt: string;
};

export type Catalog = {
  version: string;
  questions: Map<string, BankQuestion>;
  /** Every test, including hidden ones (admin, and old attempts). */
  allTests: TestDef[];
  /** Tests students can see. */
  tests: TestDef[];
  /** Exam keys shown to students, in config order (Admin → Exams). */
  enabledExams: string[];
  testById: Map<string, TestDef>;
  /** "upload:<id>" → paper name, exam and subject. */
  uploadLabels: Map<string, { name: string; examKey: string; subject: string }>;
  /** Per exam + subject (key: poolKey): questions not yet in any mock test. */
  pool: Record<string, string[]>;
  uploads: { id: string; title: string; examKey: string; subject: string; questionCount: number; newQuestions: number; createdAt: number; fileName: string }[];
  stats: CatalogStats;
};

const bundledBank = bankJson as unknown as Record<string, BankQuestion>;
const bundledTests = testsJson as unknown as TestDef[];
const buildStats = statsJson as unknown as BuildStats;
const subjectOrder = new Map(subjects.map((s, i) => [s.key, i]));
const examOrder = new Map(exams.map((e, i) => [e.key, i]));
const EMPTY: SubjectStats = { questions: 0, mockTests: 0, paperTests: 0, freeTests: 0 };

export const poolKey = (exam: string, subject: string) => `${exam}|${subject}`;

/** The section of a question in an exam's pattern (unknown / missing → the first section). */
export function sectionKeyOf(q: Pick<BankQuestion, "section">, pattern: ExamPattern): string {
  return q.section && pattern.sections.some((s) => s.key === q.section) ? q.section : pattern.sections[0].key;
}

export function buildCatalog(input: {
  version: string;
  uploads: [string, UploadDoc][];
  appendedMocks: AppendedMock[];
  overrides: Record<string, TestOverride>;
  questionEdits?: Record<string, QuestionEdit>;
  /** Exams switched on; undefined = DEFAULT_ENABLED_EXAMS. */
  enabledExams?: string[];
}): Catalog {
  const enabledSet = new Set(input.enabledExams ?? DEFAULT_ENABLED_EXAMS);
  const enabledExams = exams.filter((e) => enabledSet.has(e.key)).map((e) => e.key);
  const questions = new Map<string, BankQuestion>();
  // Duplicates are only matched within the same exam + subject (exams are independent).
  const indexes = new Map<string, DedupeIndex<BankQuestion>>();
  const indexFor = (exam: string, subject: string) => {
    const k = poolKey(exam, subject);
    if (!indexes.has(k)) indexes.set(k, new DedupeIndex<BankQuestion>(buildConfig.duplicateOptionOverlap));
    return indexes.get(k)!;
  };
  for (const q of Object.values(bundledBank)) {
    const copy: BankQuestion = { ...q, sources: [...q.sources], subject: q.subject ?? DEFAULT_SUBJECT, exam: q.exam ?? BUNDLED_EXAM };
    questions.set(copy.id, copy);
    indexFor(copy.exam!, copy.subject).add(copy);
  }

  // Bundled tests belong to BUNDLED_EXAM; a bundled paper keeps the exam it was asked in as `sourceExam`.
  const tests: TestDef[] = bundledTests.map((t) => ({
    ...t,
    subject: t.subject ?? DEFAULT_SUBJECT,
    examKey: BUNDLED_EXAM,
    ...(t.kind === "paper" && t.examKey ? { sourceExam: t.examKey } : {}),
  }));
  const uploadLabels: Catalog["uploadLabels"] = new Map();
  const uploads: Catalog["uploads"] = [];

  // Uploaded papers, oldest first, de-duplicated against everything before them (same exam + subject).
  for (const [docId, up] of [...input.uploads].sort((a, b) => a[1].createdAt - b[1].createdAt)) {
    const subject = up.subject ?? DEFAULT_SUBJECT;
    const exam = up.examKey || BUNDLED_EXAM;
    const label = `upload:${docId}`;
    uploadLabels.set(label, { name: up.title, examKey: exam, subject });
    const index = indexFor(exam, subject);
    const ids: string[] = [];
    let fresh = 0;
    for (const uq of up.questions ?? []) {
      const match = index.find(uq.question, uq.options);
      if (match) {
        if (!match.hi && uq.hi) match.hi = uq.hi; // an upload can add the Hindi version of a known question
        if (!match.sources.includes(label)) match.sources.push(label);
        if (!ids.includes(match.id)) ids.push(match.id);
        continue;
      }
      let id = uq.id;
      while (questions.has(id)) id = `${id}x`; // same question in another exam: an independent copy
      const q: BankQuestion = { ...uq, id, sources: [label], subject, exam };
      questions.set(id, q);
      index.add(q);
      ids.push(id);
      fresh++;
    }
    uploads.push({ id: docId, title: up.title, examKey: exam, subject, questionCount: ids.length, newQuestions: fresh, createdAt: up.createdAt, fileName: up.fileName });
    if (ids.length === 0) continue;
    tests.push({
      id: `u-${docId}`,
      kind: "paper",
      subject,
      number: 0,
      title: up.title,
      free: !!up.free,
      questionIds: ids,
      questionCount: ids.length,
      durationMinutes: up.durationMinutes || Math.max(1, Math.round(ids.length * buildConfig.paperMinutesPerQuestion)),
      paperCount: 1,
      examKey: exam,
      year: up.year,
      origin: "uploaded",
      createdAt: up.createdAt,
    });
  }

  // Mock tests created from uploaded questions.
  for (const m of input.appendedMocks) {
    const ids = m.questionIds.filter((id) => questions.has(id));
    if (!ids.length) continue;
    tests.push({
      id: m.id,
      kind: "mock",
      subject: m.subject ?? DEFAULT_SUBJECT,
      examKey: m.examKey ?? BUNDLED_EXAM,
      number: m.number,
      title: `Mock Test ${m.number}`,
      free: !!m.free,
      questionIds: ids,
      questionCount: ids.length,
      durationMinutes: m.durationMinutes,
      paperCount: new Set(ids.map((id) => sourceInfo(questions.get(id)!.sources[0], uploadLabels).name)).size,
      origin: "uploaded",
      createdAt: m.createdAt,
    });
  }

  // Admin question corrections (text, options, answer key, explanation, Hindi).
  for (const [qid, e] of Object.entries(input.questionEdits ?? {})) {
    const q = questions.get(qid);
    if (!q) continue;
    if (e.question) q.question = e.question;
    if (e.options && Object.keys(e.options).length >= 2) q.options = e.options;
    if (e.answer && q.options[e.answer]) q.answer = e.answer;
    if (typeof e.explanation === "string") q.explanation = e.explanation;
    if (e.hi) q.hi = e.hi;
  }

  // Sections: questions in pattern order, grouped (a test with one section shows no section tabs).
  for (const t of tests) {
    const pattern = patternFor(t.examKey);
    const order = new Map(pattern.sections.map((s, i) => [s.key, i]));
    const keyOf = (id: string) => sectionKeyOf(questions.get(id) ?? {}, pattern);
    const sorted = [...t.questionIds].sort((a, b) => order.get(keyOf(a))! - order.get(keyOf(b))!); // stable
    t.questionIds = sorted;
    const sections: TestSection[] = [];
    for (const id of sorted) {
      const k = keyOf(id);
      const last = sections[sections.length - 1];
      if (last && last.key === k) last.count++;
      else sections.push({ key: k, count: 1 });
    }
    t.sections = sections;
  }

  // Admin overrides (free / hidden / rename).
  for (const t of tests) {
    const o = input.overrides[t.id];
    if (!o) continue;
    if (typeof o.free === "boolean") t.free = o.free;
    if (typeof o.hidden === "boolean") t.hidden = o.hidden;
    if (o.title) t.title = o.title;
  }
  // Tests of exams the admin switched off are kept (old attempts, admin) but not shown.
  for (const t of tests) if (!enabledSet.has(t.examKey ?? BUNDLED_EXAM)) t.examOff = true;

  // Sort: mocks (exam, subject, number), then papers (exam, subject, source exam, newest year first).
  const sOrder = (s: string) => subjectOrder.get(s) ?? 999;
  const eOrder = (e: string | undefined) => examOrder.get(e ?? "") ?? 999;
  tests.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "mock" ? -1 : 1;
    if (a.kind === "mock") return eOrder(a.examKey) - eOrder(b.examKey) || sOrder(a.subject) - sOrder(b.subject) || a.number - b.number;
    return (
      eOrder(a.examKey) - eOrder(b.examKey) ||
      sOrder(a.subject) - sOrder(b.subject) ||
      eOrder(a.sourceExam ?? a.examKey) - eOrder(b.sourceExam ?? b.examKey) ||
      (b.year ?? 0) - (a.year ?? 0) ||
      a.title.localeCompare(b.title)
    );
  });
  let paperNo = 0;
  for (const t of tests) if (t.kind === "paper") t.number = ++paperNo;

  // Pools: questions of each exam + subject not yet used in a mock test.
  const inMock = new Set(tests.filter((t) => t.kind === "mock").flatMap((t) => t.questionIds));
  const pool: Record<string, string[]> = {};
  for (const q of questions.values()) if (!inMock.has(q.id)) (pool[poolKey(q.exam ?? BUNDLED_EXAM, q.subject)] ??= []).push(q.id);

  const visible = tests.filter(isOpenToStudents);

  const papersByExam: Record<string, number> = {};
  const papersByExamSubject: Record<string, Record<string, number>> = {};
  for (const t of visible) {
    if (t.kind !== "paper" || !t.examKey) continue;
    papersByExam[t.examKey] = (papersByExam[t.examKey] ?? 0) + 1;
    const m = (papersByExamSubject[t.examKey] ??= {});
    m[t.subject] = (m[t.subject] ?? 0) + 1;
  }
  const questionsByExam: Record<string, number> = {};
  const bySubject: Record<string, SubjectStats> = {};
  const byExamSubject: Record<string, Record<string, SubjectStats>> = {};
  const statsOf = (exam: string, subject: string) => ((byExamSubject[exam] ??= {})[subject] ??= { ...EMPTY });
  for (const q of questions.values()) {
    const keys = new Set(q.sources.map((s) => sourceInfo(s, uploadLabels).examKey));
    for (const k of keys) questionsByExam[k] = (questionsByExam[k] ?? 0) + 1;
    (bySubject[q.subject] ??= { ...EMPTY }).questions++;
    statsOf(q.exam ?? BUNDLED_EXAM, q.subject).questions++;
  }
  for (const t of visible) {
    for (const s of [(bySubject[t.subject] ??= { ...EMPTY }), statsOf(t.examKey ?? BUNDLED_EXAM, t.subject)]) {
      if (t.kind === "mock") s.mockTests++;
      else s.paperTests++;
      if (t.free) s.freeTests++;
    }
  }
  const isLive = (s: SubjectStats | undefined) => !!s && s.mockTests + s.paperTests > 0;
  const liveSubjects = Object.keys(bySubject)
    .filter((k) => isLive(bySubject[k]))
    .sort((a, b) => sOrder(a) - sOrder(b));
  const liveByExam: Record<string, string[]> = {};
  for (const [exam, m] of Object.entries(byExamSubject)) {
    liveByExam[exam] = Object.keys(m)
      .filter((k) => isLive(m[k]))
      .sort((a, b) => sOrder(a) - sOrder(b));
  }

  return {
    version: input.version,
    questions,
    allTests: tests,
    tests: visible,
    enabledExams,
    testById: new Map(tests.map((t) => [t.id, t])),
    uploadLabels,
    pool,
    uploads,
    stats: {
      totalQuestions: questions.size,
      mockTests: visible.filter((t) => t.kind === "mock").length,
      paperTests: visible.filter((t) => t.kind === "paper").length,
      freeTests: visible.filter((t) => t.free).length,
      totalTests: visible.length,
      examsWithPapers: Object.keys(papersByExam).length,
      papersByExam,
      questionsByExam,
      papersByExamSubject,
      bySubject,
      byExamSubject,
      liveSubjects,
      liveByExam,
      sourceExams: Object.keys(questionsByExam).filter((k) => examByKey.has(k)).length,
      sampleQuestionIds: buildStats.sampleQuestionIds,
      rawQuestions: buildStats.rawQuestions,
      duplicatesRemoved: buildStats.duplicatesRemoved,
      generatedAt: buildStats.generatedAt,
    },
  };
}

function sourceInfo(source: string, labels: Catalog["uploadLabels"]) {
  return labels.get(source) ?? describeSource(source);
}

// ── Loading & caching ──

const CHECK_MS = 30_000;
/** Bump when the Catalog shape changes, so a cached copy from older code is never reused (dev hot reload). */
const SCHEMA = 5;
const g = globalThis as unknown as {
  __csCatalog?: { cat: Catalog; checkedAt: number; schema: number };
  __csCatalogLoading?: Promise<Catalog>;
};

let bundledOnly: Catalog | null = null;
function bundled(): Catalog {
  return (bundledOnly ??= buildCatalog({ version: "bundled", uploads: [], appendedMocks: [], overrides: {} }));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Firestore timeout")), ms))]);
}

async function load(): Promise<Catalog> {
  const cached = g.__csCatalog?.schema === SCHEMA ? g.__csCatalog : undefined;
  try {
    const meta = await withTimeout(db().doc("catalog/meta").get(), 8000);
    const version = String(meta.get("version") ?? "0");
    if (cached && cached.cat.version === version) {
      cached.checkedAt = Date.now();
      return cached.cat;
    }
    const [uploadsSnap, mocksSnap, overridesSnap, editsSnap, examsSnap] = await withTimeout(
      Promise.all([
        db().collection("uploads").get(),
        db().doc("catalog/mocks").get(),
        db().doc("catalog/overrides").get(),
        db().collection("questionEdits").get(),
        db().doc("catalog/exams").get(),
      ]),
      15000,
    );
    const cat = buildCatalog({
      version,
      uploads: uploadsSnap.docs.map((d) => [d.id, d.data() as UploadDoc]),
      appendedMocks: (mocksSnap.get("tests") as AppendedMock[] | undefined) ?? [],
      overrides: (overridesSnap.data() as Record<string, TestOverride> | undefined) ?? {},
      questionEdits: Object.fromEntries(editsSnap.docs.map((d) => [d.id, d.data() as QuestionEdit])),
      enabledExams: examsSnap.get("enabled") as string[] | undefined,
    });
    g.__csCatalog = { cat, checkedAt: Date.now(), schema: SCHEMA };
    return cat;
  } catch (e) {
    console.error("Catalog load failed; using the last good copy or the bundled tests.", (e as Error).message);
    if (cached) {
      cached.checkedAt = Date.now();
      return cached.cat;
    }
    return bundled();
  }
}

/** The current catalogue (cached; re-checked every 30 s). */
export async function getCatalog(): Promise<Catalog> {
  if (!isFirebaseAdminConfigured()) return bundled();
  const cached = g.__csCatalog;
  if (cached && cached.schema === SCHEMA && Date.now() - cached.checkedAt < CHECK_MS) return cached.cat;
  g.__csCatalogLoading ??= load().finally(() => {
    g.__csCatalogLoading = undefined;
  });
  return g.__csCatalogLoading;
}

/** Call after an admin change so this instance reloads immediately (others within 30 s). */
export async function bumpCatalogVersion(): Promise<void> {
  await db().doc("catalog/meta").set({ version: String(Date.now()), updatedAt: Date.now() }, { merge: true });
  g.__csCatalog = undefined;
}

// ── Helpers ──

/** Shown to students: not hidden by the admin and its exam is switched on. */
export function isOpenToStudents(t: Pick<TestDef, "hidden" | "examOff">): boolean {
  return !t.hidden && !t.examOff;
}

/** Exams students can choose, in config order. */
export function liveExams(cat: Catalog): ExamInfo[] {
  return cat.enabledExams.map((k) => examByKey.get(k)!).filter(Boolean);
}

export function isExamLive(cat: Catalog, key: string | undefined): boolean {
  return !!key && cat.enabledExams.includes(key);
}

/** Does this exam+subject have tests students can take? */
export function isSeriesLive(cat: Catalog, examKey: string, subject: string): boolean {
  return (cat.stats.liveByExam[examKey] ?? []).includes(subject);
}

/**
 * The test-series page for a subject: /exams/<exam>/<subject>. Uses `examKey` when that
 * exam is switched on and offers the subject; otherwise the first switched-on exam where the
 * subject has tests, or failing that the first one that offers it.
 */
export function seriesPath(cat: Catalog, subject: string, examKey?: string, query = ""): string {
  const offers = (k: string) => {
    const e = examByKey.get(k);
    return !!e && (!e.subjects || e.subjects.includes(subject));
  };
  const exam =
    examKey && isExamLive(cat, examKey) && offers(examKey)
      ? examKey
      : (cat.enabledExams.find((k) => offers(k) && isSeriesLive(cat, k, subject)) ?? cat.enabledExams.find(offers));
  return exam ? `/exams/${exam}/${subject}${query}` : "/exams";
}

export function sourceNames(cat: Catalog, q: Pick<BankQuestion, "sources">): string[] {
  return [...new Set(q.sources.map((s) => sourceInfo(s, cat.uploadLabels).name))];
}

export function primaryExamKey(cat: Catalog, q: Pick<BankQuestion, "sources">): string {
  return sourceInfo(q.sources[0], cat.uploadLabels).examKey;
}

/** Strip the answer and explanation: the only shape that may reach the browser before submit. */
export function toPublicQuestion(cat: Catalog, q: BankQuestion): PublicQuestion {
  const hi = q.hi && (q.hi.question || q.hi.options) ? { question: q.hi.question, options: q.hi.options } : undefined;
  return { id: q.id, question: q.question, options: q.options, sources: sourceNames(cat, q), ...(hi ? { hi } : {}) };
}

export function examShort(key: string | undefined): string {
  return (key && examByKey.get(key)?.short) || "Other";
}

export type SubjectCard = SubjectInfo & { live: boolean; stats: SubjectStats; examPapers: number };

/** Subjects a student can pick for an exam (live ones first), with that exam's counts. */
export function subjectsForExam(cat: Catalog, examKey?: string): SubjectCard[] {
  const exam = examKey ? examByKey.get(examKey) : undefined;
  const allowed = exam?.subjects ? subjects.filter((s) => exam.subjects!.includes(s.key)) : subjects;
  return allowed
    .map((s) => {
      const stats = (examKey ? cat.stats.byExamSubject[examKey]?.[s.key] : cat.stats.bySubject[s.key]) ?? EMPTY;
      const live = stats.mockTests + stats.paperTests > 0;
      return { ...s, live, stats, examPapers: (examKey && cat.stats.papersByExamSubject[examKey]?.[s.key]) || 0 };
    })
    .filter((s) => s.live || !s.hideWhenEmpty)
    .sort((a, b) => Number(b.live) - Number(a.live));
}

export function isKnownSubject(key: string | undefined): key is string {
  return !!key && subjectByKey.has(key);
}

export function testsFor(cat: Catalog, f: { subject: string; kind?: TestDef["kind"]; examKey?: string }): TestDef[] {
  return cat.tests.filter((t) => t.subject === f.subject && (!f.kind || t.kind === f.kind) && (!f.examKey || t.examKey === f.examKey));
}

/** Minutes for a mock of n questions at the exam's pace. */
export function mockMinutes(n: number, pattern: ExamPattern): number {
  return Math.max(1, Math.round((pattern.durationMinutes * n) / questionsPerTest(pattern)));
}

export type SectionView = { key: string; name: string; nameHi: string; count: number; marks: number; negative: number };

/** A test's sections with display names ({subject} filled in) and marking. */
export function sectionsOf(t: Pick<TestDef, "examKey" | "subject" | "sections" | "questionCount">): SectionView[] {
  const p = patternFor(t.examKey);
  const list = t.sections?.length ? t.sections : [{ key: p.sections[0].key, count: t.questionCount }];
  return list.map((s) => {
    const sp = p.sections.find((x) => x.key === s.key) ?? p.sections[0];
    return {
      key: s.key,
      name: sp.name.replace("{subject}", subjectName(t.subject, "en")),
      nameHi: sp.nameHi.replace("{subject}", subjectName(t.subject, "hi")),
      count: s.count,
      marks: sp.marks ?? p.marksPerQuestion,
      negative: sp.negative ?? p.negativeMarksPerWrong,
    };
  });
}

/** The exam a paper was originally asked in (falls back to the series exam). */
export function paperSource(t: Pick<TestDef, "sourceExam" | "examKey">): string | undefined {
  return t.sourceExam ?? t.examKey;
}
