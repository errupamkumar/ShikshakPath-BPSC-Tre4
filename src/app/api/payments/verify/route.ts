import { NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/payments";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { getSessionUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";

  // 1. The signature proves Razorpay really processed this payment for this order.
  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }
  // 2. The order must belong to the logged-in user. Then unlock, atomically.
  const result = await markOrderPaid(orderId, paymentId, "checkout", { expectUid: user.uid });
  if (result === "paid" || result === "already_paid") return NextResponse.json({ ok: true });
  console.error("verify: unexpected result", result, orderId);
  return NextResponse.json({ error: "Payment does not match your account." }, { status: 400 });
}
