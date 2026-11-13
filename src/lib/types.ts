// Shared types used by the build script, the server and the browser.

export type OptionKey = "A" | "B" | "C" | "D" | "E";
export type Options = Partial<Record<OptionKey, string>>;

/** Optional Hindi version of a question (from question_hi / options_hi / explanation_hi in the JSON). */
export type HindiText = { question?: string; options?: Options; explanation?: string };

/** A question in the bank (SERVER ONLY: contains the answer). */
export type BankQuestion = {
  hi?: HindiText;
  id: string; // stable content hash
  question: string;
  options: Options;
  answer: OptionKey;
  explanation: string;
  /** Every source this question appeared in (first = primary). Bundled: source_file; uploaded: "upload:<id>". */
  sources: string[];
  /** Subject key from config/subjects.ts (e.g. "computer-science"). */
  subject: string;
  /** Exam (test series) the question belongs to, e.g. "bpsc". Exams are independent. */
  exam?: string;
  /** Section key from the exam's pattern (config examPatterns); missing = the first section. */
  section?: string;
};

/** A section of a test: its key in the exam pattern and how many questions (in order). */
export type TestSection = { key: string; count: number };

/** What the browser receives during a test: no answer, no explanation. */
export type PublicQuestion = {
  id: string;
  question: string;
  options: Options;
  sources: string[]; // display names
  hi?: { question?: string; options?: Options }; // never the explanation
};

export type TestKind = "mock" | "paper";

export type TestDef = {
  /**
   * BPSC TRE Computer Science mocks: "1", "2", … · other BPSC subjects: "m-<subject>-<n>" ·
   * other exams: "m-<exam>-<subject>-<n>" · bundled papers: "p-<slug>" · uploaded papers: "u-<docId>"
   */
  id: string;
  kind: TestKind;
  subject: string; // key from config/subjects.ts
  number: number; // mock number / paper position
  title: string;
  free: boolean;
  hidden?: boolean;
  /** The exam is switched off (Admin → Exams): not shown to students. */
  examOff?: boolean;
  questionIds: string[];
  questionCount: number;
  durationMinutes: number;
  paperCount: number; // how many different papers the questions come from
  /** Exam (test series) this test belongs to, e.g. "bpsc". */
  examKey?: string;
  /** Previous-year papers: the exam the paper was originally asked in (shown as "Asked in …"). */
  sourceExam?: string;
  /** Sections in question order (one section = no section tabs). */
  sections?: TestSection[];
  year?: number;
  origin: "bundled" | "uploaded";
  createdAt?: number;
};

/** Output of the build script (src/data/generated/stats.json). */
export type BuildStats = {
  generatedAt: string;
  rawQuestions: number;
  duplicatesRemoved: number;
  sampleQuestionIds: string[];
};

/** The answer value used when a student picks option E ("not attempted"). */
export const SKIP = "E" as const;
