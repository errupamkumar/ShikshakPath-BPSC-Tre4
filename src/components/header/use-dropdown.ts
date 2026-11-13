"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Open on hover or click; close on Escape, outside click, mouse leave (with delay) or navigation. */
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const onMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const onMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  return { open, setOpen, wrap, onMouseEnter, onMouseLeave };
}

export const navButtonClass =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[15px] font-semibold whitespace-nowrap text-ink-800 transition hover:text-brand-600 xl:px-3 dark:text-ink-100 dark:hover:text-brand-300";
