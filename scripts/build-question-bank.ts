/**
 * Merge every bundled question JSON file, remove duplicates and build the tests.
 *
 *   npm run build:bank
 *
 * Input : the folders in config/test-series.config.ts → buildConfig.inputDirs
 * Output: src/data/generated/
 *           bank.json   all unique questions WITH answers (server-only, never sent to the browser)
 *           tests.json  mock tests (mixed, BPSC pattern) + one "previous year paper" test per paper
 *           stats.json  build report + landing-page sample question ids
 *
 * Hindi: translations/hi.json ({ "<question id>": { question, options, explanation } })
 * adds the Hindi version of bundled questions (a question's own question_hi fields win).
 *
 * Deterministic: same files + same seed → same tests. Papers uploaded from the
 * Admin page are stored in Firestore and merged in at runtime (src/lib/catalog.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { buildConfig, examPattern } from "../config/test-series.config";
import { describeSource, examSources } from "../config/exam-sources";
import { exams } from "../config/exams";
import { DEFAULT_SUBJECT } from "../config/subjects";
import {
  cleanQuestion,
  DedupeIndex,
  hashSeed,
  looksLikeQuestionFile,
  mockTestId,
  mulberry32,
  questionId,
  shuffle,
  slugify,
  spreadAndChunk,
  yearOf,
  type RawQuestion,
} from "../src/lib/question-utils";
import type { BankQuestion, BuildStats, TestDef } from "../src/lib/types";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

function listInputFiles(): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  for (const dir of buildConfig.inputDirs) {
    const abs = path.resolve(ROOT, dir);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    const names = fs
      .readdirSync(abs)
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.localeCompare(b, "en"));
    for (const name of names) {
      const full = path.join(abs, name);
      const real = fs.realpathSync(full);
      if (seen.has(real)) continue;
      seen.add(real);
      files.push(full);
    }
  }
  return files;
}

function main() {
  const files = listInputFiles();
  if (files.length === 0) {
    console.error(`No JSON files found in: ${buildConfig.inputDirs.join(", ")}`);
    process.exit(1);
  }

  // Duplicates are only looked for within the same subject.
  const indexes = new Map<string, DedupeIndex<BankQuestion>>();
  const indexFor = (subject: string) => {
    if (!indexes.has(subject)) indexes.set(subject, new DedupeIndex<BankQuestion>(buildConfig.duplicateOptionOverlap));
    return indexes.get(subject)!;
  };
  const all: BankQuestion[] = [];
  const paperQids = new Map<string, string[]>(); // paper name → question ids in paper order
  const warnings: string[] = [];
  const unmapped = new Set<string>();
  let raw = 0;
  let dupes = 0;
  let skipped = 0;
  const perFile: { file: string; total: number; added: number; dupes: number }[] = [];
  const usedIds = new Set<string>();

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      warnings.push(`${rel}: could not parse JSON (${(e as Error).message})`);
      continue;
    }
    if (!looksLikeQuestionFile(data)) continue; // package.json, tsconfig.json, etc.

    const stat = { file: rel, total: data.length, added: 0, dupes: 0 };
    const fallbackSource = path.basename(file, ".json");

    (data as RawQuestion[]).forEach((rq, i) => {
      raw++;
      const q = cleanQuestion(rq, fallbackSource, examPattern.optionE.enabled);
      if (q.problems.length) {
        skipped++;
        warnings.push(`${rel} #${String(rq.id ?? i + 1)}: skipped (${q.problems.join("; ")})`);
        return;
      }
      if (!examSources[q.source]) unmapped.add(q.source);
      const { name: paper, subject } = describeSource(q.source);
      const index = indexFor(subject);
      const list = paperQids.get(paper) ?? [];
      paperQids.set(paper, list);

      const match = index.find(q.question, q.options);
      if (match) {
        dupes++;
        stat.dupes++;
        if (!match.sources.includes(q.source)) match.sources.push(q.source);
        if (match.answer !== q.answer && match.options[q.answer] === q.options[q.answer]) {
          warnings.push(
            `${rel} #${String(rq.id ?? i + 1)}: duplicate of a question in "${match.sources[0]}" but answer differs (${q.answer} vs ${match.answer}); kept the first one`,
          );
        }
        if (!match.hi && q.hi) match.hi = q.hi; // a later copy may carry the Hindi version
        if (!list.includes(match.id)) list.push(match.id);
        return;
      }

      let id = questionId(q.question, q.options);
      while (usedIds.has(id)) id = questionId(id, q.options); // (very unlikely) hash collision
      usedIds.add(id);
      const entry: BankQuestion = {
        id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        sources: [q.source],
        subject,
        ...(q.hi ? { hi: q.hi } : {}),
      };
      index.add(entry);
      all.push(entry);
      list.push(id);
      stat.added++;
    });
    perFile.push(stat);
  }

  // ── Mock tests, per subject: spread each paper's questions evenly across the tests ──
  // (Computer Science keeps the original seed, so its mocks never change.)
  const per = examPattern.questionsPerTest;
  const subjectKeys = [...new Set(all.map((q) => q.subject))].sort((a, b) => (a === DEFAULT_SUBJECT ? -1 : b === DEFAULT_SUBJECT ? 1 : a.localeCompare(b)));
  const mocks: TestDef[] = subjectKeys.flatMap((subject) => {
    const rand = mulberry32(hashSeed(subject === DEFAULT_SUBJECT ? buildConfig.seed : `${buildConfig.seed}:${subject}`));
    const { chunks } = spreadAndChunk(
      all.filter((q) => q.subject === subject),
      (q) => describeSource(q.sources[0]).name,
      per,
      buildConfig.minQuestionsForLastTest,
      rand,
    );
    return chunks.map((chunk, i): TestDef => {
    const qs = shuffle(chunk, rand); // so questions from one paper aren't clustered
    const n = i + 1;
    return {
      id: mockTestId(subject, n, DEFAULT_SUBJECT),
      kind: "mock",
      subject,
      number: n,
      title: `Mock Test ${n}`,
      free: n <= buildConfig.freeTests,
      questionIds: qs.map((q) => q.id),
      questionCount: qs.length,
      durationMinutes: Math.max(1, Math.round((examPattern.durationMinutes * qs.length) / per)),
      paperCount: new Set(qs.map((q) => describeSource(q.sources[0]).name)).size,
      origin: "bundled",
    };
    });
  });

  // ── Previous-year paper tests: one per paper, original question order ──
  const examOrder = new Map(exams.map((e, i) => [e.key, i]));
  const examOfPaper = new Map<string, string>();
  const subjectOfPaper = new Map<string, string>();
  for (const src of Object.keys(examSources)) {
    examOfPaper.set(examSources[src].name, examSources[src].examKey);
    subjectOfPaper.set(examSources[src].name, examSources[src].subject ?? DEFAULT_SUBJECT);
  }
  const papers: TestDef[] = [...paperQids.entries()]
    .filter(([, ids]) => ids.length > 0)
    .map(([name, ids]) => ({
      id: `p-${slugify(name)}`,
      kind: "paper" as const,
      subject: subjectOfPaper.get(name) ?? DEFAULT_SUBJECT,
      number: 0,
      title: name,
      free: buildConfig.freePapers.includes(name),
      questionIds: ids,
      questionCount: ids.length,
      durationMinutes: Math.max(1, Math.round(ids.length * buildConfig.paperMinutesPerQuestion)),
      paperCount: 1,
      examKey: examOfPaper.get(name) ?? "model-papers",
      year: yearOf(name),
      origin: "bundled" as const,
    }))
    .sort(
      (a, b) =>
        (examOrder.get(a.examKey) ?? 999) - (examOrder.get(b.examKey) ?? 999) ||
        (b.year ?? 0) - (a.year ?? 0) ||
        a.title.localeCompare(b.title),
    )
    .map((t, i) => ({ ...t, number: i + 1 }));

  // Landing-page samples: short, self-contained questions from Mock Test 1.
  const bankById = new Map(all.map((q) => [q.id, q]));
  const sampleQuestionIds = (mocks[0]?.questionIds ?? [])
    .map((id) => bankById.get(id)!)
    .filter(
      (q) =>
        q.question.length < 160 &&
        !q.question.includes("\n") &&
        !/figure|diagram|shown|given below|following/i.test(q.question) &&
        Object.values(q.options).every((o) => o!.length < 60),
    )
    .slice(0, 3)
    .map((q) => q.id);

  const stats: BuildStats = { generatedAt: new Date().toISOString(), rawQuestions: raw, duplicatesRemoved: dupes, sampleQuestionIds };

  // ── Hindi translations (translations/hi.json, keyed by question id) ──
  const hiFile = path.join(ROOT, "translations", "hi.json");
  let hiAdded = 0;
  let hiUnknown = 0;
  if (fs.existsSync(hiFile)) {
    const hi = JSON.parse(fs.readFileSync(hiFile, "utf8")) as Record<string, { question?: string; options?: Record<string, string>; explanation?: string }>;
    for (const [id, h] of Object.entries(hi)) {
      const q = bankById.get(id);
      if (!q) {
        hiUnknown++;
        continue;
      }
      if (q.hi) continue; // the JSON file's own question_hi / options_hi / explanation_hi win
      const options = Object.fromEntries(Object.entries(h.options ?? {}).filter(([k, v]) => v && q.options[k as keyof typeof q.options]));
      q.hi = {
        ...(h.question ? { question: h.question } : {}),
        ...(Object.keys(options).length ? { options } : {}),
        ...(h.explanation ? { explanation: h.explanation } : {}),
      };
      hiAdded++;
    }
  }

  // ── Write output ──
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bank: Record<string, BankQuestion> = {};
  for (const q of all) bank[q.id] = q;
  fs.writeFileSync(path.join(OUT_DIR, "bank.json"), JSON.stringify(bank));
  fs.writeFileSync(path.join(OUT_DIR, "tests.json"), JSON.stringify([...mocks, ...papers]));
  fs.writeFileSync(path.join(OUT_DIR, "stats.json"), JSON.stringify(stats, null, 2));

  // ── Report ──
  console.log("\n📚 Question bank build");
  console.log("───────────────────────────────────────────");
  for (const s of perFile) {
    console.log(`  ${s.file.padEnd(70).slice(0, 70)} ${String(s.total).padStart(4)}  +${String(s.added).padStart(3)}  dup ${s.dupes}`);
  }
  console.log("───────────────────────────────────────────");
  console.log(`  Files read           : ${perFile.length}`);
  console.log(`  Questions in files   : ${raw}`);
  console.log(`  Duplicates removed   : ${dupes}`);
  console.log(`  Invalid, skipped     : ${skipped}`);
  console.log(`  Unique questions     : ${all.length}`);
  console.log(`  Mock tests           : ${mocks.length} (${mocks.map((t) => t.questionCount).join(", ")} questions) in ${subjectKeys.length} subject(s)`);
  console.log(`  Previous-year papers : ${papers.length} tests from ${new Set(papers.map((p) => p.examKey)).size} exams`);
  console.log(`  Hindi version        : ${all.filter((q) => q.hi).length} of ${all.length} questions (${hiAdded} from translations/hi.json${hiUnknown ? `, ${hiUnknown} unknown ids skipped` : ""})`);
  if (unmapped.size) {
    console.log(`\n⚠ ${unmapped.size} source_file value(s) have no friendly name in config/exam-sources.ts:`);
    unmapped.forEach((s) => console.log(`    "${s}"`));
  }
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning(s):`);
    warnings.slice(0, 50).forEach((w) => console.log("   - " + w));
    if (warnings.length > 50) console.log(`   … and ${warnings.length - 50} more`);
  }
  console.log(`\n✔ Wrote ${path.relative(ROOT, OUT_DIR)}/bank.json, tests.json, stats.json\n`);
}

main();
