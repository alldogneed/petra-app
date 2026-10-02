"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  Users,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Eye,
  Check,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";

const API = "/api/admin/broadcast-messages";
const HISTORY_KEY = ["owner", "broadcast", "history"] as const;
const TITLE_MAX = 120;
const CONTENT_MAX = 1000;

interface MessageType {
  value: string;
  label: string;
  icon: LucideIcon;
  /** icon / accent text */
  text: string;
  /** soft surface (preview banner, icon chip) */
  soft: string;
  /** border on the soft surface */
  border: string;
  /** ring for the selected selector button */
  ring: string;
}

const MESSAGE_TYPES: MessageType[] = [
  { value: "info",    label: "מידע",        icon: Info,          text: "text-blue-700",  soft: "bg-blue-50",  border: "border-blue-200",  ring: "ring-blue-500" },
  { value: "success", label: "הצלחה",       icon: CheckCircle2,  text: "text-green-700", soft: "bg-green-50", border: "border-green-200", ring: "ring-green-500" },
  { value: "warning", label: "אזהרה",       icon: AlertTriangle, text: "text-amber-700", soft: "bg-amber-50", border: "border-amber-200", ring: "ring-amber-500" },
  { value: "error",   label: "שגיאה/חירום", icon: XCircle,       text: "text-red-700",   soft: "bg-red-50",   border: "border-red-200",   ring: "ring-red-500" },
];

const EXPIRY_PRESETS = [
  { label: "מחר", days: 1 },
  { label: "3 ימים", days: 3 },
  { label: "שבוע", days: 7 },
  { label: "שבועיים", days: 14 },
  { label: "חודש", days: 30 },
];

function typeMeta(value: string): MessageType {
  return MESSAGE_TYPES.find((t) => t.value === value) ?? MESSAGE_TYPES[0];
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date → value for <input type="datetime-local"> in the viewer's local time. */
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Broadcast {
  title: string;
  content: string;
  type: string;
  sentAt: string;
  businesses: number;
  readCount: number;
  actionUrl: string | null;
  actionLabel: string | null;
  expiresAt: string | null;
}

/** The (title, content, type) triple that identifies one broadcast wave. */
type BroadcastKey = Pick<Broadcast, "title" | "content" | "type">;

interface BroadcastPayload {
  title: string;
  content: string;
  type: string;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string;
}

const broadcastKeyStr = (b: BroadcastKey) => `${b.title}|${b.content}|${b.type}`;

/** How the message looks to a user — shared by the live preview and the confirm modals. */
function MessagePreview({
  type,
  title,
  content,
  actionUrl,
  actionLabel,
}: {
  type: string;
  title: string;
  content: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}) {
  const t = typeMeta(type);
  const Icon = t.icon;
  return (
    <div className={cn("rounded-xl border p-4 flex gap-3", t.soft, t.border)}>
      <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", t.text)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold break-words", t.text)}>
          {title || "כותרת ההודעה"}
        </p>
        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">
          {content || "תוכן ההודעה יופיע כאן..."}
        </p>
        {actionUrl && actionLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1 mt-3 text-xs px-2.5 py-1 rounded-lg font-medium bg-white border",
              t.border,
              t.text
            )}
          >
            {actionLabel}
            <ExternalLink className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}

export default function BroadcastPage() {
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("info");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  /** datetime-local value in the viewer's local time ("" = no expiry) */
  const [expiresAt, setExpiresAt] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  // When set, the compose form edits this existing broadcast instead of sending a new one
  const [editingOriginal, setEditingOriginal] = useState<BroadcastKey | null>(null);
  // History row pending retract confirmation
  const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null);

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    isFetching: historyFetching,
    refetch,
  } = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: () => fetchJSON<{ broadcasts: Broadcast[] }>(API),
    refetchInterval: 60000,
  });

  const broadcasts: Broadcast[] = historyData?.broadcasts ?? [];

  function resetForm() {
    setTitle("");
    setContent("");
    setType("info");
    setActionUrl("");
    setActionLabel("");
    setExpiresAt("");
    setShowConfirm(false);
    setEditingOriginal(null);
  }

  // POST for a new broadcast, PATCH when editing an existing one
  const sendMutation = useMutation({
    mutationFn: ({ payload, original }: { payload: BroadcastPayload; original: BroadcastKey | null }) =>
      fetchJSON<{ sent?: number; updated?: number }>(API, {
        method: original ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(original ? { ...payload, original } : payload),
      }),
    onSuccess: (data) => {
      toast.success(
        data.updated != null
          ? `השידור עודכן ב-${data.updated} תיבות`
          : `ההודעה נשלחה ל-${data.sent ?? 0} עסקים`
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (err: Error) => {
      toast.error(err.message || "שגיאה בשליחה");
    },
  });

  // Retract — removes every remaining copy of a broadcast
  const deleteMutation = useMutation({
    mutationFn: (key: BroadcastKey) =>
      fetchJSON<{ deleted: number }>(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key),
      }),
    onSuccess: (data, key) => {
      toast.success(`השידור הוסר מ-${data.deleted} תיבות`);
      setDeleteTarget(null);
      // The broadcast being edited no longer exists — drop edit mode
      if (editingOriginal && broadcastKeyStr(editingOriginal) === broadcastKeyStr(key)) resetForm();
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (err: Error) => {
      toast.error(err.message || "שגיאה במחיקה");
    },
  });

  const sendPending = sendMutation.isPending;
  const deletePending = deleteMutation.isPending;

  // Escape closes whichever confirm modal is open (unless a request is in flight)
  useEffect(() => {
    if (!showConfirm && !deleteTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showConfirm && !sendPending) setShowConfirm(false);
      if (deleteTarget && !deletePending) setDeleteTarget(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showConfirm, deleteTarget, sendPending, deletePending]);

  /** Load an existing broadcast into the compose form for editing. */
  function startEdit(b: Broadcast) {
    setEditingOriginal({ title: b.title, content: b.content, type: b.type });
    setTitle(b.title);
    setContent(b.content);
    setType(b.type);
    setActionUrl(b.actionUrl ?? "");
    setActionLabel(b.actionLabel ?? "");
    setExpiresAt(b.expiresAt ? toLocalInputValue(new Date(b.expiresAt)) : "");
    setShowConfirm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setExpiryDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setExpiresAt(toLocalInputValue(d));
  }

  const canSubmit = !!title.trim() && !!content.trim();
  const expiryDate = expiresAt ? new Date(expiresAt) : null;
  const expiryValid = !!expiryDate && !Number.isNaN(expiryDate.getTime());

  function handleSend() {
    if (!canSubmit) return;
    sendMutation.mutate({
      payload: {
        title,
        content,
        type,
        actionUrl: actionUrl || undefined,
        actionLabel: actionLabel || undefined,
        // Full ISO instant so the server stores the moment the admin picked, regardless of server TZ
        expiresAt: expiryValid && expiryDate ? expiryDate.toISOString() : undefined,
      },
      original: editingOriginal,
    });
  }

  const selectedType = typeMeta(type);
  const isEditing = editingOriginal !== null;

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">הודעות שידור</h1>
          <p className="text-sm text-slate-500 mt-1">
            שליחת הודעת מערכת לכל המשתמשים בפטרה, עריכה והסרה של שידורים קודמים
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary"
            disabled={historyFetching}
          >
            <RefreshCw className={cn("w-4 h-4", historyFetching && "animate-spin")} />
            רענן
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ── Composer ─────────────────────────────────────────────────── */}
        <section className="card lg:col-span-3 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                {isEditing ? "עריכת שידור קיים" : "הרכבת הודעה"}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {isEditing
                  ? "העדכון יחול על כל העותקים שעדיין בתיבות — עותקים שנמחקו על ידי משתמשים לא יחזרו"
                  : "ההודעה תופיע בממשק של כל משתמש רשום בפלטפורמה"}
              </p>
            </div>
            {isEditing && (
              <button type="button" onClick={resetForm} className="btn-ghost flex-shrink-0">
                <X className="w-4 h-4" />
                בטל עריכה
              </button>
            )}
          </div>

          <div className="p-5 space-y-5">
            {/* Message type */}
            <div>
              <span className="label" id="broadcast-type-label">סוג הודעה</span>
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                role="radiogroup"
                aria-labelledby="broadcast-type-label"
              >
                {MESSAGE_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setType(t.value)}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                        t.soft,
                        t.border,
                        t.text,
                        active
                          ? cn("ring-2 ring-offset-1", t.ring)
                          : "opacity-70 hover:opacity-100"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{t.label}</span>
                      {active && <Check className="w-4 h-4 ms-auto flex-shrink-0" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="label" htmlFor="broadcast-title">כותרת *</label>
              <input
                id="broadcast-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="לדוגמה: עדכון מערכת חשוב"
                maxLength={TITLE_MAX}
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1 text-end" dir="ltr">
                {title.length}/{TITLE_MAX}
              </p>
            </div>

            {/* Content */}
            <div>
              <label className="label" htmlFor="broadcast-content">תוכן ההודעה *</label>
              <textarea
                id="broadcast-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="פרט את תוכן העדכון או השינוי..."
                rows={5}
                maxLength={CONTENT_MAX}
                className="input resize-none"
              />
              <p className="text-xs text-slate-500 mt-1 text-end" dir="ltr">
                {content.length}/{CONTENT_MAX}
              </p>
            </div>

            {/* Optional action link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="broadcast-url">כתובת קישור (אופציונלי)</label>
                <input
                  id="broadcast-url"
                  type="text"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="/calendar או https://..."
                  dir="ltr"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="broadcast-label">טקסט כפתור (אופציונלי)</label>
                <input
                  id="broadcast-label"
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="לפרטים נוספים"
                  className="input"
                />
              </div>
            </div>
            {(actionUrl.trim() !== "") !== (actionLabel.trim() !== "") && (
              <p className="text-xs text-amber-700 -mt-2">
                הכפתור יוצג למשתמשים רק כשגם הכתובת וגם טקסט הכפתור מלאים.
              </p>
            )}

            {/* Expiry */}
            <div>
              <label className="label" htmlFor="broadcast-expiry">תאריך תפוגה (אופציונלי)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {EXPIRY_PRESETS.map(({ label, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExpiryDays(days)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    {label}
                  </button>
                ))}
                {expiresAt && (
                  <button
                    type="button"
                    onClick={() => setExpiresAt("")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    הסר תפוגה
                  </button>
                )}
              </div>
              <input
                id="broadcast-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1">
                {expiryValid && expiryDate
                  ? `ההודעה תיעלם מהתיבות ב-${expiryDate.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "ללא תפוגה — ההודעה תישאר עד שהמשתמש יסגור אותה"}
              </p>
            </div>

            {/* Submit — opens the confirmation modal, never sends directly */}
            <button
              type="button"
              onClick={() => canSubmit && setShowConfirm(true)}
              disabled={!canSubmit || sendPending}
              className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {isEditing ? "עדכן את השידור" : "שלח לכל המשתמשים"}
            </button>
          </div>
        </section>

        {/* ── Preview + history ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">תצוגה מקדימה</h2>
            <p className="text-sm text-slate-500 mb-3">
              כך ההודעה תיראה למשתמשים · סוג: {selectedType.label}
            </p>
            <MessagePreview
              type={type}
              title={title}
              content={content}
              actionUrl={actionUrl}
              actionLabel={actionLabel}
            />
          </section>

          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">היסטוריית שידורים</h2>
              {broadcasts.length > 0 && (
                <span className="badge badge-neutral">{broadcasts.length}</span>
              )}
            </div>

            <div className="overflow-y-auto max-h-[600px]">
              {historyLoading ? (
                <PetraLoader variant="inline" />
              ) : historyError ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">טעינת ההיסטוריה נכשלה.</p>
                  <button type="button" onClick={() => refetch()} className="btn-secondary mt-3">
                    נסה שוב
                  </button>
                </div>
              ) : !broadcasts.length ? (
                <div className="p-8 text-center">
                  <Megaphone className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    לא נשלחו הודעות עדיין — שידור שתשלח יופיע כאן עם מספר העסקים שקיבלו וקראו אותו.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {broadcasts.map((b) => {
                    const t = typeMeta(b.type);
                    const Icon = t.icon;
                    const keyStr = broadcastKeyStr(b);
                    const isEditingThis =
                      editingOriginal !== null && broadcastKeyStr(editingOriginal) === keyStr;
                    return (
                      <li
                        key={keyStr}
                        className={cn(
                          "px-5 py-4 transition-colors",
                          isEditingThis ? "bg-brand-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5",
                              t.soft,
                              t.border
                            )}
                          >
                            <Icon className={cn("w-4 h-4", t.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-900 break-words min-w-0">
                                {b.title}
                              </p>
                              {isEditingThis && <span className="badge badge-brand">בעריכה</span>}
                            </div>
                            <p className="text-sm text-slate-700 mt-0.5 line-clamp-2 break-words">
                              {b.content}
                            </p>
                            <div className="flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap text-xs text-slate-500">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded-md border font-medium",
                                  t.soft,
                                  t.border,
                                  t.text
                                )}
                              >
                                {t.label}
                              </span>
                              <span className="flex items-center gap-1" title={formatDate(b.sentAt)}>
                                <Clock className="w-3.5 h-3.5" />
                                {relativeTime(b.sentAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {Number(b.businesses)} עסקים
                              </span>
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  b.readCount > 0 && "text-green-700 font-medium"
                                )}
                                title="כמה תיבות סימנו את ההודעה כנקראה (לא כולל עסקים שמחקו אותה)"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {b.readCount} קראו
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              נשלח {formatDate(b.sentAt)}
                              {b.expiresAt && ` · תפוגה ${formatDate(b.expiresAt)}`}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(b)}
                              title="ערוך שידור"
                              aria-label="ערוך שידור"
                              className={cn(
                                "p-2 rounded-lg transition-colors hover:bg-slate-100",
                                isEditingThis ? "text-brand-600" : "text-slate-500 hover:text-slate-900"
                              )}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(b)}
                              title="הסר שידור מכל התיבות"
                              aria-label="הסר שידור מכל התיבות"
                              className="p-2 rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Send / update confirmation ─────────────────────────────────── */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => !sendPending && setShowConfirm(false)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-lg p-5"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="broadcast-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="broadcast-confirm-title" className="text-lg font-bold text-slate-900">
                {isEditing ? "אישור עדכון שידור" : "אישור שליחה לכל המשתמשים"}
              </h2>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sendPending}
                className="btn-ghost p-1 rounded-lg"
                aria-label="סגור"
                title="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                {isEditing
                  ? "העדכון יחליף את תוכן ההודעה אצל כל העסקים שעדיין לא מחקו אותה."
                  : "ההודעה תוצג לכל משתמש רשום בכל העסקים הפעילים בפטרה. אחרי השליחה ניתן לערוך או להסיר אותה, אבל משתמשים שכבר ראו אותה — ראו."}
              </p>
            </div>

            <MessagePreview
              type={type}
              title={title.trim()}
              content={content.trim()}
              actionUrl={actionUrl}
              actionLabel={actionLabel}
            />

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-slate-500 w-20 flex-shrink-0">סוג</dt>
                <dd className={cn("font-medium", selectedType.text)}>{selectedType.label}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500 w-20 flex-shrink-0">קישור</dt>
                <dd className="text-slate-700 min-w-0 break-all">
                  {actionUrl.trim() ? (
                    <>
                      <span dir="ltr">{actionUrl.trim()}</span>
                      {actionLabel.trim()
                        ? ` · כפתור: "${actionLabel.trim()}"`
                        : " · ללא טקסט כפתור (הכפתור לא יוצג)"}
                    </>
                  ) : (
                    "ללא קישור"
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500 w-20 flex-shrink-0">תפוגה</dt>
                <dd className="text-slate-700">
                  {expiryValid && expiryDate ? formatDate(expiryDate.toISOString()) : "ללא תפוגה"}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sendPending}
                className="btn-secondary"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sendPending}
                className="btn-primary disabled:opacity-50"
              >
                {isEditing ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {sendPending
                  ? isEditing ? "מעדכן..." : "שולח..."
                  : isEditing ? "כן, עדכן את השידור" : "כן, שלח לכל המשתמשים"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Retract confirmation ───────────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deletePending && setDeleteTarget(null)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-lg p-5"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="broadcast-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="broadcast-delete-title" className="text-lg font-bold text-slate-900">
                הסרת שידור מכל התיבות
              </h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletePending}
                className="btn-ghost p-1 rounded-lg"
                aria-label="סגור"
                title="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                ההודעה תימחק מהתיבות של כל {Number(deleteTarget.businesses)} העסקים שעדיין לא מחקו
                אותה. הפעולה אינה ניתנת לביטול.
              </p>
            </div>

            <MessagePreview
              type={deleteTarget.type}
              title={deleteTarget.title}
              content={deleteTarget.content}
              actionUrl={deleteTarget.actionUrl}
              actionLabel={deleteTarget.actionLabel}
            />
            <p className="text-xs text-slate-500 mt-2">נשלח {formatDate(deleteTarget.sentAt)}</p>

            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletePending}
                className="btn-secondary"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() =>
                  deleteMutation.mutate({
                    title: deleteTarget.title,
                    content: deleteTarget.content,
                    type: deleteTarget.type,
                  })
                }
                disabled={deletePending}
                className="btn-danger disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deletePending ? "מסיר..." : "כן, הסר לכולם"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
