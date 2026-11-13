// eBook (PDF) categories. Safe to import from server and client code.
// The key is stored on each PDF (Firestore resources/{id}.type) and used in URLs (/ebooks/<key>).
import type { TKey } from "./i18n";

export const EBOOK_TYPES = ["notes", "pyq", "strategy", "others"] as const;
export type EbookType = (typeof EBOOK_TYPES)[number];

export const isEbookType = (x: unknown): x is EbookType => typeof x === "string" && (EBOOK_TYPES as readonly string[]).includes(x);

/** Label and one-line description (translation keys) for each type. */
export const EBOOK_META: Record<EbookType, { label: TKey; text: TKey; admin: string }> = {
  notes: { label: "eb.notes", text: "eb.notesText", admin: "Notes" },
  pyq: { label: "eb.pyq", text: "eb.pyqText", admin: "PYQ (PDF)" },
  strategy: { label: "eb.strategy", text: "eb.strategyText", admin: "Strategy guide (by an expert)" },
  others: { label: "eb.others", text: "eb.othersText", admin: "Others" },
};
