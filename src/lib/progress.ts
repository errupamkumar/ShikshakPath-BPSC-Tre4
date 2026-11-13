import "server-only";
import { isExpired, listAttempts, remainingMsOf } from "./attempts";

export type TestProgress = {
  best: number | null;
  max: number;
  count: number;
  running: boolean; // an attempt is in progress (running or paused)
  paused: boolean;
  remainingSec: number;
};

/** Per-test summary of a student's attempts (best score, attempts, running/paused). */
export async function getTestProgress(uid: string | undefined): Promise<Map<string, TestProgress>> {
  const map = new Map<string, TestProgress>();
  if (!uid) return map;
  for (const a of await listAttempts(uid)) {
    const p = map.get(a.testId) ?? { best: null, max: 0, count: 0, running: false, paused: false, remainingSec: 0 };
    if (a.status === "submitted" && a.result) {
      p.count++;
      if (p.best === null || a.result.score > p.best) p.best = a.result.score;
      p.max = a.result.maxScore;
    } else if (a.status === "in_progress" && !isExpired(a)) {
      p.running = true;
      p.paused = !!a.pausedAt;
      p.remainingSec = Math.round(remainingMsOf(a) / 1000);
    }
    map.set(a.testId, p);
  }
  return map;
}
