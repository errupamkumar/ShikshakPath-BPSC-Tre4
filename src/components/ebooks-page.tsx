import Link from "next/link";
import { examByKey } from "@config/exams";
import { subjectByKey, subjectName } from "@config/subjects";
import { fullAccess } from "@/lib/access";
import { EBOOK_META, EBOOK_TYPES, type EbookType } from "@/lib/ebook-types";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { getT } from "@/lib/lang";
import { formatSize, listResources } from "@/lib/resources";
import { getSessionUser } from "@/lib/session";
import { LockIcon } from "./icons";
import { LogoMark } from "./logo";

/** Cover colours per eBook type. */
const COVER: Record<EbookType, string> = {
  notes: "from-brand-500 via-brand-600 to-brand-800 text-white",
  pyq: "from-ink-700 via-ink-800 to-ink-950 text-white",
  strategy: "from-emerald-600 via-emerald-700 to-emerald-900 text-white",
  others: "from-sky-600 via-sky-700 to-sky-900 text-white",
};

/** eBooks: PDFs uploaded by the admin (Notes, PYQ, Strategy guides, Others). `type` undefined = all. */
export async function EbooksPage({ type, subject }: { type?: EbookType; subject?: string }) {
  const [{ lang, t }, user] = await Promise.all([getT(), getSessionUser()]);
  const paid = await fullAccess(user);
  const all = isFirebaseAdminConfigured() ? await listResources() : [];
  const ofType = all.filter((r) => !type || r.type === type);
  const subjectFilter = subject && subjectByKey.has(subject) ? subject : "";
  const items = ofType.filter((r) => !subjectFilter || r.subject === subjectFilter || r.subject === "");
  const subjectsUsed = [...new Set(ofType.map((r) => r.subject).filter(Boolean))];
  const base = type ? `/ebooks/${type}` : "/ebooks";
  const count = (k: EbookType) => all.filter((r) => r.type === k).length;

  return (
    <>
      <section className="border-b border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900/40">
        <div className="container-page py-12 sm:py-16">
          <nav className="text-sm text-ink-500 dark:text-ink-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-900 dark:hover:text-white">{t("common.home")}</Link> /{" "}
            {type ? (
              <>
                <Link href="/ebooks" className="hover:text-ink-900 dark:hover:text-white">{t("nav.ebooks")}</Link> /{" "}
                <span className="text-ink-900 dark:text-ink-100">{t(EBOOK_META[type].label)}</span>
              </>
            ) : (
              <span className="text-ink-900 dark:text-ink-100">{t("nav.ebooks")}</span>
            )}
          </nav>
          <p className="eyebrow mt-5">{t("nav.ebooks")}</p>
          <h1 className="display mt-3 max-w-4xl text-4xl leading-[1.03] sm:text-6xl">{type ? t(EBOOK_META[type].label) : t("eb.title")}</h1>
          <p className="mt-4 max-w-2xl text-ink-600 dark:text-ink-300">{type ? t(EBOOK_META[type].text) : t("eb.text")}</p>

          <div className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist">
            <Link href="/ebooks" role="tab" aria-selected={!type} className={`btn shrink-0 px-4 py-1.5 ${!type ? "btn-primary" : "btn-secondary"}`}>
              {t("eb.all")} <span className="opacity-60">{all.length}</span>
            </Link>
            {EBOOK_TYPES.map((k) => (
              <Link key={k} href={`/ebooks/${k}`} role="tab" aria-selected={type === k} className={`btn shrink-0 px-4 py-1.5 ${type === k ? "btn-primary" : "btn-secondary"}`}>
                {t(EBOOK_META[k].label)} <span className="opacity-60">{count(k)}</span>
              </Link>
            ))}
          </div>
          {subjectsUsed.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={base} className={`rounded-full px-3 py-1 text-sm font-semibold ${!subjectFilter ? "bg-ink-900 text-white dark:bg-brand-300 dark:text-ink-950" : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200"}`}>
                {t("lib.allSubjects")}
              </Link>
              {subjectsUsed.map((k) => (
                <Link key={k} href={`${base}?subject=${k}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${subjectFilter === k ? "bg-ink-900 text-white dark:bg-brand-300 dark:text-ink-950" : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200"}`}>
                  {subjectName(k, lang)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="container-page py-10">
        {items.length === 0 ? (
          <p className="card p-10 text-center text-ink-500">{t("lib.none")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((r) => {
              const kind = (r.type in EBOOK_META ? r.type : "others") as EbookType;
              const open = r.free || paid;
              return (
                <Link key={r.id} href={`/resources/${r.id}`} className="group flex flex-col">
                  {/* book cover */}
                  <div className={`relative aspect-[3/4] overflow-hidden rounded-r-2xl rounded-l-md bg-gradient-to-br p-4 shadow-lg shadow-ink-900/15 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl sm:p-5 ${COVER[kind]}`}>
                    <span aria-hidden className="absolute inset-y-0 left-0 w-3 bg-black/20" />
                    <span aria-hidden className="absolute inset-y-0 left-3 w-px bg-white/25" />
                    <div className="relative flex h-full flex-col pl-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">{t(EBOOK_META[kind].label)}</span>
                        {r.free ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700">{t("common.free.badge")}</span>
                        ) : !open ? (
                          <span className="grid size-7 place-items-center rounded-full bg-black/25" aria-label={t("common.locked")}>
                            <LockIcon width={13} height={13} />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 line-clamp-5 text-base leading-tight font-black tracking-tight sm:text-lg">{r.title}</p>
                      <div className="mt-auto flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] uppercase opacity-85">
                        <LogoMark className="size-5" tone="onColor" />
                        {r.subject ? subjectName(r.subject, lang) : t("eb.allSubjectsShort")}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 leading-snug font-bold group-hover:text-brand-700 dark:group-hover:text-brand-300">{r.title}</p>
                  {r.author && <p className="mt-0.5 text-sm text-brand-700 dark:text-brand-300">{t("lib.by", { author: r.author })}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs font-semibold text-ink-500 dark:text-ink-400">
                    {r.examKey && examByKey.get(r.examKey) && <span>{examByKey.get(r.examKey)!.short}</span>}
                    <span>PDF · {formatSize(r.size)}</span>
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
