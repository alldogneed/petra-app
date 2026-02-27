"use client";

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
  Phone,
  MessageSquare,
  Ban,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn, fetchJSON, formatDate, formatTime } from "@/lib/utils";
import { toast } from "sonner";

interface ScheduledMessage {
  id: string;
  channel: string;
  templateKey: string;
  payloadJson: string;
  sendAt: string;
  status: string; // PENDING | SENT | FAILED | CANCELED
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
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:  { label: "ממתין",  color: "#F59E0B", icon: Clock },
  SENT:     { label: "נשלח",   color: "#22C55E", icon: CheckCircle2 },
  FAILED:   { label: "נכשל",   color: "#EF4444", icon: AlertTriangle },
  CANCELED: { label: "בוטל",   color: "#94A3B8", icon: XCircle },
};

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#22C55E" },
  sms:      { label: "SMS",      color: "#3B82F6" },
  email:    { label: "אימייל",   color: "#6366F1" },
};

const FILTER_STATUSES = [
  { id: "ALL",      label: "הכל" },
  { id: "PENDING",  label: "ממתינות" },
  { id: "SENT",     label: "נשלחו" },
  { id: "FAILED",   label: "נכשלו" },
  { id: "CANCELED", label: "בוטלו" },
];

function getPayloadPreview(payloadJson: string): string {
  try {
    const p = JSON.parse(payloadJson);
    return p.body || p.text || p.message || "";
  } catch {
    return "";
  }
}

export default function ScheduledMessagesPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PageData>({
    queryKey: ["scheduled-messages", activeStatus, page],
    queryFn: () =>
      fetchJSON<PageData>(`/api/scheduled-messages?status=${activeStatus}&page=${page}`),
  });

  const messages = data?.messages ?? [];
  const totalPages = data?.pages ?? 1;

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/scheduled-messages/${id}`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast.success("הודעה בוטלה");
      setCancelId(null);
    },
    onError: () => toast.error("שגיאה בביטול הודעה"),
  });

  function handleStatusChange(s: string) {
    setActiveStatus(s);
    setPage(1);
  }

  const pendingCount = data?.total ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="page-title">תור שליחה</h1>
          <p className="text-sm text-petra-muted mt-0.5">
            הודעות אוטומטיות מתוזמנות
            {activeStatus !== "ALL" && ` • ${pendingCount} תוצאות`}
          </p>
        </div>
        <div className="flex-1" />
        <Link href="/automations" className="btn-secondary flex items-center gap-2 text-sm">
          <Send className="w-4 h-4" />
          ניהול אוטומציות
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap mb-5">
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="card p-5 animate-pulse h-20" />)}
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Send className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין הודעות מתוזמנות</h3>
          <p className="text-sm text-petra-muted mb-4">
            הודעות יופיעו כאן כשאוטומציות יפעלו
          </p>
          <Link href="/automations" className="btn-primary flex items-center gap-2 w-fit mx-auto">
            <Send className="w-4 h-4" />
            הגדר אוטומציה
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const si = STATUS_INFO[msg.status] ?? STATUS_INFO.PENDING;
            const StatusIcon = si.icon;
            const ch = CHANNEL_LABELS[msg.channel] ?? { label: msg.channel, color: "#94A3B8" };
            const preview = getPayloadPreview(msg.payloadJson);
            const sendDate = new Date(msg.sendAt);
            const isPast = sendDate < new Date();

            return (
              <div key={msg.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${si.color}15` }}
                  >
                    <StatusIcon className="w-5 h-5" style={{ color: si.color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Link
                        href={`/customers/${msg.customer.id}`}
                        className="text-sm font-semibold text-petra-text hover:text-brand-500 transition-colors flex items-center gap-1"
                      >
                        <User className="w-3.5 h-3.5" />
                        {msg.customer.name}
                      </Link>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${si.color}15`, color: si.color }}
                      >
                        {si.label}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${ch.color}15`, color: ch.color }}
                      >
                        {ch.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-petra-muted mb-1">
                      <span className="flex items-center gap-1" dir="ltr">
                        <Phone className="w-3 h-3" />
                        {msg.customer.phone}
                      </span>
                      <span className={cn("flex items-center gap-1", msg.status === "PENDING" && isPast && "text-red-500")}>
                        <Clock className="w-3 h-3" />
                        {formatDate(msg.sendAt)} {formatTime(msg.sendAt)}
                        {msg.status === "PENDING" && isPast && " • באיחור"}
                      </span>
                      {msg.templateKey && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {msg.templateKey}
                        </span>
                      )}
                    </div>

                    {preview && (
                      <p className="text-xs text-petra-muted bg-slate-50 rounded-lg px-2.5 py-1.5 truncate">
                        {preview}
                      </p>
                    )}
                  </div>

                  {/* Cancel action for pending */}
                  {msg.status === "PENDING" && (
                    <button
                      onClick={() => setCancelId(msg.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="בטל הודעה"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
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
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cancel confirm */}
      {cancelId && (
        <div className="modal-overlay" onClick={() => setCancelId(null)}>
          <div className="modal-backdrop" />
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <Ban className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-petra-text mb-1">ביטול הודעה</h3>
              <p className="text-sm text-petra-muted mb-4">ההודעה לא תישלח. לא ניתן לבטל את הביטול.</p>
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
