"use client";

import { BookingsTabs } from "@/components/bookings/BookingsTabs";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  MessageSquare,
  Mail,
  Phone,
  Ban,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { cn, fetchJSON, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface ScheduledMessage {
  id: string;
  channel: string;
  templateKey: string;
  payloadJson: string;
  sendAt: string;
  status: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
}

interface PageData {
  messages: ScheduledMessage[];
  total: number;
  page: number;
  pages: number;
  stats?: {
    PENDING: number;
    SENT: number;
    FAILED: number;
    CANCELED: number;
  };
}

const STATUS_INFO: Record<
  string,
  { label: string; badgeClass: string; icon: React.ElementType; iconColor: string; bgColor: string }
> = {
  PENDING: {
    label: "ממתין",
    badgeClass: "badge-warning",
    icon: Clock,
    iconColor: "#F59E0B",
    bgColor: "#FEF3C715",
  },
  SENT: {
    label: "נשלח",
    badgeClass: "badge-success",
    icon: CheckCircle2,
    iconColor: "#22C55E",
    bgColor: "#F0FDF415",
  },
  FAILED: {
    label: "נכשל",
    badgeClass: "badge-danger",
    icon: AlertTriangle,
    iconColor: "#EF4444",
    bgColor: "#FEF2F215",
  },
  CANCELED: {
    label: "בוטל",
    badgeClass: "badge-neutral",
    icon: XCircle,
    iconColor: "#94A3B8",
    bgColor: "#F1F5F915",
  },
};

const CHANNEL_INFO: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "#22C55E" },
  sms: { label: "SMS", icon: Phone, color: "#3B82F6" },
  email: { label: "אימייל", icon: Mail, color: "#6366F1" },
};

const FILTER_STATUSES = [
  { id: "ALL", label: "הכל" },
  { id: "PENDING", label: "ממתינות" },
  { id: "SENT", label: "נשלחו" },
  { id: "FAILED", label: "נכשלו" },
  { id: "CANCELED", label: "בוטלו" },
];

const FILTER_CHANNELS = [
  { id: "ALL", label: "כל הערוצים" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "אימייל" },
];

function getPayloadPreview(payloadJson: string): string {
  try {
    const p = JSON.parse(payloadJson);
    return p.body || p.message || p.text || "";
  } catch {
    return "";
  }
}

function formatSendAt(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

export default function ScheduledMessagesPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [activeChannel, setActiveChannel] = useState("ALL");
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const qc = useQueryClient();

  const queryKey = ["scheduled-messages", activeStatus, activeChannel, page];

  const { data, isLoading, refetch, isFetching } = useQuery<PageData>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      if (activeChannel !== "ALL") params.set("channel", activeChannel);
      params.set("page", String(page));
      params.set("limit", "20");
      return fetchJSON<PageData>(`/api/scheduled-messages?${params.toString()}`);
    },
  });

  // Fetch stats for all statuses (always without filter)
  const { data: allData } = useQuery<PageData>({
    queryKey: ["scheduled-messages-stats"],
    queryFn: () => fetchJSON<PageData>("/api/scheduled-messages?limit=1"),
  });

  const messages = data?.messages ?? [];
  const totalPages = data?.pages ?? 1;

  const stats = allData?.stats ?? { PENDING: 0, SENT: 0, FAILED: 0, CANCELED: 0 };

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/scheduled-messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELED" }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בביטול"); return d; }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      qc.invalidateQueries({ queryKey: ["scheduled-messages-stats"] });
      toast.success("הודעה בוטלה בהצלחה");
      setCancelId(null);
    },
    onError: () => toast.error("שגיאה בביטול הודעה"),
  });

  const sendNowMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/scheduled-messages/${id}/send`, { method: "POST" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בשליחה"); return d; }),
    onSuccess: (res, id) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      qc.invalidateQueries({ queryKey: ["scheduled-messages-stats"] });
      toast.success(res.stub ? "הודעה נרשמה (Stub — אין Twilio)" : "הודעה נשלחה בהצלחה!");
    },
    onError: () => toast.error("שגיאה בשליחת הודעה"),
  });

  function handleStatusChange(s: string) {
    setActiveStatus(s);
    setPage(1);
  }

  function handleChannelChange(c: string) {
    setActiveChannel(c);
    setPage(1);
  }

  const statCards = [
    {
      key: "PENDING",
      label: "ממתינות",
      value: stats.PENDING,
      icon: Clock,
      color: "#F59E0B",
      bg: "bg-amber-50",
      textColor: "text-amber-600",
    },
    {
      key: "SENT",
      label: "נשלחו",
      value: stats.SENT,
      icon: CheckCircle2,
      color: "#22C55E",
      bg: "bg-green-50",
      textColor: "text-green-600",
    },
    {
      key: "FAILED",
      label: "נכשלו",
      value: stats.FAILED,
      icon: AlertTriangle,
      color: "#EF4444",
      bg: "bg-red-50",
      textColor: "text-red-600",
    },
    {
      key: "CANCELED",
      label: "בוטלו",
      value: stats.CANCELED,
      icon: XCircle,
      color: "#94A3B8",
      bg: "bg-slate-50",
      textColor: "text-slate-500",
    },
  ];

  return (
    <div dir="rtl">
      <BookingsTabs />
      {/* Header */}
      <div className="page-header flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">הודעות אוטומטיות</h1>
          <p className="text-sm text-petra-muted mt-0.5">
            הודעות שנוצרו אוטומטית על ידי המערכת ומתוזמנות לשליחה
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          רענן
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => handleStatusChange(s.key)}
              className={cn(
                "card p-4 text-right transition-all hover:shadow-md",
                activeStatus === s.key && "ring-2 ring-brand-500"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn("w-9 h-9 rounded-xl flex items-center justify-center", s.bg)}
                >
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-petra-text">{s.value}</p>
              <p className={cn("text-xs font-medium mt-0.5", s.textColor)}>{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => handleStatusChange(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeStatus === s.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200 hidden sm:block" />

        {/* Channel filter */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => handleChannelChange(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeChannel === c.id
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {data && (
          <span className="text-xs text-petra-muted mr-auto">
            {data.total} תוצאות
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 animate-pulse flex gap-4 items-center">
                <div className="w-32 h-4 bg-slate-200 rounded" />
                <div className="w-20 h-4 bg-slate-200 rounded" />
                <div className="flex-1 h-4 bg-slate-200 rounded" />
                <div className="w-24 h-4 bg-slate-200 rounded" />
                <div className="w-16 h-6 bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Send className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין הודעות מתוזמנות</h3>
          <p className="text-sm text-petra-muted mb-4">
            {activeStatus !== "ALL" || activeChannel !== "ALL"
              ? "לא נמצאו הודעות עם הפילטרים הנוכחיים"
              : "הודעות יופיעו כאן כשאוטומציות יפעלו"}
          </p>
          <Link href="/automations" className="btn-primary flex items-center gap-2 w-fit mx-auto">
            <Send className="w-4 h-4" />
            הגדר אוטומציה
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header-cell text-right">לקוח</th>
                  <th className="table-header-cell text-right">ערוץ</th>
                  <th className="table-header-cell text-right">תוכן ההודעה</th>
                  <th className="table-header-cell text-right">מועד שליחה</th>
                  <th className="table-header-cell text-right">סטטוס</th>
                  <th className="table-header-cell text-right">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {messages.map((msg) => {
                  const si = STATUS_INFO[msg.status] ?? STATUS_INFO.PENDING;
                  const StatusIcon = si.icon;
                  const ch = CHANNEL_INFO[msg.channel] ?? {
                    label: msg.channel,
                    icon: MessageSquare,
                    color: "#94A3B8",
                  };
                  const ChIcon = ch.icon;
                  const preview = getPayloadPreview(msg.payloadJson);
                  const { date: sendDate, time: sendTime } = formatSendAt(msg.sendAt);
                  const isPast =
                    msg.status === "PENDING" && new Date(msg.sendAt) < new Date();

                  return (
                    <tr key={msg.id} className="hover:bg-slate-50 transition-colors">
                      {/* Customer */}
                      <td className="table-cell">
                        <Link
                          href={`/customers/${msg.customer.id}`}
                          className="flex items-center gap-2 group"
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-brand-600" />
                          </div>
                          <span className="text-sm font-medium text-petra-text group-hover:text-brand-500 transition-colors">
                            {msg.customer.name}
                          </span>
                        </Link>
                      </td>

                      {/* Channel */}
                      <td className="table-cell">
                        <span
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
                          style={{
                            background: `${ch.color}18`,
                            color: ch.color,
                          }}
                        >
                          <ChIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          {ch.label}
                        </span>
                      </td>

                      {/* Content */}
                      <td className="table-cell max-w-xs">
                        {preview ? (
                          <p className="text-sm text-petra-muted truncate max-w-[220px]" title={preview}>
                            {preview}
                          </p>
                        ) : (
                          <span className="text-xs text-slate-300 italic">{msg.templateKey}</span>
                        )}
                      </td>

                      {/* Send At */}
                      <td className="table-cell whitespace-nowrap">
                        <div
                          className={cn(
                            "text-sm",
                            isPast ? "text-red-500 font-medium" : "text-petra-text"
                          )}
                        >
                          {sendDate}
                        </div>
                        <div
                          className={cn(
                            "text-xs mt-0.5 flex items-center gap-1",
                            isPast ? "text-red-400" : "text-petra-muted"
                          )}
                        >
                          <Clock className="w-3 h-3" />
                          {sendTime}
                          {isPast && <span className="text-red-400">• באיחור</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <span className={cn("badge flex items-center gap-1.5 w-fit", si.badgeClass)}>
                          <StatusIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          {si.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          {(msg.status === "PENDING" || msg.status === "FAILED") && (
                            <button
                              onClick={() => sendNowMutation.mutate(msg.id)}
                              disabled={sendNowMutation.isPending}
                              title="שלח עכשיו"
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors font-medium"
                            >
                              <Send className="w-3.5 h-3.5" />
                              שלח עכשיו
                            </button>
                          )}
                          {msg.status === "PENDING" && (
                            <button
                              onClick={() => setCancelId(msg.id)}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors font-medium"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              בטל
                            </button>
                          )}
                          {msg.status !== "PENDING" && msg.status !== "FAILED" && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
            aria-label="עמוד קודם"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-petra-muted">
            עמוד {page} מתוך {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
            aria-label="עמוד הבא"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {cancelId && (
        <div className="modal-overlay" onClick={() => setCancelId(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <Ban className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-petra-text mb-1">ביטול הודעה</h3>
              <p className="text-sm text-petra-muted mb-5">
                ההודעה לא תישלח. לא ניתן לבטל פעולה זו.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCancelId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  חזור
                </button>
                <button
                  onClick={() => cancelMutation.mutate(cancelId)}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {cancelMutation.isPending ? "מבטל..." : "בטל הודעה"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
