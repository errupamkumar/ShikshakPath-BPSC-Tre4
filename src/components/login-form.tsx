"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, signOut, type ConfirmationResult } from "firebase/auth";
import { firebaseAuth, getEmulatorOtp, isFirebaseClientConfigured } from "@/lib/firebase-client";
import { PhoneIcon } from "./icons";
import { useLang } from "./lang-provider";

const ERRORS: Record<string, string> = {
  "auth/invalid-phone-number": "That mobile number doesn't look right.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/quota-exceeded": "OTP limit reached for now. Please try again later.",
  "auth/invalid-verification-code": "Wrong OTP. Please check and try again.",
  "auth/code-expired": "This OTP has expired. Tap “Resend OTP”.",
  "auth/captcha-check-failed": "Security check failed. Please refresh the page and try again.",
  "auth/network-request-failed": "Network error. Check your internet connection.",
  "auth/billing-not-enabled": "SMS sending is not enabled on this Firebase project (needs the Blaze plan).",
  "auth/operation-not-allowed": "Phone login is not enabled in the Firebase console.",
  "auth/unauthorized-domain": "This domain is not authorised in Firebase → Authentication → Settings.",
};

function message(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return ERRORS[code] ?? (e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
}

export function LoginForm({ next }: { next: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => () => verifier.current?.clear(), []);

  const validPhone = /^[6-9]\d{9}$/.test(phone);

  async function sendOtp() {
    if (!validPhone || busy) return;
    setBusy(true);
    setError("");
    try {
      const auth = firebaseAuth();
      // A fresh element each time: reCAPTCHA can only render once per element.
      verifier.current?.clear();
      const el = document.createElement("div");
      holder.current!.replaceChildren(el);
      verifier.current = new RecaptchaVerifier(auth, el, { size: "invisible" });
      confirmation.current = await signInWithPhoneNumber(auth, `+91${phone}`, verifier.current);
      setStep("otp");
      setResendIn(30);
      // Local test mode (emulator) only: no real SMS is sent, so show the code.
      const otp = await getEmulatorOtp(`+91${phone}`);
      setTestOtp(otp);
      setCode(otp ?? "");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (code.length !== 6 || busy || !confirmation.current) return;
    setBusy(true);
    setError("");
    try {
      const cred = await confirmation.current.confirm(code);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Login failed.");
      // The server cookie is now the source of truth; drop the browser-side Firebase session.
      await signOut(firebaseAuth()).catch(() => {});
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  if (!isFirebaseClientConfigured) {
    return (
      <div className="card p-6 text-sm">
        <h1 className="text-lg font-bold">Login is not configured yet</h1>
        <p className="mt-2 text-ink-600 dark:text-ink-400">
          To test on this computer without any account, stop the server and run <code>npm run dev:local</code>.
        </p>
        <p className="mt-2 text-ink-600 dark:text-ink-400">
          For real SMS, put your Firebase keys in <code>.env.local</code> and restart <code>npm run dev</code> (README → “Firebase setup”).
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
        <PhoneIcon />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{step === "phone" ? t("lg.title") : t("lg.otpTitle")}</h1>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
        {step === "phone" ? (
          t("lg.sub")
        ) : (
          <>
            {t("lg.sentTo")} <strong>+91 {phone}</strong>.{" "}
            <button type="button" className="font-semibold text-brand-600 dark:text-brand-400" onClick={() => { setStep("phone"); setError(""); }}>
              {t("lg.change")}
            </button>
          </>
        )}
      </p>

      {step === "phone" ? (
        <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("lg.mobile")}
            <div className="flex">
              <span className="grid place-items-center rounded-l-xl border border-r-0 border-ink-300 bg-ink-100 px-3 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                +91
              </span>
              <input
                className="input rounded-l-none"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                autoFocus
              />
            </div>
          </label>
          <button type="submit" className="btn btn-primary py-3" disabled={!validPhone || busy}>
            {busy ? t("lg.sending") : t("lg.send")}
          </button>
        </form>
      ) : (
        <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); verifyOtp(); }}>
          {testOtp && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {t("lg.testMode")} <strong className="font-mono">{testOtp}</strong> {t("lg.filled")}
            </p>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            {t("lg.otp")}
            <input
              className="input text-center text-2xl tracking-[0.5em]"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
            />
          </label>
          <button type="submit" className="btn btn-primary py-3" disabled={code.length !== 6 || busy}>
            {busy ? t("lg.verifying") : t("lg.verify")}
          </button>
          <button type="button" className="btn btn-ghost text-sm" disabled={resendIn > 0 || busy} onClick={sendOtp}>
            {resendIn > 0 ? t("lg.resendIn", { s: resendIn }) : t("lg.resend")}
          </button>
        </form>
      )}

      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      <div ref={holder} />
      <p className="mt-6 text-xs text-ink-500">
        {t("lg.agree")} <a className="underline" href="/policies/terms">{t("lg.terms")}</a> {t("lg.and")}{" "}
        <a className="underline" href="/policies/privacy">{t("lg.privacy")}</a>
        {t("lg.agreeEnd")}
      </p>
    </div>
  );
}
