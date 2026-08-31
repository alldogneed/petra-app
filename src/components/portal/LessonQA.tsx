"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, MessageCircleQuestion } from "lucide-react";

export interface PortalQuestion {
  id: string;
  body: string;
  isPrivate: boolean;
  answerBody: string | null;
  answeredAt: string | null;
  createdAt: string;
  askedByName: string;
  isMine: boolean;
}

const MAX_BODY = 1000;

function heDateTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/**
 * Student-facing Q&A block, mounted under the lesson player.
 * Plain fetch — the portal pages do not use React Query.
 */
export function LessonQA({
  slug,
  lessonId,
  canAsk,
}: {
  slug: string;
  lessonId: string;
  canAsk: boolean;
}) {
  const [questions, setQuestions] = useState<PortalQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portal/${slug}/lessons/${lessonId}/questions`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "שגיאה בטעינת השאלות"
        );
      }
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינת השאלות");
    } finally {
      setLoading(false);
    }
  }, [slug, lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (text.length < 3) {
      setSendError("השאלה קצרה מדי — לפחות 3 תווים");
      return;
    }
    if (text.length > MAX_BODY) {
      setSendError("השאלה ארוכה מדי — עד 1000 תווים");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(
        `/api/portal/${slug}/lessons/${lessonId}/questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text, isPrivate }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "שגיאה בשליחת השאלה"
        );
      }
      setDraft("");
      setIsPrivate(false);
      await load();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "שגיאה בשליחת השאלה");
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      dir="rtl"
      className="rounded-2xl shadow-card bg-white border border-slate-100 p-5 mt-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <MessageCircleQuestion
          className="w-5 h-5"
          style={{ color: "var(--portal-primary)" }}
        />
        <h2 className="text-base font-bold text-slate-800">שאלות ותשובות</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin"
            style={{
              borderColor: "var(--portal-primary)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-rose-600 mb-3">{error}</p>
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            נסה שוב
          </button>
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          אין עדיין שאלות — היו הראשונים לשאול
        </p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold text-slate-800">
                  {q.isMine ? "אני" : q.askedByName}
                </span>
                <span className="text-xs text-slate-400">
                  {heDateTime(q.createdAt)}
                </span>
                {q.isPrivate && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Lock className="w-3 h-3" />
                    פרטי
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {q.body}
              </p>

              {q.answerBody ? (
                <div className="mt-3 me-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">
                    תשובת המדריך
                    {q.answeredAt ? ` · ${heDateTime(q.answeredAt)}` : ""}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {q.answerBody}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">ממתין לתשובה</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAsk && !error && (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <label
            htmlFor="portal-qa-draft"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            שאל שאלה
          </label>
          <textarea
            id="portal-qa-draft"
            value={draft}
            maxLength={MAX_BODY}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="מה לא ברור בשיעור? כתבו כאן ונחזור אליכם"
            className="w-full min-h-[90px] resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />

          <label className="flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            רק אני אראה את השאלה
          </label>

          {sendError && (
            <p className="mt-2 text-sm text-rose-600">{sendError}</p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || draft.trim().length === 0}
              style={{ backgroundColor: "var(--portal-primary)" }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-95 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending && (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              )}
              שליחת שאלה
            </button>
            <span className="text-xs text-slate-400">
              {draft.length}/{MAX_BODY}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
