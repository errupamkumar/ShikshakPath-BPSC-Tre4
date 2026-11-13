/**
 * Maps each `source_file` value in the bundled question JSON (folder "JSON file/")
 * to a friendly paper name and an exam key from config/exams.ts.
 *
 * Files with the same `name` become ONE "Previous year paper" test.
 * `subject` defaults to DEFAULT_SUBJECT (Computer Science) from config/subjects.ts.
 * ⚠ Names marked "CHECK" are best guesses from the file name. Please correct them.
 * (Papers uploaded from the Admin page don't need an entry here; you pick the
 * name and exam in the upload form.)
 */
import { DEFAULT_SUBJECT } from "./subjects";

export type ExamSource = { name: string; examKey: string; subject?: string };

export const examSources: Record<string, ExamSource> = {
  // ── NTA UGC NET Computer Science ──
  "J-8710": { name: "UGC NET June 2010 · Paper II", examKey: "ugc-net" },
  "D-87-10": { name: "UGC NET Dec 2010 · Paper II", examKey: "ugc-net" },
  "J-87-11": { name: "UGC NET June 2011 · Paper II", examKey: "ugc-net" },
  "D-87-11": { name: "UGC NET Dec 2011 · Paper II", examKey: "ugc-net" },
  "J-87-12 Comp Sci": { name: "UGC NET June 2012 · Paper II", examKey: "ugc-net" },
  "D-87-12": { name: "UGC NET Dec 2012 · Paper II", examKey: "ugc-net" },
  "J-87-13-III Computer Science and Applications": { name: "UGC NET June 2013 · Paper III", examKey: "ugc-net" },
  "J-87-14-II": { name: "UGC NET June 2014 · Paper II", examKey: "ugc-net" },
  "J 8715 Paper II Computer Science": { name: "UGC NET June 2015 · Paper II", examKey: "ugc-net" },
  "D 8715 Paper II Computer Science": { name: "UGC NET Dec 2015 · Paper II", examKey: "ugc-net" },
  "J-87-16-II _Computer Science": { name: "UGC NET July 2016 · Paper II", examKey: "ugc-net" },
  "JA-087-17-II": { name: "UGC NET Jan 2017 · Paper II", examKey: "ugc-net" },
  "N 08717 Paper II Computer Science": { name: "UGC NET Nov 2017 · Paper II", examKey: "ugc-net" },
  "J 08718 Paper II Computer Science": { name: "UGC NET July 2018 · Paper II", examKey: "ugc-net" },
  UGC_NET_June2026_PYQ: { name: "UGC NET June 2026", examKey: "ugc-net" },

  // ── Teaching exams ──
  "mcq kvs tgt_260329_130009": { name: "KVS TGT Computer Science", examKey: "kvs" },
  "LT GRADE CS 05-04-2026": { name: "UP LT Grade Computer Science (Apr 2026)", examKey: "uppsc" },
  VISU: { name: "UP LT Grade Computer Science (Apr 2026)", examKey: "uppsc" }, // CHECK: same questions as LT Grade 2026
  "HTET PGT CS L3": { name: "HTET PGT (Level 3) Computer Science", examKey: "htet" },
  UPPSC_POLYTECHNIC_CS_PAPER1: { name: "UPPSC Polytechnic Lecturer CS · Paper 1", examKey: "uppsc" },
  UPPSC_POLYTECHNIC_CS_PAPER2: { name: "UPPSC Polytechnic Lecturer CS · Paper 2", examKey: "uppsc" },
  "Lect_Tech_Computer_Engg-1": { name: "Lecturer (Technical) Computer Engg.", examKey: "lecturer-technical" }, // CHECK

  // ── State PSC / Govt. programmer & analyst exams ──
  "APPSC_AE_2025_EXAM_27TH JUNE (1)": { name: "APPSC AE 2025 (27 June)", examKey: "appsc" },
  "APPSC_AE_2025_EXAM_27TH JUNE_Completed": { name: "APPSC AE 2025 (27 June)", examKey: "appsc" },
  IT_PYQ_appsc: { name: "APPSC Information Technology", examKey: "appsc" }, // CHECK
  "Programmer Exam 2013 - Paper-I": { name: "Programmer Exam 2013 · Paper I", examKey: "programmer-analyst" },
  "Programmer Exam 2013 - Paper-II": { name: "Programmer Exam 2013 · Paper II", examKey: "programmer-analyst" },
  "Question Paper for Programmer Exam - 2024 (Paper-I)": { name: "Programmer Exam 2024 · Paper I", examKey: "programmer-analyst" },
  "Question Paper for Programmer Exam - 2024 (Paper-II)": { name: "Programmer Exam 2024 · Paper II", examKey: "programmer-analyst" },
  "programmer paper 1_2024": { name: "Programmer Exam 2024 · Paper I", examKey: "programmer-analyst" },
  "programmer paper 2_2024": { name: "Programmer Exam 2024 · Paper II", examKey: "programmer-analyst" },
  "Question Paper for Analyst-Cum-Programmer - 2014 Paper - I": { name: "Analyst-cum-Programmer 2014 · Paper I", examKey: "programmer-analyst" },
  "Question Paper for Analyst-Cum-Programmer - 2014 Paper - II": { name: "Analyst-cum-Programmer 2014 · Paper II", examKey: "programmer-analyst" },
  "Question Paper for Analyst-Cum-Programmer (Deputy Director) - 2024(Paper-I)": { name: "Analyst-cum-Programmer (Dy. Director) 2024 · Paper I", examKey: "programmer-analyst" },
  "Question Paper for Analyst-Cum-Programmer (Deputy Director) - 2024(Paper-II)": { name: "Analyst-cum-Programmer (Dy. Director) 2024 · Paper II", examKey: "programmer-analyst" },
  "paper 2": { name: "Analyst-cum-Programmer (Dy. Director) 2024 · Paper II (Set B)", examKey: "programmer-analyst" }, // CHECK: 76 of 100 questions match the 2024 Paper II

  // ── Central PSUs, ISRO & others ──
  "ISRO_SC_B_2025_CS_IT_watermark": { name: "ISRO Scientist/Engineer 'SC' 2025 (CS)", examKey: "isro" },
  "BEL_PE_CS_2023_PYQ_Completed": { name: "BEL Probationary Engineer (CS) 2023", examKey: "bel" },
  "BEL_PE_CS_2025_Question Response key": { name: "BEL Probationary Engineer (CS) 2025", examKey: "bel" },
  "SJVNL_1569050019_1258O1990S2D67E1_250719_220550_251111_181936": { name: "SJVN Ltd. Computer Science", examKey: "sjvn" },
  "WBPDCL_QUESTION PAPER_2025_06TH NOVEMBER_watermark (2)": { name: "WBPDCL 2025 (6 Nov)", examKey: "wbpdcl" },
  "UPSC_DCIO_TECH_2025_QUESTION PAPER": { name: "DCIO (Tech) 2025", examKey: "dcio" },
  "Master question paper paper-2 (answers highlighted)": { name: "Model Question Paper · Paper 2", examKey: "model-papers" }, // CHECK
};

export function describeSource(sourceFile: string): Required<ExamSource> {
  const known = examSources[sourceFile];
  if (known) return { subject: DEFAULT_SUBJECT, ...known };
  return {
    name: sourceFile.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim(),
    examKey: "model-papers",
    subject: DEFAULT_SUBJECT,
  };
}
