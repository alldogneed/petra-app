"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, Activity, CheckCircle2, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface McpStats {
  totalConnections: number;
  activeConnections: number;
  calls24h: number;
  calls7d: number;
  errors24h: number;
  errorRate24h: number;
  popularTools: Array<{ tool: string; count: number }>;
  recentLogs: Array<{
    id: string;
    toolName: string;
    status: string;
    resultSummary: string | null;
    errorMessage: string | null;
    createdAt: string;
    connection: { name: string; business: { name: string } };
  }>;
}

const TOOL_LABELS: Record<string, string> = {
  list_clients: "רשימת לקוחות",
  list_upcoming_appointments: "תורים קרובים",
  get_business_stats: "סטטיסטיקות",
  create_appointment: "יצירת תור",
  add_client_note: "הוספת הערה",
  send_reminder: "שליחת תזכורת",
};

export default function OwnerMcpPage() {
  const { data, isLoading } = useQuery<McpStats>({
    queryKey: ["owner-mcp-stats"],
    queryFn: () => fetch("/api/owner/mcp-stats").then((r) => r.json()),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">MCP — עוזרי AI</h1>
          <p className="text-sm text-slate-500">מעקב קריאות, שגיאות וחיבורים פעילים</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Bot} label="חיבורים פעילים" value={data.activeConnections} sub={`${data.totalConnections} סה"כ`} color="indigo" />
        <StatCard icon={Activity} label="קריאות 24 שעות" value={data.calls24h} sub={`${data.calls7d} ב-7 ימים`} color="emerald" />
        <StatCard icon={AlertCircle} label="שגיאות 24 שעות" value={data.errors24h} sub={`${data.errorRate24h}% error rate`} color={data.errors24h > 5 ? "red" : "slate"} />
        <StatCard icon={TrendingUp} label="כלי פופולרי" value={TOOL_LABELS[data.popularTools[0]?.tool] ?? "—"} sub={`${data.popularTools[0]?.count ?? 0} פעמים / 30 ימים`} color="violet" />
      </div>

      {/* Popular tools */}
      {data.popularTools.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-700 mb-4">כלים פופולריים (30 ימים)</h2>
          <div className="space-y-2">
            {data.popularTools.map((t) => {
              const max = data.popularTools[0]?.count ?? 1;
              const pct = Math.round((t.count / max) * 100);
              return (
                <div key={t.tool} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-44 flex-shrink-0">{TOOL_LABELS[t.tool] ?? t.tool}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 w-10 text-left">{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent logs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">קריאות אחרונות</h2>
        {data.recentLogs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">אין קריאות עדיין</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  log.status === "success" ? "bg-emerald-400" :
                  log.status === "error" ? "bg-red-400" : "bg-amber-400"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{TOOL_LABELS[log.toolName] ?? log.toolName}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 truncate">{log.connection.business.name}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-400">{log.connection.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {log.status === "error" ? (
                      <span className="text-red-500">{log.errorMessage}</span>
                    ) : (
                      log.resultSummary
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub: string;
  color: "indigo" | "emerald" | "red" | "slate" | "violet";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-50 text-slate-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
