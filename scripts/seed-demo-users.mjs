/**
 * Create 5 demo student accounts in LOCAL TEST MODE (Firebase emulators), each in a
 * different state, so you can see the site as different students do.
 *
 *   1. Start the site:   npm run dev:local
 *   2. In a 2nd terminal: npm run seed:demo
 *
 * Safe to run again: accounts that already have data are left as they are.
 * Data is kept between runs only if you stop `npm run dev:local` with Ctrl+C.
 * Never point this at a real Firebase project: it signs in through the Auth EMULATOR.
 */
import fs from "node:fs";
import path from "node:path";

const APP = process.env.APP_URL || "http://localhost:3000";
const AUTH = `http://${process.env.AUTH_EMULATOR || "127.0.0.1:9099"}`;
const FS = `http://${process.env.FIRESTORE_EMULATOR || "127.0.0.1:8080"}`;
const PROJECT = process.env.FIREBASE_PROJECT_ID || "demo-cs-test";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "+919999999999";
const J = { "Content-Type": "application/json" };

export const DEMO_USERS = [
  { phone: "+919000000001", role: "Brand-new student: not onboarded yet (is asked for exams & subjects after login)" },
  { phone: "+919000000002", role: "Free student: chose BPSC TRE 4.0 · Computer Science, took the free Mock Test 1" },
  { phone: "+919000000003", role: "Paid student: unlocked BPSC TRE 4.0 · Computer Science (STET · CS still locked); 2 mocks + 1 PYQ done" },
  { phone: "+919000000004", role: "Paid student (BPSC TRE 4.0 · Computer Science): Mock Test 2 PAUSED half-way (shows Resume)" },
  { phone: "+919000000005", role: "All-access student, topper: high score in Mock Test 1 (rank 1)" },
];
const BPSC_CS = { exam: "bpsc", subject: "computer-science" };
const STET_CS = { exam: "bseb-stet", subject: "computer-science" };

const root = process.cwd();
const bank = JSON.parse(fs.readFileSync(path.join(root, "src/data/generated/bank.json"), "utf8"));
const tests = JSON.parse(fs.readFileSync(path.join(root, "src/data/generated/tests.json"), "utf8"));
const test = (id) => tests.find((t) => t.id === id);
const firstPaper = tests.find((t) => t.kind === "paper" && t.free) ?? tests.find((t) => t.kind === "paper");

async function check(url, what) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`✗ ${what} is not reachable at ${url}. Start the site with \`npm run dev:local\` first.`);
    process.exit(1);
  }
}

async function login(phone) {
  let r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=demo-api-key`, {
    method: "POST",
    headers: J,
    body: JSON.stringify({ phoneNumber: phone, recaptchaToken: "x" }),
  });
  const { sessionInfo } = await r.json();
  const { verificationCodes } = await (await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/verificationCodes`)).json();
  const code = verificationCodes.filter((v) => v.phoneNumber === phone).pop()?.code;
  r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=demo-api-key`, {
    method: "POST",
    headers: J,
    body: JSON.stringify({ sessionInfo, code }),
  });
  const { idToken } = await r.json();
  if (!idToken) throw new Error(`Could not sign in ${phone} through the Auth emulator.`);
  const uid = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString()).user_id;
  r = await fetch(`${APP}/api/auth/session`, { method: "POST", headers: J, body: JSON.stringify({ idToken }) });
  if (!r.ok) throw new Error(`The site refused the login for ${phone} (${r.status}).`);
  return { uid, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0] };
}

const post = (url, cookie, body) => fetch(APP + url, { method: "POST", headers: { ...J, Cookie: cookie }, body: JSON.stringify(body ?? {}) });

async function attemptCount(uid) {
  const r = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/attempts?pageSize=1`, { headers: { Authorization: "Bearer owner" } });
  const j = await r.json();
  return (j.documents ?? []).length;
}

/** Answers with roughly `p` correct, for the first `share` of the questions. */
function answers(t, p, share = 0.95) {
  const out = {};
  t.questionIds.forEach((id, i) => {
    if (i >= Math.round(t.questionIds.length * share)) return;
    const q = bank[id];
    if (!q) return;
    out[id] = Math.random() < p ? q.answer : (Object.keys(q.options).find((k) => k !== q.answer) ?? q.answer);
  });
  return out;
}

async function takeTest(user, testId, p, minutes) {
  const t = test(testId);
  if (!t) return console.warn(`  (test ${testId} not found, skipped)`);
  const r = await post(`/api/tests/${testId}/start`, user.cookie);
  const { attemptId, error } = await r.json();
  if (!attemptId) return console.warn(`  (could not start ${t.title}: ${error ?? r.status})`);
  await post(`/api/attempts/${attemptId}/submit`, user.cookie, { answers: answers(t, p) });
  // Realistic "time taken" (the script submits instantly).
  await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users/${user.uid}/attempts/${attemptId}?updateMask.fieldPaths=timeTakenSec`, {
    method: "PATCH",
    headers: { ...J, Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: { timeTakenSec: { integerValue: String(minutes * 60 + Math.floor(Math.random() * 59)) } } }),
  });
  console.log(`  ✓ ${t.title} submitted`);
}

await check(APP, "The site");
await check(`${AUTH}/`, "The Auth emulator");

const admin = await login(ADMIN_PHONE);
const grantAll = (uid) => post(`/api/admin/users/${uid}/access`, admin.cookie, { paid: true });
const grantSeries = (uid, s) => post(`/api/admin/users/${uid}/access`, admin.cookie, { ...s, grant: true });
const interests = (user, list) => post("/api/me/interests", user.cookie, { interests: list });

for (const [i, d] of DEMO_USERS.entries()) {
  const user = await login(d.phone);
  console.log(`${d.phone}: ${d.role}`);
  // Exams & subjects (onboarding): set every run, so older demo accounts skip the onboarding screen too.
  if (i >= 1) {
    const r = await interests(user, i === 2 ? [BPSC_CS, STET_CS] : [BPSC_CS]);
    console.log(r.ok ? "  ✓ exams & subjects chosen" : `  ✗ could not save exams & subjects (${r.status})`);
  }
  if ((await attemptCount(user.uid)) > 0) {
    console.log("  already has tests, left unchanged");
    continue;
  }
  if (i === 2 || i === 3) {
    const r = await grantSeries(user.uid, BPSC_CS);
    console.log(r.ok ? "  ✓ BPSC TRE 4.0 · Computer Science unlocked (as if paid)" : `  ✗ could not unlock the series (${r.status})`);
  }
  if (i === 4) {
    const r = await grantAll(user.uid);
    console.log(r.ok ? "  ✓ all test series unlocked (as if paid)" : `  ✗ could not grant access (${r.status})`);
  }
  if (i === 1) await takeTest(user, "1", 0.58, 71);
  if (i === 2) {
    await takeTest(user, "1", 0.66, 68);
    await takeTest(user, "2", 0.62, 74);
    if (firstPaper) await takeTest(user, firstPaper.id, 0.6, Math.min(firstPaper.durationMinutes - 5, 85));
  }
  if (i === 3) {
    const t = test("2");
    const { attemptId } = await (await post("/api/tests/2/start", user.cookie)).json();
    const half = answers(t, 0.7, 0.45);
    await post(`/api/attempts/${attemptId}/pause`, user.cookie, { answers: half, marked: t.questionIds.slice(5, 8), visited: t.questionIds.slice(0, 38), current: 37 });
    console.log("  ✓ Mock Test 2 started, 36 answers saved, then Exit (paused)");
  }
  if (i === 4) await takeTest(user, "1", 0.93, 63);
}

console.log(`
Log in at ${APP}/login with any of these numbers (without +91). In local test mode no SMS
is sent: the OTP appears on the login screen. Admin: ${ADMIN_PHONE.replace("+91", "")}.`);
