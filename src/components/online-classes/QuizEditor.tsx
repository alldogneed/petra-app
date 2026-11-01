"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, HelpCircle } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { Modal } from "./shared";
import { PetraLoader } from "@/components/ui/PetraLoader";

// ─── Types ──────────────────────────────────────────────────────

interface QuizOptionDraft {
  text: string;
  isCorrect: boolean;
}

interface QuizQuestionDraft {
  text: string;
  options: QuizOptionDraft[];
}

interface QuizApiOption {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

interface QuizApiQuestion {
  id: string;
  text: string;
  position: number;
  options: QuizApiOption[];
}

interface QuizApi {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: QuizApiQuestion[];
}

// ─── Limits (mirror src/services/quizzes.ts) ────────────────────

const TITLE_MAX = 200;
const MAX_QUESTIONS = 50;
const QUESTION_TEXT_MAX = 500;
const OPTION_TEXT_MAX = 300;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function emptyQuestion(): QuizQuestionDraft {
  return {
    text: "",
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  };
}

/** Client-side mirror of the service validation — fast Hebrew feedback before PUT. */
function validateDraft(
  t: ReturnType<typeof useTranslations<"onlineClasses">>,
  title: string,
  passScore: string,
  questions: QuizQuestionDraft[]
): string | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return t("quizEditor.validation.titleRequired");
  if (trimmedTitle.length > TITLE_MAX)
    return t("quizEditor.validation.titleTooLong", { max: TITLE_MAX });

  const score = parseInt(passScore, 10);
  if (!Number.isInteger(score) || score < 0 || score > 100)
    return t("quizEditor.validation.passScoreRange");

  if (questions.length < 1) return t("quizEditor.validation.atLeastOneQuestion");
  if (questions.length > MAX_QUESTIONS)
    return t("quizEditor.validation.maxQuestions", { max: MAX_QUESTIONS });

  for (let i = 0; i < questions.length; i++) {
    const n = i + 1;
    const q = questions[i];
    const text = q.text.trim();
    if (!text) return t("quizEditor.validation.questionTextRequired", { n });
    if (text.length > QUESTION_TEXT_MAX)
      return t("quizEditor.validation.questionTextTooLong", { n, max: QUESTION_TEXT_MAX });
    if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS)
      return t("quizEditor.validation.optionsCount", { n, min: MIN_OPTIONS, max: MAX_OPTIONS });
    let correct = 0;
    for (const o of q.options) {
      const optText = o.text.trim();
      if (!optText) return t("quizEditor.validation.optionTextRequired", { n });
      if (optText.length > OPTION_TEXT_MAX)
        return t("quizEditor.validation.optionTextTooLong", { n, max: OPTION_TEXT_MAX });
      if (o.isCorrect) correct++;
    }
    if (correct !== 1) return t("quizEditor.validation.exactlyOneCorrect", { n });
  }

  return null;
}

// ─── Component ──────────────────────────────────────────────────

export function QuizEditor({
  moduleId,
  moduleTitle,
  onClose,
}: {
  moduleId: string;
  moduleTitle: string;
  onClose: () => void;
}) {
  const t = useTranslations("onlineClasses");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [passScore, setPassScore] = useState("70");
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>([
    emptyQuestion(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loadedQuizId, setLoadedQuizId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-quiz", moduleId],
    queryFn: () =>
      fetchJSON<{ quiz: QuizApi | null }>(
        `/api/online-classes/modules/${moduleId}/quiz`
      ),
  });

  useEffect(() => {
    if (!data) return;
    const quiz = data.quiz;
    if (!quiz) {
      setLoadedQuizId(null);
      setTitle(t("quizEditor.title", { moduleTitle }));
      setPassScore("70");
      setQuestions([emptyQuestion()]);
      return;
    }
    setLoadedQuizId(quiz.id);
    setTitle(quiz.title);
    setPassScore(String(quiz.passScore));
    setQuestions(
      (quiz.questions ?? []).map((q) => ({
        text: q.text,
        options: (q.options ?? []).map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }))
    );
  }, [data, moduleTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/online-classes/modules/${moduleId}/quiz`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          passScore: parseInt(passScore, 10),
          questions: questions.map((q) => ({
            text: q.text.trim(),
            options: q.options.map((o) => ({
              text: o.text.trim(),
              isCorrect: o.isCorrect,
            })),
          })),
        }),
      }),
    onSuccess: () => {
      toast.success(t("quizEditor.toasts.saved"));
      queryClient.invalidateQueries({ queryKey: ["oc-quiz", moduleId] });
      queryClient.invalidateQueries({ queryKey: ["oc-courses"] });
      onClose();
    },
    onError: (e: Error) => {
      const message = e.message || t("quizEditor.toasts.saveError");
      setError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/online-classes/modules/${moduleId}/quiz`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(t("quizEditor.toasts.deleted"));
      queryClient.invalidateQueries({ queryKey: ["oc-quiz", moduleId] });
      queryClient.invalidateQueries({ queryKey: ["oc-courses"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("quizEditor.toasts.deleteError")),
  });

  // ─── Draft mutators ───────────────────────────────────────────

  function updateQuestion(index: number, patch: Partial<QuizQuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function updateOption(
    qIndex: number,
    oIndex: number,
    patch: Partial<QuizOptionDraft>
  ) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIndex
          ? q
          : {
              ...q,
              options: q.options.map((o, j) =>
                j === oIndex ? { ...o, ...patch } : o
              ),
            }
      )
    );
  }

  function markCorrect(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIndex
          ? q
          : {
              ...q,
              options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIndex })),
            }
      )
    );
  }

  function addQuestion() {
    setQuestions((prev) =>
      prev.length >= MAX_QUESTIONS ? prev : [...prev, emptyQuestion()]
    );
  }

  function removeQuestion(index: number) {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  function addOption(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIndex || q.options.length >= MAX_OPTIONS
          ? q
          : { ...q, options: [...q.options, { text: "", isCorrect: false }] }
      )
    );
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= MIN_OPTIONS) return q;
        const options = q.options.filter((_, j) => j !== oIndex);
        if (!options.some((o) => o.isCorrect) && options.length > 0) {
          options[0] = { ...options[0], isCorrect: true };
        }
        return { ...q, options };
      })
    );
  }

  function handleSave() {
    const validationError = validateDraft(t, title, passScore, questions);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    setError(null);
    saveMutation.mutate();
  }

  function handleDelete() {
    if (
      !window.confirm(
        t("quizEditor.confirmDelete")
      )
    ) {
      return;
    }
    deleteMutation.mutate();
  }

  const busy = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Modal title={t("quizEditor.title", { moduleTitle })} onClose={onClose} maxWidth="max-w-2xl">
      {isLoading ? (
        <PetraLoader variant="inline" />
      ) : isError ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
          <p className="text-red-600 font-medium mb-3">{t("quizEditor.loadError")}</p>
          <button className="btn-secondary text-sm" onClick={() => refetch()}>
            {t("quizEditor.retry")}
          </button>
        </div>
      ) : (
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pe-1">
          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">{t("quizEditor.titleLabel")}</label>
              <input
                className="input"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("quizEditor.titlePlaceholder")}
              />
            </div>
            <div>
              <label className="label">{t("quizEditor.passScoreLabel")}</label>
              <div className="relative">
                <input
                  className="input pe-8"
                  type="number"
                  min={0}
                  max={100}
                  value={passScore}
                  onChange={(e) => setPassScore(e.target.value)}
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-petra-muted text-sm pointer-events-none">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <div
                key={qIndex}
                className="rounded-xl border border-petra-border p-4 bg-slate-50/60"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-bold text-petra-text flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-petra-muted" />
                    {t("quizEditor.questionNumber", { n: qIndex + 1 })}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("quizEditor.removeQuestion")}
                    </button>
                  )}
                </div>

                <input
                  className="input mb-3"
                  value={q.text}
                  maxLength={QUESTION_TEXT_MAX}
                  onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                  placeholder={t("quizEditor.questionPlaceholder")}
                />

                <div className="space-y-2">
                  {q.options.map((o, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`quiz-q-${qIndex}`}
                        checked={o.isCorrect}
                        onChange={() => markCorrect(qIndex, oIndex)}
                        className="w-4 h-4 accent-petra-sidebar-active shrink-0"
                        aria-label={t("quizEditor.correctAnswerAria", { n: oIndex + 1 })}
                      />
                      <input
                        className="input flex-1"
                        value={o.text}
                        maxLength={OPTION_TEXT_MAX}
                        onChange={(e) =>
                          updateOption(qIndex, oIndex, { text: e.target.value })
                        }
                        placeholder={t("quizEditor.optionPlaceholder", { n: oIndex + 1 })}
                      />
                      {q.options.length > MIN_OPTIONS && (
                        <button
                          type="button"
                          onClick={() => removeOption(qIndex, oIndex)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-petra-muted hover:bg-red-50 hover:text-red-600 shrink-0"
                          aria-label={t("quizEditor.removeOption")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {q.options.length < MAX_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => addOption(qIndex)}
                    className="mt-2 text-xs text-petra-muted hover:text-petra-text inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("quizEditor.addOption")}
                  </button>
                )}
              </div>
            ))}
          </div>

          {questions.length < MAX_QUESTIONS && (
            <button type="button" className="btn-secondary text-sm" onClick={addQuestion}>
              <Plus className="w-4 h-4" />
              {t("quizEditor.addQuestion")}
            </button>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-petra-border">
            <div>
              {loadedQuizId && (
                <button
                  type="button"
                  className="btn-danger text-sm"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  <Trash2 className="w-4 h-4" />
                  {t("quizEditor.deleteQuiz")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={onClose}
                disabled={busy}
              >
                {tc("actions.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={handleSave}
                disabled={busy}
              >
                {saveMutation.isPending ? tc("progress.saving") : t("quizEditor.saveQuiz")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
