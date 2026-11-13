/**
 * Translate the question bank into Hindi with the Claude API.
 *
 *   npm run translate:hindi                 translate every question that has no Hindi yet
 *   npm run translate:hindi -- --limit 100  only the first 100 (try it on a small sample first)
 *   npm run translate:hindi -- --dry-run    count what is left and estimate the cost, no API calls
 *
 * Needs an Anthropic API key: ANTHROPIC_API_KEY=sk-ant-... in the environment (or `ant auth login`).
 * Model: claude-opus-5-5 by default; set TRANSLATE_MODEL to use another (e.g. a cheaper one).
 *
 * Reads  src/data/generated/bank.json (run `npm run build:bank` first)
 * Writes translations/hi.json after EVERY batch, so you can stop (Ctrl+C) and run it again
 * later: questions already in the file are skipped. Then run `npm run build:bank` (or just
 * `npm run dev` / `npm run build`) and the Hindi appears on the site.
 * Questions that already carry question_hi in their JSON file are skipped too.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = process.cwd();
const BANK = path.join(ROOT, "src/data/generated/bank.json");
const OUT = path.join(ROOT, "translations/hi.json");
const MODEL = process.env.TRANSLATE_MODEL || "claude-opus-5-5";
const BATCH = 15; // questions per request
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(value("--limit") ?? Infinity);
const DRY = flag("--dry-run");

// USD per 1M tokens (input, output), for the running cost estimate only.
const PRICES = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

const SYSTEM = `You translate multiple-choice exam questions from English into Hindi for Bihar teacher-recruitment exams (BPSC TRE, Bihar STET), in the bilingual style of official BPSC question papers.

Rules:
- Write standard Hindi in Devanagari, clear and exam-appropriate.
- Keep unchanged: code, program output, formulas, numbers, symbols, variable/function names, file names, commands, SQL, acronyms (CPU, SQL, OSI, BFS…) and proper nouns.
- For technical terms, use the common Hindi term and add the English term in brackets the first time when it helps, e.g. "प्रोजेक्शन (Projection)". If Hindi speakers normally use the English word, keep it in English.
- Keep line breaks and list numbering (i., ii., (a), A., I.) exactly as in the English.
- Translate every option. If an option is only code, a number or a symbol, return it unchanged.
- Translate the explanation too (empty string if the English explanation is empty).
- Never change the meaning, never add or remove information, never answer the question.
Return JSON that matches the schema, with one item per input question and the same ids.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["translations"],
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "options", "explanation"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "text"],
              properties: { key: { type: "string", enum: ["A", "B", "C", "D", "E"] }, text: { type: "string" } },
            },
          },
          explanation: { type: "string" },
        },
      },
    },
  },
};

function loadJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}
function save(all) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2) + "\n");
  fs.renameSync(tmp, OUT); // atomic: a crash never leaves a half-written file
}

if (!fs.existsSync(BANK)) {
  console.error("src/data/generated/bank.json not found. Run `npm run build:bank` first.");
  process.exit(1);
}
const bank = loadJson(BANK, {});
const done = loadJson(OUT, {});
const todo = Object.values(bank)
  .filter((q) => !q.hi && !done[q.id])
  .slice(0, LIMIT);

const chars = todo.reduce((n, q) => n + q.question.length + Object.values(q.options).join("").length + (q.explanation ?? "").length, 0);
console.log(`Hindi already available: ${Object.keys(bank).length - Object.values(bank).filter((q) => !q.hi && !done[q.id]).length} of ${Object.keys(bank).length} questions.`);
console.log(`To translate now: ${todo.length} questions (${chars.toLocaleString("en-IN")} characters) with ${MODEL}.`);
const price = PRICES[MODEL];
if (price) {
  // Rough guide: ~4 English characters per input token; Hindi output ~1 token per 1.2 characters of English source.
  const inTok = chars / 4 + (todo.length / BATCH) * 600;
  const outTok = chars / 1.2;
  const est = (inTok * price[0] + outTok * price[1]) / 1e6;
  console.log(`Estimated cost: about $${est.toFixed(2)} (very rough; the real cost is printed as it runs).`);
}
if (DRY || !todo.length) process.exit(0);

const client = new Anthropic({ maxRetries: 4 });
let usageIn = 0;
let usageOut = 0;
let translated = 0;
let failed = 0;

/** Translate one batch; on a cut-off or a bad answer, split it in half and try again. */
async function translate(batch) {
  const input = batch.map((q) => ({ id: q.id, question: q.question, options: q.options, explanation: q.explanation ?? "" }));
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    // If a safety classifier declines, the API re-runs the request on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `Translate these ${input.length} questions into Hindi:\n\n${JSON.stringify(input, null, 1)}` }],
  });
  usageIn += response.usage.input_tokens ?? 0;
  usageOut += response.usage.output_tokens ?? 0;

  if (response.stop_reason === "refusal") {
    console.warn(`  ✗ declined (${response.stop_details?.category ?? "no category"}): ${batch.map((q) => q.id).join(", ")}`);
    failed += batch.length;
    return;
  }
  let parsed = null;
  if (response.stop_reason !== "max_tokens") {
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!parsed?.translations) {
    if (batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      await translate(batch.slice(0, mid));
      await translate(batch.slice(mid));
    } else {
      console.warn(`  ✗ could not translate ${batch[0].id} (${response.stop_reason})`);
      failed++;
    }
    return;
  }
  for (const t of parsed.translations) {
    const q = bank[t.id];
    if (!q || !batch.some((b) => b.id === t.id) || !t.question?.trim()) continue;
    const options = {};
    for (const o of t.options ?? []) if (q.options[o.key] && o.text?.trim() && o.text.trim() !== q.options[o.key]) options[o.key] = o.text.trim();
    done[t.id] = {
      question: t.question.trim(),
      ...(Object.keys(options).length ? { options } : {}),
      ...(t.explanation?.trim() ? { explanation: t.explanation.trim() } : {}),
    };
    translated++;
  }
  save(done);
}

const batches = [];
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
let next = 0;
const started = Date.now();
async function worker() {
  while (next < batches.length) {
    const i = next++;
    try {
      await translate(batches[i]);
    } catch (e) {
      // Typed SDK errors: report and move on; the batch is retried on the next run.
      if (e instanceof Anthropic.AuthenticationError) {
        console.error("Invalid or missing API key (set ANTHROPIC_API_KEY).");
        process.exit(1);
      }
      console.warn(`  ✗ batch ${i + 1} failed: ${e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e.message}`);
      failed += batches[i].length;
    }
    const cost = price ? ` · ~$${((usageIn * price[0] + usageOut * price[1]) / 1e6).toFixed(2)} so far` : "";
    console.log(`  ${Math.min((i + 1) * BATCH, todo.length)}/${todo.length} · ${translated} translated${cost} · ${Math.round((Date.now() - started) / 1000)}s`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nDone: ${translated} translated, ${failed} not translated (run again to retry them).`);
console.log(`Tokens: ${usageIn.toLocaleString("en-IN")} in, ${usageOut.toLocaleString("en-IN")} out.`);
console.log("Next: `npm run build:bank` (or restart the site) to use the new Hindi.");
