import "server-only";
import type { MenuExam } from "@/components/header/types";
import { liveExams, subjectsForExam, type Catalog } from "./catalog";
import type { Lang } from "./i18n";

/** Exams switched on (Admin → Exams), each with its subjects (live first), for the menus and the picker. */
export function menuExams(cat: Catalog, lang: Lang): MenuExam[] {
  return liveExams(cat).map((e) => ({
    key: e.key,
    short: e.short,
    name: e.name,
    posts: e.posts,
    logo: e.logo,
    subjects: subjectsForExam(cat, e.key).map((s) => ({
      key: s.key,
      name: lang === "hi" ? s.nameHi : s.name,
      short: s.short,
      tone: s.tone,
      live: s.live,
      tests: s.stats.mockTests + s.examPapers,
    })),
  }));
}
