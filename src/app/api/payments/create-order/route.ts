import { NextResponse } from "next/server";
import { siteConfig } from "@config/test-series.config";
import { examByKey } from "@config/exams";
import { subjectByKey, subjectName } from "@config/subjects";
import { accessFor, canOpenSeries } from "@/lib/access";
import { getCatalog, isExamLive, isSeriesLive } from "@/lib/catalog";
import { db } from "@/lib/firebase-admin";
import type { PaymentDoc } from "@/lib/payments";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

/** Start a Razorpay payment for ONE test series (exam + subject). Body: { exam, subject }. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { exam?: unknown; subject?: unknown } | null;
  const exam = typeof body?.exam === "string" ? examByKey.get(body.exam) : undefined;
  const subject = typeof body?.subject === "string" && subjectByKey.has(body.subject) ? body.subject : "";
  const cat = await getCatalog();
  if (!exam || !subject || !isExamLive(cat, exam.key) || (exam.subjects && !exam.subjects.includes(subject))) {
    return NextResponse.json({ error: "Choose the exam and subject you want to unlock." }, { status: 400 });
  }
  if (!isSeriesLive(cat, exam.key, subject)) return NextResponse.json({ error: "This test series has no tests yet." }, { status: 400 });
  if (canOpenSeries(await accessFor(user), exam.key, subject)) return NextResponse.json({ error: "Already unlocked." }, { status: 409 });

  // The amount always comes from the server, never from the browser.
  const amount = await getPriceInPaise();
  try {
    const order = await createRazorpayOrder({
      amount,
      currency: "INR",
      receipt: `u_${user.uid.slice(0, 12)}_${Date.now()}`,
      notes: { uid: user.uid, phone: user.phone, exam: exam.key, subject },
    });
    const payment: PaymentDoc = {
      uid: user.uid,
      phone: user.phone,
      amount: order.amount,
      currency: order.currency,
      status: "created",
      createdAt: Date.now(),
      exam: exam.key,
      subject,
    };
    await db().doc(`payments/${order.id}`).set(payment);
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      name: siteConfig.name,
      description: `${exam.short} · ${subjectName(subject)} test series`,
      phone: user.phone,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 502 });
  }
}
