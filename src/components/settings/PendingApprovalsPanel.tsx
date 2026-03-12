"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

interface PendingApproval {
  id: string;
  action: string;
  description: string;
  status: string;
  rejectionReason: string | null;
  expiresAt: string;
  resolvedAt: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string; email: string };
  resolvedBy: { id: string; name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  DELETE_CUSTOMER:    "מחיקת לקוח",
  DELETE_PET:         "מחיקת חיית מחמד",
  DELETE_TRAINING:    "מחיקת תוכנית אימון",
  DELETE_APPOINTMENT: "מחיקת פגישה",
  EDIT_PRICING:       "שינוי מחירון",
  EDIT_SETTINGS:      "שינוי הגדרות עסק",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "ממתין לאישור", color: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "אושר",         color: "bg-green-100 text-green-700" },
  REJECTED:  { label: "נדחה",         color: "bg-red-100 text-red-700" },
  EXPIRED:   { label: "פג תוקף",      color: "bg-slate-100 text-slate-500" },
  CANCELLED: { label: "בוטל",         color: "bg-slate-100 text-slate-500" },
};

export function PendingApprovalsPanel() {
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expanded, setExpanded] = useState(true);

  const { data, isLoading } = useQuery<{ approvals: PendingApproval[] }>({
    queryKey: ["pending-approvals", statusFilter],
    queryFn: () =>
      fetch(`/api/pending-approvals?status=${statusFilter}`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, rejectionReason }: { id: string; action: "approve" | "reject"; rejectionReason?: string }) =>
      fetch(`/api/pending-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      }).then((r) => r.json()),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      if (vars.action === "approve") {
        toast.success("הפעולה אושרה ובוצעה");
      } else {
        toast.success("הבקשה נדחתה");
        setRejectingId(null);
        setRejectReason("");
      }
    },
    onError: () => toast.error("שגיאה בטיפול בבקשה"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/pending-approvals/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast.success("הבקשה בוטלה");
    },
    onError: () => toast.error("שגיאה בביטול הבקשה"),
  });

  const pendingCount = statusFilter === "PENDING" ? (data?.approvals.length ?? 0) : 0;

  return (
    <div className="card p-0 overflow-hidden" dir="rtl">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-800">בקשות ממתינות לאישור</h3>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Filter tabs */}
          <div className="flex gap-1 p-3 bg-slate-50 border-b border-slate-100">
            {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-white text-petra-text shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {STATUS_LABELS[s].label}
              </button>
            ))}
          </div>

          {/* Approvals list */}
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">טוען...</div>
            ) : !data?.approvals.length ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                {statusFilter === "PENDING" ? "אין בקשות ממתינות" : "אין פריטים"}
              </div>
            ) : (
              data.approvals.map((approval) => (
                <div key={approval.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {approval.status === "PENDING" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {approval.status === "APPROVED" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {approval.status === "REJECTED" && <XCircle className="w-4 h-4 text-red-400" />}
                      {(approval.status === "EXPIRED" || approval.status === "CANCELLED") && (
                        <Clock className="w-4 h-4 text-slate-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {ACTION_LABELS[approval.action] ?? approval.action}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_LABELS[approval.status]?.color)}>
                          {STATUS_LABELS[approval.status]?.label ?? approval.status}
                        </span>
                      </div>

                      <p className="text-sm text-slate-800 font-medium">{approval.description}</p>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span>בוקש על-ידי: {approval.requestedBy.name}</span>
                        <span>{formatDate(approval.createdAt)}</span>
                        {approval.status === "PENDING" && (
                          <span className="text-amber-500">
                            פג תוקף: {formatDate(approval.expiresAt)}
                          </span>
                        )}
                      </div>

                      {approval.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1">סיבת דחייה: {approval.rejectionReason}</p>
                      )}

                      {/* Actions — owner only, PENDING only */}
                      {perms.canApproveActions && approval.status === "PENDING" && (
                        <div className="mt-3 space-y-2">
                          {rejectingId === approval.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="סיבת הדחייה (אופציונלי)..."
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-red-300"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    resolveMutation.mutate({
                                      id: approval.id,
                                      action: "reject",
                                      rejectionReason: rejectReason || undefined,
                                    })
                                  }
                                  disabled={resolveMutation.isPending}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                >
                                  אשר דחייה
                                </button>
                                <button
                                  onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                  ביטול
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => resolveMutation.mutate({ id: approval.id, action: "approve" })}
                                disabled={resolveMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                אשר ובצע
                              </button>
                              <button
                                onClick={() => setRejectingId(approval.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                דחה
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cancel — requester can cancel their own pending requests */}
                      {!perms.canApproveActions && approval.status === "PENDING" && (
                        <button
                          onClick={() => cancelMutation.mutate(approval.id)}
                          disabled={cancelMutation.isPending}
                          className="mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
                        >
                          בטל בקשה
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
