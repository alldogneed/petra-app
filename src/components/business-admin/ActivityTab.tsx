"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  Activity,
  RefreshCw,
} from "lucide-react";
import { ActivityEntry, TeamMember, ACTION_LABELS, ACTION_ICONS, ACTION_COLORS, relativeTime, formatTs } from "./shared";

export function ActivityTab() {
  const { user } = useAuth();
  const businessId = user?.businessId ?? "";
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const { data: teamData } = useQuery<TeamMember[]>({
    queryKey: ["ba-team"],
    enabled: !!businessId,
    queryFn: () => fetch(`/api/admin/${businessId}/members`).then((r) => r.json()),
  });

  const params = new URLSearchParams({ take: "100" });
  if (filterUser) params.set("userId", filterUser);
  if (filterAction) params.set("action", filterAction);

  const { data, isLoading, refetch, isFetching } = useQuery<ActivityEntry[]>({
    queryKey: ["ba-activity", filterUser, filterAction],
    queryFn: () =>
      fetch(`/api/business-admin/activity?${params}`).then((r) => r.json()),
  });

  const actionOptions = [
    { value: "", label: "כל הפעולות" },
    { value: "LOGIN", label: "כניסות" },
    { value: "CREATE_CUSTOMER", label: "יצירת לקוח" },
    { value: "CREATE_APPOINTMENT", label: "יצירת תור" },
    { value: "CREATE_PAYMENT", label: "רישום תשלום" },
    { value: "CREATE_LEAD", label: "יצירת ליד" },
    { value: "CREATE_TASK", label: "יצירת משימה" },
    { value: "CREATE_BOARDING_STAY", label: "פנסיון" },
    { value: "UPDATE_SETTINGS", label: "הגדרות" },
    { value: "DELETE_CUSTOMER", label: "מחיקת לקוח" },
    { value: "DELETE_APPOINTMENT", label: "מחיקת תור" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input py-2 text-sm w-48"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
        >
          <option value="">כל חברי הצוות</option>
          {teamData?.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
        <select
          className="input py-2 text-sm w-48"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          {actionOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => refetch()}
          className="btn-ghost text-sm flex items-center gap-1.5 px-3"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          רענן
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : !data?.length ? (
          <div className="p-10 text-center text-sm text-petra-muted">
            אין פעילות להצגה
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-petra-muted">
                <th className="text-right px-4 py-3 font-medium">משתמש</th>
                <th className="text-right px-4 py-3 font-medium">פעולה</th>
                <th className="text-right px-4 py-3 font-medium">זמן</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => {
                const color = ACTION_COLORS[entry.action] ?? "#64748B";
                const Icon = ACTION_ICONS[entry.action] ?? Activity;
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {entry.userName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: color + "18" }}
                        >
                          <Icon className="w-3 h-3" {...({ style: { color } } as any)} />
                        </div>
                        <span className="text-slate-700">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-petra-muted whitespace-nowrap">
                      <span title={formatTs(entry.createdAt)}>
                        {relativeTime(entry.createdAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
