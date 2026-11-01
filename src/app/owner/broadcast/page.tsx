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
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";

const API = "/api/admin/broadcast-messages";
const HISTORY_KEY = ["owner", "broadcast", "history"] as const;
const TITLE_MAX = 120;
const CONTENT_MAX = 1000;

type BroadcastT = ReturnType<typeof useTranslations<"owner.ownerBroadcastPage">>;

interface MessageType {
  value: string;
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
  { value: "info",    icon: Info,          text: "text-blue-700",  soft: "bg-blue-50",  border: "border-blue-200",  ring: "ring-blue-500" },
  { value: "success", icon: CheckCircle2,  text: "text-green-700", soft: "bg-green-50", border: "border-green-200", ring: "ring-green-500" },
  { value: "warning", icon: AlertTriangle, text: "text-amber-700", soft: "bg-amber-50", border: "border-amber-200", ring: "ring-amber-500" },
  { value: "error",   icon: XCircle,       text: "text-red-700",   soft: "bg-red-50",   border: "border-red-200",   ring: "ring-red-500" },
];

const EXPIRY_PRESETS = [
  { key: "tomorrow", days: 1 },
  { key: "threeDays", days: 3 },
  { key: "week", days: 7 },
  { key: "twoWeeks", days: 14 },
  { key: "month", days: 30 },
];

function typeMeta(value: string): MessageType {
  return MESSAGE_TYPES.find((t) => t.value === value) ?? MESSAGE_TYPES[0];
}

function relativeTime(date: string, t: BroadcastT) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("relative.now");
  if (m < 60) return t("relative.minutesAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("relative.hoursAgo", { count: h });
  return t("relative.daysAgo", { count: Math.floor(h / 24) });
}

function formatDate(date: string, locale: string) {
  return new Date(date).toLocaleString(locale, {
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
  const t = useTranslations("owner.ownerBroadcastPage");
  const meta = typeMeta(type);
  const Icon = meta.icon;
  return (
    <div className={cn("rounded-xl border p-4 flex gap-3", meta.soft, meta.border)}>
      <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", meta.text)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold break-words", meta.text)}>
          {title || t("preview.titlePlaceholder")}
        </p>
        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">
          {content || t("preview.contentPlaceholder")}
        </p>
        {actionUrl && actionLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1 mt-3 text-xs px-2.5 py-1 rounded-lg font-medium bg-white border",
              meta.border,
              meta.text
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
  const t = useTranslations("owner.ownerBroadcastPage");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
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
          ? t("toasts.updated", { count: data.updated })
          : t("toasts.sent", { count: data.sent ?? 0 })
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("toasts.sendError"));
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
      toast.success(t("toasts.deleted", { count: data.deleted }));
      setDeleteTarget(null);
      // The broadcast being edited no longer exists — drop edit mode
      if (editingOriginal && broadcastKeyStr(editingOriginal) === broadcastKeyStr(key)) resetForm();
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("toasts.deleteError"));
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
          <h1 className="page-title">{t("page.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("page.subtitle")}
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
            {t("page.refresh")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ── Composer ─────────────────────────────────────────────────── */}
        <section className="card lg:col-span-3 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                {isEditing ? t("composer.titleEdit") : t("composer.titleNew")}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {isEditing
                  ? t("composer.subtitleEdit")
                  : t("composer.subtitleNew")}
              </p>
            </div>
            {isEditing && (
              <button type="button" onClick={resetForm} className="btn-ghost flex-shrink-0">
                <X className="w-4 h-4" />
                {t("composer.cancelEdit")}
              </button>
            )}
          </div>

          <div className="p-5 space-y-5">
            {/* Message type */}
            <div>
              <span className="label" id="broadcast-type-label">{t("composer.typeLabel")}</span>
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                role="radiogroup"
                aria-labelledby="broadcast-type-label"
              >
                {MESSAGE_TYPES.map((mt) => {
                  const Icon = mt.icon;
                  const active = type === mt.value;
                  return (
                    <button
                      key={mt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setType(mt.value)}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                        mt.soft,
                        mt.border,
                        mt.text,
                        active
                          ? cn("ring-2 ring-offset-1", mt.ring)
                          : "opacity-70 hover:opacity-100"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{t(`types.${mt.value}`)}</span>
                      {active && <Check className="w-4 h-4 ms-auto flex-shrink-0" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="label" htmlFor="broadcast-title">{t("composer.titleField")}</label>
              <input
                id="broadcast-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("composer.titlePlaceholder")}
                maxLength={TITLE_MAX}
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1 text-end" dir="ltr">
                {title.length}/{TITLE_MAX}
              </p>
            </div>

            {/* Content */}
            <div>
              <label className="label" htmlFor="broadcast-content">{t("composer.contentField")}</label>
              <textarea
                id="broadcast-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("composer.contentPlaceholder")}
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
                <label className="label" htmlFor="broadcast-url">{t("composer.urlField")}</label>
                <input
                  id="broadcast-url"
                  type="text"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder={t("composer.urlPlaceholder")}
                  dir="ltr"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="broadcast-label">{t("composer.buttonField")}</label>
                <input
                  id="broadcast-label"
                  type="text"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder={t("composer.buttonPlaceholder")}
                  className="input"
                />
              </div>
            </div>
            {(actionUrl.trim() !== "") !== (actionLabel.trim() !== "") && (
              <p className="text-xs text-amber-700 -mt-2">
                {t("composer.buttonHint")}
              </p>
            )}

            {/* Expiry */}
            <div>
              <label className="label" htmlFor="broadcast-expiry">{t("composer.expiryField")}</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {EXPIRY_PRESETS.map(({ key, days }) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExpiryDays(days)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    {t(`expiry.presets.${key}`)}
                  </button>
                ))}
                {expiresAt && (
                  <button
                    type="button"
                    onClick={() => setExpiresAt("")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    {t("expiry.remove")}
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
                  ? t("expiry.disappearsAt", { date: expiryDate.toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) })
                  : t("expiry.noneHint")}
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
              {isEditing ? t("composer.submitEdit") : t("composer.submitNew")}
            </button>
          </div>
        </section>

        {/* ── Preview + history ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">{t("preview.title")}</h2>
            <p className="text-sm text-slate-500 mb-3">
              {t("preview.subtitle", { type: t(`types.${selectedType.value}`) })}
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
              <h2 className="text-base font-semibold text-slate-900">{t("history.title")}</h2>
              {broadcasts.length > 0 && (
                <span className="badge badge-neutral">{broadcasts.length}</span>
              )}
            </div>

            <div className="overflow-y-auto max-h-[600px]">
              {historyLoading ? (
                <PetraLoader variant="inline" />
              ) : historyError ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">{t("history.loadError")}</p>
                  <button type="button" onClick={() => refetch()} className="btn-secondary mt-3">
                    {t("history.retry")}
                  </button>
                </div>
              ) : !broadcasts.length ? (
                <div className="p-8 text-center">
                  <Megaphone className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    {t("history.empty")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {broadcasts.map((b) => {
                    const meta = typeMeta(b.type);
                    const Icon = meta.icon;
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
                              meta.soft,
                              meta.border
                            )}
                          >
                            <Icon className={cn("w-4 h-4", meta.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-900 break-words min-w-0">
                                {b.title}
                              </p>
                              {isEditingThis && <span className="badge badge-brand">{t("history.editingBadge")}</span>}
                            </div>
                            <p className="text-sm text-slate-700 mt-0.5 line-clamp-2 break-words">
                              {b.content}
                            </p>
                            <div className="flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap text-xs text-slate-500">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded-md border font-medium",
                                  meta.soft,
                                  meta.border,
                                  meta.text
                                )}
                              >
                                {t(`types.${meta.value}`)}
                              </span>
                              <span className="flex items-center gap-1" title={formatDate(b.sentAt, locale)}>
                                <Clock className="w-3.5 h-3.5" />
                                {relativeTime(b.sentAt, t)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {t("history.businesses", { count: Number(b.businesses) })}
                              </span>
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  b.readCount > 0 && "text-green-700 font-medium"
                                )}
                                title={t("history.readTooltip")}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t("history.readCount", { count: b.readCount })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {t("history.sentAt", { date: formatDate(b.sentAt, locale) })}
                              {b.expiresAt && t("history.expiresAt", { date: formatDate(b.expiresAt, locale) })}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(b)}
                              title={t("history.edit")}
                              aria-label={t("history.edit")}
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
                              title={t("history.remove")}
                              aria-label={t("history.remove")}
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
                {isEditing ? t("confirmSend.titleEdit") : t("confirmSend.titleNew")}
              </h2>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sendPending}
                className="btn-ghost p-1 rounded-lg"
                aria-label={tc("actions.close")}
                title={tc("actions.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                {isEditing
                  ? t("confirmSend.warningEdit")
                  : t("confirmSend.warningNew")}
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
                <dt className="text-slate-500 w-20 flex-shrink-0">{t("confirmSend.type")}</dt>
                <dd className={cn("font-medium", selectedType.text)}>{t(`types.${selectedType.value}`)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500 w-20 flex-shrink-0">{t("confirmSend.link")}</dt>
                <dd className="text-slate-700 min-w-0 break-all">
                  {actionUrl.trim() ? (
                    <>
                      <span dir="ltr">{actionUrl.trim()}</span>
                      {actionLabel.trim()
                        ? t("confirmSend.buttonLabel", { label: actionLabel.trim() })
                        : t("confirmSend.noButtonText")}
                    </>
                  ) : (
                    t("confirmSend.noLink")
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500 w-20 flex-shrink-0">{t("confirmSend.expiry")}</dt>
                <dd className="text-slate-700">
                  {expiryValid && expiryDate ? formatDate(expiryDate.toISOString(), locale) : t("confirmSend.noExpiry")}
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
                {tc("actions.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sendPending}
                className="btn-primary disabled:opacity-50"
              >
                {isEditing ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {sendPending
                  ? isEditing ? tc("progress.updating") : t("confirmSend.sending")
                  : isEditing ? t("confirmSend.confirmEdit") : t("confirmSend.confirmNew")}
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
                {t("confirmDelete.title")}
              </h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletePending}
                className="btn-ghost p-1 rounded-lg"
                aria-label={tc("actions.close")}
                title={tc("actions.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                {t("confirmDelete.warning", { count: Number(deleteTarget.businesses) })}
              </p>
            </div>

            <MessagePreview
              type={deleteTarget.type}
              title={deleteTarget.title}
              content={deleteTarget.content}
              actionUrl={deleteTarget.actionUrl}
              actionLabel={deleteTarget.actionLabel}
            />
            <p className="text-xs text-slate-500 mt-2">{t("history.sentAt", { date: formatDate(deleteTarget.sentAt, locale) })}</p>

            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletePending}
                className="btn-secondary"
              >
                {tc("actions.cancel")}
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
                {deletePending ? t("confirmDelete.removing") : t("confirmDelete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
