import "server-only";
import { AggregateField, FieldValue, type DocumentReference, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { patternFor, playerConfig } from "@config/test-series.config";
import { getCatalog, sectionsOf, type Catalog } from "./catalog";
import { db } from "./firebase-admin";
import { SKIP, type OptionKey, type TestDef } from "./types";

/** Answers saved within this long after the deadline still count (network lag). */
export const GRACE_MS = 30_000;

export type Graded = "correct" | "wrong" | "skipped" | "blank";

/** Marking and sections of a test, saved with each attempt when it starts. */
export type AttemptPattern = {
  marks: number;
  negative: number;
  optionE: boolean;
  optionELabel: string;
  blankPenalty: number;
  sections: { key: string; name: string; nameHi: string; count: number; marks: number; negative: number }[];
};

export type SectionResult = { key: string; name: string; nameHi: string; score: number; maxScore: number; correct: number; wrong: number; skipped: number; blank: number };

/** Pattern snapshot for a test (its exam's pattern + the test's sections). */
export function patternOfTest(test: Pick<TestDef, "examKey" | "subject" | "sections" | "questionCount">): AttemptPattern {
  const p = patternFor(test.examKey);
  return {
    marks: p.marksPerQuestion,
    negative: p.negativeMarksPerWrong,
    optionE: p.optionE.enabled,
    optionELabel: p.optionE.label,
    blankPenalty: p.optionE.enabled ? p.optionE.blankPenalty : 0,
    sections: sectionsOf(test),
  };
}

/** The attempt's saved pattern; attempts from before patterns were saved use their test's exam. */
export function attemptPattern(cat: Catalog, a: Pick<AttemptDoc, "pattern" | "testId" | "questionIds">): AttemptPattern {
  if (a.pattern) return a.pattern;
  const t = cat.testById.get(a.testId);
  return patternOfTest(t ?? { examKey: undefined, subject: "computer-science", questionCount: a.questionIds.length });
}

export type AttemptResult = {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  skipped: number; // chose Option E "Question not attempted"
  blank: number; // left with no option at all
  accuracy: number; // correct / (correct + wrong), in %
  // Pattern snapshot, so old results stay correct if the config changes later.
  marksPerQuestion: number;
  negativeMarksPerWrong: number;
  blankPenalty: number;
  /** Section-wise scores (tests with more than one section). */
  sections?: SectionResult[];
};

export type AttemptDoc = {
  testId: string;
  testTitle: string;
  testKind?: TestDef["kind"];
  examKey?: string;
  /** Marking, Option E and sections when the attempt started. */
  pattern?: AttemptPattern;
  status: "in_progress" | "submitted";
  questionIds: string[];
  startedAt: number;
  deadlineAt: number;
  durationSec: number;
  answers: Record<string, OptionKey>;
  marked: string[];
  visited: string[];
  current: number;
  savedAt: number;
  /** Set while the student has exited with the timer paused. */
  pausedAt?: number;
  /** Time left when paused (ms). */
  remainingMs?: number;
  submittedAt?: number;
  timeTakenSec?: number;
  autoSubmitted?: boolean;
  result?: AttemptResult;
  graded?: Record<string, Graded>;
};

export type Attempt = AttemptDoc & { id: string };

const attemptsCol = (uid: string) => db().collection(`users/${uid}/attempts`);
const attemptRef = (uid: string, id: string) => attemptsCol(uid).doc(id);
const activeRef = (uid: string, testId: string) => db().doc(`users/${uid}/active/${testId}`);
const leaderboard = (testId: string) => db().collection(`leaderboards/${testId}/entries`);

export function isExpired(a: Pick<AttemptDoc, "deadlineAt" | "pausedAt">, now = Date.now()): boolean {
  if (a.pausedAt) return false; // a paused test never runs out
  return now > a.deadlineAt + GRACE_MS;
}

/** Time left in ms (paused: the time left when the student exited). */
export function remainingMsOf(a: Pick<AttemptDoc, "deadlineAt" | "pausedAt" | "remainingMs">, now = Date.now()): number {
  return a.pausedAt ? Math.max(0, a.remainingMs ?? 0) : Math.max(0, a.deadlineAt - now);
}

export async function getAttempt(uid: string, id: string): Promise<Attempt | null> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return null;
  const snap = await attemptRef(uid, id).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as AttemptDoc) } as Attempt) : null;
}

/** The attempt for this test that is still running (time left), if any. */
export async function getRunningAttempt(uid: string, testId: string): Promise<Attempt | null> {
  const p = await activeRef(uid, testId).get();
  const id = p.get("attemptId") as string | undefined;
  if (!id) return null;
  const a = await getAttempt(uid, id);
  return a && a.status === "in_progress" && !isExpired(a) ? a : null;
}

export async function listAttempts(uid: string, limit = 200): Promise<Attempt[]> {
  const snap = await attemptsCol(uid).orderBy("startedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AttemptDoc) }));
}

// ── Input sanitising (never trust what the browser sends) ──

export function sanitizeAnswers(cat: Catalog, a: Pick<AttemptDoc, "questionIds" | "pattern" | "testId">, input: unknown): Record<string, OptionKey> {
  const out: Record<string, OptionKey> = {};
  if (!input || typeof input !== "object") return out;
  const optionE = attemptPattern(cat, a).optionE;
  const allowed = new Set(a.questionIds);
  for (const [qid, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.has(qid) || typeof value !== "string") continue;
    const q = cat.questions.get(qid);
    if (!q) continue;
    const key = value as OptionKey;
    if (q.options[key] || (optionE && key === SKIP)) out[qid] = key;
  }
  return out;
}

export function sanitizeIds(a: Pick<AttemptDoc, "questionIds">, input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(a.questionIds);
  return [...new Set(input.filter((x): x is string => typeof x === "string" && allowed.has(x)))];
}

// ── Scoring ──

export function grade(cat: Catalog, a: Pick<AttemptDoc, "questionIds" | "pattern" | "testId">, answers: Record<string, OptionKey>) {
  const p = attemptPattern(cat, a);
  // Section of each question position (sections are consecutive, in question order).
  const sectionAt: number[] = [];
  p.sections.forEach((sec, i) => {
    for (let k = 0; k < sec.count; k++) sectionAt.push(i);
  });
  const per: SectionResult[] = p.sections.map((sec) => ({ key: sec.key, name: sec.name, nameHi: sec.nameHi, score: 0, maxScore: 0, correct: 0, wrong: 0, skipped: 0, blank: 0 }));

  const graded: Record<string, Graded> = {};
  let score = 0;
  let maxScore = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let blank = 0;

  a.questionIds.forEach((qid, i) => {
    const q = cat.questions.get(qid);
    if (!q) return; // question removed from the bank since the attempt started
    const si = Math.min(sectionAt[i] ?? p.sections.length - 1, p.sections.length - 1);
    const sec = p.sections[si];
    const r = per[si];
    const marks = sec?.marks ?? p.marks;
    const negative = sec?.negative ?? p.negative;
    let delta = 0;
    maxScore += marks;
    r.maxScore += marks;
    const chosen = answers[qid];
    if (!chosen) {
      graded[qid] = "blank";
      blank++;
      r.blank++;
      delta = -p.blankPenalty;
    } else if (p.optionE && chosen === SKIP) {
      graded[qid] = "skipped";
      skipped++;
      r.skipped++;
    } else if (chosen === q.answer) {
      graded[qid] = "correct";
      correct++;
      r.correct++;
      delta = marks;
    } else {
      graded[qid] = "wrong";
      wrong++;
      r.wrong++;
      delta = -negative;
    }
    score += delta;
    r.score += delta;
  });

  const round = (x: number) => Math.round(x * 100) / 100;
  const result: AttemptResult = {
    score: round(score),
    maxScore: round(maxScore),
    correct,
    wrong,
    skipped,
    blank,
    accuracy: correct + wrong ? Math.round((correct / (correct + wrong)) * 1000) / 10 : 0,
    marksPerQuestion: p.marks,
    negativeMarksPerWrong: p.negative,
    blankPenalty: p.blankPenalty,
    ...(per.length > 1 ? { sections: per.map((r) => ({ ...r, score: round(r.score), maxScore: round(r.maxScore) })) } : {}),
  };
  return { result, graded };
}

function submission(cat: Catalog, a: AttemptDoc, answers: Record<string, OptionKey>, auto: boolean, now: number) {
  const { result, graded } = grade(cat, a, answers);
  return {
    status: "submitted" as const,
    answers,
    submittedAt: now,
    // Time actually spent: duration minus what was left (pauses don't count).
    timeTakenSec: Math.max(0, Math.round((a.durationSec * 1000 - remainingMsOf(a, now)) / 1000)),
    autoSubmitted: auto,
    result,
    graded,
  };
}

type Submission = ReturnType<typeof submission>;
type Tx = Transaction;

/** Read the leaderboard entry (must run before any write in the transaction). */
async function readBoard(tx: Tx, testId: string, uid: string) {
  return tx.get(leaderboard(testId).doc(uid));
}
/** First attempt only: record the score for rank / percentile. */
function writeBoard(tx: Tx, existing: DocumentSnapshot, s: Submission) {
  if (existing.exists) return;
  tx.set(existing.ref, {
    score: s.result.score,
    maxScore: s.result.maxScore,
    accuracy: s.result.accuracy,
    timeTakenSec: s.timeTakenSec,
    submittedAt: s.submittedAt,
  });
}

// ── Lifecycle ──

/** Resume the running attempt for this test, or start a new one. Returns the attempt id. */
export async function startAttempt(uid: string, test: TestDef): Promise<string> {
  const cat = await getCatalog();
  const pointer = activeRef(uid, test.id);
  return db().runTransaction(async (tx) => {
    const now = Date.now();
    const p = await tx.get(pointer);
    const existingId = p.get("attemptId") as string | undefined;
    let expired: { ref: DocumentReference; a: AttemptDoc } | null = null;
    if (existingId) {
      const ref = attemptRef(uid, existingId);
      const snap = await tx.get(ref);
      const a = snap.data() as AttemptDoc | undefined;
      if (a?.status === "in_progress") {
        if (!isExpired(a, now)) return existingId;
        expired = { ref, a }; // time ran out while away: submit it with its saved answers
      }
    }
    const board = expired ? await readBoard(tx, expired.a.testId, uid) : null;
    if (expired && board) {
      const s = submission(cat, expired.a, expired.a.answers ?? {}, true, now);
      tx.update(expired.ref, s);
      writeBoard(tx, board, s);
    }
    const ref = attemptsCol(uid).doc();
    const durationSec = test.durationMinutes * 60;
    const doc: AttemptDoc = {
      testId: test.id,
      testTitle: test.title,
      testKind: test.kind,
      ...(test.examKey ? { examKey: test.examKey } : {}),
      pattern: patternOfTest(test),
      status: "in_progress",
      questionIds: test.questionIds,
      startedAt: now,
      deadlineAt: now + durationSec * 1000,
      durationSec,
      answers: {},
      marked: [],
      visited: [],
      current: 0,
      savedAt: now,
    };
    tx.set(ref, doc);
    tx.set(pointer, { attemptId: ref.id, startedAt: now });
    return ref.id;
  });
}

/** Save progress during the test. */
export async function saveProgress(
  uid: string,
  id: string,
  input: { answers?: unknown; marked?: unknown; visited?: unknown; current?: unknown },
): Promise<"ok" | "not_found" | "submitted" | "expired"> {
  const cat = await getCatalog();
  const ref = attemptRef(uid, id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const a = snap.data() as AttemptDoc | undefined;
    if (!a) return "not_found";
    if (a.status !== "in_progress") return "submitted";
    if (isExpired(a)) return "expired";
    const current = Number.isInteger(input.current) ? Math.min(Math.max(0, input.current as number), a.questionIds.length - 1) : a.current;
    tx.update(ref, {
      answers: sanitizeAnswers(cat, a, input.answers),
      marked: sanitizeIds(a, input.marked),
      visited: sanitizeIds(a, input.visited),
      current,
      savedAt: Date.now(),
    });
    return "ok";
  });
}

/**
 * Submit (idempotent). If the request arrives after the deadline + grace period,
 * the last answers saved before the deadline are graded instead of the payload.
 */
export async function finalizeAttempt(
  uid: string,
  id: string,
  payload?: { answers?: unknown; marked?: unknown; auto?: unknown },
): Promise<Attempt | null> {
  const cat = await getCatalog();
  const ref = attemptRef(uid, id);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const a = snap.data() as AttemptDoc | undefined;
    if (!a || a.status === "submitted") return;
    const board = await readBoard(tx, a.testId, uid);
    const now = Date.now();
    const late = isExpired(a, now);
    const answers = !late && payload ? sanitizeAnswers(cat, a, payload.answers) : (a.answers ?? {});
    const marked = !late && payload ? sanitizeIds(a, payload.marked) : (a.marked ?? []);
    const auto = late || !payload || payload.auto === true;
    const s = submission(cat, a, answers, auto, now);
    tx.update(ref, { ...s, marked, pausedAt: FieldValue.delete(), remainingMs: FieldValue.delete() });
    writeBoard(tx, board, s);
  });
  return getAttempt(uid, id);
}

/**
 * "Exit" during a test: save progress and (if allowed) pause the timer.
 * Returns "paused" (timer stopped), "saved" (timer keeps running), or an error status.
 */
export async function pauseAttempt(
  uid: string,
  id: string,
  input: { answers?: unknown; marked?: unknown; visited?: unknown; current?: unknown },
): Promise<"paused" | "saved" | "not_found" | "submitted" | "expired"> {
  const cat = await getCatalog();
  const ref = attemptRef(uid, id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const a = snap.data() as AttemptDoc | undefined;
    if (!a) return "not_found";
    if (a.status !== "in_progress") return "submitted";
    if (isExpired(a)) return "expired";
    const now = Date.now();
    const current = Number.isInteger(input.current) ? Math.min(Math.max(0, input.current as number), a.questionIds.length - 1) : a.current;
    const progress = {
      answers: sanitizeAnswers(cat, a, input.answers),
      marked: sanitizeIds(a, input.marked),
      visited: sanitizeIds(a, input.visited),
      current,
      savedAt: now,
    };
    if (!playerConfig.allowPauseAndResume) {
      tx.update(ref, progress);
      return "saved";
    }
    tx.update(ref, a.pausedAt ? progress : { ...progress, pausedAt: now, remainingMs: Math.max(0, a.deadlineAt - now) });
    return "paused";
  });
}

/** Opening a paused test: the timer continues with the time that was left. */
export async function resumeAttempt(uid: string, id: string): Promise<void> {
  const ref = attemptRef(uid, id);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const a = snap.data() as AttemptDoc | undefined;
    if (!a || a.status !== "in_progress" || !a.pausedAt) return;
    tx.update(ref, {
      deadlineAt: Date.now() + Math.max(0, a.remainingMs ?? 0),
      pausedAt: FieldValue.delete(),
      remainingMs: FieldValue.delete(),
    });
  });
}

// ── Rank & percentile (first attempts of all students) ──

export type RankInfo = { rank: number; total: number; percentile: number; topper: number; average: number };

export async function getRankInfo(testId: string, score: number): Promise<RankInfo | null> {
  try {
    const col = leaderboard(testId);
    const [above, all, top, avg] = await Promise.all([
      col.where("score", ">", score).count().get(),
      col.count().get(),
      col.orderBy("score", "desc").limit(1).get(),
      col.aggregate({ avg: AggregateField.average("score") }).get(),
    ]);
    const total = all.data().count;
    if (!total) return null;
    const rank = Math.min(above.data().count + 1, total);
    return {
      rank,
      total,
      // share of students who scored the same or lower (100 = top)
      percentile: Math.round(((total - above.data().count) / total) * 10000) / 100,
      topper: (top.docs[0]?.get("score") as number | undefined) ?? score,
      average: Math.round(((avg.data().avg as number | null) ?? 0) * 100) / 100,
    };
  } catch (e) {
    console.error("Rank lookup failed", (e as Error).message);
    return null;
  }
}
