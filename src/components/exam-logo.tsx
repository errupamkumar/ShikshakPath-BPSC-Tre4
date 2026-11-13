import Image from "next/image";

/** An exam's official logo (config/exams.ts → logo), or a lettered badge when there is none. */
export function ExamLogo({ exam, size = 44, className = "" }: { exam: { short: string; logo?: string }; size?: number; className?: string }) {
  if (exam.logo) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-ink-200 dark:ring-ink-700 ${className}`} style={{ width: size, height: size }}>
        <Image src={exam.logo} alt={`${exam.short} logo`} width={size} height={size} className="rounded-full object-contain p-[2px]" />
      </span>
    );
  }
  const initials = exam.short.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-brand-50 font-black tracking-tight text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
