import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { examByKey } from "@config/exams";
import { subjectName } from "@config/subjects";
import { LockIcon } from "@/components/icons";
import { UnlockButton } from "@/components/unlock-button";
import { fullAccess } from "@/lib/access";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { rupees } from "@/lib/format";
import { getT } from "@/lib/lang";
import { EBOOK_META } from "@/lib/ebook-types";
import { formatSize, getResource } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";
import { getPriceInPaise } from "@/lib/settings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isFirebaseAdminConfigured()) return { title: "PDF" };
  const r = await getResource((await params).id);
  return { title: r?.title ?? "PDF" };
}

/** One eBook (PDF): access check, then the PDF in an embedded viewer. */
export default async function ResourcePage({ params }: Props) {
  const { id } = await params;
  if (!isFirebaseAdminConfigured()) notFound();
  const [{ lang, t }, user, r] = await Promise.all([getT(), getSessionUser(), getResource(id)]);
  if (!r || (r.hidden && !user?.isAdmin)) notFound();
  if (!user) redirect(`/login?next=/resources/${id}`);
  const open = r.free || (await fullAccess(user));
  const meta = EBOOK_META[r.type] ?? EBOOK_META.others;
  const file = `/api/resources/${r.id}/file`;

  return (
    <div className="container-page py-8 sm:py-12">
      <Link href={`/ebooks/${r.type in EBOOK_META ? r.type : "others"}`} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
        ← {t("nav.ebooks")} · {t(meta.label)}
      </Link>
      <h1 className="display mt-3 max-w-4xl text-3xl sm:text-5xl">{r.title}</h1>
      {r.author && <p className="mt-2 font-semibold text-brand-700 dark:text-brand-300">{t("lib.by", { author: r.author })}</p>}
      {r.description && <p className="mt-3 max-w-3xl text-ink-600 dark:text-ink-300">{r.description}</p>}
      <p className="mt-3 flex flex-wrap gap-x-4 text-sm text-ink-500">
        {r.subject && <span>{subjectName(r.subject, lang)}</span>}
        {r.examKey && <span>{examByKey.get(r.examKey)?.short}</span>}
        <span>PDF · {formatSize(r.size)}</span>
      </p>

      {open ? (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={file} target="_blank" rel="noopener" className="btn btn-primary px-5 py-3">
              {t("lib.open")}
            </a>
            <a href={`${file}?download=1`} className="btn btn-secondary px-5 py-3">
              {t("lib.download")}
            </a>
          </div>
          <div className="card mt-6 overflow-hidden">
            <iframe src={file} title={r.title} className="h-[78dvh] w-full bg-white" />
          </div>
          <p className="mt-2 text-xs text-ink-500">{t("lib.viewerHint")}</p>
        </>
      ) : (
        <div className="card mt-8 max-w-2xl p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            <LockIcon width={26} height={26} />
          </span>
          <h2 className="mt-4 text-2xl font-bold">{t("lib.lockedTitle")}</h2>
          <p className="mt-2 text-ink-600 dark:text-ink-300">{t("lib.lockedText", { price: rupees(await getPriceInPaise()) })}</p>
          <div className="mt-6 flex justify-center">
            <UnlockButton priceLabel={rupees(await getPriceInPaise())} loggedIn />
          </div>
        </div>
      )}
    </div>
  );
}
