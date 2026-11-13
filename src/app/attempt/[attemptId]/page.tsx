import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { playerConfig } from "@config/test-series.config";
import { TestPlayer } from "@/components/test-player";
import { canAccessTest } from "@/lib/access";
import { attemptPattern, finalizeAttempt, getAttempt, isExpired, resumeAttempt } from "@/lib/attempts";
import { getCatalog, toPublicQuestion } from "@/lib/catalog";
import { fractionLabel } from "@/lib/format";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Test in progress" };

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/attempt/${attemptId}`);

  let attempt = await getAttempt(user.uid, attemptId); // only finds the user's own attempts
  if (!attempt) notFound();
  if (attempt.status === "submitted") redirect(`/results/${attempt.id}`);
  if (isExpired(attempt)) {
    await finalizeAttempt(user.uid, attempt.id); // time ran out while the page was closed
    redirect(`/results/${attempt.id}`);
  }
  const cat = await getCatalog();
  const test = cat.testById.get(attempt.testId);
  if (test && !(await canAccessTest(user, test))) redirect(`/tests/${test.id}`);

  // Coming back after "Exit": the timer continues with the time that was left.
  if (attempt.pausedAt) {
    await resumeAttempt(user.uid, attempt.id);
    attempt = (await getAttempt(user.uid, attempt.id))!;
  }

  // Questions WITHOUT answers or explanations.
  const questions = attempt.questionIds
    .map((id) => cat.questions.get(id))
    .filter((q) => q !== undefined)
    .map((q) => toPublicQuestion(cat, q));

  // Marking and sections saved when the attempt started.
  const p = attemptPattern(cat, attempt);
  const neg = p.negative;
  return (
    <TestPlayer
      attemptId={attempt.id}
      testId={attempt.testId}
      title={attempt.testTitle}
      questions={questions}
      initial={{
        answers: attempt.answers ?? {},
        marked: attempt.marked ?? [],
        visited: attempt.visited ?? [],
        current: attempt.current ?? 0,
        savedAt: attempt.savedAt ?? 0,
      }}
      deadlineAt={attempt.deadlineAt}
      serverNow={Date.now()}
      optionELabel={p.optionE ? p.optionELabel : null}
      marking={`+${fractionLabel(p.marks)} / ${neg ? `−${fractionLabel(neg)}` : "0"}`}
      blankPenalty={p.blankPenalty}
      allowPause={playerConfig.allowPauseAndResume}
      sections={p.sections.map((x) => ({ name: x.name, nameHi: x.nameHi, count: x.count }))}
    />
  );
}
