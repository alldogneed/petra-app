"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Filter } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "התחבר למערכת",
  CREATE_CUSTOMER: "יצר לקוח חדש",
  ADD_PET: "הוסיף חיית מחמד",
  CREATE_APPOINTMENT: "יצר תור חדש",
  CREATE_ORDER: "יצר הזמנה חדשה",
  CREATE_PAYMENT: "רשם תשלום",
  CREATE_LEAD: "יצר ליד חדש",
  CREATE_TASK: "יצר משימה חדשה",
  CREATE_BOARDING_STAY: "יצר שהייה בפנסיון",
  UPDATE_SETTINGS: "עדכן הגדרות",
  CREATE_MESSAGE_TEMPLATE: "יצר תבנית הודעה",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "#22C55E",
  CREATE_CUSTOMER: "#06B6D4",
  ADD_PET: "#A855F7",
  CREATE_APPOINTMENT: "#3B82F6",
  CREATE_ORDER: "#F59E0B",
  CREATE_PAYMENT: "#10B981",
  CREATE_LEAD: "#EC4899",
  CREATE_TASK: "#6366F1",
  CREATE_BOARDING_STAY: "#F97316",
  UPDATE_SETTINGS: "#64748B",
  CREATE_MESSAGE_TEMPLATE: "#8B5CF6",
};

const FILTER_OPTIONS = [
  { value: "", label: "הכל" },
  { value: "LOGIN", label: "כניסות" },
  { value: "CREATE_CUSTOMER", label: "לקוחות" },
  { value: "ADD_PET", label: "חיות מחמד" },
  { value: "CREATE_APPOINTMENT", label: "תורים" },
  { value: "CREATE_PAYMENT", label: "תשלומים" },
  { value: "CREATE_LEAD", label: "לידים" },
  { value: "CREATE_TASK", label: "משימות" },
  { value: "CREATE_BOARDING_STAY", label: "פנסיון" },
];

function relativeTime(date: string) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שעות`;
  const diffDays = Math.floor(diffHr / 24);
  return `לפני ${diffDays} ימים`;
}

function formatTimestamp(date: string) {
  return new Date(date).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminFeedPage() {
  const [actionFilter, setActionFilter] = useState("");

  const { data: feed, isLoading } = useQuery({
    queryKey: ["admin-feed-full", actionFilter],
    queryFn: () =>
      fetch(`/api/admin/feed?limit=100${actionFilter ? `&action=${actionFilter}` : ""}`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">פיד פעילות</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>כל הפעולות בפלטפורמה בזמן אמת</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: "#64748B" }}>עדכון כל 30 שניות</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4" style={{ color: "#64748B" }} />
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActionFilter(opt.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: actionFilter === opt.value ? "#06B6D420" : "#12121A",
              color: actionFilter === opt.value ? "#06B6D4" : "#64748B",
              border: `1px solid ${actionFilter === opt.value ? "#06B6D440" : "#1E1E2E"}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
        {isLoading ? (
          <div className="p-12 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
        ) : !feed?.length ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: "#1E1E2E" }} />
            <p className="text-sm" style={{ color: "#64748B" }}>אין פעולות להצגה</p>
          </div>
        ) : (
          feed.map((item: any) => (
            <div
              key={item.id}
              className="px-5 py-3.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
              style={{ borderBottom: "1px solid #1E1E2E" }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: ACTION_COLORS[item.action] || "#64748B" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: "#E2E8F0" }}>
                  <span className="font-medium text-white">{item.userName}</span>{" "}
                  {ACTION_LABELS[item.action] || item.action}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" style={{ color: "#475569" }} />
                    <span className="text-[11px]" style={{ color: "#475569" }}>
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: "#334155" }}>
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>
              </div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                style={{
                  background: (ACTION_COLORS[item.action] || "#64748B") + "20",
                  color: ACTION_COLORS[item.action] || "#64748B",
                }}
              >
                {ACTION_LABELS[item.action]?.split(" ").pop() || item.action}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
