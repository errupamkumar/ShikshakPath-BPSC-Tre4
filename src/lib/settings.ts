import "server-only";
import { pricingConfig } from "@config/test-series.config";
import { db, isFirebaseAdminConfigured } from "./firebase-admin";

// Cached for a minute per server instance (on globalThis so every route shares it).
const CACHE_MS = 60_000;
const g = globalThis as unknown as { __csPriceCache?: { priceInPaise: number; at: number } };

/** Current price of "Unlock all", in paise. Admin value from Firestore, else config default. */
export async function getPriceInPaise(): Promise<number> {
  const fallback = Math.round(pricingConfig.defaultPriceInRupees * 100);
  if (!isFirebaseAdminConfigured()) return fallback;
  const cached = g.__csPriceCache;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.priceInPaise;
  try {
    const snap = await db().doc("settings/app").get();
    const value = snap.get("priceInPaise");
    const priceInPaise = typeof value === "number" && value >= 100 ? value : fallback;
    g.__csPriceCache = { priceInPaise, at: Date.now() };
    return priceInPaise;
  } catch (e) {
    console.error("Could not read settings/app, using default price", e);
    return fallback;
  }
}

export async function setPriceInPaise(priceInPaise: number, updatedBy: string): Promise<void> {
  await db()
    .doc("settings/app")
    .set({ priceInPaise, updatedAt: Date.now(), updatedBy }, { merge: true });
  g.__csPriceCache = { priceInPaise, at: Date.now() };
}
