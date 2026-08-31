"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types (mirror src/services/quizzes.ts student payloads) ────

interface StudentQuizOption {
  id: string;
  text: string;
}

interface StudentQuizQuestion {
  id: string;
  text: string;
  options: StudentQuizOption[];
}

interface StudentQuiz {
  id: string;
  title: string;
  passScore: number;
  moduleTitle: string;
  courseTitle: string;
  questions: StudentQuizQuestion[];
  bestAttempt: { score: number; passed: boolean; createdAt: string } | null;
}

interface AttemptResult {
  score: number;
  passed: boolean;
  passScore: number;
  correctCount: number;
  totalQuestions: number;
  results: Array<{
    questionId: string;
    correct: boolean;
    correctOptionId: string;
  }>;
}

function heDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────

export function QuizRunner({
  slug,
  quizId,
  onPassed,
}: {
  slug: string;
  quizId: string;
  onPassed?: () => void;
}) {
  const [quiz, setQuiz] = useState<StudentQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/portal/${encodeURIComponent(slug)}/quizzes/${encodeURIComponent(quizId)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data?.error || "שגיאה בטעינת הבוחן");
        setQuiz(null);
      } else {
        setQuiz(data?.quiz ?? null);
      }
    } catch {
      setLoadError("שגיאה בטעינת הבוחן");
      setQuiz(null);
    } finally {
      setLoading(false);
    }
  }, [slug, quizId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  async function handleSubmit() {
    if (!quiz || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/portal/${encodeURIComponent(slug)}/quizzes/${encodeURIComponent(quizId)}/attempt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: quiz.questions
              .filter((q) => answers[q.id])
              .map((q) => ({ questionId: q.id, optionId: answers[q.id] })),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.error || "שגיאה בשליחת הבוחן");
        return;
      }
      setResult(data as AttemptResult);
      if (data?.passed) onPassed?.();
    } catch {
      setSubmitError("שגיאה בשליחת הבוחן");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setResult(null);
    setAnswers({});
    setSubmitError(null);
    loadQuiz();
  }

  // ─── Loading / error ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-card border border-petra-border p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !quiz) {
    return (
      <div className="bg-white rounded-2xl shadow-card border border-petra-border p-6 text-center">
        <p className="text-slate-600 mb-4">{loadError || "הבוחן לא נמצא"}</p>
        <button
          type="button"
          onClick={loadQuiz}
          className="px-4 py-2 rounded-xl border border-petra-border text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  // ─── Result screen ────────────────────────────────────────────

  if (result) {
    const resultByQuestion = new Map(result.results.map((r) => [r.questionId, r]));
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-card border border-petra-border p-6 text-center">
          <div
            className={`text-5xl font-extrabold mb-2 ${
              result.passed ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {result.score}%
          </div>
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
              result.passed
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {result.passed ? "✓ עברת את הבוחן" : "✗ לא עברת את הבוחן"}
          </div>
          <p className="text-sm text-slate-500 mt-3">
            {result.correctCount} מתוך {result.totalQuestions} תשובות נכונות · ציון עובר:{" "}
            {result.passScore}%
          </p>
          {quiz.bestAttempt && (
            <p className="text-xs text-slate-400 mt-1">
              ניסיון קודם הטוב ביותר: {quiz.bestAttempt.score}%
              {quiz.bestAttempt.createdAt
                ? ` (${heDate(quiz.bestAttempt.createdAt)})`
                : ""}
            </p>
          )}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleRetry}
              style={{ backgroundColor: "var(--portal-primary)" }}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-95 active:brightness-90"
            >
              נסה שוב
            </button>
          </div>
        </div>

        {quiz.questions.map((q, index) => {
          const qResult = resultByQuestion.get(q.id);
          const chosenId = answers[q.id];
          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl shadow-card border border-petra-border p-5"
            >
              <div className="flex items-start gap-2 mb-3">
                <span
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                    qResult?.correct
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {qResult?.correct ? "✓" : "✗"}
                </span>
                <h3 className="font-semibold text-slate-900 leading-6">
                  {index + 1}. {q.text}
                </h3>
              </div>
              <div className="space-y-2">
                {q.options.map((o) => {
                  const isCorrectOption = qResult?.correctOptionId === o.id;
                  const isChosen = chosenId === o.id;
                  const base =
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm";
                  const tone = isCorrectOption
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : isChosen
                      ? "border-rose-300 bg-rose-50 text-rose-800"
                      : "border-petra-border bg-white text-slate-600";
                  return (
                    <div key={o.id} className={`${base} ${tone}`}>
                      <span>{o.text}</span>
                      {isCorrectOption ? (
                        <span className="text-xs font-semibold shrink-0">
                          התשובה הנכונה
                        </span>
                      ) : isChosen ? (
                        <span className="text-xs font-semibold shrink-0">
                          התשובה שלך
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Quiz form ────────────────────────────────────────────────

  const allAnswered =
    quiz.questions.length > 0 &&
    quiz.questions.every((q) => Boolean(answers[q.id]));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card border border-petra-border p-5">
        <h2 className="text-lg font-bold text-slate-900">{quiz.title}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {quiz.moduleTitle} · ציון עובר: {quiz.passScore}%
        </p>
        {quiz.bestAttempt && (
          <p
            className={`text-sm mt-2 font-medium ${
              quiz.bestAttempt.passed ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            הציון הטוב ביותר שלך: {quiz.bestAttempt.score}%
            {quiz.bestAttempt.passed ? " — עברת" : ""}
            {quiz.bestAttempt.createdAt
              ? ` (${heDate(quiz.bestAttempt.createdAt)})`
              : ""}
          </p>
        )}
      </div>

      {quiz.questions.map((q, index) => (
        <div
          key={q.id}
          className="bg-white rounded-2xl shadow-card border border-petra-border p-5"
        >
          <h3 className="font-semibold text-slate-900 mb-3 leading-6">
            {index + 1}. {q.text}
          </h3>
          <div className="space-y-2">
            {q.options.map((o) => {
              const checked = answers[q.id] === o.id;
              return (
                <label
                  key={o.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    checked
                      ? "border-slate-400 bg-slate-50"
                      : "border-petra-border hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`quiz-question-${q.id}`}
                    checked={checked}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: o.id }))
                    }
                    className="w-4 h-4 shrink-0"
                    style={{ accentColor: "var(--portal-primary)" }}
                  />
                  <span className="text-slate-800">{o.text}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {submitError && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {allAnswered ? "אפשר לשלוח" : "יש לענות על כל השאלות כדי לשלוח"}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          style={{ backgroundColor: "var(--portal-primary)" }}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-95 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "שולח..." : "שלח תשובות"}
        </button>
      </div>
    </div>
  );
}
