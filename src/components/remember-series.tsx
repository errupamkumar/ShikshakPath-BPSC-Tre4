"use client";

import { useEffect } from "react";
import { SERIES_COOKIE } from "@/lib/series-cookie";

/** Remembers the student's last exam + subject, so "Test Series" in the header opens it directly. */
export function RememberSeries({ exam, subject }: { exam: string; subject: string }) {
  useEffect(() => {
    document.cookie = `${SERIES_COOKIE}=${encodeURIComponent(`${exam}/${subject}`)}; path=/; max-age=31536000; samesite=lax`;
  }, [exam, subject]);
  return null;
}
