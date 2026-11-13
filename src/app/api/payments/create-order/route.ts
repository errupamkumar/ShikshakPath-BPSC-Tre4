import { NextResponse } from "next/server";
import { siteConfig } from "@config/test-series.config";
import { hasFullAccess } from "@/lib/access";
import { getCatalog } from "@/lib/catalog";
import { db } from "@/lib/firebase-admin";
import type { PaymentDoc } from "@/lib/payments";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)." }, { status: 503 });
  }
  if (await hasFullAccess(user.uid)) return NextResponse.json({ error: "Already unlocked." }, { status: 409 });

  // The amount always comes from the server, never from the browser.
  const amount = await getPriceInPaise();
  try {
    const order = await createRazorpayOrder({
      amount,
      currency: "INR",
      receipt: `u_${user.uid.slice(0, 12)}_${Date.now()}`,
      notes: { uid: user.uid, phone: user.phone },
    });
    const payment: PaymentDoc = {
      uid: user.uid,
      phone: user.phone,
      amount: order.amount,
      currency: order.currency,
      status: "created",
      createdAt: Date.now(),
    };
    await db().doc(`payments/${order.id}`).set(payment);
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      name: siteConfig.name,
      description: `Unlock all ${(await getCatalog()).stats.totalTests} tests`,
      phone: user.phone,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 502 });
  }
}
