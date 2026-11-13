// Pure question-processing helpers shared by the build script (scripts/build-question-bank.ts)
// and the admin upload API, so both clean and de-duplicate questions identically.
// Server/Node only (uses node:crypto); never import from a client component.
import { createHash } from "node:crypto";
import type { HindiText, OptionKey, Options } from "./types";

export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];
const NOT_ATTEMPTED = /^\s*question\s+not\s+attempted\s*\.?\s*$/i;

export type RawQuestion = {
  id?: unknown;
  source_file?: unknown;
  question?: unknown;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
  // Optional Hindi version
  question_hi?: unknown;
  options_hi?: unknown;
  explanation_hi?: unknown;
  // Optional section of the exam's pattern, e.g. "aptitude" (config examPatterns)
  section?: unknown;
};

export type CleanQuestion = {
  question: string;
  options: Options;
  answer: OptionKey;
  explanation: string;
  source: string;
  hi?: HindiText;
  /** Raw "section" value from the JSON (matched against the exam's pattern by the caller). */
  section?: string;
  problems: string[];
};

/** Read the optional Hindi fields; option keys must match the English options. */
export function cleanHindi(raw: RawQuestion, options: Options): HindiText | undefined {
  const hi: HindiText = {};
  if (typeof raw.question_hi === "string" && raw.question_hi.trim()) hi.question = raw.question_hi.trim();
  if (typeof raw.explanation_hi === "string" && raw.explanation_hi.trim()) hi.explanation = raw.explanation_hi.trim();
  if (raw.options_hi && typeof raw.options_hi === "object") {
    const o: Options = {};
    for (const key of OPTION_KEYS) {
      const v = (raw.options_hi as Record<string, unknown>)[key];
      if (v === undefined || v === null || !options[key]) continue;
      const text = String(v).trim();
      if (text) o[key] = text;
    }
    if (Object.keys(o).length) hi.options = o;
  }
  return Object.keys(hi).length ? hi : undefined;
}

export const normStem = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export const normOpt = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function looksLikeQuestionFile(data: unknown): data is RawQuestion[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((q) => q && typeof q === "object" && "question" in q && "options" in q)
  );
}

/** Validate and normalise one raw question. `problems` is empty when it is usable. */
export function cleanQuestion(raw: RawQuestion, fallbackSource: string, optionEEnabled: boolean): CleanQuestion {
  const problems: string[] = [];
  const question = typeof raw.question === "string" ? raw.question.trim() : "";
  if (!question) problems.push("empty question");

  const options: Options = {};
  if (raw.options && typeof raw.options === "object") {
    for (const key of OPTION_KEYS) {
      const v = (raw.options as Record<string, unknown>)[key];
      if (v === undefined || v === null) continue;
      const text = String(v).trim();
      if (!text) continue;
      // Drop the answer-sheet "Question not attempted" option; the app adds its own Option E.
      if (key === "E" && NOT_ATTEMPTED.test(text)) continue;
      options[key] = text;
    }
  }
  if (Object.keys(options).length < 2) problems.push("fewer than 2 options");

  const answer = String(raw.answer ?? "").trim().toUpperCase() as OptionKey;
  if (!options[answer]) problems.push(`answer "${String(raw.answer)}" is not one of the options`);
  if (optionEEnabled && options.E) problems.push("has a real option E, which clashes with the 'Question not attempted' choice");

  const source = typeof raw.source_file === "string" && raw.source_file.trim() ? raw.source_file.trim() : fallbackSource;
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";
  const section = typeof raw.section === "string" && raw.section.trim() ? raw.section.trim() : undefined;
  return { question, options, answer, explanation, source, hi: cleanHindi(raw, options), ...(section ? { section } : {}), problems };
}

export function optionSet(options: Options): Set<string> {
  return new Set(Object.values(options).map((o) => normOpt(o!)));
}

/** Stable id from content: same text + same options → same id on every build and upload. */
export function questionId(question: string, options: Options): string {
  const sortedOpts = [...optionSet(options)].sort().join("|");
  return createHash("sha1").update(`${normStem(question)}#${sortedOpts}`).digest("hex").slice(0, 12);
}

/**
 * Duplicate finder: two questions are duplicates when the text matches (ignoring
 * spaces/case) AND at least `threshold` of their options match.
 */
export class DedupeIndex<T extends { id: string; question: string; options: Options }> {
  private byStem = new Map<string, { item: T; opts: Set<string> }[]>();
  constructor(private threshold: number) {}

  find(question: string, options: Options): T | undefined {
    const opts = optionSet(options);
    const candidates = this.byStem.get(normStem(question)) ?? [];
    for (const c of candidates) {
      let common = 0;
      for (const o of opts) if (c.opts.has(o)) common++;
      if (common / Math.max(opts.size, c.opts.size) >= this.threshold) return c.item;
    }
    return undefined;
  }

  add(item: T): void {
    const stem = normStem(item.question);
    const list = this.byStem.get(stem) ?? [];
    list.push({ item, opts: optionSet(item.options) });
    this.byStem.set(stem, list);
  }
}

// ── Deterministic shuffling ──

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Order questions so each group (paper) is spread evenly, then cut into tests. */
export function spreadAndChunk<T>(
  items: T[],
  groupOf: (item: T) => string,
  perTest: number,
  minLast: number,
  rand: () => number,
  /** If false, a too-small remainder is returned separately instead of merged into the last test. */
  mergeSmallRemainder = true,
): { chunks: T[][]; remainder: T[] } {
  const groups = new Map<string, T[]>();
  for (const it of items) groups.set(groupOf(it), [...(groups.get(groupOf(it)) ?? []), it]);
  const keyed: { it: T; k: number }[] = [];
  for (const g of [...groups.keys()].sort()) {
    const list = shuffle(groups.get(g)!, rand);
    list.forEach((it, i) => keyed.push({ it, k: (i + rand()) / list.length }));
  }
  keyed.sort((a, b) => a.k - b.k);
  const ordered = keyed.map((x) => x.it);

  const chunks: T[][] = [];
  for (let i = 0; i < ordered.length; i += perTest) chunks.push(ordered.slice(i, i + perTest));
  let remainder: T[] = [];
  const last = chunks[chunks.length - 1];
  if (last && last.length < perTest && last.length < minLast) {
    chunks.pop();
    if (mergeSmallRemainder && chunks.length) chunks[chunks.length - 1].push(...last);
    else remainder = last;
  } else if (last && last.length < perTest && !mergeSmallRemainder) {
    // Uploads: only full tests are created automatically; the rest waits in the pool.
    chunks.pop();
    remainder = last;
  }
  return { chunks, remainder };
}

/** Computer Science mocks keep the plain ids "1", "2", …; other subjects get "m-<subject>-<n>". */
export function mockTestId(subject: string, n: number, defaultSubject: string): string {
  return subject === defaultSubject ? String(n) : `m-${subject}-${n}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function yearOf(s: string): number | undefined {
  const m = s.match(/\b(19|20)\d{2}\b/g);
  return m ? Number(m[m.length - 1]) : undefined;
}
