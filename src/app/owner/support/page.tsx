"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  pageUrl: string | null;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  business: { id: string; name: string };
  user: { id: string; email: string; name: string | null };
}

const STATUS_TABS = [
  { key: "", label: "הכל" },
  { key: "open", label: "פתוח" },
  { key: "in_progress", label: "בטיפול" },
  { key: "resolved", label: "נסגר" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "פתוח", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  in_progress: { label: "בטיפול", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  resolved: { label: "נסגר", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OwnerSupportPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ tickets: SupportTicket[] }>({
    queryKey: ["owner-support", statusFilter],
    queryFn: () =>
      fetch(`/api/owner/support${statusFilter ? `?status=${statusFilter}` : ""}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/owner/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => {
        if (!r.ok) throw new Error("שגיאה");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-support"] });
      toast.success("עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const tickets = data?.tickets ?? [];

  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">פניות תמיכה</h1>
          <p className="text-sm text-slate-500">
            {counts.open} פתוח · {counts.in_progress} בטיפול · {counts.resolved} נסגר
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all",
              statusFilter === tab.key
                ? "bg-white shadow-sm text-slate-800"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <LifeBuoy className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>אין פניות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const meta = STATUS_META[ticket.status];
            const Icon = meta.icon;
            const isExpanded = expandedId === ticket.id;

            return (
              <div key={ticket.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Card header */}
                <button
                  className="w-full text-right px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                >
                  <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", {
                    "text-red-500": ticket.status === "open",
                    "text-amber-500": ticket.status === "in_progress",
                    "text-emerald-500": ticket.status === "resolved",
                  })} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{ticket.title}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", meta.color)}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      <span>{ticket.business.name}</span>
                      <span>·</span>
                      <span dir="ltr">{ticket.user.email}</span>
                      <span>·</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-50">
                    <p className="text-sm text-slate-600 leading-relaxed mt-4 whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                    {ticket.pageUrl && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span dir="ltr">{ticket.pageUrl}</span>
                      </div>
                    )}

                    {/* Status actions */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                      {ticket.status !== "open" && (
                        <button
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                          onClick={() => patchMutation.mutate({ id: ticket.id, status: "open" })}
                        >
                          סמן כפתוח
                        </button>
                      )}
                      {ticket.status !== "in_progress" && (
                        <button
                          className="px-3 py-1.5 text-xs rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors font-medium"
                          onClick={() => patchMutation.mutate({ id: ticket.id, status: "in_progress" })}
                        >
                          סמן בטיפול
                        </button>
                      )}
                      {ticket.status !== "resolved" && (
                        <button
                          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors font-medium"
                          onClick={() => patchMutation.mutate({ id: ticket.id, status: "resolved" })}
                        >
                          סמן כנסגר
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
