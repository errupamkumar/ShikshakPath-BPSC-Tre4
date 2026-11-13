import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { setPriceInPaise } from "@/lib/settings";

export async function POST(req: Request) {
  const admin = await getSessionUser(true); // also checks the session wasn't revoked
  if (!admin?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { priceInRupees?: unknown } | null;
  const rupees = Number(body?.priceInRupees);
  if (!Number.isFinite(rupees) || rupees < 1 || rupees > 100000) {
    return NextResponse.json({ error: "Enter a price between ₹1 and ₹1,00,000." }, { status: 400 });
  }
  const paise = Math.round(rupees * 100);
  await setPriceInPaise(paise, admin.phone);
  return NextResponse.json({ ok: true, priceInPaise: paise });
}
