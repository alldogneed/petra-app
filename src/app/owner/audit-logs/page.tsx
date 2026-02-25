"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { fetchJSON, cn } from "@/lib/utils";

interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  actorUserId: string | null;
  actorPlatformRole: string | null;
  actorBusinessId: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  metadataJson: string;
  actor?: { name: string; email: string } | null;
}

const ACTION_COLOR: Record<string, string> = {
  LOGIN_SUCCESS: "bg-green-100 text-green-700",
  LOGIN_FAILURE: "bg-red-100 text-red-700",
  PLATFORM_USER_BLOCKED: "bg-red-100 text-red-700",
  PLATFORM_USER_UNBLOCKED: "bg-green-100 text-green-700",
  TENANT_SUSPENDED: "bg-orange-100 text-orange-700",
  TENANT_ACTIVATED: "bg-green-100 text-green-700",
  TENANT_CREATED: "bg-blue-100 text-blue-700",
  PLATFORM_USER_CREATED: "bg-blue-100 text-blue-700",
  FEATURE_FLAG_CHANGED: "bg-violet-100 text-violet-700",
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<{ logs: AuditLogRow[]; total: number }>({
    queryKey: ["owner", "audit-logs", { search, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("action", search);
      return fetchJSON(`/api/owner/audit-logs?${params}`);
    },
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">יומן פעולות</h1>
          <p className="text-sm text-slate-400 mt-1">{total.toLocaleString()} אירועים</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="סנן לפי פעולה..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input w-full pr-10"
            dir="ltr"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
          שגיאה בטעינת נתונים: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header-cell">זמן</th>
                <th className="table-header-cell">פעולה</th>
                <th className="table-header-cell">מבצע</th>
                <th className="table-header-cell">יעד</th>
                <th className="table-header-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell text-xs text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString("he-IL")}
                  </td>
                  <td className="table-cell">
                    <span
                      className={cn(
                        "font-mono text-xs font-medium px-2 py-0.5 rounded",
                        ACTION_COLOR[log.action] ?? "bg-slate-100 text-slate-700"
                      )}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="table-cell text-xs">
                    {log.actor ? (
                      <div>
                        <div className="font-medium text-slate-700">{log.actor.name}</div>
                        <div className="text-slate-400">{log.actor.email}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">מערכת</span>
                    )}
                  </td>
                  <td className="table-cell text-xs text-slate-500">
                    {log.targetType && (
                      <span>
                        {log.targetType}
                        {log.targetId && (
                          <span className="text-slate-400 mr-1">
                            {log.targetId.slice(0, 8)}…
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="table-cell text-xs text-slate-400 font-mono">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    לא נמצאו רשומות
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              עמוד {page} מתוך {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                הקודם
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                הבא
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
