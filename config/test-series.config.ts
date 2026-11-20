/**
 * ───────────────────────────────────────────────────────────────────────────
 *  ShikshakPath (BPSC TRE & Bihar STET test series): the ONE file to edit.
 *
 *  After changing `examPattern` or `buildConfig`, regenerate the tests:
 *      npm run build:bank
 *  (This also runs automatically before `npm run dev` and `npm run build`.)
 * ───────────────────────────────────────────────────────────────────────────
 */

export const siteConfig = {
  // Brand name: "ShikshakPath" (शिक्षक पथ = "the teacher's path"). Shown in the header,
  // footer, browser tab, payment window and policies. Change all four lines together.
  name: "ShikshakPath",
  shortName: "ShikshakPath",
  targetExam: "BPSC TRE 4.0 & Bihar STET Test Series",
  tagline:
    "Bihar's teacher-recruitment test series: BPSC TRE 4.0 and Bihar STET mock tests, previous-year questions with explanations and eBooks, subject by subject.",

  // Header/footer wordmark: `title` + `accent` (in copper), with `subtitle` underneath.
  // The book-and-path mark itself is drawn in src/components/logo.tsx (and src/app/icon.svg).
  logo: { title: "Shikshak", accent: "Path", subtitle: "BPSC TRE · Bihar STET" },

  // ⚠ FILL IN before going live. Razorpay's website check looks for these on
  //   the Contact / Terms / Refund / Privacy pages.
  business: {
    legalName: "Your Name or Business Name",
    email: "rupam@srmecotech.com",
    phone: "+91 7992472144",
    address: "Kankar Bhagh, Patna, Bihar - 800001",
  },

  // Thin dark strip above the header. Set `text` to "" to hide it.
  announcement: {
    text: "BPSC TRE 4.0 & Bihar STET test series is live. The first mock test of every subject is free.",
    textHi: "BPSC TRE 4.0 और बिहार STET टेस्ट सीरीज़ लाइव है। हर विषय का पहला मॉक टेस्ट मुफ़्त है।",
    cta: "Start free test",
    href: "/exams",
  },

  // Footer social links. Leave "" to hide an icon.
  social: {
    youtube: "",
    telegram: "",
    instagram: "",
    whatsapp: "",
  },

  // The design is based on the free "Nova" template (WebScale, distributed by ThemeWagon).
  // ThemeWagon's free licence may require this credit; keep it unless the author allows removal.
  themeCredit: true,
};

/**
 * EXAM PATTERNS: every exam is independent, with its own questions, mock tests and pattern.
 *
 * A pattern describes ONE mock test of that exam:
 *   - `sections`: the parts of the paper, in order, with the number of questions of each.
 *     Questions are put in a section by the "section" field in the uploaded JSON
 *     (e.g. "section": "aptitude"); questions without one go to the FIRST section.
 *     A section `name` may contain {subject}, replaced by the subject the student chose.
 *     A section can override the marking with `marks` / `negative`.
 *   - Each uploaded JSON file becomes ONE test: a mock test or a previous-year paper (the
 *     admin chooses). Mock uploads get this pattern's time by default. Optionally, Admin →
 *     Upload → "Build mixed mock" makes mocks from previous-paper questions in no mock yet.
 *   - Marking, time and Option E are saved with each attempt, so changing them later
 *     never changes old results.
 * Exams without an entry here use `defaultPattern`.
 */
export type SectionPattern = { key: string; name: string; nameHi: string; questions: number; marks?: number; negative?: number };
export type ExamPattern = {
  name: string; // shown on the instructions page, e.g. "BPSC TRE 4.0 pattern"
  durationMinutes: number; // time for one full mock test (all sections)
  marksPerQuestion: number;
  negativeMarksPerWrong: number; // 0 = no negative marking
  optionE: { enabled: boolean; label: string; blankPenalty: number };
  sections: SectionPattern[];
};

/**
 * ⚠ CONFIRM every number against the official notifications before launch.
 *
 * BPSC TRE 4.0 (https://bpsc.bihar.gov.in): reported by coaching sites, Aug–Oct 2026:
 *   the full paper is 150 questions / 2 h 30 min (Language 30 + General Studies 40 +
 *   Subject 80), −1/3 per wrong answer, and "Option E" (a 5th choice "Question not
 *   attempted"; leaving all options blank also costs 1/3). The site has subject
 *   questions only, so a mock = the 80-question subject section. When you upload
 *   General Studies / Language questions (with "section": "gs" / "language"), add those
 *   sections below and set durationMinutes to 150 for full-length mocks.
 *
 * Bihar STET (BSEB): reported for 2024: 150 questions, 150 marks, 2 h 30 min, no
 *   negative marking; about 100 questions on the subject and 50 on teaching aptitude /
 *   general topics (sources differ on the exact split).
 */
export const examPatterns: Record<string, ExamPattern> = {
  bpsc: {
    name: "BPSC TRE 4.0 pattern",
    durationMinutes: 80, // ⚠ CONFIRM: 1 minute per question, the real exam pace
    marksPerQuestion: 1, // ⚠ CONFIRM
    negativeMarksPerWrong: 1 / 3, // ⚠ CONFIRM: set to 0 for no negative marking
    optionE: {
      enabled: true, // ⚠ CONFIRM: set false to hide the "E" choice entirely
      label: "Question not attempted",
      blankPenalty: 1 / 3, // ⚠ CONFIRM: marks lost for leaving a question fully blank
    },
    sections: [{ key: "subject", name: "{subject}", nameHi: "{subject}", questions: 80 }],
  },
  "bseb-stet": {
    name: "Bihar STET pattern",
    durationMinutes: 150, // ⚠ CONFIRM
    marksPerQuestion: 1, // ⚠ CONFIRM
    negativeMarksPerWrong: 0, // ⚠ CONFIRM: reported as no negative marking
    optionE: { enabled: false, label: "Question not attempted", blankPenalty: 0 },
    sections: [
      { key: "subject", name: "{subject}", nameHi: "{subject}", questions: 100 }, // ⚠ CONFIRM
      { key: "aptitude", name: "Teaching Aptitude & General Studies", nameHi: "शिक्षण अभिरुचि एवं सामान्य अध्ययन", questions: 50 }, // ⚠ CONFIRM
    ],
  },
};

/** Pattern for exams that have no entry in `examPatterns`. */
export const defaultPattern: ExamPattern = {
  name: "Standard pattern",
  durationMinutes: 100,
  marksPerQuestion: 1,
  negativeMarksPerWrong: 0,
  optionE: { enabled: false, label: "Question not attempted", blankPenalty: 0 },
  sections: [{ key: "subject", name: "{subject}", nameHi: "{subject}", questions: 100 }],
};

export function patternFor(examKey: string | undefined): ExamPattern {
  return (examKey && examPatterns[examKey]) || defaultPattern;
}

/** Questions in one full mock test of this pattern. */
export const questionsPerTest = (p: ExamPattern) => p.sections.reduce((n, s) => n + s.questions, 0);

/** Kept for older code paths: the pattern of the exam the bundled questions belong to (BPSC TRE 4.0). */
export const examPattern = { ...examPatterns.bpsc, questionsPerTest: questionsPerTest(examPatterns.bpsc) };

export const playerConfig = {
  // "Exit" during a test saves the answers. With this on, the timer also PAUSES and the
  // student can resume later with the same time left (practice-friendly).
  // Set false for strict real-exam mode: the timer keeps running after exit.
  allowPauseAndResume: true,
};

export const libraryConfig = {
  // PYQ study mode (/pyq): locked papers show this many questions with answers as a preview.
  pyqPreviewQuestions: 5,
  // Largest PDF (Notes / Strategy guides) the admin can upload, in MB.
  maxPdfMb: 50,
};

/**
 * Landing-page carousel: screenshots of the real test screens (files in public/screens/).
 * Retake them after a redesign with the script described in README → "Landing carousel".
 */
export const carouselConfig = {
  autoplaySeconds: 5,
  slides: [
    { src: "/screens/player-desktop.webp", w: 1440, h: 900, frame: "browser", title: "Real exam interface", titleHi: "असली परीक्षा जैसा इंटरफ़ेस", text: "Timer, question palette, mark for review and Option E, exactly like the BPSC computer-based test.", textHi: "टाइमर, प्रश्न पैलेट, रिव्यू के लिए मार्क और विकल्प E, बिल्कुल BPSC की कंप्यूटर आधारित परीक्षा जैसा।" },
    { src: "/screens/player-hindi.webp", w: 1440, h: 900, frame: "browser", title: "Questions in हिंदी & English", titleHi: "प्रश्न हिंदी और English में", text: "Switch any question between Hindi and English with one tap, even in the middle of a test.", textHi: "टेस्ट के बीच में भी, एक टैप में किसी भी प्रश्न को हिंदी और English में बदलें।" },
    { src: "/screens/player-mobile.webp", w: 390, h: 844, frame: "phone", title: "Practise on your phone", titleHi: "फ़ोन पर अभ्यास करें", text: "The full test screen works on any phone, with auto-save after every answer.", textHi: "पूरी टेस्ट स्क्रीन किसी भी फ़ोन पर चलती है, हर उत्तर के बाद ऑटो-सेव के साथ।" },
    { src: "/screens/result-desktop.webp", w: 1440, h: 900, frame: "browser", title: "Score, rank & percentile", titleHi: "स्कोर, रैंक और पर्सेंटाइल", text: "See where you stand among all students the moment you submit.", textHi: "सबमिट करते ही जानें कि सभी छात्रों में आप कहाँ हैं।" },
    { src: "/screens/solutions-desktop.webp", w: 1440, h: 900, frame: "browser", title: "Answers with explanations", titleHi: "उत्तर व्याख्या सहित", text: "Every question with the correct answer, your answer and a clear explanation.", textHi: "हर प्रश्न का सही उत्तर, आपका उत्तर और स्पष्ट व्याख्या।" },
    { src: "/screens/exit-desktop.webp", w: 1440, h: 900, frame: "browser", title: "Exit & resume any time", titleHi: "कभी भी बाहर निकलें, फिर शुरू करें", text: "Leave mid-test: your answers are saved and the timer pauses until you return.", textHi: "बीच में टेस्ट छोड़ें: उत्तर सेव रहते हैं और लौटने तक टाइमर रुका रहता है।" },
  ],
};

export const buildConfig = {
  // The exam (series) the bundled question files belong to. All their mock tests and
  // previous-year papers are part of this exam's test series; each paper still shows the
  // exam it was originally asked in ("Asked in: UGC NET June 2026").
  exam: "bpsc",

  // Folders scanned for question files (in this order). Missing folders are skipped.
  // Only JSON files shaped like [{ question, options, answer, ... }] are read.
  inputDirs: ["JSON file", "cs_questions", "."],

  // Changing the seed reshuffles which questions land in which test.
  seed: "bpsc-tre-4.0",

  // The first N mock tests are free for every logged-in user.
  freeTests: 1,

  // Previous-year papers (one test per paper) that are free. Use the paper name from
  // config/exam-sources.ts. You can also switch any test free/paid from the Admin page.
  freePapers: ["UGC NET June 2026"],

  // Time allowed in a previous-year paper test = questions × this (minutes).
  // Default keeps the BPSC pace: durationMinutes / questionsPerTest = 1 min per question.
  paperMinutesPerQuestion: 1,

  // If the leftover questions (after making full tests) are at least this many,
  // they become one shorter final test. Otherwise they are added to the last test.
  minQuestionsForLastTest: 20,

  // Two questions with the same text count as duplicates only if at least this
  // share of their options also match (so generic stems like "Which statement
  // is FALSE?" with different options are kept as separate questions).
  duplicateOptionOverlap: 0.5,
};

export const pricingConfig = {
  // Starting price. The admin page can change it any time (stored in Firestore,
  // which overrides this value).
  defaultPriceInRupees: 199,
  // null = lifetime access. Or a number of days, e.g. 365.
  accessValidityDays: null as number | null,
};

/**
 * Home page "Prepared by serving teachers" section and hero badge.
 * ⚠ MUST BE TRUE. Set `teacherCount` to the real number of teachers on your panel (or
 *   `enabled: false` to hide the section). Advertising a false claim is illegal under the
 *   Consumer Protection Act 2019 and the ASCI code. Add names/photos only with each teacher's consent.
 */
export const expertsConfig = {
  enabled: true,
  teacherCount: 10,
  /** Optional: real panel members, shown as cards. Leave empty to show only the process. */
  members: [] as { name: string; subject: string; school?: string; years?: number }[],
};

export const landingConfig = {
  // ⚠ Approximate prices of buying separate solved-paper books. Update with the
  //   prices you actually see on Amazon / Flipkart / local shops.
  bookComparison: [
    { title: "BPSC TRE subject solved papers (one subject)", price: 450 },
    { title: "Bihar STET Paper I / II guide", price: 400 },
    { title: "BPSC TRE practice sets (mock papers)", price: 350 },
    { title: "Subject notes / one-liner book", price: 300 },
    { title: "Exam strategy & previous-year analysis book", price: 250 },
  ],
  faqs: [
    {
      q: "Which exams and subjects is this for?",
      a: "BPSC TRE 4.0 (school teacher recruitment, classes 1–12) and Bihar STET. After choosing your exam you pick your subject; each subject has its own mock tests, previous-year questions and eBooks. Subjects go live one by one: a subject marked “Coming soon” is being prepared.",
    },
    {
      q: "Are these real exam questions?",
      a: "Yes. The tests are built from real previous-year questions of teacher-recruitment and other government exams, cleaned and de-duplicated, in the BPSC TRE pattern (question count, time and negative marking). Every question shows the exam it was asked in.",
    },
    {
      q: "Do I get answers and explanations?",
      a: "Yes. After you submit a test you see your score, accuracy and time, then every question with the correct answer and an explanation.",
    },
    {
      q: "How do I log in?",
      a: "Only with your mobile number and a one-time password (OTP). No email or password needed.",
    },
    {
      q: "Who prepares the tests?",
      a: "A panel of teachers who are already serving in Bihar's schools prepares and cross-checks every mock test and question as per the BPSC standard: syllabus, difficulty, language and the official pattern.",
    },
    {
      q: "What exactly do I pay for?",
      a: "You pay once per test series: one exam + one subject (for example BPSC TRE 4.0 · Computer Science). It unlocks all mock tests, previous-year papers and paid eBooks of that exam and subject. Preparing for more than one? Unlock each one you need; they all appear on your dashboard.",
    },
    {
      q: "How do I pay? Is it safe?",
      a: "Payments go through Razorpay (UPI, cards, net-banking). We never see your card or UPI PIN. Access unlocks immediately after the payment is verified.",
    },
    {
      q: "Can I try before paying?",
      a: "Yes. The first mock test of every subject is completely free: same pattern, timer, result and explanations as the paid tests.",
    },
    {
      q: "Can I leave a test and continue later?",
      a: "Yes. Press Exit at any time: your answers are saved and the timer pauses. Resume from the test page or your dashboard.",
    },
  ],
  // Hindi version of the FAQs above (shown when the visitor switches to हिंदी).
  faqsHi: [
    {
      q: "यह किन परीक्षाओं और विषयों के लिए है?",
      a: "BPSC TRE 4.0 (विद्यालय शिक्षक भर्ती, कक्षा 1–12) और बिहार STET। परीक्षा चुनने के बाद आप अपना विषय चुनते हैं; हर विषय के अपने मॉक टेस्ट, पिछले वर्षों के प्रश्न और ई-बुक्स हैं। विषय एक-एक करके लाइव होते हैं: “जल्द आ रहा है” वाला विषय तैयार किया जा रहा है।",
    },
    {
      q: "क्या ये असली परीक्षा के प्रश्न हैं?",
      a: "हाँ। टेस्ट शिक्षक भर्ती और अन्य सरकारी परीक्षाओं के असली पिछले वर्षों के प्रश्नों से बने हैं, साफ़ करके और दोहराव हटाकर, BPSC TRE पैटर्न (प्रश्नों की संख्या, समय और नेगेटिव मार्किंग) में। हर प्रश्न के साथ लिखा होता है कि वह किस परीक्षा में पूछा गया था।",
    },
    {
      q: "क्या उत्तर और व्याख्या मिलती है?",
      a: "हाँ। टेस्ट सबमिट करने के बाद आपको स्कोर, सटीकता और समय दिखता है, फिर हर प्रश्न का सही उत्तर और व्याख्या।",
    },
    {
      q: "लॉग इन कैसे करें?",
      a: "केवल अपने मोबाइल नंबर और OTP से। ईमेल या पासवर्ड की ज़रूरत नहीं।",
    },
    {
      q: "टेस्ट कौन तैयार करता है?",
      a: "बिहार के विद्यालयों में पहले से कार्यरत शिक्षकों का पैनल हर मॉक टेस्ट और प्रश्न को BPSC मानक के अनुसार तैयार और जाँचता है: पाठ्यक्रम, कठिनाई स्तर, भाषा और आधिकारिक पैटर्न।",
    },
    {
      q: "मैं किस चीज़ का भुगतान करता/करती हूँ?",
      a: "आप हर टेस्ट सीरीज़ का एक बार भुगतान करते हैं: एक परीक्षा + एक विषय (जैसे BPSC TRE 4.0 · कंप्यूटर विज्ञान)। इससे उस परीक्षा और विषय के सभी मॉक टेस्ट, पिछले वर्षों के पेपर और पेड ई-बुक्स खुल जाते हैं। एक से ज़्यादा की तैयारी? जो चाहिए, हर एक को अनलॉक करें; सब आपके डैशबोर्ड पर दिखेंगे।",
    },
    {
      q: "भुगतान कैसे करें? क्या यह सुरक्षित है?",
      a: "भुगतान Razorpay (UPI, कार्ड, नेट-बैंकिंग) से होता है। हम आपका कार्ड या UPI PIN कभी नहीं देखते। भुगतान सत्यापित होते ही एक्सेस तुरंत खुल जाता है।",
    },
    {
      q: "क्या भुगतान से पहले आज़मा सकते हैं?",
      a: "हाँ। हर विषय का पहला मॉक टेस्ट पूरी तरह मुफ़्त है: वही पैटर्न, टाइमर, परिणाम और व्याख्या जो पेड टेस्ट में है।",
    },
    {
      q: "क्या टेस्ट बीच में छोड़कर बाद में जारी रख सकते हैं?",
      a: "हाँ। कभी भी “बाहर निकलें” दबाएँ: आपके उत्तर सेव रहते हैं और टाइमर रुक जाता है। टेस्ट पेज या डैशबोर्ड से फिर शुरू करें।",
    },
  ],
};
