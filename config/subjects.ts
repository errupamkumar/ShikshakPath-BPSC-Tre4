/**
 * Subjects students can choose after picking an exam (Exam → Subject → tests).
 *
 * - `key` is used in URLs (/exams/kvs/mathematics) and stored on uploaded papers.
 *   Don't change a key after papers have been uploaded for it.
 * - A subject is "live" as soon as it has at least one test. Subjects without tests
 *   are shown as "Coming soon" (set `hideWhenEmpty: true` to hide one instead).
 * - To add a subject: add it here, then choose it in Admin → Upload.
 */
export type SubjectInfo = {
  key: string;
  name: string;
  nameHi: string; // shown when the visitor switches to हिंदी
  short: string; // 2–3 letters for badges
  tone: string; // Tailwind classes for the badge
  hideWhenEmpty?: boolean;
};

/** Subject of the questions bundled in "JSON file/" (all Computer Science today). */
export const DEFAULT_SUBJECT = "computer-science";

export const subjects: SubjectInfo[] = [
  { key: "computer-science", name: "Computer Science", nameHi: "कंप्यूटर साइंस", short: "CS", tone: "bg-brand-100 text-brand-800 ring-brand-200" },
  { key: "mathematics", name: "Mathematics", nameHi: "गणित", short: "MA", tone: "bg-sky-100 text-sky-800 ring-sky-200" },
  { key: "physics", name: "Physics", nameHi: "भौतिकी", short: "PH", tone: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  { key: "chemistry", name: "Chemistry", nameHi: "रसायन विज्ञान", short: "CH", tone: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  { key: "biology", name: "Biology", nameHi: "जीव विज्ञान", short: "BI", tone: "bg-lime-100 text-lime-800 ring-lime-200" },
  { key: "english", name: "English", nameHi: "अंग्रेज़ी", short: "EN", tone: "bg-rose-100 text-rose-800 ring-rose-200" },
  { key: "hindi", name: "Hindi", nameHi: "हिंदी", short: "HI", tone: "bg-orange-100 text-orange-800 ring-orange-200" },
  { key: "sanskrit", name: "Sanskrit", nameHi: "संस्कृत", short: "SA", tone: "bg-amber-100 text-amber-800 ring-amber-200" },
  { key: "urdu", name: "Urdu", nameHi: "उर्दू", short: "UR", tone: "bg-teal-100 text-teal-800 ring-teal-200" },
  { key: "history", name: "History", nameHi: "इतिहास", short: "HS", tone: "bg-stone-200 text-stone-800 ring-stone-300" },
  { key: "geography", name: "Geography", nameHi: "भूगोल", short: "GE", tone: "bg-green-100 text-green-800 ring-green-200" },
  { key: "political-science", name: "Political Science", nameHi: "राजनीति विज्ञान", short: "PS", tone: "bg-violet-100 text-violet-800 ring-violet-200" },
  { key: "economics", name: "Economics", nameHi: "अर्थशास्त्र", short: "EC", tone: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  { key: "commerce", name: "Commerce", nameHi: "वाणिज्य", short: "CO", tone: "bg-cyan-100 text-cyan-800 ring-cyan-200" },
  { key: "home-science", name: "Home Science", nameHi: "गृह विज्ञान", short: "HM", tone: "bg-pink-100 text-pink-800 ring-pink-200" },
  { key: "music", name: "Music", nameHi: "संगीत", short: "MU", tone: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200" },
  { key: "fine-arts", name: "Fine Arts", nameHi: "ललित कला", short: "FA", tone: "bg-purple-100 text-purple-800 ring-purple-200" },
  { key: "physical-education", name: "Physical Education", nameHi: "शारीरिक शिक्षा", short: "PE", tone: "bg-red-100 text-red-800 ring-red-200" },
  { key: "general-studies", name: "General Studies", nameHi: "सामान्य अध्ययन", short: "GS", tone: "bg-slate-200 text-slate-800 ring-slate-300" },
  { key: "pedagogy", name: "Child Development & Pedagogy", nameHi: "बाल विकास एवं शिक्षाशास्त्र", short: "CD", tone: "bg-blue-100 text-blue-800 ring-blue-200" },
];

export const subjectByKey = new Map(subjects.map((s) => [s.key, s]));

export function subjectName(key: string | undefined, lang: "en" | "hi" = "en"): string {
  const s = subjectByKey.get(key ?? DEFAULT_SUBJECT);
  if (!s) return lang === "hi" ? "सामान्य" : "General";
  return lang === "hi" ? s.nameHi : s.name;
}
