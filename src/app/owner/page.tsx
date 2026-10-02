"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  LifeBuoy,
  PauseCircle,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  TIER_LABELS,
  TARGET_TYPE_LABELS,
  auditActionLabel,
  activityActionLabel,
} from "@/lib/platform-labels";

interface TierBreakdownRow {
  tier: string;
  count: number;
  pricePerMonth: number;
  contribution: number;
}

interface ExpiringBusiness {
  id: string;
  name: string;
  tier: string;
  subscriptionEndsAt: string | null;
}

interface RecentPayment {
  id: string;
  createdAt: string;
  business: { id: string; name: string } | null;
}

interface Stats {
  includeTest: boolean;
  excludedTestBusinesses: number;
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  recentAuditLogs: number;
  mrr: number;
  trialCount: number;
  tierBreakdown: TierBreakdownRow[];
  gcalConnectedCount: number;
  activeSubscriptions: number;
  expiringIn7Days: number;
  expiringSoon: ExpiringBusiness[];
  recentPayments: RecentPayment[];
  attention: {
    openSupportTickets: number;
    expiringSubscriptions: number;
    suspendedTenants: number;
    mcpErrors24h: number;
  };
  usage: {
    mau: number;
    activeToday: number;
    newSignups7d: number;
    topUsers: { userId: string; userName: string | null; count: number }[];
    activityByAction: { action: string; count: number }[];
    dailyActivity: { date: string; count: number }[];
  };
}

interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  targetType: string | null;
  targetId: string | null;
  targetName?: string | null;
  actor?: { name: string | null; email: string } | null;
}

const DAY_MS = 86_400_000;

function daysLeftLabel(endsAt: string | null): string {
  if (!endsAt) return "";
  const days = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY_MS));
  if (days <= 0) return "פג היום";
  if (days === 1) return "נותר יום אחד";
  return `נותרו ${days} ימים`;
}

/** "2026-10-02" → "02.10" */
function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

function StatCard({
  icon: Icon,
  iconClass,
  title,
  value,
  sub,
  href,
  valueClass,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  valueClass?: string;
}) {
  const body = (
    <div className={cn("card p-4 h-full", href && "card-hover")}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4 flex-shrink-0", iconClass)} />
        <span className="text-xs font-medium text-slate-500 truncate">{title}</span>
      </div>
      <div className={cn("text-2xl font-bold text-slate-900", valueClass)}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 mb-3">
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

function AttentionLinkCard({
  href,
  icon: Icon,
  tone,
  count,
  label,
  cta,
}: {
  href: string;
  icon: LucideIcon;
  tone: "amber" | "red";
  count: number;
  label: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
        tone === "red"
          ? "bg-red-50 border-red-200 hover:bg-red-100"
          : "bg-amber-50 border-amber-200 hover:bg-amber-100"
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0", tone === "red" ? "text-red-600" : "text-amber-600")} />
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-semibold", tone === "red" ? "text-red-900" : "text-amber-900")}>
          <span className="text-lg font-bold me-1.5">{count.toLocaleString()}</span>
          {label}
        </div>
        <div className={cn("text-xs mt-0.5", tone === "red" ? "text-red-700" : "text-amber-700")}>{cta} ←</div>
      </div>
    </Link>
  );
}

export default function OwnerDashboard() {
  const [includeTest, setIncludeTest] = useState(false);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<Stats>({
    queryKey: ["owner", "stats", { includeTest }],
    queryFn: () => fetchJSON(`/api/owner/stats${includeTest ? "?includeTest=1" : ""}`),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ["owner", "audit-logs", "recent"],
    queryFn: () => fetchJSON("/api/owner/audit-logs?limit=8"),
  });

  const attention = stats?.attention;
  const expiringSoon = stats?.expiringSoon ?? [];
  const hasAttention =
    !!attention &&
    (attention.openSupportTickets > 0 ||
      expiringSoon.length > 0 ||
      attention.suspendedTenants > 0 ||
      attention.mcpErrors24h > 0);

  const daily = stats?.usage.dailyActivity ?? [];
  const dailyMax = Math.max(1, ...daily.map((d) => d.count));
  const dailyTotal = daily.reduce((sum, d) => sum + d.count, 0);
  const byAction = stats?.usage.activityByAction ?? [];
  const actionMax = Math.max(1, ...byAction.map((a) => a.count));
  const topUsers = (stats?.usage.topUsers ?? []).slice(0, 5);
  const tierRows = [...(stats?.tierBreakdown ?? [])].sort(
    (a, b) => b.contribution - a.contribution || b.count - a.count
  );
  const logs = logsData?.logs ?? [];

  return (
    <div>
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">דשבורד פלטפורמה</h1>
          <p className="text-sm text-slate-500 mt-1">מה דורש טיפול, הכנסות ושימוש בפלטפורמה</p>
          {stats && !includeTest && stats.excludedTestBusinesses > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {stats.excludedTestBusinesses} עסקי בדיקה מוחרגים מהמדדים
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 accent-orange-500"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
            />
            הצג חשבונות בדיקה
          </label>
        </div>
      </div>

      {statsLoading ? (
        <PetraLoader />
      ) : statsError || !stats ? (
        <div className="card p-8 text-center text-sm text-slate-500 mb-8">
          לא הצלחנו לטעון את נתוני הדשבורד. נסו לרענן את העמוד.
        </div>
      ) : (
        <>
          {/* 2. Needs attention */}
          <section className="mb-8">
            <SectionTitle>דורש טיפול</SectionTitle>
            {!hasAttention || !attention ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
                אין פריטים שדורשים טיפול
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
                {attention.openSupportTickets > 0 && (
                  <AttentionLinkCard
                    href="/owner/support"
                    icon={LifeBuoy}
                    tone="amber"
                    count={attention.openSupportTickets}
                    label="פניות תמיכה פתוחות"
                    cta="לטיפול בפניות"
                  />
                )}

                {expiringSoon.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                      <div className="text-sm font-semibold text-amber-900">
                        <span className="text-lg font-bold me-1.5">{expiringSoon.length}</span>
                        מנויים יפוגו תוך 7 ימים
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {expiringSoon.map((b) => (
                        <li key={b.id}>
                          <Link
                            href={`/owner/tenants/${b.id}`}
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-amber-100"
                          >
                            <span className="font-medium text-amber-900 truncate">{b.name}</span>
                            <span className="text-amber-700 flex-shrink-0">
                              {daysLeftLabel(b.subscriptionEndsAt)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {attention.suspendedTenants > 0 && (
                  <AttentionLinkCard
                    href="/owner/tenants?status=suspended"
                    icon={PauseCircle}
                    tone="red"
                    count={attention.suspendedTenants}
                    label="עסקים מושהים"
                    cta="לרשימת המושהים"
                  />
                )}

                {attention.mcpErrors24h > 0 && (
                  <AttentionLinkCard
                    href="/owner/mcp"
                    icon={Bot}
                    tone="red"
                    count={attention.mcpErrors24h}
                    label="שגיאות עוזר AI ב-24 שעות"
                    cta="לבדיקת השגיאות"
                  />
                )}
              </div>
            )}
          </section>

          {/* 3. Revenue */}
          <section className="mb-8">
            <SectionTitle>הכנסות</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard
                icon={TrendingUp}
                iconClass="text-green-600"
                title="MRR"
                value={`₪${stats.mrr.toLocaleString()}`}
                sub="הכנסה חוזרת חודשית"
              />
              <StatCard
                icon={Building2}
                iconClass="text-blue-600"
                title="עסקים פעילים"
                value={stats.activeTenants.toLocaleString()}
                sub={`מתוך ${stats.totalTenants.toLocaleString()} סה״כ`}
                href="/owner/tenants"
              />
              <StatCard
                icon={CreditCard}
                iconClass="text-orange-500"
                title="מנויים משלמים"
                value={stats.activeSubscriptions.toLocaleString()}
                sub="מנוי פעיל בתשלום"
              />
              <StatCard
                icon={Clock}
                iconClass="text-amber-500"
                title="בתקופת ניסיון"
                value={stats.trialCount.toLocaleString()}
                sub="ניסיון פעיל"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card overflow-hidden lg:col-span-2">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <h3 className="font-semibold text-slate-900 text-sm">פירוט לפי מנוי</h3>
                </div>
                {tierRows.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-500">
                    אין עסקים פעילים להצגה.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="table-header-cell">מנוי</th>
                          <th className="table-header-cell text-center">עסקים</th>
                          <th className="table-header-cell text-center">מחיר/חודש</th>
                          <th className="table-header-cell text-center">תרומה ל-MRR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tierRows.map((row) => (
                          <tr key={row.tier} className="hover:bg-slate-50">
                            <td className="table-cell font-medium text-sm text-slate-900">
                              {TIER_LABELS[row.tier] ?? "מנוי אחר"}
                            </td>
                            <td className="table-cell text-center text-sm text-slate-700">{row.count}</td>
                            <td className="table-cell text-center text-sm text-slate-700">
                              ₪{row.pricePerMonth.toLocaleString()}
                            </td>
                            <td className="table-cell text-center font-semibold text-sm text-green-700">
                              ₪{row.contribution.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="table-cell font-bold text-slate-900">סה״כ</td>
                          <td className="table-cell text-center font-bold text-slate-900">
                            {stats.activeTenants}
                          </td>
                          <td className="table-cell" />
                          <td className="table-cell text-center font-bold text-green-700">
                            ₪{stats.mrr.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-slate-900 text-sm">הפעלות אחרונות</h3>
                </div>
                {stats.recentPayments.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-500">
                    עדיין לא הופעלו מנויים.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stats.recentPayments.map((p) => (
                      <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {p.business ? (
                            <Link
                              href={`/owner/tenants/${p.business.id}`}
                              className="block text-sm font-medium text-slate-900 hover:text-orange-600 truncate"
                            >
                              {p.business.name}
                            </Link>
                          ) : (
                            <div className="text-sm text-slate-500">עסק שנמחק</div>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {new Date(p.createdAt).toLocaleDateString("he-IL")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 4. Usage */}
          <section className="mb-8">
            <SectionTitle hint="30 הימים האחרונים">שימוש</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <StatCard
                icon={Users}
                iconClass="text-blue-600"
                title="משתמשים פעילים בחודש"
                value={stats.usage.mau.toLocaleString()}
                sub="MAU"
              />
              <StatCard
                icon={UserCheck}
                iconClass="text-green-600"
                title="פעילים היום"
                value={stats.usage.activeToday.toLocaleString()}
              />
              <StatCard
                icon={UserPlus}
                iconClass="text-orange-500"
                title="נרשמו ב-7 ימים"
                value={stats.usage.newSignups7d.toLocaleString()}
              />
              <StatCard
                icon={Users}
                iconClass="text-slate-600"
                title="סה״כ משתמשים"
                value={stats.totalUsers.toLocaleString()}
                sub={`${stats.blockedUsers.toLocaleString()} חסומים`}
                href="/owner/users"
              />
              <StatCard
                icon={CalendarCheck}
                iconClass="text-indigo-600"
                title="Google Calendar"
                value={stats.gcalConnectedCount.toLocaleString()}
                sub="משתמשים מחוברים"
              />
            </div>

            <div className="card p-5 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  <h3 className="font-semibold text-slate-900 text-sm">פעילות יומית — 14 ימים</h3>
                </div>
                <span className="text-xs text-slate-500">{dailyTotal.toLocaleString()} פעולות</span>
              </div>
              {dailyTotal === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  לא נרשמה פעילות ב-14 הימים האחרונים.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1.5 min-w-[440px]" dir="ltr">
                    {daily.map((d) => (
                      <div
                        key={d.date}
                        className="flex-1 min-w-0 flex flex-col items-center"
                        title={`${shortDate(d.date)} — ${d.count.toLocaleString()} פעולות`}
                      >
                        <span className="text-[10px] leading-4 text-slate-600 tabular-nums">
                          {d.count.toLocaleString()}
                        </span>
                        <div className="w-full h-28 flex items-end">
                          <div
                            className={cn(
                              "w-full rounded-t",
                              d.count > 0 ? "bg-orange-400" : "bg-slate-200"
                            )}
                            style={{
                              height: d.count > 0 ? `${Math.max(4, (d.count / dailyMax) * 100)}%` : "2px",
                            }}
                          />
                        </div>
                        <span className="text-[10px] leading-4 text-slate-500 mt-1 tabular-nums">
                          {shortDate(d.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900 text-sm">משתמשים פעילים ביותר</h3>
                </div>
                {topUsers.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-500">
                    אין פעילות משתמשים ב-30 הימים האחרונים.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {topUsers.map((u, i) => (
                      <Link
                        key={u.userId}
                        href={`/owner/users/${u.userId}`}
                        className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50"
                      >
                        <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">
                          {u.userName?.trim() || "משתמש ללא שם"}
                        </span>
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {u.count.toLocaleString()} פעולות
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900 text-sm">התפלגות פעולות</h3>
                </div>
                {byAction.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-500">
                    אין פעולות להצגה ב-30 הימים האחרונים.
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {byAction.map((a) => (
                      <div key={a.action}>
                        <div className="flex items-center justify-between gap-2 text-xs mb-1">
                          <span className="text-slate-700 truncate">{activityActionLabel(a.action)}</span>
                          <span className="text-slate-500 flex-shrink-0 tabular-nums">
                            {a.count.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{ width: `${Math.max(2, (a.count / actionMax) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* 5. Recent admin actions */}
      <section>
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900 text-sm">פעולות אדמין אחרונות</h2>
            <Link href="/owner/audit-logs" className="text-xs font-medium text-orange-600 hover:text-orange-700">
              הצג הכל ←
            </Link>
          </div>
          {logsLoading ? (
            <PetraLoader variant="inline" />
          ) : logs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              עדיין לא נרשמו פעולות אדמין.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const target =
                  log.targetName?.trim() ||
                  (log.targetType ? TARGET_TYPE_LABELS[log.targetType] : undefined);
                const actor = log.actor?.name?.trim() || log.actor?.email || "מערכת";
                return (
                  <div key={log.id} className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="badge badge-neutral flex-shrink-0">{auditActionLabel(log.action)}</span>
                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                      {actor}
                      {target && <span className="text-slate-500"> · {target}</span>}
                    </span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleString("he-IL")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
