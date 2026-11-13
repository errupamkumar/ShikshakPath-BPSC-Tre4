"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { UnlockIcon } from "./icons";
import { useLang } from "./lang-provider";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: string, cb: (r: { error?: { description?: string } }) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function UnlockButton({
  priceLabel,
  loggedIn,
  className = "btn-accent",
  label,
}: {
  priceLabel: string;
  loggedIn: boolean;
  className?: string;
  label?: string;
}) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function unlock() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!(await loadCheckout())) throw new Error("Could not load Razorpay. Check your internet connection.");
      const res = await fetch("/api/payments/create-order", { method: "POST" });
      const order = (await res.json().catch(() => ({}))) as {
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        name?: string;
        description?: string;
        phone?: string;
        error?: string;
      };
      if (res.status === 409) {
        // Already paid (e.g. on another device).
        router.refresh();
        return;
      }
      if (!res.ok || !order.orderId) throw new Error(order.error || "Could not start the payment.");

      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: order.name,
        description: order.description,
        prefill: { contact: order.phone },
        theme: { color: "#4f46e5" },
        handler: async (resp: RazorpayResponse) => {
          try {
            const v = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const data = (await v.json().catch(() => ({}))) as { error?: string };
            if (!v.ok) throw new Error(data.error || "Verification failed.");
            setDone(true);
            router.refresh();
          } catch (e) {
            setError(
              `${(e as Error).message} If money was deducted, it will unlock automatically within a few minutes, or contact support with payment id ${resp.razorpay_payment_id}.`,
            );
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (r) => setError(r.error?.description || "Payment failed. Please try again."));
      rzp.open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (done) {
    return <p className="font-semibold text-emerald-600">✓ {t("common.unlocked")}</p>;
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={unlock} disabled={busy} className={`btn ${className} px-5 py-3`}>
        <UnlockIcon width={18} height={18} />
        {busy ? t("common.openingPayment") : (label ?? t("common.unlockAllFor", { price: priceLabel }))}
      </button>
      {error && <p className="max-w-md text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
