// One-line description of an exam's pattern, e.g. "80 Qs · 80 min · −⅓ per wrong answer · Option E".
// Safe for server and client code.
import { questionsPerTest, type ExamPattern } from "@config/test-series.config";
import { fractionLabel } from "./format";
import type { TFn } from "./i18n";

export function patternSummary(p: ExamPattern, t: TFn): string {
  const parts = [t("pt.qs", { n: questionsPerTest(p) }), t("pt.min", { m: p.durationMinutes })];
  parts.push(p.negativeMarksPerWrong ? t("pt.neg", { neg: fractionLabel(p.negativeMarksPerWrong) }) : t("pt.noNeg"));
  if (p.optionE.enabled) parts.push(t("pt.optE"));
  if (p.sections.length > 1) parts.push(t("pt.sections", { n: p.sections.length }));
  return parts.join(" · ");
}
