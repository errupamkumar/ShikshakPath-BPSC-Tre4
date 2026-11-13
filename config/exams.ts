/**
 * Every exam the site knows. Students only see the exams that are switched ON in
 * Admin → Exams (until the admin changes it: DEFAULT_ENABLED_EXAMS below).
 * Flow for students: Exam → Subject (config/subjects.ts) → that subject's test series.
 *
 * - `key` is used in URLs (/exams/bpsc) and stored on uploaded papers. Don't change a
 *   key after papers have been uploaded for it.
 * - `posts` describes the posts in general words. ⚠ Please check against each exam's
 *   latest notification.
 * - `subjects`: leave out for exams that test every subject; list keys for exams
 *   that only test some (e.g. ISRO → Computer Science only).
 * - `logo`: an image in /public (e.g. "/exams/bpsc.png"). Without one, a lettered badge
 *   is shown. ⚠ The BPSC logo contains the State Emblem of India: read README → "Exam logos".
 */
export type ExamInfo = {
  key: string;
  short: string; // shown on cards and menus
  name: string; // full organisation name
  posts: string;
  region?: string;
  logo?: string;
  subjects?: string[]; // limit to these subject keys (default: all subjects)
};

/** Exams shown to students until the admin changes it in Admin → Exams. */
export const DEFAULT_ENABLED_EXAMS = ["bpsc", "bseb-stet"];

const CS = ["computer-science"];

export const exams: ExamInfo[] = [
  {
    key: "bpsc",
    short: "BPSC TRE 4.0",
    name: "Bihar Public Service Commission",
    posts: "School Teacher Recruitment Exam (TRE 4.0) for classes 1–5, 6–8, 9–10 and 11–12",
    region: "Bihar",
    logo: "/exams/bpsc.png",
  },
  {
    key: "bseb-stet",
    short: "Bihar STET",
    name: "Bihar School Examination Board",
    posts: "Secondary Teacher Eligibility Test: Paper I (classes 9–10) and Paper II (classes 11–12)",
    region: "Bihar",
    logo: "/exams/bseb.png",
  },

  // Other exams: switched OFF by default (Admin → Exams). While an exam is off, its
  // previous-year papers are hidden from students, but their questions are still used
  // in the mock tests of their subject.
  { key: "kvs", short: "KVS", name: "Kendriya Vidyalaya Sangathan", posts: "PGT / TGT / PRT teachers" },
  { key: "nvs", short: "NVS", name: "Navodaya Vidyalaya Samiti", posts: "PGT / TGT teachers" },
  { key: "emrs", short: "NESTS (EMRS)", name: "National Education Society for Tribal Students", posts: "PGT / TGT teachers in Eklavya Model Residential Schools" },
  { key: "aees", short: "AEES", name: "Atomic Energy Education Society", posts: "PGT / TGT teachers" },
  { key: "awes", short: "AWES", name: "Army Welfare Education Society (Army Public Schools)", posts: "PGT / TGT teachers" },
  { key: "ugc-net", short: "NTA UGC NET", name: "National Testing Agency: UGC NET", posts: "JRF & Assistant Professor eligibility" },
  { key: "dsssb", short: "DSSSB", name: "Delhi Subordinate Services Selection Board", posts: "TGT / PGT teachers", region: "Delhi" },
  { key: "upessc", short: "UPESSC", name: "UP Education Service Selection Commission", posts: "TGT / PGT teachers", region: "Uttar Pradesh" },
  { key: "rssb", short: "RSSB (RSMSSB)", name: "Rajasthan Staff Selection Board", posts: "School teachers, Informatics Assistant & Computer Instructor", region: "Rajasthan" },
  { key: "hssc", short: "HSSC", name: "Haryana Staff Selection Commission", posts: "TGT / PGT teachers", region: "Haryana" },
  { key: "mpesb", short: "MPESB", name: "Madhya Pradesh Employees Selection Board", posts: "Higher Secondary & Middle School teachers", region: "Madhya Pradesh" },
  { key: "trb", short: "TN TRB", name: "Teachers Recruitment Board, Tamil Nadu", posts: "PG Assistants & teachers", region: "Tamil Nadu" },
  { key: "wbssc", short: "WBSSC", name: "West Bengal School Service Commission", posts: "SLST assistant teachers", region: "West Bengal" },
  { key: "cg-vyapam", short: "CG Vyapam", name: "Chhattisgarh Professional Examination Board", posts: "Lecturers & teachers", region: "Chhattisgarh" },
  { key: "htet", short: "HTET", name: "Board of School Education Haryana: HTET", posts: "Teacher eligibility (PRT, TGT, PGT levels)", region: "Haryana" },
  { key: "uppsc", short: "UPPSC", name: "Uttar Pradesh Public Service Commission", posts: "LT Grade, GIC & Polytechnic lecturers", region: "Uttar Pradesh" },
  { key: "rpsc", short: "RPSC", name: "Rajasthan Public Service Commission", posts: "School Lecturer, Senior Teacher & Programmer", region: "Rajasthan" },
  { key: "hpsc", short: "HPSC", name: "Haryana Public Service Commission", posts: "PGT / Lecturer & Assistant Professor", region: "Haryana" },
  { key: "kpsc", short: "KPSC", name: "Karnataka Public Service Commission", posts: "Lecturer & Assistant Professor", region: "Karnataka" },
  { key: "opsc", short: "OPSC", name: "Odisha Public Service Commission", posts: "Lecturer & PGT", region: "Odisha" },
  { key: "gpsc", short: "GPSC", name: "Gujarat Public Service Commission", posts: "Lecturer & Assistant Professor", region: "Gujarat" },
  { key: "kerala-psc", short: "Kerala PSC", name: "Kerala Public Service Commission", posts: "HSST & Lecturer", region: "Kerala" },
  { key: "mpsc", short: "MPSC", name: "Maharashtra Public Service Commission", posts: "Lecturer & Assistant Professor", region: "Maharashtra" },
  { key: "appsc", short: "APPSC", name: "Andhra Pradesh Public Service Commission", posts: "Assistant Engineer, IT & lecturer posts", region: "Andhra Pradesh" },
  { key: "programmer-analyst", short: "Programmer / Analyst", name: "State Programmer & Analyst-cum-Programmer exams", posts: "Programmer, Analyst-cum-Programmer (Deputy Director)", subjects: CS },
  { key: "isro", short: "ISRO", name: "Indian Space Research Organisation", posts: "Scientist / Engineer 'SC'", subjects: CS },
  { key: "bel", short: "BEL", name: "Bharat Electronics Limited", posts: "Probationary Engineer", subjects: CS },
  { key: "sjvn", short: "SJVN", name: "SJVN Limited", posts: "Executive / technical posts", subjects: CS },
  { key: "wbpdcl", short: "WBPDCL", name: "West Bengal Power Development Corporation", posts: "Technical posts", subjects: CS },
  { key: "dcio", short: "DCIO (Tech)", name: "Deputy Central Intelligence Officer (Technical)", posts: "DCIO / Tech", subjects: CS },
  { key: "lecturer-technical", short: "Lecturer (Technical)", name: "Lecturer (Technical) exams", posts: "Polytechnic / technical lecturers", subjects: CS },
  { key: "model-papers", short: "Model papers", name: "Model question papers", posts: "Practice papers" },
];

export const examByKey = new Map(exams.map((e) => [e.key, e]));

export function examLabel(key: string | undefined): string {
  return (key && examByKey.get(key)?.short) || "Other";
}

/** 2–3 letters for exams without a logo image. */
export function examInitials(e: Pick<ExamInfo, "short">): string {
  return e.short.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
