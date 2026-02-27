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
} from "lucide-react";
import { cn } from "@/lib/utils";

const EXPORT_TYPES = [
  {
    value: "customers",
    label: "לקוחות",
    description: "שם, טלפון, מייל, כתובת, תגיות",
    icon: Users,
  },
  {
    value: "pets",
    label: "חיות מחמד",
    description: "שם, סוג, גזע, מין, משקל, בעלים",
    icon: PawPrint,
  },
  {
    value: "both",
    label: "לקוחות + חיות",
    description: "שני גיליונות בקובץ אחד",
    icon: FileSpreadsheet,
  },
];

const STATUS_ICONS = {
  pending: Clock,
  processing: RefreshCw,
  completed: CheckCircle2,
  failed: XCircle,
  expired: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-500",
  processing: "text-blue-500",
  completed: "text-emerald-500",
  failed: "text-red-500",
  expired: "text-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  processing: "מעבד",
  completed: "מוכן",
  failed: "נכשל",
  expired: "פג תוקף",
};

interface ExportJob {
  id: string;
  exportType: string;
  format: string;
  status: string;
  fileName: string | null;
  recordCount: number | null;
  filterFromDate: string | null;
  filterToDate: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function ExportsPage() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState("customers");
  const [format, setFormat] = useState("xlsx");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: jobs = [], isLoading } = useQuery<ExportJob[]>({
    queryKey: ["exportJobs"],
    queryFn: () => fetch("/api/exports").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportType: selectedType,
          format,
          filterFromDate: fromDate || null,
          filterToDate: toDate || null,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exportJobs"] });
    },
  });

  const buildDownloadUrl = (type: string, fmt: string, from?: string | null, to?: string | null) => {
    const params = new URLSearchParams({ type, format: fmt });
    if (from) params.set("from", from.split("T")[0]);
    if (to) params.set("to", to.split("T")[0]);
    return `/api/exports/download?${params.toString()}`;
  };

  const typeLabels: Record<string, string> = {
    customers: "לקוחות",
    pets: "חיות מחמד",
    both: "לקוחות + חיות",
    customers_dogs: "לקוחות + חיות",
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ייצוא נתונים</h1>
          <p className="text-sm text-petra-muted mt-1">הורד נתוני עסק לקובץ Excel או CSV</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Export builder */}
        <div className="lg:col-span-2 card p-5 space-y-5">
          <h2 className="text-base font-bold text-petra-text">יצירת ייצוא חדש</h2>

          {/* Type selection */}
          <div>
            <label className="label mb-2">סוג הנתונים</label>
            <div className="space-y-2">
              {EXPORT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all",
                      selectedType === type.value
                        ? "border-brand-400 bg-brand-50"
                        : "border-slate-200 hover:border-brand-200 bg-white"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 flex-shrink-0", selectedType === type.value ? "text-brand-500" : "text-petra-muted")} />
                    <div>
                      <p className={cn("text-sm font-medium", selectedType === type.value ? "text-brand-700" : "text-petra-text")}>
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
            <label className="label mb-2">פורמט</label>
            <div className="flex gap-2">
              {["xlsx", "csv"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                    format === f
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                  )}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Date filter */}
          <div>
            <label className="label mb-2">סינון לפי תאריך הצטרפות (אופציונלי)</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-petra-muted mb-1 block">מתאריך</label>
                <input className="input text-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-petra-muted mb-1 block">עד תאריך</label>
                <input className="input text-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </div>

          <a
            href={buildDownloadUrl(selectedType, format, fromDate || null, toDate || null)}
            onClick={() => createMutation.mutate()}
            download
            className="btn-primary w-full gap-2 inline-flex items-center justify-center"
          >
            <Download className="w-4 h-4" />
            הורד קובץ {format.toUpperCase()}
          </a>
        </div>

        {/* Export history */}
        <div className="lg:col-span-3 card p-5">
          <h2 className="text-base font-bold text-petra-text mb-4">היסטוריית ייצוא</h2>
          {isLoading ? (
            <div className="text-center text-petra-muted text-sm py-8">טוען...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center text-petra-muted text-sm py-8">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
              אין ייצואים עדיין
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const StatusIcon = STATUS_ICONS[job.status as keyof typeof STATUS_ICONS] || Clock;
                const isDownloadable = job.status === "completed" && new Date(job.expiresAt) > new Date();
                return (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={cn("w-4 h-4 flex-shrink-0", STATUS_COLORS[job.status])} />
                      <div>
                        <p className="text-sm font-medium text-petra-text">
                          {typeLabels[job.exportType] || job.exportType}
                          <span className="text-petra-muted font-normal mr-1">({job.format.toUpperCase()})</span>
                        </p>
                        <p className="text-xs text-petra-muted">
                          {new Date(job.createdAt).toLocaleDateString("he-IL")} ·{" "}
                          {STATUS_LABELS[job.status] || job.status}
                          {job.recordCount != null && ` · ${job.recordCount} רשומות`}
                        </p>
                      </div>
                    </div>
                    {isDownloadable && (
                      <a
                        href={buildDownloadUrl(job.exportType, job.format, job.filterFromDate, job.filterToDate)}
                        download={job.fileName || `export.${job.format}`}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                        הורד
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
