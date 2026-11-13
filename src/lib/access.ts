import "server-only";
import { pricingConfig } from "@config/test-series.config";
import { db } from "./firebase-admin";
import type { SessionUser } from "./session";
import type { TestDef } from "./types";

export type UserDoc = {
  phone: string;
  createdAt: number;
  lastLoginAt: number;
  paid?: boolean;
  paidAt?: number;
  paidOrderId?: string;
};

export function accessIsActive(user: Pick<UserDoc, "paid" | "paidAt"> | null | undefined): boolean {
  if (!user?.paid) return false;
  const days = pricingConfig.accessValidityDays;
  if (days == null) return true;
  return Boolean(user.paidAt && user.paidAt + days * 86_400_000 > Date.now());
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await db().doc(`users/${uid}`).get();
  return (snap.data() as UserDoc | undefined) ?? null;
}

/** Server-side check of paid access. Never trust the browser for this. */
export async function hasFullAccess(uid: string): Promise<boolean> {
  return accessIsActive(await getUserDoc(uid));
}

/** Paid students and admins can open everything. (Admins: all content unlocked, read/write.) */
export async function fullAccess(user: SessionUser | null): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin) return true;
  return hasFullAccess(user.uid);
}

export async function canAccessTest(user: SessionUser | null, test: TestDef): Promise<boolean> {
  if (!user) return false; // even the free test needs login (attempts are saved per user)
  if (test.free) return true;
  return fullAccess(user);
}
