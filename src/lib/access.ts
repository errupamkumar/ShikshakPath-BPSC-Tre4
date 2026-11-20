import "server-only";
import { pricingConfig } from "@config/test-series.config";
import { BUNDLED_EXAM } from "./catalog";
import { db } from "./firebase-admin";
import type { SessionUser } from "./session";
import type { TestDef } from "./types";

/**
 * Access model: students buy one TEST SERIES at a time = one exam + one subject
 * (e.g. BPSC TRE 4.0 · Computer Science). Each purchase adds a "pass" for that series.
 * `paid: true` (older purchases, or "Grant all" in Admin → Users) unlocks everything.
 */
export type Pass = { exam: string; subject: string; paidAt: number; orderId?: string; grantedBy?: string };
/** Exams + subjects the student chose after signing up (Exam → Subject). */
export type Interest = { exam: string; subject: string };

export type UserDoc = {
  phone: string;
  createdAt: number;
  lastLoginAt: number;
  paid?: boolean; // all-access (legacy purchases and admin "Grant all")
  paidAt?: number;
  paidOrderId?: string;
  grantedBy?: string;
  passes?: Record<string, Pass>; // key: seriesKey(exam, subject)
  interests?: Interest[];
  onboardedAt?: number;
};

export const seriesKey = (exam: string, subject: string) => `${exam}__${subject}`;

const stillValid = (paidAt: number | undefined) => {
  const days = pricingConfig.accessValidityDays;
  if (days == null) return true;
  return Boolean(paidAt && paidAt + days * 86_400_000 > Date.now());
};

/** All-access (legacy `paid` flag or admin grant), within the validity period. */
export function accessIsActive(user: Pick<UserDoc, "paid" | "paidAt"> | null | undefined): boolean {
  return !!user?.paid && stillValid(user.paidAt);
}

/** Series this user has unlocked (valid passes only). */
export function activePasses(user: Pick<UserDoc, "passes"> | null | undefined): Pass[] {
  return Object.values(user?.passes ?? {}).filter((p) => stillValid(p.paidAt));
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await db().doc(`users/${uid}`).get();
  return (snap.data() as UserDoc | undefined) ?? null;
}

export type Access = { all: boolean; series: Set<string>; subjects: Set<string>; any: boolean };
const NONE: Access = { all: false, series: new Set(), subjects: new Set(), any: false };

/** What this user may open. Checked on the server; never trust the browser for this. */
export async function accessFor(user: SessionUser | null): Promise<Access> {
  if (!user) return NONE;
  if (user.isAdmin) return { all: true, series: new Set(), subjects: new Set(), any: true };
  const doc = await getUserDoc(user.uid);
  if (accessIsActive(doc)) return { all: true, series: new Set(), subjects: new Set(), any: true };
  const passes = activePasses(doc);
  return {
    all: false,
    series: new Set(passes.map((p) => seriesKey(p.exam, p.subject))),
    subjects: new Set(passes.map((p) => p.subject)),
    any: passes.length > 0,
  };
}

export function canOpenSeries(a: Access, exam: string | undefined, subject: string): boolean {
  return a.all || a.series.has(seriesKey(exam ?? BUNDLED_EXAM, subject));
}

/** eBooks: one for an exam + subject needs that series; one for a subject needs any series of that subject; a general one needs any series. */
export function canOpenResource(a: Access, r: { examKey?: string; subject?: string }): boolean {
  if (a.all) return true;
  if (r.examKey && r.subject) return a.series.has(seriesKey(r.examKey, r.subject));
  if (r.subject) return a.subjects.has(r.subject);
  return a.any;
}

/** Admins and all-access students. (Admins: all content unlocked, read/write.) */
export async function fullAccess(user: SessionUser | null): Promise<boolean> {
  return (await accessFor(user)).all;
}

export async function canAccessTest(user: SessionUser | null, test: TestDef): Promise<boolean> {
  if (!user) return false; // even the free test needs login (attempts are saved per user)
  if (test.free) return true;
  return canOpenSeries(await accessFor(user), test.examKey, test.subject);
}
