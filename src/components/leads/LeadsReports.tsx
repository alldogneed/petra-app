"use client";

/**
 * "דוחות" tab of מערכת מכירות (/leads).
 * All numbers come from GET /api/leads/reports (SalesReport, src/lib/analytics-types.ts) —
 * no client-side lead math here.
 */
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AlertCircle, BarChart3, RefreshCw } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import type { LeadReportBasis, SalesReport } from "@/lib/analytics-types";
import { isYmd, israelTodayYmd } from "@/lib/report-dates";
import { ReportControls } from "./reports/ReportControls";
import { ReportKpis } from "./reports/ReportKpis";
import { AgingChart, FunnelChart, MonthlyTrendChart, ResponseTimeChart, StaleTable } from "./reports/ReportCharts";
import { ClosersTable, LandingPageTable, LostReasonsCard, SourceTables } from "./reports/ReportTables";
import { BASIS_OPTIONS, RANGE_PRESETS, addDaysYmd, formatYmd, presetRange, type RangePreset } from "./reports/format";

const MAX_RANGE_DAYS = 1825; // 5 years — the server caps at this

export function LeadsReports() {
  const [preset, setPreset] = useState<RangePreset>("90d");
  const [basis, setBasis] = useState<LeadReportBasis>("cohort");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const handlePresetChange = (p: RangePreset) => {
    if (p === "custom" && preset !== "custom") {
      // Start the custom picker from the range currently on screen.
      const current = presetRange(preset as Exclude<RangePreset, "custom">);
      setCustomFrom(current.from);
      setCustomTo(current.to);
    }
    setPreset(p);
  };

  const { from, to, customError } = useMemo((): { from: string | null; to: string | null; customError: string | null } => {
    if (preset !== "custom") return { ...presetRange(preset), customError: null };
    if (!isYmd(customFrom) || !isYmd(customTo)) return { from: null, to: null, customError: "יש לבחור תאריך התחלה ותאריך סיום" };
    if (customFrom > customTo) return { from: null, to: null, customError: "תאריך ההתחלה חייב להיות לפני תאריך הסיום" };
    if (customFrom < addDaysYmd(customTo, -(MAX_RANGE_DAYS - 1))) {
      return { from: null, to: null, customError: "הטווח המקסימלי הוא 5 שנים" };
    }
    return { from: customFrom, to: customTo, customError: null };
  }, [preset, customFrom, customTo]);

  const { data: report, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["leadsReport", from, to, basis],
    queryFn: () =>
      fetchJSON<SalesReport>(
        `/api/leads/reports?${new URLSearchParams({ from: from!, to: to!, basis }).toString()}`
      ),
    enabled: !!from && !!to,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const rangeLabel = useMemo(() => {
    if (!from || !to) return null;
    const presetName = preset !== "custom" ? RANGE_PRESETS.find((r) => r.id === preset)?.label : null;
    const dates = `${formatYmd(from)} – ${formatYmd(to)}`;
    return presetName ? `${presetName} (${dates})` : dates;
  }, [preset, from, to]);
  const basisLabel = BASIS_OPTIONS.find((b) => b.id === basis)?.label;
  const today = israelTodayYmd();

  const isEmpty =
    !!report && report.kpis.total === 0 && report.kpis.open === 0 && report.aging.every((a) => a.count === 0);

  return (
    <div className="space-y-5">
      <ReportControls
        preset={preset}
        onPresetChange={handlePresetChange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        customError={customError}
        basis={basis}
        onBasisChange={setBasis}
      />

      {customError ? null : isLoading ? (
        <PetraLoader variant="inline" />
      ) : isError && !report ? (
        <div className="bg-white rounded-xl border border-red-200 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-red-700 flex-1 min-w-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>לא הצלחנו לטעון את הדוח{error instanceof Error && error.message ? `: ${error.message}` : ""}</span>
          </div>
          <button type="button" onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-1.5 self-start">
            <RefreshCw className="w-3.5 h-3.5" /> נסה שוב
          </button>
        </div>
      ) : report ? (
        <>
          {/* What the numbers below mean — never ambiguous */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-petra-muted">
            <span className="bg-brand-50 border border-brand-100 text-petra-text px-2 py-1 rounded-lg">{rangeLabel}</span>
            <span className="bg-slate-100 px-2 py-1 rounded-lg">{basisLabel}</span>
            {to === today && <span>· נכון להיום</span>}
            {isFetching && <RefreshCw className="w-3.5 h-3.5 animate-spin text-petra-muted" aria-label="מרענן" />}
            {isError && <span className="text-red-600">· הרענון נכשל, מוצגים נתונים קודמים</span>}
          </div>

          {isEmpty ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-petra-text">אין עדיין לידים בטווח הזה</p>
              <p className="text-sm text-petra-muted mt-1">נסו טווח תאריכים רחב יותר, או הוסיפו לידים — הדוחות יתמלאו אוטומטית.</p>
            </div>
          ) : (
            <>
              <ReportKpis report={report} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <MonthlyTrendChart report={report} />
                <FunnelChart report={report} />
                <ResponseTimeChart report={report} />
                <AgingChart report={report} />
                <StaleTable report={report} />
                <LostReasonsCard report={report} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <SourceTables report={report} />
                <LandingPageTable report={report} />
                <ClosersTable report={report} />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
