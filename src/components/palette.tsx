"use client";

// Question-palette colours shared by the instructions page and the test player.
import { useLang } from "./lang-provider";

export type QStatus = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";

export const statusStyle: Record<QStatus, string> = {
  not_visited: "bg-white text-ink-700 border-ink-300 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-600",
  not_answered: "bg-rose-500 text-white border-rose-600",
  answered: "bg-emerald-500 text-white border-emerald-600",
  marked: "bg-violet-500 text-white border-violet-600",
  answered_marked: "bg-violet-500 text-white border-violet-600",
};

const ORDER: QStatus[] = ["not_visited", "not_answered", "answered", "marked", "answered_marked"];

export function StatusDot({ status, children }: { status: QStatus; children?: React.ReactNode }) {
  return (
    <span className={`relative grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-bold ${statusStyle[status]}`}>
      {children}
      {status === "answered_marked" && (
        <span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-ink-900" />
      )}
    </span>
  );
}

export function PaletteLegend({ counts }: { counts?: Partial<Record<QStatus, number>> }) {
  const { t } = useLang();
  return (
    <ul className="grid gap-2 text-sm sm:grid-cols-2">
      {ORDER.map((s) => (
        <li key={s} className="flex items-center gap-2">
          <StatusDot status={s}>{counts ? (counts[s] ?? 0) : ""}</StatusDot>
          <span className="text-ink-600 dark:text-ink-300">{t(`pal.${s}` as const)}</span>
        </li>
      ))}
    </ul>
  );
}
