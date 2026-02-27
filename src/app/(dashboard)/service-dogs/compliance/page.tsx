"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Send,
  ChevronLeft,
  Dog,
  Clock,
  FileText,
  Filter,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { COMPLIANCE_EVENT_MAP } from "@/lib/service-dogs";
import { toast } from "sonner";

interface ComplianceEvent {
  id: string;
  eventType: string;
  eventDescription: string;
  notificationRequired: boolean;
  notificationDue: string | null;
  notificationSentAt: string | null;
  notificationStatus: string;
  eventAt: string;
  serviceDogId?: string;
  serviceDog?: { pet: { name: string } };
  placement?: { recipient?: { name: string } } | null;
}

const NOTIFICATION_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: "ממתין לשליחה", className: "bg-amber-100 text-amber-700" },
  SENT: { label: "נשלח", className: "bg-emerald-100 text-emerald-700" },
  WAIVED: { label: "ויתור", className: "bg-slate-100 text-slate-600" },
  NOT_REQUIRED: { label: "לא נדרש", className: "bg-slate-100 text-slate-500" },
  FAILED: { label: "נכשל", className: "bg-red-100 text-red-600" },
};

export default function CompliancePage() {
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "sent">("pending");
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<ComplianceEvent[]>({
    queryKey: ["service-compliance"],
    queryFn: () => fetch("/api/service-compliance").then((r) => r.json()),
  });

  const markMutation = useMutation({
    mutationFn: ({ id, notificationStatus }: { id: string; notificationStatus: string }) =>
      fetch(`/api/service-compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationStatus }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-compliance"] });
      queryClient.invalidateQueries({ queryKey: ["service-dogs"] });
      toast.success("סטטוס עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const now = new Date();
  const pendingEvents = events.filter((e) => e.notificationStatus === "PENDING");
  const overdueEvents = pendingEvents.filter(
    (e) => e.notificationDue && new Date(e.notificationDue) < now
  );
  const nonOverduePending = pendingEvents.filter(
    (e) => !e.notificationDue || new Date(e.notificationDue) >= now
  );
  const sentEvents = events.filter((e) => e.notificationStatus === "SENT");
  const otherEvents = events.filter(
    (e) => !["PENDING", "SENT"].includes(e.notificationStatus)
  );

  const filteredEvents = (() => {
    switch (filter) {
      case "pending": return [...overdueEvents, ...nonOverduePending];
      case "overdue": return overdueEvents;
      case "sent": return sentEvents;
      default: return events;
    }
  })();

  const filterTabs = [
    { id: "pending" as const, label: `ממתינים (${pendingEvents.length})`, color: pendingEvents.length > 0 ? "amber" : "default" },
    { id: "overdue" as const, label: `באיחור (${overdueEvents.length})`, color: overdueEvents.length > 0 ? "red" : "default" },
    { id: "sent" as const, label: `נשלחו (${sentEvents.length})`, color: "emerald" },
    { id: "all" as const, label: `הכל (${events.length})`, color: "default" },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">כלבי שירות</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>משמעת ודיווח</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-brand-500" />
            משמעת ודיווח ממשלתי
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול אירועי ציות ודיווחים נדרשים לרשויות
          </p>
        </div>
      </div>

      {/* Urgent Banner */}
      {overdueEvents.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold text-red-700">
              {overdueEvents.length} דיווחים עברו את מועד הגשה!
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              יש לטפל בדחיפות. מדינת ישראל מחייבת דיווח בתוך 48 שעות מהאירוע.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cn("rounded-xl p-4 border", overdueEvents.length > 0 ? "bg-red-50 border-red-200" : "bg-muted/30")}>
          <div className={cn("text-2xl font-bold", overdueEvents.length > 0 ? "text-red-600" : "text-slate-600")}>{overdueEvents.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">באיחור</div>
        </div>
        <div className="rounded-xl p-4 border bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-600">{nonOverduePending.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">ממתינים</div>
        </div>
        <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-600">{sentEvents.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">נשלחו</div>
        </div>
        <div className="rounded-xl p-4 border bg-muted/30">
          <div className="text-2xl font-bold text-slate-600">{events.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">סה״כ</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b pb-0">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
              filter === tab.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state py-12">
          <CheckCircle2 className="empty-state-icon text-emerald-400" />
          <p className="text-muted-foreground">
            {filter === "pending" ? "אין דיווחים ממתינים — מצוין!" : "אין אירועים"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event) => {
            const sc = NOTIFICATION_STATUS_CONFIG[event.notificationStatus] || NOTIFICATION_STATUS_CONFIG.PENDING;
            const isOverdue =
              event.notificationStatus === "PENDING" &&
              event.notificationDue &&
              new Date(event.notificationDue) < now;
            const eventInfo = COMPLIANCE_EVENT_MAP[event.eventType];

            return (
              <div
                key={event.id}
                className={cn(
                  "card p-4 flex items-start justify-between gap-4",
                  isOverdue && "border-red-300 bg-red-50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm">
                      {eventInfo?.label || event.eventType}
                    </p>
                    {event.notificationRequired && (
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full font-medium",
                          isOverdue ? "bg-red-200 text-red-700" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {isOverdue ? "⚠ דיווח באיחור" : "דיווח חובה"}
                      </span>
                    )}
                    {event.serviceDog && (
                      <Link
                        href={`/service-dogs/${event.serviceDogId}`}
                        className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600"
                      >
                        <Dog className="w-3 h-3" />
                        {event.serviceDog.pet.name}
                      </Link>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">{event.eventDescription}</p>

                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(event.eventAt)}
                    </span>
                    {event.notificationDue && (
                      <span
                        className={cn(
                          "flex items-center gap-1",
                          isOverdue ? "text-red-600 font-semibold" : "text-amber-600"
                        )}
                      >
                        <FileText className="w-3 h-3" />
                        דד-ליין: {formatDate(event.notificationDue)}
                      </span>
                    )}
                    {event.notificationSentAt && (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        נשלח: {formatDate(event.notificationSentAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={cn("text-xs px-2 py-1 rounded-full font-medium", sc.className)}>
                    {sc.label}
                  </span>

                  {event.notificationStatus === "PENDING" && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => markMutation.mutate({ id: event.id, notificationStatus: "SENT" })}
                        disabled={markMutation.isPending}
                        className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        נשלח ✓
                      </button>
                      <button
                        onClick={() => markMutation.mutate({ id: event.id, notificationStatus: "WAIVED" })}
                        disabled={markMutation.isPending}
                        className="btn-ghost text-xs py-1 px-2"
                      >
                        ויתור
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Other events (waived/not required) */}
          {filter === "all" && otherEvents.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                אחר ({otherEvents.length})
              </h4>
              {otherEvents.map((event) => {
                const sc = NOTIFICATION_STATUS_CONFIG[event.notificationStatus] || NOTIFICATION_STATUS_CONFIG.PENDING;
                return (
                  <div key={event.id} className="card p-3 mb-2 opacity-70 flex items-center justify-between">
                    <div>
                      <p className="text-sm">{COMPLIANCE_EVENT_MAP[event.eventType]?.label || event.eventType}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.eventAt)}</p>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", sc.className)}>
                      {sc.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
