"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Share2,
  AlertCircle,
  Download,
  LayoutDashboard,
  Wallet,
  CalendarDays,
  Target,
  GraduationCap,
} from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TierGate } from "@/components/paywall/TierGate";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { formatCurrency, type CurrencyOptions } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatIls } from "@/lib/lead-deal-value";
import type { AnalyticsData } from "@/lib/analytics-types";
import { israelTodayYmd, israelYmdOf } from "@/lib/report-dates";
import { OverviewTab } from "@/components/analytics/OverviewTab";
import { FinanceTab } from "@/components/analytics/FinanceTab";
import { AppointmentsTab } from "@/components/analytics/AppointmentsTab";
import { LeadsTab } from "@/components/analytics/LeadsTab";
import { OperationsTab } from "@/components/analytics/OperationsTab";

const PERIODS = [{ id: "week" }, { id: "month" }, { id: "quarter" }, { id: "year" }];

const TABS = [
  { id: "overview", icon: LayoutDashboard },
  { id: "finance", icon: Wallet },
  { id: "appointments", icon: CalendarDays },
  { id: "leads", icon: Target },
  { id: "operations", icon: GraduationCap },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(v: string | null): v is TabId {
  return !!v && TABS.some((t) => t.id === v);
}

type PageT = ReturnType<typeof useTranslations<"analytics.analyticsPage">>;

export default function AnalyticsPage() {
  const t = useTranslations("analytics.analyticsPage");
  return (
    <ProtectedRoute requiredRole="owner">
      <TierGate
        feature="analytics"
        title={t("title")}
        description={t("tierDescription")}
      >
        {/* useSearchParams (tab in the URL) needs a Suspense boundary in the app router */}
        <Suspense fallback={<PetraLoader />}>
          <AnalyticsContent />
        </Suspense>
      </TierGate>
    </ProtectedRoute>
  );
}

function buildShareText(data: AnalyticsData, periodLabel: string, t: PageT, money: CurrencyOptions): string {
  const from = new Date(data.from).toLocaleDateString(money.locale);
  const to = new Date(data.to).toLocaleDateString(money.locale);
  const o = data.overview;
  const closed = data.leads.wonThisPeriod + data.leads.lostThisPeriod;
  const lines = [
    t("share.title", { period: periodLabel }),
    `${from} – ${to}`,
    "",
    ...(o.revenue != null ? [t("share.revenue", { amount: formatCurrency(o.revenue, money) })] : []),
    t("share.appointments", { total: o.totalAppointments, rate: o.completionRate }),
    t("share.newCustomers", { count: o.newCustomers }),
    `${t("share.leadsWon", { count: data.leads.wonThisPeriod })}${closed > 0 ? t("share.conversion", { rate: data.leads.conversionRate }) : ""}`,
    ...(data.leadSales
      ? [
          t("share.leadSales", {
            total: formatIls(data.leadSales.total),
            deals: formatIls(data.leadSales.dealValueTotal),
            orders: formatIls(data.leadSales.ordersTotal),
          }),
        ]
      : []),
    t("share.tasksCompleted", { count: data.tasks.completedThisPeriod }),
    `${t("share.boardingStays", { count: data.boarding.staysThisPeriod })}${data.boarding.occupancyRate != null ? t("share.occupancy", { rate: data.boarding.occupancyRate }) : ""}`,
    ...(data.finance && data.finance.outstanding.total > 0
      ? [t("share.outstanding", { amount: formatCurrency(data.finance.outstanding.total, money) })]
      : []),
  ];
  return lines.join("\n");
}

function AnalyticsContent() {
  const t = useTranslations("analytics.analyticsPage");
  const tc = useTranslations("common");
  const { locale, currency, cfg } = useBusinessLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "overview";

  const setTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const [period, setPeriod] = useState("month");
  const [dateMode, setDateMode] = useState<"preset" | "custom">("preset");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const todayStr = israelTodayYmd();
  const effectiveCustomTo = customTo || todayStr;
  const rangeInvalid = dateMode === "custom" && !!customFrom && customFrom > effectiveCustomTo;
  const customReady = dateMode === "custom" && !!customFrom && !rangeInvalid;

  const queryUrl = customReady
    ? `/api/analytics?from=${customFrom}&to=${effectiveCustomTo}`
    : `/api/analytics?period=${period}`;

  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["analytics", customReady ? `custom-${customFrom}-${effectiveCustomTo}` : period],
    queryFn: () => fetchJSON<AnalyticsData>(queryUrl),
    enabled: dateMode === "preset" || customReady,
  });

  const exportFrom = customReady ? customFrom : data?.from ? israelYmdOf(data.from) : "";
  const exportTo = customReady ? effectiveCustomTo : data?.to ? israelYmdOf(data.to) : "";

  const handleExport = () => {
    if (!exportFrom || !exportTo) return;
    setIsExporting(true);
    window.location.href = `/api/analytics/export?from=${exportFrom}&to=${exportTo}`;
    setTimeout(() => setIsExporting(false), 3000);
  };

  const periodLabel =
    dateMode === "custom" ? t("custom") : PERIODS.some((p) => p.id === period) ? t(`periods.${period}`) : period;
  const shareHref = useMemo(
    () =>
      data
        ? `https://api.whatsapp.com/send?text=${encodeURIComponent(buildShareText(data, periodLabel, t, { locale, currency }))}`
        : "",
    [data, periodLabel, t, locale, currency]
  );

  const startCustom = () => {
    setDateMode("custom");
    if (!customFrom) {
      // Start from the range currently shown so switching modes doesn't jump to a 1-day report
      setCustomFrom(data?.from ? israelYmdOf(data.from) : todayStr);
      if (!customTo) setCustomTo(todayStr);
    }
  };

  const pill = (active: boolean) =>
    cn(
      "px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
      active ? "bg-brand-500 text-white shadow-sm" : "bg-white text-petra-muted hover:bg-slate-50 border border-slate-200"
    );

  return (
    <div className="animate-fade-in min-w-0">
      <PageTitle title={t("title")} />
      <DesktopBanner />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-500" />
            {t("title")}
          </h1>
          <p className="text-sm text-petra-muted">{t("subtitle")}</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !exportFrom || !exportTo}
              className="btn-secondary flex items-center gap-1.5 disabled:opacity-50"
              title={t("exportTitle")}
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? tc("progress.exporting") : "Excel"}</span>
            </button>
            <a
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1.5"
              title={t("shareTitle")}
            >
              <Share2 className="w-4 h-4" />
              <span>{t("share.button")}</span>
            </a>
          </div>
        )}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {PERIODS.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => {
              setPeriod(p.id);
              setDateMode("preset");
            }}
            className={pill(dateMode === "preset" && period === p.id)}
          >
            {t(`periods.${p.id}`)}
          </button>
        ))}
        <button type="button" onClick={startCustom} className={pill(dateMode === "custom")}>
          {t("custom")}
        </button>
        {dateMode === "custom" && (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <input
              type="date"
              lang={cfg.lang}
              value={customFrom}
              max={todayStr}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={cn("input px-3 py-1.5 text-sm w-36", rangeInvalid && "border-red-300")}
              aria-label={t("fromDateAria")}
            />
            <span className="text-xs text-petra-muted">{t("until")}</span>
            <input
              type="date"
              lang={cfg.lang}
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={cn("input px-3 py-1.5 text-sm w-36", rangeInvalid && "border-red-300")}
              placeholder={t("todayPlaceholder")}
              aria-label={t("toDateAria")}
            />
            {rangeInvalid && <span className="text-xs text-red-500 w-full sm:w-auto">{t("rangeInvalid")}</span>}
          </div>
        )}
      </div>

      {/* Tabs — horizontally scrollable on mobile, never the page */}
      <div className="max-w-full overflow-x-auto mb-4 -mx-1 px-1">
        <div role="tablist" aria-label={t("tabsAria")} className="inline-flex gap-1 p-1 bg-slate-100 rounded-xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  active ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-brand-500" : "")} />
                {t(`tabs.${tab.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      {rangeInvalid ? null : isLoading ? (
        <PetraLoader />
      ) : isError ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-petra-text">{t("loadError")}</p>
          <p className="text-xs text-petra-muted mt-1">{t("loadErrorHint")}</p>
        </div>
      ) : data ? (
        <div role="tabpanel">
          {activeTab === "overview" && <OverviewTab data={data} />}
          {activeTab === "finance" && <FinanceTab data={data} />}
          {activeTab === "appointments" && <AppointmentsTab data={data} />}
          {activeTab === "leads" && <LeadsTab data={data} />}
          {activeTab === "operations" && <OperationsTab data={data} />}
        </div>
      ) : null}
    </div>
  );
}
