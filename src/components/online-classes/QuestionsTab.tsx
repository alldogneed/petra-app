"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircleQuestion,
  AlertTriangle,
  Trash2,
  Lock,
  Pencil,
} from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { heDateTime, unwrapList } from "./shared";
import { PetraLoader } from "@/components/ui/PetraLoader";

export interface BusinessQuestionItem {
  id: string;
  body: string;
  answerBody: string | null;
  answeredAt: string | null;
  createdAt: string;
  isPrivate: boolean;
  student: { name: string; email: string };
  lesson: { id: string; title: string; courseTitle: string };
}

type FilterId = "pending" | "answered" | "all";

// Labels: onlineClasses.questionsTab.filters.<id>
const FILTERS: { id: FilterId }[] = [
  { id: "pending" },
  { id: "answered" },
  { id: "all" },
];

function queryFor(filter: FilterId): string {
  if (filter === "pending") return "/api/online-classes/questions?answered=false";
  if (filter === "answered") return "/api/online-classes/questions?answered=true";
  return "/api/online-classes/questions";
}

export function QuestionsTab() {
  const t = useTranslations("onlineClasses");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("pending");
  /** questionId → draft answer text (open editor) */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-questions", filter],
    queryFn: () => fetchJSON(queryFor(filter)),
  });
  const questions = unwrapList<BusinessQuestionItem>(data, "questions", "items");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["oc-questions"] });

  const answerMutation = useMutation({
    mutationFn: ({ id, answerBody }: { id: string; answerBody: string }) =>
      fetchJSON(`/api/online-classes/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerBody }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(t("questionsTab.toasts.answered"));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || t("questionsTab.toasts.answerError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/online-classes/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("questionsTab.toasts.deleted"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || t("questionsTab.toasts.deleteError")),
  });

  const openEditor = (q: BusinessQuestionItem) =>
    setDrafts((prev) => ({ ...prev, [q.id]: q.answerBody ?? "" }));

  const closeEditor = (id: string) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const submitAnswer = (id: string) => {
    const text = (drafts[id] ?? "").trim();
    if (!text) {
      toast.error(t("questionsTab.toasts.emptyAnswer"));
      return;
    }
    if (text.length > 2000) {
      toast.error(t("questionsTab.toasts.tooLong"));
      return;
    }
    answerMutation.mutate({ id, answerBody: text });
  };

  const confirmDelete = (q: BusinessQuestionItem) => {
    if (
      window.confirm(
        t("questionsTab.confirmDelete", { name: q.student.name })
      )
    ) {
      deleteMutation.mutate(q.id);
    }
  };

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">{t("questionsTab.loadError")}</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>
          {t("questionsTab.retry")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                filter === f.id
                  ? "px-3.5 py-1.5 rounded-full text-xs font-medium bg-brand-500 text-white whitespace-nowrap"
                  : "px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-petra-muted hover:bg-slate-200 whitespace-nowrap"
              }
            >
              {t(`questionsTab.filters.${f.id}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : questions.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <MessageCircleQuestion className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-petra-text mb-1">{t("questionsTab.empty.title")}</p>
          <p className="text-sm text-petra-muted">
            {t("questionsTab.empty.body")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isAnswered = !!q.answeredAt;
            const editorOpen = drafts[q.id] !== undefined;
            return (
              <div key={q.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-petra-text">
                        {q.student.name || "—"}
                      </span>
                      {isAnswered && (
                        <span className="badge-success">{t("questionsTab.answeredBadge")}</span>
                      )}
                      {q.isPrivate && (
                        <span className="inline-flex items-center gap-1 text-xs text-petra-muted">
                          <Lock className="w-3 h-3" />
                          {t("questionsTab.privateQuestion")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-petra-muted">
                      {q.lesson.title}
                      {q.lesson.courseTitle ? ` · ${q.lesson.courseTitle}` : ""}
                      {" · "}
                      {heDateTime(q.createdAt)}
                    </p>
                  </div>
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600 shrink-0"
                    title={t("questionsTab.deleteTitle")}
                    onClick={() => confirmDelete(q)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-petra-text whitespace-pre-wrap mb-3">
                  {q.body}
                </p>

                {isAnswered && !editorOpen && (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 mb-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">
                      {t("questionsTab.yourAnswer")}
                      {q.answeredAt ? ` · ${heDateTime(q.answeredAt)}` : ""}
                    </p>
                    <p className="text-sm text-petra-text whitespace-pre-wrap">
                      {q.answerBody}
                    </p>
                  </div>
                )}

                {editorOpen ? (
                  <div>
                    <textarea
                      className="input min-h-[96px] resize-y"
                      value={drafts[q.id] ?? ""}
                      maxLength={2000}
                      placeholder={t("questionsTab.answerPlaceholder")}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="btn-primary text-sm"
                        onClick={() => submitAnswer(q.id)}
                        disabled={answerMutation.isPending}
                      >
                        {t("questionsTab.sendAnswer")}
                      </button>
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => closeEditor(q.id)}
                        disabled={answerMutation.isPending}
                      >
                        {tc("actions.cancel")}
                      </button>
                      <span className="text-xs text-petra-muted">
                        {(drafts[q.id] ?? "").length}/2000
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    className={isAnswered ? "btn-secondary text-sm" : "btn-primary text-sm"}
                    onClick={() => openEditor(q)}
                  >
                    {isAnswered ? (
                      <>
                        <Pencil className="w-4 h-4" />
                        {t("questionsTab.editAnswer")}
                      </>
                    ) : (
                      t("questionsTab.answerQuestion")
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
