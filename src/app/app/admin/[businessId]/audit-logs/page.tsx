"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";

interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  actor?: { name: string; email: string } | null;
}

export default function TenantAuditLogsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("action", search);
    const res = await fetch(`/api/admin/${businessId}/audit-logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
    setLoading(false);
  }, [businessId, page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Business Audit Logs</h1>
        <span className="text-sm text-slate-400">{total.toLocaleString()} events</span>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by action..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            dir="ltr"
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Time</th>
                <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Action</th>
                <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Actor</th>
                <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {log.actor ? (
                      <div>
                        <div className="font-medium text-slate-700">{log.actor.name}</div>
                        <div className="text-slate-400">{log.actor.email}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {log.targetType}
                    {log.targetId && <span className="text-slate-400 ml-1">{log.targetId.slice(0, 8)}…</span>}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400">No audit logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {total > 50 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 50)}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
