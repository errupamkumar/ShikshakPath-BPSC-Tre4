import "server-only";
import { buildConfig, patternFor, questionsPerTest } from "@config/test-series.config";
import { describeSource } from "@config/exam-sources";
import { DEFAULT_ENABLED_EXAMS, examByKey } from "@config/exams";
import { DEFAULT_SUBJECT, subjectByKey, subjectName } from "@config/subjects";
import {
  BUNDLED_EXAM,
  bumpCatalogVersion,
  buildCatalog,
  getCatalog,
  mockMinutes,
  poolKey,
  sectionKeyOf,
  type AppendedMock,
  type Catalog,
  type QuestionEdit,
  type TestOverride,
  type UploadDoc,
  type UploadKind,
  type UploadQuestion,
} from "./catalog";
import { db } from "./firebase-admin";
import {
  cleanHindi,
  cleanQuestion,
  DedupeIndex,
  hashSeed,
  looksLikeQuestionFile,
  mockTestId,
  mulberry32,
  OPTION_KEYS,
  questionId,
  spreadAndChunk,
  type RawQuestion,
} from "./question-utils";
import type { OptionKey, Options, TestSection } from "./types";

const MAX_DOC_BYTES = 900_000; // Firestore documents are limited to 1 MiB

export type UploadInput = {
  fileName?: unknown;
  kind?: unknown;
  title?: unknown;
  examKey?: unknown;
  subject?: unknown;
  year?: unknown;
  durationMinutes?: unknown;
  free?: unknown;
  questions?: unknown;
};

export type UploadReport = {
  testId: string;
  kind: UploadKind;
  /** Mock tests: the number it got (Mock Test N). */
  number?: number;
  title: string;
  examKey: string;
  subject: string;
  questionsInFile: number;
  valid: number;
  invalid: { index: number; reason: string }[];
  duplicatesInFile: number;
  withHindi: number;
  /** Whether students can take it without paying. */
  free: boolean;
  /** True when it became free because it is the first mock test of its exam + subject. */
  madeFreeAsFirstMock: boolean;
  alreadyInBank: number;
  newQuestions: number;
  mocksCreated: number[];
  poolRemaining: number;
};

export class UploadError extends Error {}

/** Read the current Firestore catalogue inputs directly (no cache), then build. */
async function freshCatalog(): Promise<{ cat: Catalog; mocks: AppendedMock[] }> {
  const [uploadsSnap, mocksSnap, overridesSnap, editsSnap, examsSnap] = await Promise.all([
    db().collection("uploads").get(),
    db().doc("catalog/mocks").get(),
    db().doc("catalog/overrides").get(),
    db().collection("questionEdits").get(),
    db().doc("catalog/exams").get(),
  ]);
  const mocks = (mocksSnap.get("tests") as AppendedMock[] | undefined) ?? [];
  const cat = buildCatalog({
    version: "fresh",
    uploads: uploadsSnap.docs.map((d) => [d.id, d.data() as UploadDoc]),
    appendedMocks: mocks,
    overrides: (overridesSnap.data() as Record<string, TestOverride> | undefined) ?? {},
    questionEdits: Object.fromEntries(editsSnap.docs.map((d) => [d.id, d.data() as QuestionEdit])),
    enabledExams: examsSnap.get("enabled") as string[] | undefined,
  });
  return { cat, mocks };
}

/** Admin → Exams: show or hide an exam (its menu entry, pages and previous-year papers). */
export async function setExamEnabled(examKey: string, enabled: boolean, adminPhone: string): Promise<string[]> {
  if (!examByKey.has(examKey)) throw new UploadError("Unknown exam.");
  const ref = db().doc("catalog/exams");
  const next = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = new Set((snap.get("enabled") as string[] | undefined) ?? DEFAULT_ENABLED_EXAMS);
    if (enabled) current.add(examKey);
    else current.delete(examKey);
    if (current.size === 0) throw new UploadError("Keep at least one exam switched on.");
    const list = [...current].filter((k) => examByKey.has(k));
    tx.set(ref, { enabled: list, updatedAt: Date.now(), updatedBy: adminPhone });
    return list;
  });
  await bumpCatalogVersion();
  return next;
}

function sourceGroup(cat: Catalog, id: string): string {
  const src = cat.questions.get(id)!.sources[0];
  return cat.uploadLabels.get(src)?.name ?? describeSource(src).name;
}

/** Mock test id: BPSC TRE keeps "1", "2", … (Computer Science) and "m-<subject>-<n>"; other exams "m-<exam>-<subject>-<n>". */
function mockId(exam: string, subject: string, n: number): string {
  return exam === BUNDLED_EXAM ? mockTestId(subject, n, DEFAULT_SUBJECT) : `m-${exam}-${subject}-${n}`;
}

/**
 * Turn pool questions of one exam + subject (not yet in any mock) into new mock tests, following
 * the exam's pattern: every section gets its number of questions. A mock is made only when every
 * section can be filled. `allowPartial` (admin button) also makes one shorter mock from what is
 * left, if at least minQuestionsForLastTest questions are waiting.
 */
async function createMocksFromPool(exam: string, subject: string, allowPartial: boolean): Promise<{ created: number[]; poolRemaining: number }> {
  const ref = db().doc("catalog/mocks");
  const { cat } = await freshCatalog();
  const pattern = patternFor(exam);
  const pool = cat.pool[poolKey(exam, subject)] ?? [];
  const bySection = new Map<string, string[]>(pattern.sections.map((sec) => [sec.key, []]));
  for (const id of pool) bySection.get(sectionKeyOf(cat.questions.get(id)!, pattern))!.push(id);

  const rand = mulberry32(hashSeed(`${buildConfig.seed}:${exam}:${subject}:${pool.length}:${Date.now()}`));
  // Shuffle each section's questions, spreading the source papers evenly.
  const ordered = new Map(
    pattern.sections.map((sec) => [sec.key, spreadAndChunk(bySection.get(sec.key)!, (id) => sourceGroup(cat, id), 1e9, 0, rand, true).chunks[0] ?? []]),
  );
  const full = Math.min(...pattern.sections.map((sec) => Math.floor(ordered.get(sec.key)!.length / sec.questions)));
  const plans: { ids: string[]; sections: TestSection[] }[] = [];
  for (let i = 0; i < full; i++) {
    const sections: TestSection[] = [];
    const ids: string[] = [];
    for (const sec of pattern.sections) {
      ids.push(...ordered.get(sec.key)!.slice(i * sec.questions, (i + 1) * sec.questions));
      sections.push({ key: sec.key, count: sec.questions });
    }
    plans.push({ ids, sections });
  }
  if (allowPartial) {
    const sections: TestSection[] = [];
    const ids: string[] = [];
    for (const sec of pattern.sections) {
      const rest = ordered.get(sec.key)!.slice(full * sec.questions, full * sec.questions + sec.questions);
      if (!rest.length) continue;
      ids.push(...rest);
      sections.push({ key: sec.key, count: rest.length });
    }
    if (ids.length >= buildConfig.minQuestionsForLastTest) plans.push({ ids, sections });
  }
  if (!plans.length) return { created: [], poolRemaining: pool.length };

  const created: number[] = [];
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.get("tests") as AppendedMock[] | undefined) ?? [];
    const taken = new Set(existing.flatMap((m) => m.questionIds));
    const same = (m: { subject?: string; examKey?: string }) => (m.subject ?? DEFAULT_SUBJECT) === subject && (m.examKey ?? BUNDLED_EXAM) === exam;
    const ownMocks = cat.allTests.filter((t) => t.kind === "mock" && t.subject === subject && (t.examKey ?? BUNDLED_EXAM) === exam);
    const firstForSeries = !ownMocks.length && !existing.some(same);
    let next = Math.max(0, ...ownMocks.map((t) => t.number), ...existing.filter(same).map((m) => m.number)) + 1;
    const now = Date.now();
    const added: AppendedMock[] = [];
    for (const plan of plans) {
      if (plan.ids.some((id) => taken.has(id))) continue; // guard against a concurrent run
      const n = plan.ids.length;
      added.push({
        id: mockId(exam, subject, next),
        number: next,
        subject,
        examKey: exam,
        // A brand-new exam + subject gets its first mock free, so students can try it.
        free: firstForSeries && added.length === 0,
        questionIds: plan.ids,
        sections: plan.sections,
        durationMinutes: n === questionsPerTest(pattern) ? pattern.durationMinutes : mockMinutes(n, pattern),
        createdAt: now,
      });
      created.push(next);
      next++;
    }
    tx.set(ref, { tests: [...existing, ...added] }, { merge: true });
  });
  const used = plans.reduce((n, pl) => n + pl.ids.length, 0);
  return { created, poolRemaining: pool.length - used };
}

export async function uploadPaper(input: UploadInput, adminPhone: string): Promise<UploadReport> {
  // ── Validate the form fields ──
  const kind: UploadKind | null = input.kind === "mock" || input.kind === "paper" ? input.kind : null;
  if (!kind) throw new UploadError("Choose what this file is: a mock test or a previous-year paper.");
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  if (title.length < 3 || title.length > 120) throw new UploadError("Enter a paper name (3–120 characters).");
  const examKey = typeof input.examKey === "string" ? input.examKey : "";
  const exam = examByKey.get(examKey);
  if (!exam) throw new UploadError("Choose the exam this paper belongs to.");
  const subject = typeof input.subject === "string" && input.subject ? input.subject : DEFAULT_SUBJECT;
  if (!subjectByKey.has(subject)) throw new UploadError("Choose the subject of this paper.");
  if (exam.subjects && !exam.subjects.includes(subject)) {
    throw new UploadError(`${exam.short} only has ${exam.subjects.map((k) => subjectName(k)).join(", ")} on this site. Pick another exam or subject.`);
  }
  const yearNum = Number(input.year);
  const year = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 ? yearNum : undefined;
  const fileName = typeof input.fileName === "string" ? input.fileName.slice(0, 200) : "upload.json";
  const pattern = patternFor(examKey);
  // "section" in the JSON may be a section key ("aptitude") or its name ("Teaching Aptitude & General Studies").
  const sectionKey = (raw: string | undefined): string | null => {
    if (!raw) return pattern.sections[0].key;
    const k = raw.trim().toLowerCase();
    const hit = pattern.sections.find((sec) => sec.key.toLowerCase() === k || sec.name.replace("{subject}", subjectName(subject)).toLowerCase() === k);
    return hit ? hit.key : null;
  };
  if (!looksLikeQuestionFile(input.questions)) {
    throw new UploadError('The file must be a JSON array of questions like [{ "question": …, "options": { "A": …, "B": … }, "answer": "A", "explanation": … }].');
  }
  const raw = input.questions as RawQuestion[];
  if (raw.length > 1000) throw new UploadError("Too many questions in one file (max 1000). Split it into papers.");

  // ── Clean & de-duplicate inside the file ──
  const invalid: UploadReport["invalid"] = [];
  const local = new DedupeIndex<UploadQuestion>(buildConfig.duplicateOptionOverlap);
  const questions: UploadQuestion[] = [];
  let duplicatesInFile = 0;
  raw.forEach((rq, i) => {
    const q = cleanQuestion(rq, title, pattern.optionE.enabled);
    const section = sectionKey(q.section);
    if (section === null) q.problems.push(`unknown section "${q.section}" (this exam has: ${pattern.sections.map((sec) => sec.key).join(", ")})`);
    if (q.problems.length) {
      invalid.push({ index: i + 1, reason: q.problems.join("; ") });
      return;
    }
    if (local.find(q.question, q.options)) {
      duplicatesInFile++;
      return;
    }
    const uq: UploadQuestion = {
      id: questionId(q.question, q.options),
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      ...(q.hi ? { hi: q.hi } : {}),
      ...(section && section !== pattern.sections[0].key ? { section } : {}),
    };
    local.add(uq);
    questions.push(uq);
  });
  if (!questions.length) throw new UploadError(`No valid questions found. First problem: ${invalid[0]?.reason ?? "empty file"}.`);

  const durIn = Number(input.durationMinutes);
  const durationMinutes =
    Number.isFinite(durIn) && durIn >= 1 && durIn <= 600
      ? Math.round(durIn)
      : kind === "mock"
        ? mockMinutes(questions.length, pattern)
        : Math.max(1, Math.round(questions.length * buildConfig.paperMinutesPerQuestion));

  // The first mock test of a brand-new exam + subject is free, so students can try the series
  // ("first mock free in every subject"). The admin can make it paid later (Admin → Tests).
  const firstMockOfSeries =
    kind === "mock" && !(await freshCatalog()).cat.allTests.some((t) => t.kind === "mock" && (t.examKey ?? BUNDLED_EXAM) === examKey && t.subject === subject);

  const doc: UploadDoc = {
    title,
    kind,
    examKey,
    subject,
    year,
    free: input.free === true || firstMockOfSeries,
    durationMinutes,
    fileName,
    createdAt: Date.now(),
    uploadedBy: adminPhone,
    questions,
  };
  if (Buffer.byteLength(JSON.stringify(doc)) > MAX_DOC_BYTES) {
    throw new UploadError("This file is too large to store as one paper (over ~900 KB). Split it into two files.");
  }

  // ── Save. The file becomes exactly ONE test (no automatic extra mock tests, so nothing appears twice). ──
  const ref = await db().collection("uploads").add(JSON.parse(JSON.stringify(doc)));
  const { cat } = await freshCatalog();
  const info = cat.uploads.find((u) => u.id === ref.id);
  const created: number[] = [];
  const poolRemaining = 0;
  await bumpCatalogVersion();

  return {
    testId: `u-${ref.id}`,
    kind,
    number: kind === "mock" ? cat.testById.get(`u-${ref.id}`)?.number : undefined,
    title,
    examKey,
    subject,
    questionsInFile: raw.length,
    valid: questions.length,
    invalid: invalid.slice(0, 50),
    duplicatesInFile,
    alreadyInBank: questions.length - (info?.newQuestions ?? 0),
    newQuestions: info?.newQuestions ?? 0,
    mocksCreated: created,
    poolRemaining,
    withHindi: questions.filter((q) => q.hi).length,
    free: doc.free === true,
    madeFreeAsFirstMock: firstMockOfSeries && input.free !== true,
  };
}

/**
 * Change what an upload is: mock test ↔ previous-year paper. When it becomes a mock test, mock tests
 * that were built automatically from its questions (older versions did that) are removed, so the
 * same questions don't appear twice.
 */
export async function setUploadKind(docId: string, kind: UploadKind): Promise<{ removedMocks: number[] }> {
  const ref = db().collection("uploads").doc(docId);
  if (!(await ref.get()).exists) throw new UploadError("Upload not found.");
  await ref.update({ kind });
  const removedMocks: number[] = [];
  if (kind === "mock") {
    const { cat } = await freshCatalog();
    const label = `upload:${docId}`;
    const own = new Set([...cat.questions.values()].filter((q) => q.sources.includes(label)).map((q) => q.id));
    const mocksRef = db().doc("catalog/mocks");
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(mocksRef);
      const existing = (snap.get("tests") as AppendedMock[] | undefined) ?? [];
      const keep = existing.filter((m) => {
        const dup = m.questionIds.some((id) => own.has(id));
        if (dup) removedMocks.push(m.number);
        return !dup;
      });
      if (keep.length !== existing.length) tx.set(mocksRef, { tests: keep }, { merge: true });
    });
  }
  await bumpCatalogVersion();
  return { removedMocks };
}

/** Delete a mock test that was built from the question pool (catalog/mocks). Uploaded mock tests are deleted with their upload. */
export async function deleteMock(mockId: string): Promise<boolean> {
  const ref = db().doc("catalog/mocks");
  const removed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.get("tests") as AppendedMock[] | undefined) ?? [];
    const keep = existing.filter((m) => m.id !== mockId);
    if (keep.length === existing.length) return false;
    tx.set(ref, { tests: keep }, { merge: true });
    return true;
  });
  if (removed) await bumpCatalogVersion();
  return removed;
}

/** Admin button: make mock test(s) now from the questions of one exam + subject waiting in the pool. */
export async function createMocksNow(exam: string, subject: string): Promise<{ created: number[]; poolRemaining: number }> {
  if (!examByKey.has(exam)) throw new UploadError("Unknown exam.");
  const r = await createMocksFromPool(exam, subject, true);
  if (r.created.length) await bumpCatalogVersion();
  return r;
}

export async function setTestOverride(testId: string, patch: TestOverride): Promise<void> {
  const ref = db().doc("catalog/overrides");
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = ((snap.data() ?? {}) as Record<string, TestOverride>)[testId] ?? {};
    const next: TestOverride = { ...current };
    if (typeof patch.free === "boolean") next.free = patch.free;
    if (typeof patch.hidden === "boolean") next.hidden = patch.hidden;
    if (typeof patch.title === "string") {
      const t = patch.title.trim().replace(/\s+/g, " ").slice(0, 120);
      if (t) next.title = t;
    }
    tx.set(ref, { [testId]: next }, { merge: true });
  });
  await bumpCatalogVersion();
}

/** Delete an uploaded paper, unless its questions are already used in mock tests. */
export async function deleteUpload(docId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { cat, mocks } = await freshCatalog();
  const label = `upload:${docId}`;
  if (!cat.uploads.some((u) => u.id === docId)) return { ok: false, reason: "Upload not found." };
  const onlyFromThis = new Set([...cat.questions.values()].filter((q) => q.sources.length === 1 && q.sources[0] === label).map((q) => q.id));
  const usedIn = mocks.filter((m) => m.questionIds.some((id) => onlyFromThis.has(id))).map((m) => m.number);
  if (usedIn.length) {
    return { ok: false, reason: `Its questions are used in Mock Test ${usedIn.join(", ")}. Delete that mock test first, or hide this one instead.` };
  }
  await db().collection("uploads").doc(docId).delete();
  await bumpCatalogVersion();
  return { ok: true };
}

/**
 * Admin "write" on content: correct a question (text, options, answer key,
 * explanation, Hindi). Stored as an override, so the original data is untouched.
 */
export async function saveQuestionEdit(qid: string, input: Record<string, unknown>, adminPhone: string): Promise<void> {
  const cat = await getCatalog();
  const current = cat.questions.get(qid);
  if (!current) throw new UploadError("Question not found.");

  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (!question) throw new UploadError("The question text can't be empty.");
  const options: Options = {};
  const rawOptions = (input.options && typeof input.options === "object" ? input.options : {}) as Record<string, unknown>;
  for (const k of OPTION_KEYS) {
    const v = rawOptions[k];
    if (typeof v === "string" && v.trim()) options[k] = v.trim();
  }
  if (Object.keys(options).length < 2) throw new UploadError("A question needs at least 2 options.");
  const answer = String(input.answer ?? "").toUpperCase() as OptionKey;
  if (!options[answer]) throw new UploadError("The answer must be one of the options.");
  const explanation = typeof input.explanation === "string" ? input.explanation.trim() : "";
  const hi = cleanHindi({ question_hi: input.question_hi, options_hi: input.options_hi, explanation_hi: input.explanation_hi }, options);

  const edit: QuestionEdit = { question, options, answer, explanation, updatedAt: Date.now(), updatedBy: adminPhone };
  // Firestore can't store `undefined`; an empty object clears a previous Hindi version.
  await db().doc(`questionEdits/${qid}`).set({ ...edit, hi: hi ?? {} });
  await bumpCatalogVersion();
}
