"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, Activity, CheckCircle2, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { isExpectedMcpError } from "@/lib/mcp-error-kind";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

interface McpStats {
  totalConnections: number;
  activeConnections: number;
  calls24h: number;
  calls7d: number;
  errors24h: number;
  errorRate24h: number;
  expectedErrors24h?: number;
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

/** Tools with a translated label under `owner.ownerMcpPage.tools.*`. */
const LABELLED_TOOLS = new Set([
  "list_clients",
  "list_upcoming_appointments",
  "get_business_stats",
  "create_appointment",
  "add_client_note",
  "send_reminder",
]);

export default function OwnerMcpPage() {
  const t = useTranslations("owner.ownerMcpPage");
  const { locale } = useBusinessLocale();
  const toolLabel = (tool: string | undefined): string | undefined =>
    tool && LABELLED_TOOLS.has(tool) ? t(`tools.${tool}`) : undefined;
  const { data, isLoading } = useQuery<McpStats>({
    queryKey: ["owner-mcp-stats"],
    queryFn: () => fetch("/api/owner/mcp-stats").then((r) => r.json()),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("subtitle")}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Bot} label={t("stats.activeConnections")} value={data.activeConnections} sub={t("stats.totalConnections", { count: data.totalConnections })} color="indigo" />
        <StatCard icon={Activity} label={t("stats.calls24h")} value={data.calls24h} sub={t("stats.calls7d", { count: data.calls7d })} color="emerald" />
        <StatCard icon={AlertCircle} label={t("stats.errors24h")} value={data.errors24h} sub={`${t("stats.errorRate", { rate: data.errorRate24h })}${data.expectedErrors24h ? t("stats.expectedErrors", { count: data.expectedErrors24h }) : ""}`} color={data.errors24h > 5 ? "red" : "slate"} />
        <StatCard icon={TrendingUp} label={t("stats.popularTool")} value={toolLabel(data.popularTools[0]?.tool) ?? "—"} sub={t("stats.popularToolCount", { count: data.popularTools[0]?.count ?? 0 })} color="violet" />
      </div>

      {/* Popular tools */}
      {data.popularTools.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-700 mb-4">{t("popularTools")}</h2>
          <div className="space-y-2">
            {data.popularTools.map((tl) => {
              const max = data.popularTools[0]?.count ?? 1;
              const pct = Math.round((tl.count / max) * 100);
              return (
                <div key={tl.tool} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-44 flex-shrink-0">{toolLabel(tl.tool) ?? tl.tool}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 w-10 text-end">{tl.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent logs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">{t("recentCalls")}</h2>
        {data.recentLogs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">{t("noCalls")}</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  log.status === "success" ? "bg-emerald-400" :
                  log.status === "error" && !isExpectedMcpError(log.errorMessage) ? "bg-red-400" : "bg-amber-400"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{toolLabel(log.toolName) ?? log.toolName}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 truncate">{log.connection.business.name}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-400">{log.connection.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {log.status === "error" ? (
                      <span className={isExpectedMcpError(log.errorMessage) ? "text-amber-600" : "text-red-500"}>
                        {isExpectedMcpError(log.errorMessage) && /not found/i.test(log.errorMessage ?? "") ? t("recordNotFound") : log.errorMessage}
                      </span>
                    ) : (
                      log.resultSummary
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
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
