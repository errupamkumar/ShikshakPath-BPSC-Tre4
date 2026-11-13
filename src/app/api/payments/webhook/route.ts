import { NextResponse } from "next/server";
import { markOrderFailed, markOrderPaid } from "@/lib/payments";
import { verifyWebhookSignature } from "@/lib/razorpay";

type PaymentEntity = { id?: string; order_id?: string; amount?: number; error_description?: string };
type WebhookEvent = { event?: string; payload?: { payment?: { entity?: PaymentEntity } } };

/**
 * Backup path: unlocks access even if the student closed the browser right
 * after paying (before /api/payments/verify ran). Configure in Razorpay
 * Dashboard → Webhooks with events payment.captured, order.paid, payment.failed.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const evt = JSON.parse(raw) as WebhookEvent;
  const p = evt.payload?.payment?.entity;
  if (!p?.order_id || !p.id) return NextResponse.json({ ok: true }); // not an order payment: ignore

  if (evt.event === "payment.captured" || evt.event === "order.paid") {
    const result = await markOrderPaid(p.order_id, p.id, "webhook", { amount: p.amount });
    if (result !== "paid" && result !== "already_paid") console.warn("webhook:", result, p.order_id);
  } else if (evt.event === "payment.failed") {
    await markOrderFailed(p.order_id, p.error_description ?? "failed");
  }
  return NextResponse.json({ ok: true });
}
