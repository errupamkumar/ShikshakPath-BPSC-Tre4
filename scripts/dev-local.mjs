/**
 * Local test mode: Firebase emulators + the website, in ONE command.
 *
 *   npm run dev:local      → http://localhost:3000
 *
 * - No Firebase account or keys needed (uses a "demo-" project that never touches Google servers).
 * - The OTP is shown on the login screen (and in this terminal).
 * - Log in with 9999999999 to open /admin.
 * - Test users/attempts are saved to ./.emulator-data when you stop with Ctrl+C.
 * - Needs Java 11+ (`java -version`).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";

const PROJECT = "demo-cs-test";
const DATA_DIR = ".emulator-data";
const hasSavedData = fs.existsSync(`${DATA_DIR}/firebase-export-metadata.json`);

// These override anything in .env.local for this run only.
const env = {
  ...process.env,
  FIREBASE_PROJECT_ID: PROJECT,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app-id",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  // PDFs (Notes / Strategy guides) go to the Storage emulator
  FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  ADMIN_PHONES: "+919999999999",
};

const args = [
  "-y",
  "firebase-tools@15",
  "emulators:exec",
  "--only",
  "auth,firestore,storage",
  "--project",
  PROJECT,
  "--ui",
  ...(hasSavedData ? ["--import", DATA_DIR] : []),
  "--export-on-exit",
  DATA_DIR,
  '"next dev"', // firebase sets FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST for this command
];

console.log("\n▶ Local test mode: starting Firebase emulators + website…");
console.log("  Website:      http://localhost:3000   (admin login: 9999999999)");
console.log("  Emulator UI:  http://127.0.0.1:4000\n");

const child = spawn("npx", args, { stdio: "inherit", shell: true, env });
child.on("exit", (code) => process.exit(code ?? 0));
