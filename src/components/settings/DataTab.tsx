"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef } from "react";
import { CheckCircle2, Loader2, XCircle, CheckCircle, AlertCircle, Download, Upload, FileSpreadsheet, Clock, Info, Users, PawPrint, RefreshCw, CalendarRange, Lock } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

// ─── Data Tab (Import / Export) ──────────────────────────────────────────────

type ImportPhase = "idle" | "uploading" | "preview" | "executing" | "done" | "error";

interface ImportStats {
  totalCustomers: number;
  totalPets: number;
  skippedRows: number;
  inFileDuplicates: number;
  dbDuplicates: number;
  orphanPets: number;
}

interface ImportResult {
  createdCustomers: number;
  mergedCustomers: number;
  createdPets: number;
}

// Export types/constants for DataTab
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

const EXPORT_DATA_TYPES = [
  { value: "customers", icon: Users },
  { value: "dogs", icon: PawPrint },
  { value: "customers_dogs", icon: FileSpreadsheet },
] as const;
// Label = settings.dataTab.exportStatus.<key>
const EXPORT_STATUS_CFG: Record<string, { icon: React.ElementType; badgeClass: string; spin?: boolean }> = {
  pending:    { icon: Clock,         badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  processing: { icon: RefreshCw,     badgeClass: "bg-blue-50 text-blue-700 border-blue-200", spin: true },
  completed:  { icon: CheckCircle2,  badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed:     { icon: XCircle,       badgeClass: "bg-red-50 text-red-700 border-red-200" },
  expired:    { icon: XCircle,       badgeClass: "bg-slate-50 text-slate-500 border-slate-200" },
};
// Export type labels (incl. legacy "pets" / "both" jobs) = settings.dataTab.exportTypeLabels.<type>
function fmtFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataTab() {
  const queryClient = useQueryClient();
  const { canExportData, canImportData } = usePermissions();
  // POST /api/import/parse + /api/import/execute require DATA_IMPORT (owner-grantable).
  const canImport = canImportData;
  const t = useTranslations("settings.dataTab");
  const tc = useTranslations("common");
  const { locale, cfg: localeCfg } = useBusinessLocale();

  // Export state (async job system)
  const [exportType, setExportType] = useState<"customers" | "dogs" | "customers_dogs">("customers");
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [outputMode, setOutputMode] = useState<"flat" | "separate">("separate");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // Import state
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importTopIssues, setImportTopIssues] = useState<{ row: number; message: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export jobs query
  const { data: exportJobs = [] } = useQuery<ExportJob[]>({
    queryKey: ["exports"],
    queryFn: () => fetchJSON<ExportJob[]>("/api/exports"),
    enabled: canExportData,
    refetchInterval: (query) => {
      const data = query.state.data as ExportJob[] | undefined;
      return data?.some((j) => j.status === "pending" || j.status === "processing") ? 3000 : false;
    },
  });

  const createExportMutation = useMutation({
    mutationFn: () =>
      fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType, format: exportFormat, outputMode, filterFromDate: filterFromDate || null, filterToDate: filterToDate || null }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.createExport")); return d; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exports"] }),
    onError: (e: Error) => toast.error(e.message || t("errors.createExport")),
  });

  function handleDownloadExport(jobId: string) {
    window.location.href = `/api/exports/download?jobId=${jobId}`;
  }

  // Template download
  async function handleDownloadTemplate() {
    const res = await fetch("/api/import/template").catch(() => null);
    if (!res?.ok) {
      toast.error(t("errors.templateDownload"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petra-import-template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // File upload & parse
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canImport) return;

    setImportPhase("uploading");
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("includePets", "true");

      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : "");
      }

      const data = await res.json();
      setImportBatchId(data.batchId);
      setImportStats(data.stats);
      setImportTopIssues(data.topIssues?.map((i: { row: number; message: string }) => ({ row: i.row, message: i.message })) || []);
      setImportPhase("preview");
    } catch (err) {
      const msg = err instanceof Error && /[\u0590-\u05FF]/.test(err.message) ? err.message : "";
      setImportError(msg || t("errors.parse"));
      setImportPhase("error");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Execute import
  async function handleExecuteImport() {
    if (!importBatchId || !canImport) return;
    setImportPhase("executing");

    try {
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: importBatchId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : "");
      }

      const data = await res.json();
      setImportResult(data);
      setImportPhase("done");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      const msg = err instanceof Error && /[\u0590-\u05FF]/.test(err.message) ? err.message : "";
      setImportError(msg || t("errors.execute"));
      setImportPhase("error");
    }
  }

  function resetImport() {
    setImportPhase("idle");
    setImportStats(null);
    setImportBatchId(null);
    setImportResult(null);
    setImportError(null);
    setImportTopIssues([]);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* ── Export Section ── */}
      {canExportData && (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">{t("export.title")}</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Export Form */}
          <div className="lg:col-span-2 card p-4 sm:p-5 space-y-4 self-start min-w-0">
            <h4 className="text-sm font-bold text-petra-text">{t("export.newExport")}</h4>
            {/* Type */}
            <div>
              <label className="label mb-2 block">{t("export.type")}</label>
              <div className="space-y-2">
                {EXPORT_DATA_TYPES.map((dt) => {
                  const Icon = dt.icon;
                  const sel = exportType === dt.value;
                  return (
                    <button key={dt.value} type="button" onClick={() => setExportType(dt.value as typeof exportType)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-start transition-all",
                        sel ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-200 bg-white"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 flex-shrink-0", sel ? "text-brand-500" : "text-petra-muted")} />
                      <div>
                        <p className={cn("text-sm font-semibold", sel ? "text-brand-700" : "text-petra-text")}>{t(`exportTypes.${dt.value}.label`)}</p>
                        <p className="text-xs text-petra-muted">{t(`exportTypes.${dt.value}.description`)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Format */}
            <div>
              <label className="label mb-2 block">{t("export.format")}</label>
              <div className="flex gap-2">
                {(["xlsx", "csv"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setExportFormat(f)}
                    className={cn("flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all",
                      exportFormat === f ? "bg-brand-500 text-white border-brand-500" : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                    )}
                  >
                    {f === "xlsx" ? "Excel (.xlsx)" : "CSV"}
                  </button>
                ))}
              </div>
            </div>
            {/* Output mode */}
            <div>
              <label className="label mb-2 block">{t("export.outputMode")}</label>
              <div className="flex flex-col gap-2">
                {[{ value: "flat", label: t("export.outputFlat") }, { value: "separate", label: t("export.outputSeparate") }].map((m) => (
                  <button key={m.value} type="button" onClick={() => setOutputMode(m.value as typeof outputMode)}
                    className={cn("w-full py-2 px-3 rounded-xl text-sm font-medium border text-start transition-all",
                      outputMode === m.value ? "bg-brand-500 text-white border-brand-500" : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                    )}
                  >{m.label}</button>
                ))}
              </div>
            </div>
            {/* Date filter */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarRange className="w-4 h-4 text-petra-muted" />
                <label className="label">{t("export.dateFilter")}</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-petra-muted mb-1 block">{t("export.fromDate")}</label>
                  <input className="input text-sm" type="date" lang={localeCfg.lang} value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-petra-muted mb-1 block">{t("export.toDate")}</label>
                  <input className="input text-sm" type="date" lang={localeCfg.lang} value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                </div>
              </div>
            </div>
            <button type="button" onClick={() => createExportMutation.mutate()} disabled={createExportMutation.isPending}
              className="btn-primary w-full gap-2 justify-center flex items-center"
            >
              {createExportMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />{tc("progress.exporting")}</> : <><Download className="w-4 h-4" />{t("export.exportNow")}</>}
            </button>
            {createExportMutation.isSuccess && <p className="text-xs text-emerald-600 text-center">{t("export.requested")}</p>}
          </div>
          {/* Export History */}
          <div className="lg:col-span-3 card p-4 sm:p-5 min-w-0">
            <h4 className="text-sm font-bold text-petra-text mb-4">{t("export.historyTitle")}</h4>
            {exportJobs.length === 0 ? (
              <div className="py-10 text-center text-petra-muted text-sm">{t("export.historyEmpty")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr>
                      {(["type", "format", "status", "records", "size", "date", ""] as const).map((h) => (
                        <th key={h} className="table-header-cell">{h ? t(`export.columns.${h}`) : ""}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportJobs.map((job) => {
                      const statusKey = EXPORT_STATUS_CFG[job.status] ? job.status : "pending";
                      const cfg = EXPORT_STATUS_CFG[statusKey];
                      const Icon = cfg.icon;
                      const downloadable = job.status === "completed" && new Date(job.expiresAt) > new Date();
                      return (
                        <tr key={job.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="table-cell font-medium">{t.has(`exportTypeLabels.${job.exportType}`) ? t(`exportTypeLabels.${job.exportType}`) : job.exportType}</td>
                          <td className="table-cell uppercase text-petra-muted">{job.format}</td>
                          <td className="table-cell">
                            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cfg.badgeClass)}>
                              <Icon className={cn("w-3 h-3", cfg.spin && "animate-spin")} />
                              {t(`exportStatus.${statusKey}`)}
                            </span>
                          </td>
                          <td className="table-cell text-petra-muted">{job.recordCount != null ? job.recordCount.toLocaleString(locale) : "—"}</td>
                          <td className="table-cell text-petra-muted">{fmtFileSize(job.fileSize)}</td>
                          <td className="table-cell text-petra-muted whitespace-nowrap">{new Date(job.createdAt).toLocaleDateString(locale)}</td>
                          <td className="table-cell">
                            {downloadable ? (
                              <button onClick={() => handleDownloadExport(job.id)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />{t("export.download")}
                              </button>
                            ) : job.status === "completed" ? <span className="text-xs text-petra-muted">{t("exportStatus.expired")}</span> : null}
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
      )}

      {/* ── Import Section ── */}
      <div className={cn("card p-4 sm:p-6", !canImport && "opacity-80")}>
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">{t("import.title")}</h3>
        </div>

        {!canImport && (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t("import.noPermission")}</span>
          </div>
        )}

        {canImport && importPhase === "idle" && (
          <div className="space-y-4">
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="w-4 h-4" />
              {t("import.downloadTemplate")}
            </button>

            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
            >
              <Upload className="w-8 h-8 text-petra-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-petra-text">{t("import.clickToUpload")}</p>
              <p className="text-xs text-petra-muted mt-1">{t("import.fileTypes")}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        )}

        {importPhase === "preview" && importStats && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
              <Info className="w-4 h-4 flex-shrink-0" />
              {t("import.summaryTitle")}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-lg font-bold text-emerald-700">{importStats.totalCustomers}</p>
                <p className="text-xs text-emerald-600">{t("import.newCustomers")}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{importStats.totalPets}</p>
                <p className="text-xs text-blue-600">{t("import.pets")}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-lg font-bold text-amber-700">{importStats.skippedRows}</p>
                <p className="text-xs text-amber-600">{t("import.skippedRows")}</p>
              </div>
            </div>

            {importStats.dbDuplicates > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {t("import.dbDuplicates", { count: importStats.dbDuplicates })}
              </p>
            )}

            {importTopIssues.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-petra-muted">{t("import.issuesTitle")}</p>
                {importTopIssues.slice(0, 5).map((issue, i) => (
                  <p key={i} className="text-xs text-red-500">
                    {t("import.issueRow", { row: issue.row, message: issue.message })}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleExecuteImport}>
                <CheckCircle className="w-4 h-4" />
                {t("import.confirm")}
              </button>
              <button className="btn-secondary" onClick={resetImport}>{tc("actions.cancel")}</button>
            </div>
          </div>
        )}

        {(importPhase === "uploading" || importPhase === "executing") && (
          <div className="space-y-3">
            <div className="text-center pb-4">
              <PetraLoader variant="inline" className="pb-3" />
              <span className="text-sm text-petra-muted">
                {importPhase === "uploading" ? t("import.parsing") : t("import.importing")}
              </span>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t("import.stayOnPage")}</span>
            </div>
          </div>
        )}

        {importPhase === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {t("import.done")}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-lg font-bold text-emerald-700">{importResult.createdCustomers}</p>
                <p className="text-xs text-emerald-600">{t("import.createdCustomers")}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{importResult.mergedCustomers}</p>
                <p className="text-xs text-blue-600">{t("import.mergedCustomers")}</p>
              </div>
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-center">
                <p className="text-lg font-bold text-violet-700">{importResult.createdPets}</p>
                <p className="text-xs text-violet-600">{t("import.createdPets")}</p>
              </div>
            </div>
            <button className="btn-secondary" onClick={resetImport}>{t("import.importMore")}</button>
          </div>
        )}

        {importPhase === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {importError || t("errors.generic")}
            </div>
            <button className="btn-secondary" onClick={resetImport}>{t("import.retry")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
