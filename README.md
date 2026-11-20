# ShikshakPath: BPSC TRE 4.0 & Bihar STET test series

**ShikshakPath** (शिक्षक पथ, "the teacher's path") is a test series for Bihar's teacher recruitment exams, **BPSC TRE 4.0** and **Bihar STET**, in every subject. Students choose **Exam → Subject → test series**. It is built from real previous-year questions. Computer Science is live; other subjects show "Coming soon" until their questions are uploaded.

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Firebase Phone Auth (OTP) · Firestore · Firebase Storage (PDFs) · Razorpay · Vercel

**What students get:** a landing page with an **Exam → Subject picker**, a **carousel of the real test screens** and a **"prepared by serving teachers"** section · after sign-up they choose **their exams and subjects** and see those test series on their dashboard · they **pay per test series (one exam + one subject)** · BPSC-pattern **mock tests** (mixed from all exams) + **previous-year papers** (one test per real paper, grouped by exam) · real exam interface (timer, palette, mark for review, auto-save, auto-submit, **Exit & resume later**) · score, accuracy, **rank, percentile, topper & average** · answers with explanations · **PYQs with answers & explanations** to read (study mode) · **eBooks** (PDFs: Notes, PYQ, Strategy guides, Others) · **English / हिंदी** switch · exam pages with the official exam logos.

**What the admin gets:** a control panel with a sidebar (**Overview · Upload · Tests · Exams · eBooks · Students · Payments**) · **everything unlocked** (all tests, papers and PDFs, no payment needed) · upload a JSON file → it becomes **one** test: a **mock test** or a **previous-year paper**, as chosen · **edit any question** (text, options, answer key, explanation, Hindi version) · **upload eBooks** (PDFs) · **switch exams on/off** (which exams students see) · free/paid, hide, rename, delete tests (filter by exam, subject, type) · price per test series · students (grant/revoke one test series, or all) · payments.

**Design:** based on the free "Nova" template by [WebScale](https://webscale.pl/), distributed by [ThemeWagon](https://themewagon.com/): cream/ink/copper palette, Satoshi font, pill buttons. The footer keeps a credit line (`siteConfig.themeCredit`), since ThemeWagon's free licence may require it.

---

## 1. Folder structure

```
JSON file/                     your bundled question files (also reads ./cs_questions and the root)
config/
  test-series.config.ts        ← THE config: name, exam pattern, price, FAQs, announcement bar, carousel, business details
  exams.ts                     ← every exam the site knows (34): name, posts, logo; which are shown is set in Admin → Exams
  subjects.ts                  ← the subjects (Computer Science, Mathematics, …)
  exam-sources.ts              ← bundled source_file → paper name + exam
scripts/
  build-question-bank.ts       merge + dedupe bundled files → mock tests + paper tests (npm run build:bank)
  dev-local.mjs                local test mode: Firebase emulators + website in one command
src/
  data/generated/              output of build:bank (bank.json = answers, server-only)
  lib/
    catalog.ts                 live catalogue = bundled tests + Admin uploads (Firestore) + overrides
    admin-catalog.ts           upload, auto-create mocks, free/hide/rename/delete
    question-utils.ts          shared cleaning + duplicate detection (build script and uploads)
    attempts.ts                attempts, scoring, exit/resume, rank & percentile
    resources.ts, ebook-types.ts eBooks (PDFs): Notes, PYQ, Strategy guides, Others
    i18n.ts                    every English / Hindi UI text (add or fix translations here)
    …                          session, access, payments, Razorpay
  components/                  header (Exams & eBooks menus, mobile menu), footer, logo, exam picker, screen carousel,
                               test player, PYQ viewer, eBook covers, cards, admin forms, …
  app/
    (site)/                    pages with header/footer: home, exams (→ subject → series), pyq, ebooks, results, dashboard, admin, about, policies
    attempt/[attemptId]/       full-screen test player
    api/                       auth, tests, attempts, payments, resources, admin
public/exams/                  official exam logos (bpsc.png, bseb.png); see "Exam logos" below
public/screens/                screenshots shown in the landing-page carousel
firestore.rules                deny all direct browser access (everything goes through the server)
storage.rules                  PDFs: no direct downloads; uploads only by the admin, PDF only, < 50 MB
firestore.indexes.json         one index for the admin revenue total
.env.example                   real keys template (copy to .env.local)
```

---

## 2. Run it locally

You need **Node.js 20.9+** (22 recommended).

### A. Quick look (no accounts needed)
```bash
npm install
npm run dev          # builds the question bank, then starts http://localhost:3000
```
The landing page, test list and policy pages work. Login shows "not configured".

### B. The full app with login, on your computer (still no accounts): local test mode
Needs **Java 11+** (`java -version`). One command, one terminal:
```bash
npm run dev:local     # Firebase emulators + website → http://localhost:3000 (emulator UI: http://127.0.0.1:4000)
```
- Log in with **any** 10-digit number. No SMS is sent; **the OTP appears on the login screen** and is filled in for you.
- Log in with **9999999999** to open **/admin**. The admin can open every test, paper and PDF without paying.
- To unlock tests for a student without paying: Admin → Users → **Grant**.
- PDF uploads (Admin → eBooks) go to the local Storage emulator, so no Firebase account is needed for them either.
- Test users and attempts are saved in `.emulator-data/` when you stop with **Ctrl+C**, and loaded next time.
- To try Razorpay checkout locally, put Razorpay **test** keys in `.env.local` (step 4.2). Nothing else is needed there.
- Don't run `npm run dev` and `npm run dev:local` at the same time; they use the same ports.

### C. Against your real Firebase project
Fill in `.env.local` (template: `.env.example`) with the keys from step 4, then run `npm run dev`. Restart `npm run dev` after **any** change to `.env.local`, because keys are read only at start-up. While testing, use Firebase **test phone numbers** (step 4.1.4) so no real SMS is sent.

---

## 3. Exams and subjects (Exam → Subject → test series)

Students first choose the **exam**, then the **subject**, then land on that subject's **test series**:

| Step | Where |
|---|---|
| 1. Exam | the picker on the home page, or `/exams` (BPSC TRE 4.0, Bihar STET) |
| 2. Subject | the picker on the home page, or `/exams/bpsc` |
| 3. Test series | `/exams/bpsc/computer-science`: mock tests and previous papers (tabs), price, the subject's eBooks |

The header's **Exams** menu shows each exam with its subjects. **Test Series** opens the student's last series (remembered in a cookie), or the exam picker the first time. Old links like `/tests?subject=…` still work and forward to the new pages.

### Which exams students see (Admin → Exams)
`config/exams.ts` knows 34 exams. **Admin → Exams** has an on/off switch for each one; by default only **BPSC TRE 4.0** and **Bihar STET** are on (`DEFAULT_ENABLED_EXAMS`). Switched-on exams appear in the menus, the home page, `/exams` and the footer.
- Switching an exam **off** hides it, with all its tests, from students. Past results keep working, and the admin can still open everything.
- You can upload papers for an exam that is off; they appear when you switch the exam on.

### Every exam is independent
Each exam has its **own questions, mock tests, previous papers and pattern**. Nothing is shared between exams: a question uploaded to Bihar STET is a separate question from the same text in BPSC TRE 4.0, and each exam + subject has its own pool and its own mock numbering.

- **All current content belongs to BPSC TRE 4.0** (`buildConfig.exam = "bpsc"`): the 2,950 questions, 37 Computer Science mock tests and 39 previous-year papers. Each paper keeps the exam it was originally asked in, shown as **"Asked in NTA UGC NET"** and so on. Bihar STET (and every other exam) shows **Coming soon** until you upload its papers.
- **Pattern per exam** (`examPatterns` in `config/test-series.config.ts`): time, marks, negative marking, Option E and **sections** with their number of questions. BPSC TRE 4.0: 80 questions / 80 min / −⅓ / Option E (the subject section). Bihar STET: 150 questions / 150 min / no negative marking, in two sections (Subject 100 + Teaching Aptitude & General Studies 50). All values are marked ⚠ CONFIRM. Exams without an entry use `defaultPattern`.
- **Sections:** put a question in a section with `"section": "aptitude"` (the section key or its name) in the JSON. Questions without one go to the first section; an unknown section is reported as invalid. In a test, multi-section papers show **section tabs** above the question and a palette grouped by section; the result shows **performance by section**. A section can have its own `marks` / `negative`.
- **Mock tests** come from uploads marked **Mock test** (one file = one mock, numbered after the existing mocks of that exam + subject). Optionally, **Build mixed mock** (Admin → Upload) makes mocks from previous-paper questions that are in no mock yet, following the exam's sections (e.g. STET: 100 subject + 50 aptitude). The first mock of a new exam + subject is free.
- Marking, Option E and sections are **saved with each attempt** when it starts, so changing a pattern later never changes old results.
- To add full-length BPSC mocks later (Language 30 + General Studies 40 + Subject 80): upload those questions with `"section": "gs"` / `"section": "language"`, add the sections to `examPatterns.bpsc` and set its `durationMinutes` to 150.

### Exam logos
Put a logo in `public/exams/` and set `logo: "/exams/<file>"` on the exam in `config/exams.ts`; without one a lettered badge is shown. The BPSC and BSEB logos were taken from their official websites (bpsc.bihar.gov.in, bsebstet.org).

**⚠ Legal check before launch:** the BPSC logo contains the **State Emblem of India**. The State Emblem of India (Prohibition of Improper Use) Act, 2005 forbids using it for trade or business or in a way that suggests a link with the government. A paid site showing it may be at risk even with a disclaimer. The footer says the site is not affiliated with BPSC or BSEB and that the logos belong to their owners. That reduces confusion but may not be enough. Get advice, or remove the logo: delete the `logo` line of that exam to show a lettered badge instead.

### Subjects

- The subject list is in `config/subjects.ts` (Computer Science, Mathematics, Physics, Chemistry, Biology, English, Hindi, Sanskrit, Urdu, History, Geography, Political Science, Economics, Commerce, Home Science, Music, Fine Arts, Physical Education, General Studies, Pedagogy). Add or remove subjects there.
- A subject becomes **live** as soon as it has a test. Until then it shows **Coming soon**, and its pages are hidden from search engines.
- Exams that only test some subjects (ISRO, BEL, Programmer… = Computer Science only) list them in `subjects` in `config/exams.ts`; the upload form enforces it.
- Every question, paper and mock belongs to one exam and one subject. Duplicates are matched within the same exam + subject only, and mock tests never mix subjects or exams.
- One payment unlocks **one test series = one exam + one subject** (see 3f).

## 3b. Adding question papers

### Recommended: upload from the Admin page (no code, no redeploy)
**Admin → Upload**
1. **What is this file?** **Mock test / practice set** (shown only under *Mock tests*) or **Previous-year paper (PYQ)** (shown only under *Previous papers* and on the PYQ pages). A file name with "practice", "mock", "model" or "set 1" suggests *Mock test*.
2. Pick the **exam** (BPSC TRE 4.0, Bihar STET, …; exams that are switched off are listed separately) and the **subject**.
3. Choose the `.json` file (an array of `question`, `options` A–D, `answer`, `explanation`), check the name (filled in from `source_file`), year (papers only), time limit (mocks: the exam pattern's time by default) and free/paid. Click **Upload & create**. Then:
   - the file becomes **exactly one test**, at once. Nothing is created twice;
   - questions already in the bank are recognised (same text + ≥50% same options) and linked, not duplicated;
   - the **first mock test** of a new exam + subject is made **free** automatically, so students can try the series (make it paid under Tests if you want);
   - existing tests are **never reshuffled**.
4. The report shows how many questions were accepted, skipped (with the reason), already known or new, and whether the test is free.

The **Uploaded files** list shows each upload with its type (**Mock Test N** / **Previous paper**), a **Make it a mock test / Make it a previous paper** switch, and the test buttons. **Mixed mocks (optional):** previous-paper questions that are in no mock are listed per exam + subject; **Build mixed mock** turns them into mocks (students then see those questions both in the paper and in the mock).

**Fixing older uploads that appeared twice.** Before this version every upload became a previous paper **and** its new questions were put into an automatic mock, so practice sets showed up in both tabs. For each such upload click **Make it a mock test** (or keep it a paper and delete the extra mock under **Tests**). *Make it a mock test* also removes the automatic mocks that contain its questions.

**Admin → Tests** lists every test with filters (exam, subject, type, search) and **Make free / Make paid**, **Hide / Show**, **Rename**, **Delete** (uploads and mixed mocks). Deleting a paper is refused while its questions are used in a mixed mock; delete that mock first, or hide the paper. Uploads are stored in Firestore, so they work on Vercel (whose disk is read-only). One file can hold up to ~900 KB (≈1,000 questions).

### Hindi version of questions (optional)
Any question, in a bundled file or an upload, can carry its Hindi text next to the English:
```json
{
  "question": "Which layer of the OSI model handles routing?",
  "options": { "A": "Data link", "B": "Network", "C": "Transport", "D": "Session" },
  "answer": "B",
  "explanation": "Routing is done at the Network layer (Layer 3).",
  "question_hi": "OSI मॉडल की कौन-सी परत रूटिंग करती है?",
  "options_hi": { "A": "डेटा लिंक", "B": "नेटवर्क", "C": "ट्रांसपोर्ट", "D": "सेशन" },
  "explanation_hi": "रूटिंग नेटवर्क परत (परत 3) पर होती है।"
}
```
All three `_hi` fields are optional, and so is each option. (You can also add `"section": "…"` to any question; see 3 → Every exam is independent.) Where Hindi is missing, students in हिंदी mode see the English text (the test player adds a small note). The upload report shows how many questions had Hindi. If a later file has the Hindi of a question already in the bank, the Hindi is added to that question.

### Translating the question bank into Hindi
**Mock Test 1 (the free test, 80 questions) is fully bilingual** already: its Hindi is in `translations/hi.json` (question id → Hindi question, options, explanation), which `npm run build:bank` merges into the bundled questions. A question's own `question_hi` fields always win.

To translate the other ~2,870 questions automatically with the Claude API:
```bash
npm run translate:hindi -- --dry-run      # how many are left + rough cost, no API calls
npm run translate:hindi -- --limit 50     # try a small batch first and check the Hindi on the site
npm run translate:hindi                   # the rest (stop any time with Ctrl+C; run again to continue)
npm run build:bank                        # then restart / redeploy
```
It needs `ANTHROPIC_API_KEY` (from console.anthropic.com) in the environment, uses Claude Opus 5.5 at low effort (set `TRANSLATE_MODEL` to choose another model), keeps code, numbers and formulas unchanged, and writes `translations/hi.json` after every batch. The dry run estimates about **$17** for the rest with Claude Opus 5.5 (a rough figure; the real cost is printed as it runs). If a safety check declines a batch, the API retries it on a fallback model automatically (server-side fallback is switched on). **Have a Hindi-speaking teacher spot-check the result**, and fix any question with **✎ Edit** on its PYQ page.

### Correcting a question (admin)
Open any paper under **PYQs** while logged in as admin. Every question has **✎ Edit**: change the text, options, **answer key** or explanation, or add the Hindi version, then **Save**. The change applies at once (within 30 s on every server) to the PYQ page, every test that contains the question, and every attempt submitted after it. Results already submitted keep the grading they had. Use this to fix the answer-key conflicts that `npm run build:bank` warns about.

### Bundled files (in the repo)
The 43 files in `JSON file/` are built into the site by `npm run build:bank` (runs automatically before `dev` and `build`). Adding files there needs a redeploy and **reshuffles the bundled mock tests**, so prefer the Admin upload. Past results stay correct either way: each attempt stores its own question list and grading.

### Settings

| What | Where | Then |
|---|---|---|
| Each exam's pattern: sections and questions per mock, time, marks, negative marking, Option E | `config/test-series.config.ts` → `examPatterns` | restart / redeploy |
| Which exam the bundled JSON files belong to | `buildConfig.exam` | `npm run build:bank` |
| Free mock tests, free papers, minutes per question for papers, shuffle seed | `config/test-series.config.ts` → `buildConfig` | `npm run build:bank` |
| Which exams students see | Admin → Exams | instant |
| The exam list itself (names, posts, logos) | `config/exams.ts` | restart / redeploy |
| Site name and logo | `siteConfig.name` / `siteConfig.logo` in `config/test-series.config.ts`; the mark is drawn in `src/components/logo.tsx` and `src/app/icon.svg` | restart / redeploy |
| Landing-page carousel (screenshots and captions) | `carouselConfig` in `config/test-series.config.ts`; images in `public/screens/` | restart / redeploy |
| Names of the bundled papers | `config/exam-sources.ts` | restart / redeploy |
| Price | Admin → Overview | instant |
| Announcement bar, social links, FAQs (English + Hindi), book prices, business details | `config/test-series.config.ts` | restart / redeploy |
| Allow students to Exit a test and resume later | `config/test-series.config.ts` → `playerConfig.allowPauseAndResume` | restart / redeploy |
| Questions shown as a free preview of a locked PYQ paper, max PDF size | `config/test-series.config.ts` → `libraryConfig` | restart / redeploy |
| Website texts in English and Hindi (including the welcome pop-up, keys `wm.*`) | `src/lib/i18n.ts` | restart / redeploy |

The build report lists duplicates removed, invalid questions skipped, unknown `source_file` names, and duplicates whose answer keys disagree. **Read the warnings.**

## 3c. PYQs and eBooks

The header has **Exams ▾ · Test Series · PYQs · eBooks ▾**. The eBooks menu has **Notes · PYQ · Strategy guides · Others**.

- **PYQs** (`/pyq`): every previous-year paper as a page to read, with **Show answer** and the explanation under each question. Free papers are fully open to logged-in students. Locked papers show the first 5 questions (`libraryConfig.pyqPreviewQuestions`) and an **Unlock** button. A logged-out visitor sees the preview and **Log in to read**. Each paper also has **Practise as a timed test**.
- **eBooks** (`/ebooks`, `/ebooks/notes`, `/ebooks/pyq`, `/ebooks/strategy`, `/ebooks/others`): PDFs uploaded by the admin, shown as book covers and filterable by subject. Students open them in the browser. The old addresses `/notes` and `/strategy` redirect here.

**Uploading a PDF:** Admin → **eBooks** → **Choose a PDF** (max 50 MB), pick the type (**Notes**, **PYQ (PDF)**, **Strategy guide** or **Others**), enter a title, and optionally an author/expert (shown as "By …"), subject, exam and short description. Tick **Free for every logged-in student** or leave it paid → **Upload PDF**. The table below the form has **Make free / Make paid**, **Hide / Show** and **Delete** (removes the file too).

**Who can open a PDF:** free PDFs → anyone logged in; paid PDFs with an exam + subject → students who unlocked that test series; paid PDFs with only a subject → students who unlocked any series of that subject; paid PDFs with neither → students who unlocked any series. The admin can open all. The file is never public: the server checks access and then hands out a link that expires after 10 minutes, so a shared link stops working.

PDF uploads need Firebase Storage (step 4.1, items 12–14). In local test mode (`npm run dev:local`) they work without it.

### Landing-page carousel
The home page shows real screenshots of the test screens (`public/screens/*.webp`): the desktop player, the same question in Hindi, the mobile player, the result with rank, the answers with explanations, and the Exit dialog. Captions (English + Hindi) and the order are in `carouselConfig`. After a redesign, take new screenshots (desktop 1440 × 900, phone 390 × 844, e.g. with the browser's device toolbar), save them as WebP under the same names, and redeploy.

### Welcome pop-up
Visitors who haven't unlocked any test series get a pop-up on the home page a second after it opens: a greeting (good morning / afternoon / evening, *Namaste! Welcome to ShikshakPath*), **Attempt the free mock test** (opens the first free mock) and the case for buying with **Choose exam & subject · ₹… each** (visitors: the exam picker; logged-in students: their dashboard). It shows once; after it is closed it comes back after 3 days at most. Students who unlocked a series never see it. Texts: `wm.*` in `src/lib/i18n.ts`; timing: `src/components/welcome-modal.tsx`.

## 3d. Exit & resume, and English / हिंदी

- **Exit:** in a test, **Exit** saves every answer and **pauses the timer**. The test then shows **Resume paused test** on its page and as **Paused** on the dashboard. Resuming continues with the time that was left; time spent away isn't counted. To turn this off (strict exam mode, where the timer keeps running), set `playerConfig.allowPauseAndResume = false`. Exit then still saves the answers.
- **Language:** the **EN | हिं** switch is in the header, the mobile menu and the test player. The choice is remembered (cookie `lang`). It translates the website, and also questions, options and explanations wherever their Hindi version exists (see 3b → Hindi version).

---

## 3e. Demo accounts (local test mode)
With `npm run dev:local` running, run this in a second terminal:
```bash
npm run seed:demo
```
It creates five demo students (running it again changes nothing). Log in at `/login` with the number; in local test mode no SMS is sent, and the OTP appears on the screen.

| Mobile number | Account |
|---|---|
| 9000000001 | Brand-new student: is asked for exams & subjects right after login |
| 9000000002 | Free student (BPSC TRE 4.0 · Computer Science): took the free Mock Test 1 |
| 9000000003 | Paid student: unlocked BPSC TRE 4.0 · Computer Science (Bihar STET · CS shown locked); Mock Tests 1 and 2 and a PYQ paper done |
| 9000000004 | Paid student (BPSC TRE 4.0 · Computer Science): Mock Test 2 paused half-way (shows **Resume**) |
| 9000000005 | All-access student, topper: high score in Mock Test 1 |
| 9999999999 | Admin (from `ADMIN_PHONES`) |

The demo data is kept only if you stop `npm run dev:local` with **Ctrl+C**; otherwise run `npm run seed:demo` again. Accounts seeded by an older version keep their tests and full access; running `npm run seed:demo` again sets their exams & subjects so they skip the onboarding screen. On the real site there is no seed script: add the numbers in Firebase → Authentication → Phone → **Phone numbers for testing** with fixed codes, log in with them, and give access with Admin → Students (**+ series… → Grant**, or **Grant all**).

## 3f. Exams & subjects after sign-up, and paying per test series

- **Onboarding:** right after the first login a student is asked **which exams and subjects they are preparing for** (`/onboarding`; several can be ticked). They can change it any time (Dashboard → **Edit exams & subjects**, or the account menu → **My exams & subjects**).
- **Dashboard → My test series** shows a card per chosen exam + subject: mocks, papers, questions, **Unlocked / Locked**, and an **Unlock for ₹…** button on each locked one. Everything stays visible; paid tests open only after paying.
- **One payment = one test series** (one exam + one subject), at the price set in Admin → Overview. It unlocks that series' mock tests, previous papers, PYQ pages and paid eBooks. Several series are bought separately and each opens on its own. The first mock of every series is free.
- Orders from older versions (before per-series pricing) and **Grant all** in Admin → Students still give access to everything.
- Admin → Students shows each student's chosen exams & subjects and unlocked series, with **+ series… → Grant**, **×** (revoke one) and **Grant all / Revoke all**. Admin → Payments shows the series of each order.

## 3g. "Prepared by serving teachers" (home page)

The home page has a badge in the hero, a section and a pricing line saying that every mock test and question is prepared by **10 teachers already serving in Bihar's schools, as per the BPSC standard**, with four steps (written by subject teachers, matched to the BPSC syllabus, cross-checked before going live, explained answers). Settings: `expertsConfig` in `config/test-series.config.ts` (`teacherCount`, `enabled`, and optional `members`: name, subject, school, years, shown as cards). Texts: `home.exp*`, `home.trustExperts`, `pc.f.experts`, `wm.bExperts` in `src/lib/i18n.ts`.

**⚠ This must be true.** Set `teacherCount` to the real size of your panel, change the four steps to what your teachers actually do, or set `enabled: false`. A false claim in an advertisement breaks the Consumer Protection Act 2019 (misleading advertisement) and the ASCI code. Add real names or photos only with each teacher's written consent, and check whether a government teacher's service rules allow paid outside work before naming them.

## 4. Accounts and keys you need

| Account | Why | Cost |
|---|---|---|
| **Firebase** (Google account) | Phone OTP login + Firestore database + Storage for PDFs | Real SMS needs the **Blaze (pay-as-you-go)** plan; SMS is charged per message. Firestore and Storage have free quotas (Storage: only in US bucket locations, see 4.1.12). |
| **Razorpay** | UPI / card payments | Free to sign up. Fee per successful payment (~2%). **KYC** needed for live mode. |
| **Vercel** | Hosting | Hobby plan is free but **non-commercial only**. A paid test series needs **Pro**. |
| **GitHub** | Vercel deploys from a repo | Free (use a **private** repo; it contains your question bank) |
| Domain (optional) | e.g. `cstestseries.in` | ~₹500–1,000/yr. Looks more trustworthy and helps Razorpay approval. |

### 4.1 Firebase setup
1. https://console.firebase.google.com → **Add project** (Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Phone → Enable.**
3. **Upgrade to Blaze** (bottom-left, *Upgrade*). Set a **budget alert** in Google Cloud Billing (e.g. ₹500).
4. *Testing without SMS:* Phone provider → **Phone numbers for testing** → add e.g. `+91 9999999999` / code `123456`.
5. **Authentication → Settings → SMS region policy → Allow only India.** This blocks SMS-fraud traffic to other countries.
6. **Authentication → Settings → Authorized domains** → add your Vercel domain (`your-app.vercel.app`) and custom domain.
7. **Build → Firestore Database → Create database** → location **asia-south1 (Mumbai)** → *Production mode*.
8. Firestore → **Rules** tab → paste the contents of `firestore.rules` → *Publish*.
9. Firestore → **Indexes → Composite → Add index**: collection `payments`, fields `status` Ascending, `amount` Ascending. Or, with the Firebase CLI: `npx firebase-tools deploy --only firestore`.
10. **Project settings → General → Your apps → Web (</>)** → register app → copy `apiKey`, `authDomain`, `projectId`, `appId` → the `NEXT_PUBLIC_FIREBASE_*` variables.
11. **Project settings → Service accounts → Generate new private key** → from the downloaded JSON copy `project_id`, `client_email`, `private_key` → `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. **Never commit this file.**
12. **Build → Storage → Get started** → *Production mode*. This needs the Blaze plan (step 3). Location: Firebase's free Storage quota applies only to buckets in `us-central1`, `us-east1` or `us-west1`. `asia-south1` (Mumbai) is faster for students in India, but all its usage is billed. For a few hundred PDFs either choice costs little.
13. Storage → **Rules** tab → paste the contents of `storage.rules` → *Publish*. Or, with the CLI: `npx firebase-tools deploy --only storage`.
14. Copy the bucket name shown at the top of the Storage page (e.g. `your-project-id.firebasestorage.app`, without `gs://`) into **both** `FIREBASE_STORAGE_BUCKET` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.

### 4.2 Razorpay setup
1. Sign up at https://dashboard.razorpay.com. Start in **Test mode**.
2. **Account & Settings → API Keys → Generate key** → `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET`.
3. **Account & Settings → Webhooks → Add new webhook** (after you deploy):
   - URL: `https://YOUR-DOMAIN/api/payments/webhook`
   - Secret: any long random string → `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `order.paid`, `payment.failed`
4. Test cards / UPI: Razorpay docs → "Test card details" (e.g. UPI id `success@razorpay`).
5. **Going live:** complete KYC (PAN, bank account, website URL). Razorpay checks that your site has **Contact, Terms, Privacy and Refund pages**; they're at `/policies/*`. Fill in `siteConfig.business` first. Then generate **live** keys (`rzp_live_…`), replace the env vars, and add the webhook again in live mode.

### 4.3 Admin
Set `ADMIN_PHONES` to your own mobile number(s), comma-separated (e.g. `+919876543210,+919812345678`). Log in with that number and open **/admin**.

---

## 5. Deploy to Vercel

1. Put the project in a **private** GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "ShikshakPath test series"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/cs-test-series.git
   git push -u origin main
   ```
   `.env.local` and `src/data/generated/` are git-ignored. The question JSON files **are** committed, because Vercel rebuilds the bank from them.
2. https://vercel.com/new → **Import** the repo. Framework: Next.js (auto-detected). Leave build settings at their defaults.
3. **Environment Variables:** add every variable from `.env.example` with your real values.
   - For `FIREBASE_PRIVATE_KEY`, paste the whole key **including** `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`. Both real newlines and `\n` work.
   - Do **not** add any `*_EMULATOR_HOST` variables on Vercel.
4. **Deploy.** The build runs `npm run build:bank`, then `next build`. Functions run in Mumbai (`vercel.json` → `bom1`).
5. After the first deploy:
   - Firebase → Authentication → Settings → **Authorized domains** → add the `*.vercel.app` domain (and your custom domain).
   - Razorpay → add the webhook URL (step 4.2.3).
   - Optional: Vercel → Project → Settings → **Domains** → add your custom domain.
6. Every `git push` redeploys automatically.

### Go-live checklist
- [ ] Decide on the exam logos (see "Exam logos": the BPSC logo contains the State Emblem of India)
- [ ] Upload BPSC TRE / Bihar STET papers, and switch on in Admin → Exams any other exam whose papers you want to show
- [ ] Confirm every `⚠ CONFIRM` value in `config/test-series.config.ts` against the official BPSC notification
- [ ] Check the names marked `CHECK` in `config/exam-sources.ts`, and the CS post descriptions in `config/exams.ts`
- [ ] Rewrite the About page (`src/app/(site)/about/page.tsx`) in your own words; set the announcement bar and social links
- [ ] Keep the Nova/ThemeWagon credit in the footer unless the template author allows removal
- [ ] Review the duplicate-answer warnings printed by `npm run build:bank`
- [ ] Fill in `siteConfig.business` and read the policy pages
- [ ] Update `landingConfig.bookComparison` to real book prices
- [ ] Firebase on Blaze, SMS region policy = India, budget alert set
- [ ] Firestore rules published and the payments index created
- [ ] Storage enabled, `storage.rules` published, both bucket variables set; one PDF uploaded and opened as a student
- [ ] Razorpay live keys and live webhook configured
- [ ] One real ₹ payment end-to-end, then refund it from the Razorpay dashboard and revoke access in /admin

---

## 6. How the security works

- **Answers never reach the browser before submission.** The question bank (`bank.json` and uploaded papers in Firestore) is read only by server code marked `server-only`; the build fails if browser code imports it. During a test the browser receives only question text and options. Answers and explanations are sent only by the result page, after submission.
- **The PYQ reading pages are separate from tests.** A paper's PYQ page shows answers by design, so a student could read a paper before taking it as a test. To keep a paper "unseen", leave it paid: then only the 5-question preview is open to students who have not unlocked its test series.
- **Admin actions** (upload, question edits, PDFs, test settings, price, access) check the admin's phone against `ADMIN_PHONES` on the server, including a check that the session wasn't revoked. To everyone else `/admin` is a 404.
- **PDFs:** the Storage bucket allows no direct reads. Uploads are allowed only with a short-lived admin-only sign-in the server issues, and only for PDF files under 50 MB. Downloads go through `/api/resources/{id}/file`, which checks access and then redirects to a signed link that expires after 10 minutes.
- **Exit & resume:** the remaining time is stored on the server when a test is paused, and the deadline is reset on the server when it is resumed. The browser can't add time.
- **Grading happens on the server.** Answers sent after the deadline (plus a 30 s grace period) are ignored; the last answers saved before time ran out are graded instead.
- **Paid access is checked on the server** every time a test starts or opens. Locks shown in the browser are only for display.
- **Payments:** the price comes from the server. The checkout result is accepted only if the HMAC-SHA256 signature `order_id|payment_id` matches your key secret **and** the order belongs to the logged-in user. The webhook (also signature-checked) unlocks access if the student closes the page right after paying.
- **Login:** Firebase verifies the OTP. The server turns the result into a 14-day **httpOnly, SameSite=Lax** session cookie. Firestore rules deny all direct browser access.

## 7. Data model (Firestore)

```
users/{uid}                   phone, createdAt, lastLoginAt, interests [{exam, subject}], onboardedAt,
                              passes { "<exam>__<subject>": {exam, subject, paidAt, orderId | grantedBy} },
                              paid, paidAt, paidOrderId (older all-access orders and "Grant all")
users/{uid}/attempts/{id}     testId, status, questionIds, startedAt, deadlineAt, answers, marked,
                              visited, current, savedAt, submittedAt, timeTakenSec, result, graded,
                              pausedAt + remainingMs (only while paused with Exit),
                              examKey, pattern (marking, Option E and sections when it started)
users/{uid}/active/{testId}   attemptId of the running attempt (prevents duplicates)
payments/{razorpayOrderId}    uid, phone, exam, subject, amount (paise), status created|paid|failed, paymentId, verifiedVia
settings/app                  priceInPaise (price of one test series)
uploads/{id}                  one uploaded file = one test: title, kind mock|paper (older: paper), examKey, subject, year, free, durationMinutes, questions[]
catalog/mocks                 mixed mocks built from previous-paper questions ("Build mixed mock"), per exam + subject, with their sections
                              (BPSC TRE CS: "38", "39"…; BPSC TRE other subjects: "m-mathematics-1"…; other exams: "m-bseb-stet-computer-science-1"…)
catalog/overrides             { [testId]: { free, hidden, title } } set from the admin table
catalog/exams                 { enabled: [examKey…] } exams shown to students (Admin → Exams)
catalog/meta                  version, bumped on every change so all servers reload within 30 s
questionEdits/{questionId}    admin corrections: question, options, answer, explanation, hi {question, options, explanation}
resources/{id}                eBook PDF: type notes|pyq|strategy|others, title, description, author, subject, examKey, free, hidden,
                              storagePath, fileName, size, createdAt, uploadedBy
leaderboards/{testId}/entries/{uid}   first-attempt score → rank, percentile, topper, average
```
Storage: `resources/{uuid}.pdf`, one file per PDF.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| "Login is not configured yet" | Locally: use `npm run dev:local`. With real keys: check `.env.local`, then **restart** `npm run dev` (keys are read only at start-up). On Vercel: add the env vars and **redeploy**. |
| `auth/billing-not-enabled` | Upgrade Firebase to Blaze, or use a test phone number. |
| `auth/unauthorized-domain` | Add the domain in Firebase → Authentication → Settings → Authorized domains. |
| `auth/captcha-check-failed` | Same as above; also check that ad-blockers aren't blocking Google reCAPTCHA. |
| Login works locally but not on Vercel | Check the `FIREBASE_PRIVATE_KEY` format and that all env vars are set for *Production*; redeploy after changing env vars. |
| "Payments are not configured" | Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. |
| Admin revenue shows "index needed" | Create the `payments (status, amount)` composite index (step 4.1.9). |
| Paid but still locked | It unlocks via the webhook within a minute; otherwise Admin → search the number → **Grant**. |
| An exam page or paper shows "404" | The exam is switched off: Admin → Exams. |
| "File storage is not configured" (Admin → eBooks) | Do step 4.1, items 12–14, then restart / redeploy. |
| PDF upload fails with "unauthorized" or 403 | Publish `storage.rules` (step 4.1.13) and check that both bucket variables hold the same bucket name. |
| Some Hindi text still in English | That question has no `_hi` fields yet: add them in the JSON, or use **✎ Edit** on its PYQ page. Website texts are in `src/lib/i18n.ts`. |
