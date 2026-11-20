import "server-only";
import { seriesKey } from "./access";
import { db } from "./firebase-admin";

export type PaymentDoc = {
  uid: string;
  phone: string;
  amount: number; // paise
  currency: string;
  status: "created" | "paid" | "failed";
  /** The test series bought (exam + subject). Orders without them (older) unlock everything. */
  exam?: string;
  subject?: string;
  createdAt: number;
  paidAt?: number;
  paymentId?: string;
  verifiedVia?: "checkout" | "webhook" | "admin";
  failureReason?: string;
};

/**
 * Mark an order as paid and unlock the series it was for (or everything, for older orders),
 * atomically and idempotently.
 * Called after the checkout signature or the webhook signature has been verified.
 */
export async function markOrderPaid(
  orderId: string,
  paymentId: string,
  via: PaymentDoc["verifiedVia"],
  opts: { expectUid?: string; amount?: number } = {},
): Promise<"paid" | "already_paid" | "unknown_order" | "wrong_user" | "amount_mismatch"> {
  const payRef = db().doc(`payments/${orderId}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(payRef);
    const p = snap.data() as PaymentDoc | undefined;
    if (!p) return "unknown_order";
    if (opts.expectUid && p.uid !== opts.expectUid) return "wrong_user";
    if (opts.amount !== undefined && opts.amount !== p.amount) return "amount_mismatch";
    if (p.status === "paid") return "already_paid";
    const now = Date.now();
    tx.update(payRef, { status: "paid", paymentId, paidAt: now, verifiedVia: via });
    const user = db().doc(`users/${p.uid}`);
    if (p.exam && p.subject) {
      tx.set(user, { passes: { [seriesKey(p.exam, p.subject)]: { exam: p.exam, subject: p.subject, paidAt: now, orderId } } }, { merge: true });
    } else {
      tx.set(user, { paid: true, paidAt: now, paidOrderId: orderId }, { merge: true });
    }
    return "paid";
  });
}

export async function markOrderFailed(orderId: string, reason: string): Promise<void> {
  const payRef = db().doc(`payments/${orderId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(payRef);
    const p = snap.data() as PaymentDoc | undefined;
    if (!p || p.status === "paid") return;
    tx.update(payRef, { status: "failed", failureReason: reason.slice(0, 200) });
  });
}
