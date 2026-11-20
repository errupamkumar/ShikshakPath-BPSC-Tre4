import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getUserDoc } from "@/lib/access";
import { getCatalog } from "@/lib/catalog";
import { menuExams } from "@/lib/exam-menu";
import { safeNext } from "@/lib/format";
import { getT } from "@/lib/lang";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Choose your exams and subjects", robots: { index: false } };

/** Asked right after sign-up (and from the dashboard): which exams + subjects is the student preparing for? */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined, "/dashboard");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${next}`)}`);
  const [cat, profile, { lang, t }] = await Promise.all([getCatalog(), getUserDoc(user.uid), getT()]);

  return (
    <div className="container-page max-w-5xl py-10 sm:py-14">
      <p className="eyebrow">{t("ob.eyebrow")}</p>
      <h1 className="display mt-3 text-4xl leading-[1.05] sm:text-5xl">{t("ob.title")}</h1>
      <p className="mt-4 max-w-2xl text-ink-600 dark:text-ink-300">{t("ob.text")}</p>
      <div className="mt-8">
        <OnboardingForm exams={menuExams(cat, lang)} initial={profile?.interests ?? []} next={next === "/login" ? "/dashboard" : next} />
      </div>
    </div>
  );
}
