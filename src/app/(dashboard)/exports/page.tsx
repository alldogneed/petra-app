"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Users,
  PawPrint,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

interface ExportJob {
  id: string;
  exportType: string;
  format: string;
  outputMode: string;
  status: string;
  fileName: string | null;
  fileSize: number | null;
  recordCount: number | null;
  filterFromDate: string | null;
  filterToDate: string | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────

const EXPORT_TYPES = [
  {
    value: "customers",
    label: "לקוחות בלבד",
    description: "שם, טלפון, מייל, כתובת, תגיות",
    icon: Users,
  },
  {
    value: "dogs",
    label: "כלבים בלבד",
    description: "שם, גזע, מין, משקל, בעלים",
    icon: PawPrint,
  },
  {
    value: "customers_dogs",
    label: "לקוחות + כלבים",
    description: "נתוני לקוחות וכלבים משולבים",
    icon: FileSpreadsheet,
  },
];

const FORMAT_OPTIONS = [
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV" },
];

const OUTPUT_MODES = [
  { value: "flat", label: "שטוח (גיליון אחד)" },
  { value: "separate", label: "מופרד (גיליון לכל סוג)" },
];

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; badgeClass: string; label: string }> = {
  pending: {
    icon: Clock,
    color: "text-amber-500",
    badgeClass: "badge bg-amber-50 text-amber-700 border border-amber-200",
    label: "ממתין",
  },
  processing: {
    icon: RefreshCw,
    color: "text-blue-500",
    badgeClass: "badge bg-blue-50 text-blue-700 border border-blue-200",
    label: "מעבד",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    badgeClass: "badge bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "מוכן",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    badgeClass: "badge bg-red-50 text-red-700 border border-red-200",
    label: "נכשל",
  },
  expired: {
    icon: XCircle,
    color: "text-slate-400",
    badgeClass: "badge bg-slate-50 text-slate-500 border border-slate-200",
    label: "פג תוקף",
  },
};

const EXPORT_TYPE_LABELS: Record<string, string> = {
  customers: "לקוחות בלבד",
  dogs: "כלבים בלבד",
  customers_dogs: "לקוחות + כלבים",
  // legacy values
  pets: "חיות מחמד",
  both: "לקוחות + חיות",
};

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ───────────────────────────────────────────────

export default function ExportsPage() {
  const queryClient = useQueryClient();

  const [exportType, setExportType] = useState<"customers" | "dogs" | "customers_dogs">("customers");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [outputMode, setOutputMode] = useState<"flat" | "separate">("separate");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // ── Queries ──────────────────────────────────────────────

  const { data: jobs = [], isLoading } = useQuery<ExportJob[]>({
    queryKey: ["exports"],
    queryFn: () => fetch("/api/exports").then((r) => r.json()),
    refetchInterval: (query) => {
      const data = query.state.data as ExportJob[] | undefined;
      const hasPending = data?.some((j) => j.status === "pending" || j.status === "processing");
      return hasPending ? 3000 : false;
    },
  });

  // ── Mutations ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () =>
      fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportType,
          format,
          outputMode,
          filterFromDate: filterFromDate || null,
          filterToDate: filterToDate || null,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });

  const handleExport = () => {
    createMutation.mutate();
  };

  const handleDownload = (jobId: string) => {
    window.location.href = `/api/exports/download?jobId=${jobId}`;
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ייצוא נתונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            הורד את נתוני העסק שלך לקובץ Excel או CSV לצרכי גיבוי, ניתוח ושיתוף
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Export Form ─────────────────────────────────────── */}
        <div className="lg:col-span-2 card p-5 space-y-5 self-start">
          <h2 className="text-base font-bold text-petra-text">ייצוא חדש</h2>

          {/* Export Type */}
          <div>
            <label className="label mb-2 block">סוג ייצוא</label>
            <div className="space-y-2">
              {EXPORT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = exportType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setExportType(type.value as typeof exportType)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all",
                      isSelected
                        ? "border-brand-400 bg-brand-50"
                        : "border-slate-200 hover:border-brand-200 bg-white"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isSelected ? "text-brand-500" : "text-petra-muted"
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          isSelected ? "text-brand-700" : "text-petra-text"
                        )}
                      >
                        {type.label}
                      </p>
                      <p className="text-xs text-petra-muted">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="label mb-2 block">פורמט קובץ</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value as typeof format)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all",
                    format === f.value
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Output Mode */}
          <div>
            <label className="label mb-2 block">אופן פלט</label>
            <div className="flex flex-col gap-2">
              {OUTPUT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setOutputMode(mode.value as typeof outputMode)}
                  className={cn(
                    "w-full py-2 px-3 rounded-xl text-sm font-medium border text-right transition-all",
                    outputMode === mode.value
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarRange className="w-4 h-4 text-petra-muted" />
              <label className="label">פילטר תאריכים (אופציונלי)</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-petra-muted mb-1 block">מתאריך</label>
                <input
                  className="input text-sm"
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-petra-muted mb-1 block">עד תאריך</label>
                <input
                  className="input text-sm"
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleExport}
            disabled={createMutation.isPending}
            className="btn-primary w-full gap-2 justify-center"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                מייצא...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                ייצא עכשיו
              </>
            )}
          </button>

          {createMutation.isSuccess && (
            <p className="text-xs text-emerald-600 text-center">
              בקשת הייצוא נשלחה. הקובץ יופיע בהיסטוריה למטה.
            </p>
          )}
        </div>

        {/* ── Export History ───────────────────────────────────── */}
        <div className="lg:col-span-3 card p-5">
          <h2 className="text-base font-bold text-petra-text mb-4">היסטוריית ייצואים</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-petra-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              טוען...
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <p className="text-sm text-petra-muted mt-2">אין ייצואים עדיין</p>
              <p className="text-xs text-petra-muted mt-1">
                צור ייצוא ראשון באמצעות הטופס משמאל
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header-cell">סוג</th>
                    <th className="table-header-cell">פורמט</th>
                    <th className="table-header-cell">מצב</th>
                    <th className="table-header-cell">רשומות</th>
                    <th className="table-header-cell">גודל</th>
                    <th className="table-header-cell">תאריך</th>
                    <th className="table-header-cell"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.icon;
                    const isDownloadable =
                      job.status === "completed" && new Date(job.expiresAt) > new Date();

                    return (
                      <tr key={job.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="table-cell font-medium">
                          {EXPORT_TYPE_LABELS[job.exportType] ?? job.exportType}
                        </td>
                        <td className="table-cell uppercase text-petra-muted">
                          {job.format}
                        </td>
                        <td className="table-cell">
                          <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", statusCfg.badgeClass)}>
                            <StatusIcon
                              className={cn(
                                "w-3 h-3",
                                job.status === "processing" && "animate-spin"
                              )}
                            />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="table-cell text-petra-muted">
                          {job.recordCount != null ? `${job.recordCount.toLocaleString("he-IL")}` : "—"}
                        </td>
                        <td className="table-cell text-petra-muted">
                          {job.fileSize ? formatFileSize(job.fileSize) : "—"}
                        </td>
                        <td className="table-cell text-petra-muted whitespace-nowrap">
                          {new Date(job.createdAt).toLocaleDateString("he-IL")}
                        </td>
                        <td className="table-cell">
                          {isDownloadable ? (
                            <button
                              type="button"
                              onClick={() => handleDownload(job.id)}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 font-medium"
                            >
                              <Download className="w-3.5 h-3.5" />
                              הורד
                            </button>
                          ) : job.status === "completed" ? (
                            <span className="text-xs text-petra-muted">פג תוקף</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
