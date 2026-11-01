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
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

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
    statKey: "churnRisk",
    icon: AlertTriangle,
    accent: "text-red-600",
    active: "border-red-400 ring-2 ring-red-200 bg-red-50/60",
    badge: "bg-red-50 text-red-700 border border-red-200",
  },
  {
    key: "never_activated",
    statKey: "neverActivated",
    icon: UserX,
    accent: "text-amber-600",
    active: "border-amber-400 ring-2 ring-amber-200 bg-amber-50/60",
    badge: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  {
    key: "watch",
    statKey: "watch",
    icon: Eye,
    accent: "text-yellow-700",
    active: "border-yellow-400 ring-2 ring-yellow-200 bg-yellow-50/60",
    badge: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  },
  {
    key: "new",
    statKey: "fresh",
    icon: Sparkles,
    accent: "text-blue-600",
    active: "border-blue-400 ring-2 ring-blue-200 bg-blue-50/60",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  {
    key: "healthy",
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

type CSTranslator = ReturnType<typeof useTranslations<"owner.ownerCustomerSuccessPage">>;

function lastLoginText(days: number | null, t: CSTranslator): string {
  if (days === null) return t("lastLogin.never");
  if (days <= 0) return t("lastLogin.today");
  if (days === 1) return t("lastLogin.oneDayAgo");
  return t("lastLogin.daysAgo", { count: days });
}

function daysText(n: number, t: CSTranslator): string {
  return n === 1 ? t("days.one") : t("days.other", { count: n });
}

function PlanCell({ row }: { row: CSRow }) {
  const t = useTranslations("owner.ownerCustomerSuccessPage");
  if (row.trialActive && row.trialDaysLeft !== null) {
    const urgent = row.trialDaysLeft <= 3;
    return (
      <span className={cn(urgent ? "text-red-600 font-semibold" : "text-slate-700")}>
        {t("plan.trialLeft", { days: daysText(row.trialDaysLeft, t) })}
      </span>
    );
  }
  // A free-tier business with a stale subscriptionEndsAt is not "expired" — it simply has no plan
  if (row.subDaysLeft !== null && row.tier !== "free") {
    if (row.subDaysLeft < 0) {
      return <span className="text-red-600 font-semibold">{t("plan.expiredAgo", { days: daysText(-row.subDaysLeft, t) })}</span>;
    }
    const urgent = row.subDaysLeft <= 7;
    return (
      <span className={cn(urgent ? "text-red-600 font-semibold" : "text-slate-700")}>
        {t("plan.subscriptionLeft", { days: daysText(row.subDaysLeft, t) })}
      </span>
    );
  }
  if (row.subscriptionStatus === "active") return <span className="text-slate-700">{t("plan.active")}</span>;
  return <span className="text-slate-500">—</span>;
}

export default function CustomerSuccessPage() {
  const t = useTranslations("owner.ownerCustomerSuccessPage");
  const { locale } = useBusinessLocale();
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
    if (!data || data.rows.length === 0) return t("empty.none");
    const seg = segment ? t(`segments.${SEGMENT_MAP[segment].key}.label`) : null;
    if (seg && payingOnly) return t("empty.payingInSegment", { segment: seg });
    if (seg) return t("empty.inSegment", { segment: seg });
    if (payingOnly) return t("empty.paying");
    return t("empty.none");
  })();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("subtitle")}
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
            {t("showTestAccounts")}
          </label>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            {t("refresh")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : isError || !data ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500 mb-3">{t("loadError")}</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary">
            {t("retry")}
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
                    "card p-4 text-start transition-all hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                    selected && s.active
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{t(`segments.${s.key}.label`)}</span>
                    <Icon className={cn("w-4 h-4 flex-shrink-0", s.accent)} />
                  </div>
                  <div className={cn("text-3xl font-bold mt-1", s.accent)}>
                    {stats ? stats[s.statKey] : "—"}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{t(`segments.${s.key}.meaning`)}</p>
                  {s.key === "churn_risk" && stats && (
                    <p
                      className={cn(
                        "text-xs mt-2 font-bold",
                        stats.payingAtRisk > 0 ? "text-red-700" : "text-slate-500"
                      )}
                    >
                      {t("payingAtRisk", { count: stats.payingAtRisk })}
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
              {t("filters.payingOnly")}
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
                {t("filters.clear")}
              </button>
            )}
            <span className="text-sm text-slate-500 ms-auto">
              {t("filters.showing", { shown: rows.length, total: stats?.total ?? data.rows.length })}
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
                      {(["business", "owner", "tenure", "lastActivity", "clients", "appointments", "plan", "status", "contact"] as const).map(
                        (h) => (
                          <th key={h} scope="col" className="table-header-cell text-start whitespace-nowrap">
                            {t(`table.${h}`)}
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
                              {row.paying && <span className="badge badge-success">{t("badges.paying")}</span>}
                              {row.isTest && <span className="badge badge-neutral">{t("badges.test")}</span>}
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

                          <td className="table-cell text-slate-700 whitespace-nowrap">{t("table.daysActive", { count: row.daysActive })}</td>

                          <td
                            className={cn(
                              "table-cell whitespace-nowrap",
                              login === null || login > 14
                                ? "text-red-600 font-semibold"
                                : login > 7
                                ? "text-amber-700 font-medium"
                                : "text-slate-700"
                            )}
                            title={row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString(locale) : undefined}
                          >
                            {lastLoginText(login, t)}
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
                              {seg ? t(`segments.${seg.key}.label`) : t("unknownSegment")}
                            </span>
                          </td>

                          <td className="table-cell">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {wa && (
                                <a
                                  href={wa}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={t("contact.whatsappTitle", { name: row.businessName, phone: row.phone ?? "" })}
                                  aria-label={t("contact.whatsappAriaLabel", { name: row.businessName })}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-green-200 bg-green-50 text-green-800 text-xs font-medium hover:bg-green-100 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  {t("contact.whatsapp")}
                                </a>
                              )}
                              {row.ownerEmail && (
                                <a
                                  href={`mailto:${row.ownerEmail}`}
                                  title={t("contact.emailTitle", { email: row.ownerEmail })}
                                  aria-label={t("contact.emailAriaLabel", { name: row.ownerName ?? row.businessName })}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
                                >
                                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                                  {t("contact.email")}
                                </a>
                              )}
                              {!wa && !row.ownerEmail && (
                                <span className="text-xs text-slate-500">{t("contact.none")}</span>
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
