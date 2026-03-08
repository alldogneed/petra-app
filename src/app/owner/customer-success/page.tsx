"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  Clock,
  TrendingUp,
} from "lucide-react";

interface CSRow {
  businessId: string;
  businessName: string;
  tier: string;
  createdAt: string;
  daysActive: number;
  ownerName: string | null;
  ownerEmail: string | null;
  lastLoginAt: string | null;
  lastLoginDaysAgo: number | null;
  customerCount: number;
  appointmentCount: number;
  churnRisk: "high" | "medium" | "healthy";
}

interface CSData {
  rows: CSRow[];
  stats: { total: number; highRisk: number; medium: number; healthy: number };
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-slate-100 text-slate-600" },
  basic: { label: "Basic", color: "bg-blue-100 text-blue-700" },
  pro: { label: "Pro", color: "bg-violet-100 text-violet-700" },
  service_dog: { label: "Service Dog", color: "bg-amber-100 text-amber-700" },
  groomer: { label: "Groomer", color: "bg-pink-100 text-pink-700" },
};

function RiskBadge({ risk }: { risk: "high" | "medium" | "healthy" }) {
  if (risk === "high")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
        <AlertTriangle className="w-3 h-3" />
        סיכון גבוה
      </span>
    );
  if (risk === "medium")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-semibold">
        <AlertCircle className="w-3 h-3" />
        מעקב
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-semibold">
      <CheckCircle className="w-3 h-3" />
      פעיל
    </span>
  );
}

export default function CustomerSuccessPage() {
  const { data, isLoading } = useQuery<CSData>({
    queryKey: ["owner-cs"],
    queryFn: () => fetch("/api/owner/customer-success").then((r) => r.json()),
    staleTime: 60000,
  });

  const stats = data?.stats;
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Success</h1>
        <p className="text-slate-400 text-sm mt-1">מעקב מעורבות וסיכוני נטישה</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "סה״כ עסקים", value: stats?.total ?? "—", icon: TrendingUp, color: "text-cyan-400" },
          { label: "סיכון גבוה", value: stats?.highRisk ?? "—", icon: AlertTriangle, color: "text-red-400" },
          { label: "מעקב", value: stats?.medium ?? "—", icon: AlertCircle, color: "text-amber-400" },
          { label: "פעילים", value: stats?.healthy ?? "—", icon: CheckCircle, color: "text-green-400" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: "#0D0D14", border: "1px solid #1E1E2E" }}
          >
            <s.icon className={cn("w-5 h-5 flex-shrink-0", s.color)} />
            <div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#0D0D14", border: "1px solid #1E1E2E" }}>
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">טוען...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1E1E2E" }}>
                  {["עסק", "מסלול", "בעלים", "פעיל מ", "כניסה אחרונה", "לקוחות", "תורים", "סיכון נטישה"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-right text-xs font-semibold text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.businessId}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: "1px solid #1A1A2A" }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/owner/tenants/${row.businessId}`}
                        className="font-medium text-slate-200 hover:text-cyan-300 transition-colors"
                      >
                        {row.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          TIER_LABELS[row.tier]?.color ?? "bg-slate-100 text-slate-600"
                        )}
                      >
                        {TIER_LABELS[row.tier]?.label ?? row.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 font-medium">{row.ownerName ?? "—"}</div>
                      {row.ownerEmail && (
                        <div className="text-xs text-slate-500">{row.ownerEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        {row.daysActive} ימים
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.lastLoginAt ? (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            row.lastLoginDaysAgo !== null && row.lastLoginDaysAgo > 7
                              ? "text-red-400"
                              : row.lastLoginDaysAgo !== null && row.lastLoginDaysAgo > 3
                              ? "text-amber-400"
                              : "text-slate-400"
                          )}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {row.lastLoginDaysAgo === 0
                            ? "היום"
                            : row.lastLoginDaysAgo === 1
                            ? "אתמול"
                            : `לפני ${row.lastLoginDaysAgo} ימים`}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">לא התחבר</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-600" />
                        {row.customerCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.appointmentCount}</td>
                    <td className="px-4 py-3">
                      <RiskBadge risk={row.churnRisk} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      אין נתונים
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
