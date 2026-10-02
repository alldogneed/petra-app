"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef } from "react";
import { CheckCircle2, Loader2, XCircle, CheckCircle, AlertCircle, Download, Upload, FileSpreadsheet, Clock, Info, Users, PawPrint, RefreshCw, CalendarRange } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

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
  { value: "customers", label: "לקוחות בלבד", description: "שם, טלפון, מייל, כתובת, תגיות", icon: Users },
  { value: "dogs", label: "כלבים בלבד", description: "שם, גזע, מין, משקל, בעלים", icon: PawPrint },
  { value: "customers_dogs", label: "לקוחות + כלבים", description: "נתוני לקוחות וכלבים משולבים", icon: FileSpreadsheet },
];
const EXPORT_STATUS_CFG: Record<string, { icon: React.ElementType; badgeClass: string; label: string; spin?: boolean }> = {
  pending:    { icon: Clock,         badgeClass: "bg-amber-50 text-amber-700 border-amber-200",   label: "ממתין" },
  processing: { icon: RefreshCw,     badgeClass: "bg-blue-50 text-blue-700 border-blue-200",      label: "מעבד", spin: true },
  completed:  { icon: CheckCircle2,  badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "מוכן" },
  failed:     { icon: XCircle,       badgeClass: "bg-red-50 text-red-700 border-red-200",         label: "נכשל" },
  expired:    { icon: XCircle,       badgeClass: "bg-slate-50 text-slate-500 border-slate-200",   label: "פג תוקף" },
};
const EXPORT_TYPE_LABELS: Record<string, string> = {
  customers: "לקוחות בלבד", dogs: "כלבים בלבד", customers_dogs: "לקוחות + כלבים",
  pets: "חיות מחמד", both: "לקוחות + חיות",
};
function fmtFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataTab() {
  const queryClient = useQueryClient();
  const { canExportData } = usePermissions();

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
    queryFn: () => fetch("/api/exports").then((r) => r.json()),
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
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה ביצירת הייצוא"); return d; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exports"] }),
    onError: () => toast.error("שגיאה ביצירת הייצוא"),
  });

  function handleDownloadExport(jobId: string) {
    window.location.href = `/api/exports/download?jobId=${jobId}`;
  }

  // Template download
  async function handleDownloadTemplate() {
    const res = await fetch("/api/import/template");
    if (!res.ok) return;
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
    if (!file) return;

    setImportPhase("uploading");
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("includePets", "true");

      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Parse failed");

      const data = await res.json();
      setImportBatchId(data.batchId);
      setImportStats(data.stats);
      setImportTopIssues(data.topIssues?.map((i: { row: number; message: string }) => ({ row: i.row, message: i.message })) || []);
      setImportPhase("preview");
    } catch {
      setImportError("שגיאה בניתוח הקובץ");
      setImportPhase("error");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Execute import
  async function handleExecuteImport() {
    if (!importBatchId) return;
    setImportPhase("executing");

    try {
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: importBatchId }),
      });
      if (!res.ok) throw new Error("Execute failed");

      const data = await res.json();
      setImportResult(data);
      setImportPhase("done");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch {
      setImportError("שגיאה בביצוע הייבוא");
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
          <h3 className="text-base font-semibold text-petra-text">ייצוא נתונים</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Export Form */}
          <div className="lg:col-span-2 card p-5 space-y-4 self-start">
            <h4 className="text-sm font-bold text-petra-text">ייצוא חדש</h4>
            {/* Type */}
            <div>
              <label className="label mb-2 block">סוג ייצוא</label>
              <div className="space-y-2">
                {EXPORT_DATA_TYPES.map((t) => {
                  const Icon = t.icon;
                  const sel = exportType === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setExportType(t.value as typeof exportType)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all",
                        sel ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-200 bg-white"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 flex-shrink-0", sel ? "text-brand-500" : "text-petra-muted")} />
                      <div>
                        <p className={cn("text-sm font-semibold", sel ? "text-brand-700" : "text-petra-text")}>{t.label}</p>
                        <p className="text-xs text-petra-muted">{t.description}</p>
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
              <label className="label mb-2 block">אופן פלט</label>
              <div className="flex flex-col gap-2">
                {[{ value: "flat", label: "שטוח (גיליון אחד)" }, { value: "separate", label: "מופרד (גיליון לכל סוג)" }].map((m) => (
                  <button key={m.value} type="button" onClick={() => setOutputMode(m.value as typeof outputMode)}
                    className={cn("w-full py-2 px-3 rounded-xl text-sm font-medium border text-right transition-all",
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
                <label className="label">פילטר תאריכים (אופציונלי)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-petra-muted mb-1 block">מתאריך</label>
                  <input className="input text-sm" type="date" lang="he" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-petra-muted mb-1 block">עד תאריך</label>
                  <input className="input text-sm" type="date" lang="he" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                </div>
              </div>
            </div>
            <button type="button" onClick={() => createExportMutation.mutate()} disabled={createExportMutation.isPending}
              className="btn-primary w-full gap-2 justify-center flex items-center"
            >
              {createExportMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />מייצא...</> : <><Download className="w-4 h-4" />ייצא עכשיו</>}
            </button>
            {createExportMutation.isSuccess && <p className="text-xs text-emerald-600 text-center">בקשת הייצוא נשלחה. הקובץ יופיע בהיסטוריה.</p>}
          </div>
          {/* Export History */}
          <div className="lg:col-span-3 card p-5">
            <h4 className="text-sm font-bold text-petra-text mb-4">היסטוריית ייצואים</h4>
            {exportJobs.length === 0 ? (
              <div className="py-10 text-center text-petra-muted text-sm">אין ייצואים עדיין</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["סוג", "פורמט", "מצב", "רשומות", "גודל", "תאריך", ""].map((h) => (
                        <th key={h} className="table-header-cell">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportJobs.map((job) => {
                      const cfg = EXPORT_STATUS_CFG[job.status] ?? EXPORT_STATUS_CFG.pending;
                      const Icon = cfg.icon;
                      const downloadable = job.status === "completed" && new Date(job.expiresAt) > new Date();
                      return (
                        <tr key={job.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="table-cell font-medium">{EXPORT_TYPE_LABELS[job.exportType] ?? job.exportType}</td>
                          <td className="table-cell uppercase text-petra-muted">{job.format}</td>
                          <td className="table-cell">
                            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cfg.badgeClass)}>
                              <Icon className={cn("w-3 h-3", cfg.spin && "animate-spin")} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="table-cell text-petra-muted">{job.recordCount != null ? job.recordCount.toLocaleString("he-IL") : "—"}</td>
                          <td className="table-cell text-petra-muted">{fmtFileSize(job.fileSize)}</td>
                          <td className="table-cell text-petra-muted whitespace-nowrap">{new Date(job.createdAt).toLocaleDateString("he-IL")}</td>
                          <td className="table-cell">
                            {downloadable ? (
                              <button onClick={() => handleDownloadExport(job.id)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 font-medium"
                              >
                                <Download className="w-3.5 h-3.5" />הורד
                              </button>
                            ) : job.status === "completed" ? <span className="text-xs text-petra-muted">פג תוקף</span> : null}
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
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ייבוא נתונים</h3>
        </div>

        {importPhase === "idle" && (
          <div className="space-y-4">
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="w-4 h-4" />
              הורד תבנית לדוגמה
            </button>

            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-petra-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-petra-text">לחץ להעלאת קובץ</p>
              <p className="text-xs text-petra-muted mt-1">Excel (.xlsx) או CSV</p>
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
              סיכום ניתוח הקובץ
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-lg font-bold text-emerald-700">{importStats.totalCustomers}</p>
                <p className="text-xs text-emerald-600">לקוחות חדשים</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{importStats.totalPets}</p>
                <p className="text-xs text-blue-600">חיות מחמד</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-lg font-bold text-amber-700">{importStats.skippedRows}</p>
                <p className="text-xs text-amber-600">שורות דולגו</p>
              </div>
            </div>

            {importStats.dbDuplicates > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {importStats.dbDuplicates} לקוחות כבר קיימים במערכת (ימוזגו)
              </p>
            )}

            {importTopIssues.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-petra-muted">בעיות שזוהו:</p>
                {importTopIssues.slice(0, 5).map((issue, i) => (
                  <p key={i} className="text-xs text-red-500">
                    שורה {issue.row}: {issue.message}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleExecuteImport}>
                <CheckCircle className="w-4 h-4" />
                אשר ייבוא
              </button>
              <button className="btn-secondary" onClick={resetImport}>ביטול</button>
            </div>
          </div>
        )}

        {(importPhase === "uploading" || importPhase === "executing") && (
          <div className="space-y-3">
            <div className="text-center pb-4">
              <PetraLoader variant="inline" className="pb-3" />
              <span className="text-sm text-petra-muted">
                {importPhase === "uploading" ? "מנתח קובץ..." : "מייבא נתונים... עשוי לקחת עד דקה"}
              </span>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <span className="shrink-0 text-base">⚠️</span>
              <span>המערכת טוענת נתונים — נא לא לצאת מדף ההגדרות עד שהייבוא יסתיים</span>
            </div>
          </div>
        )}

        {importPhase === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              הייבוא הושלם בהצלחה!
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-lg font-bold text-emerald-700">{importResult.createdCustomers}</p>
                <p className="text-xs text-emerald-600">לקוחות נוצרו</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{importResult.mergedCustomers}</p>
                <p className="text-xs text-blue-600">לקוחות מוזגו</p>
              </div>
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-center">
                <p className="text-lg font-bold text-violet-700">{importResult.createdPets}</p>
                <p className="text-xs text-violet-600">חיות נוצרו</p>
              </div>
            </div>
            <button className="btn-secondary" onClick={resetImport}>ייבוא נוסף</button>
          </div>
        )}

        {importPhase === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {importError || "אירעה שגיאה"}
            </div>
            <button className="btn-secondary" onClick={resetImport}>נסה שוב</button>
          </div>
        )}
      </div>
    </div>
  );
}
