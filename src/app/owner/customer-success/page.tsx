"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Mail,
  MessageCircle,
  RefreshCw,
  Sparkles,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/platform-labels";
import { PetraLoader } from "@/components/ui/PetraLoader";

type Segment = "churn_risk" | "never_activated" | "watch" | "new" | "healthy";

interface CSRow {
  businessId: string;
  businessName: string;
  tier: string;
  paying: boolean;
  phone: string | null;
  createdAt: string;
  daysActive: number;
  ownerName: string | null;
  ownerEmail: string | null;
  lastLoginAt: string | null;
  lastLoginDaysAgo: number | null;
  customerCount: number;
  appointmentCount: number;
  trialActive: boolean;
  trialDaysLeft: number | null;
  subscriptionStatus: string | null;
  subDaysLeft: number | null;
  segment: Segment;
  priority: number;
  isTest?: boolean;
}

interface CSStats {
  total: number;
  churnRisk: number;
  payingAtRisk: number;
  neverActivated: number;
  watch: number;
  fresh: number;
  healthy: number;
}

interface CSData {
  rows: CSRow[];
  stats: CSStats;
  includeTest: boolean;
}

interface SegmentDef {
  key: Segment;
  label: string;
  meaning: string;
  statKey: keyof CSStats;
  icon: LucideIcon;
  /** number + icon colour */
  accent: string;
  /** selected-card ring/border */
  active: string;
  /** row badge */
  badge: string;
}

const SEGMENTS: SegmentDef[] = [
  {
    key: "churn_risk",
    label: "סיכון נטישה",
    meaning: "היו פעילים ואין מהם פעילות 14+ ימים",
    statKey: "churnRisk",
    icon: AlertTriangle,
    accent: "text-red-600",
    active: "border-red-400 ring-2 ring-red-200 bg-red-50/60",
    badge: "bg-red-50 text-red-700 border border-red-200",
  },
  {
    key: "never_activated",
    label: "לא הופעלו",
    meaning: "נרשמו ולא הוסיפו לקוח או תור",
    statKey: "neverActivated",
    icon: UserX,
    accent: "text-amber-600",
    active: "border-amber-400 ring-2 ring-amber-200 bg-amber-50/60",
    badge: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  {
    key: "watch",
    label: "במעקב",
    meaning: "שימוש דל או 7+ ימים בלי פעילות",
    statKey: "watch",
    icon: Eye,
    accent: "text-yellow-700",
    active: "border-yellow-400 ring-2 ring-yellow-200 bg-yellow-50/60",
    badge: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  },
  {
    key: "new",
    label: "חדשים",
    meaning: "3 ימים ראשונים",
    statKey: "fresh",
    icon: Sparkles,
    accent: "text-blue-600",
    active: "border-blue-400 ring-2 ring-blue-200 bg-blue-50/60",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  {
    key: "healthy",
    label: "בריאים",
    meaning: "פעילים באופן קבוע",
    statKey: "healthy",
    icon: CheckCircle,
    accent: "text-green-600",
    active: "border-green-400 ring-2 ring-green-200 bg-green-50/60",
    badge: "bg-green-50 text-green-700 border border-green-200",
  },
];

const SEGMENT_MAP = Object.fromEntries(SEGMENTS.map((s) => [s.key, s])) as Record<Segment, SegmentDef>;

function toWhatsApp(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

function lastLoginText(days: number | null): string {
  if (days === null) return "מעולם לא";
  if (days <= 0) return "היום";
  if (days === 1) return "לפני יום";
  return `לפני ${days} ימים`;
}

function daysText(n: number): string {
  return n === 1 ? "יום אחד" : `${n} ימים`;
}

function PlanCell({ row }: { row: CSRow }) {
  if (row.trialActive && row.trialDaysLeft !== null) {
    const urgent = row.trialDaysLeft <= 3;
    return (
      <span className={cn(urgent ? "text-red-600 font-semibold" : "text-slate-700")}>
        ניסיון · נותרו {daysText(row.trialDaysLeft)}
      </span>
    );
  }
  // A free-tier business with a stale subscriptionEndsAt is not "expired" — it simply has no plan
  if (row.subDaysLeft !== null && row.tier !== "free") {
    if (row.subDaysLeft < 0) {
      return <span className="text-red-600 font-semibold">מנוי פג לפני {daysText(-row.subDaysLeft)}</span>;
    }
    const urgent = row.subDaysLeft <= 7;
    return (
      <span className={cn(urgent ? "text-red-600 font-semibold" : "text-slate-700")}>
        מנוי · נותרו {daysText(row.subDaysLeft)}
      </span>
    );
  }
  if (row.subscriptionStatus === "active") return <span className="text-slate-700">מנוי פעיל</span>;
  return <span className="text-slate-500">—</span>;
}

export default function CustomerSuccessPage() {
  const [includeTest, setIncludeTest] = useState(false);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [payingOnly, setPayingOnly] = useState(false);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<CSData>({
    queryKey: ["owner", "customer-success", { includeTest }],
    queryFn: () =>
      fetchJSON<CSData>(`/api/owner/customer-success${includeTest ? "?includeTest=1" : ""}`),
    staleTime: 60_000,
  });

  const stats = data?.stats;

  // API order = priority (handle first) — filtering preserves it.
  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    return all.filter((r) => (!segment || r.segment === segment) && (!payingOnly || r.paying));
  }, [data, segment, payingOnly]);

  const hasFilter = segment !== null || payingOnly;

  const emptyText = (() => {
    if (!data || data.rows.length === 0) return "אין עסקים להצגה.";
    const seg = segment ? SEGMENT_MAP[segment].label : null;
    if (seg && payingOnly) return `אין עסקים משלמים במצב "${seg}".`;
    if (seg) return `אין עסקים במצב "${seg}" כרגע.`;
    if (payingOnly) return "אין עסקים משלמים להצגה.";
    return "אין עסקים להצגה.";
  })();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">בריאות לקוחות</h1>
          <p className="text-sm text-slate-500 mt-1">
            מי צריך יחס עכשיו — נטישה מול הרשמה שלא הופעלה
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
            />
            הצג חשבונות בדיקה
          </label>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            רענון
          </button>
        </div>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : isError || !data ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500 mb-3">טעינת הנתונים נכשלה. נסו שוב.</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary">
            נסה שוב
          </button>
        </div>
      ) : (
        <>
          {/* Segment cards — double as filters */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {SEGMENTS.map((s) => {
              const selected = segment === s.key;
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSegment(selected ? null : s.key)}
                  className={cn(
                    "card p-4 text-right transition-all hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                    selected && s.active
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{s.label}</span>
                    <Icon className={cn("w-4 h-4 flex-shrink-0", s.accent)} />
                  </div>
                  <div className={cn("text-3xl font-bold mt-1", s.accent)}>
                    {stats ? stats[s.statKey] : "—"}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{s.meaning}</p>
                  {s.key === "churn_risk" && stats && (
                    <p
                      className={cn(
                        "text-xs mt-2 font-bold",
                        stats.payingAtRisk > 0 ? "text-red-700" : "text-slate-500"
                      )}
                    >
                      מתוכם {stats.payingAtRisk} משלמים
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Extra filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              aria-pressed={payingOnly}
              onClick={() => setPayingOnly((v) => !v)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                payingOnly
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
              )}
            >
              משלמים בלבד
            </button>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setSegment(null);
                  setPayingOnly(false);
                }}
                className="btn-ghost text-sm"
              >
                נקה סינון
              </button>
            )}
            <span className="text-sm text-slate-500 ms-auto">
              מוצגים {rows.length} מתוך {stats?.total ?? data.rows.length} עסקים
            </span>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 text-center px-4 py-10">{emptyText}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["עסק", "בעלים", "ותק", "פעילות אחרונה", "לקוחות", "תורים", "מנוי/ניסיון", "מצב", "יצירת קשר"].map(
                        (h) => (
                          <th key={h} scope="col" className="table-header-cell text-right whitespace-nowrap">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const seg = SEGMENT_MAP[row.segment];
                      const wa = row.phone ? toWhatsApp(row.phone) : null;
                      const login = row.lastLoginDaysAgo;
                      return (
                        <tr key={row.businessId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="table-cell">
                            <Link
                              href={`/owner/tenants/${row.businessId}`}
                              className="font-medium text-slate-900 hover:text-orange-600 hover:underline"
                            >
                              {row.businessName}
                            </Link>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="badge badge-neutral">{TIER_LABELS[row.tier] ?? row.tier}</span>
                              {row.paying && <span className="badge badge-success">משלם</span>}
                              {row.isTest && <span className="badge badge-neutral">בדיקה</span>}
                            </div>
                          </td>

                          <td className="table-cell">
                            <div className="text-slate-700 font-medium">{row.ownerName ?? "—"}</div>
                            {row.ownerEmail && (
                              <div className="text-xs text-slate-500" dir="ltr">
                                {row.ownerEmail}
                              </div>
                            )}
                          </td>

                          <td className="table-cell text-slate-700 whitespace-nowrap">{row.daysActive} ימים</td>

                          <td
                            className={cn(
                              "table-cell whitespace-nowrap",
                              login === null || login > 14
                                ? "text-red-600 font-semibold"
                                : login > 7
                                ? "text-amber-700 font-medium"
                                : "text-slate-700"
                            )}
                            title={row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString("he-IL") : undefined}
                          >
                            {lastLoginText(login)}
                          </td>

                          <td className="table-cell text-slate-700">{row.customerCount}</td>
                          <td className="table-cell text-slate-700">{row.appointmentCount}</td>

                          <td className="table-cell whitespace-nowrap">
                            <PlanCell row={row} />
                          </td>

                          <td className="table-cell whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                                seg?.badge ?? "bg-slate-100 text-slate-700"
                              )}
                            >
                              {seg?.label ?? "לא ידוע"}
                            </span>
                          </td>

                          <td className="table-cell">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {wa && (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`וואטסאפ אל ${row.businessName} (${row.phone})`}
                                  aria-label={`שליחת וואטסאפ אל ${row.businessName}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-green-200 bg-green-50 text-green-800 text-xs font-medium hover:bg-green-100 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  וואטסאפ
                                </a>
                              )}
                              {row.ownerEmail && (
                                <a
                                  href={`mailto:${row.ownerEmail}`}
                                  title={`מייל אל ${row.ownerEmail}`}
                                  aria-label={`שליחת מייל אל ${row.ownerName ?? row.businessName}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
                                >
                                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                                  מייל
                                </a>
                              )}
                              {!wa && !row.ownerEmail && (
                                <span className="text-xs text-slate-500">אין פרטי קשר</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
