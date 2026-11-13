import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pricingConfig, siteConfig } from "@config/test-series.config";

// ⚠ Template text. Read it, adjust it to your business, and fill in
//   siteConfig.business in config/test-series.config.ts. Razorpay reviews these pages.
const b = siteConfig.business;
const validity =
  pricingConfig.accessValidityDays == null ? "lifetime of the service" : `${pricingConfig.accessValidityDays} days from purchase`;

const pages: Record<string, { title: string; body: { h?: string; p: string }[] }> = {
  terms: {
    title: "Terms & Conditions",
    body: [
      { p: `These terms apply to ${siteConfig.name} ("the service"), operated by ${b.legalName}. By creating an account or making a payment you agree to them.` },
      { h: "The service", p: "An online practice test series made of previous-year questions from various computer-science recruitment and teaching exams, with answers and explanations. It is an independent practice resource, not affiliated with BPSC or any exam-conducting body." },
      { h: "Account", p: "You log in with your mobile number and a one-time password. Keep access to your phone secure. One purchase is for one person; sharing accounts may lead to suspension." },
      { h: "Payments & access", p: `Paid access unlocks all tests for the ${validity}. Payments are processed by Razorpay. Prices may change for future purchases; this does not affect access you have already bought.` },
      { h: "Content", p: "Questions are compiled from publicly available past papers for practice. We try to keep answers and explanations accurate but do not guarantee they are error-free. Copying or redistributing the test content is not allowed." },
      { h: "Contact", p: `Questions about these terms: ${b.email}.` },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      { h: "What we collect", p: "Your mobile number (for login), your test attempts and scores, and records of your payments (order id, amount, status). We do not see or store card, UPI or bank details; Razorpay handles those." },
      { h: "Why", p: "To log you in, save your progress, show your results and dashboard, and confirm your purchase." },
      { h: "Who processes it", p: "Google Firebase (login and database) and Razorpay (payments). We do not sell your data or send marketing SMS." },
      { h: "Deletion", p: `To delete your account and data, email ${b.email} from the number's owner or contact us at ${b.phone}.` },
    ],
  },
  refund: {
    title: "Cancellation & Refund Policy",
    body: [
      { p: "This is a digital product that is unlocked immediately after payment, so purchases are generally non-refundable. Please try the free test first." },
      { h: "When we refund", p: `If you were charged twice, or paid but the tests did not unlock and we cannot fix it, email ${b.email} within 7 days with your registered mobile number and payment id. Approved refunds go back to the original payment method within 5–7 working days.` },
      { h: "Cancellation", p: "There is no subscription to cancel; it is a one-time payment." },
    ],
  },
  contact: {
    title: "Contact Us",
    body: [
      { p: `${b.legalName}` },
      { h: "Email", p: b.email },
      { h: "Phone", p: b.phone },
      { h: "Address", p: b.address },
      { p: "We usually reply within 1 working day." },
    ],
  },
};

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: pages[slug]?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  return (
    <article className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      <div className="mt-6 grid gap-5 text-ink-700 dark:text-ink-300">
        {page.body.map((s, i) => (
          <section key={i}>
            {s.h && <h2 className="mb-1 font-semibold text-ink-900 dark:text-white">{s.h}</h2>}
            <p>{s.p}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
