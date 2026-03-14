"use client";

import { useState, useRef, useCallback } from "react";
import { X, Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImportIssue {
  rowNumber: number;
  entityType: string;
  issueCode: string;
  message: string;
}

interface PreviewResult {
  total: number;
  valid: number;
  issues: ImportIssue[];
}

interface ExecuteResult {
  total: number;
  valid: number;
  created: number;
  issues: ImportIssue[];
  batchId: string;
}

type Stage = "idle" | "uploading" | "preview" | "executing" | "done";

interface ImportModalProps {
  title: string;
  templateUrl: string;
  importUrl: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function ImportModal({ title, templateUrl, importUrl, onSuccess, onClose }: ImportModalProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("נדרש קובץ Excel (.xlsx) או CSV");
      return;
    }

    setFile(f);
    setStage("uploading");

    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("dryRun", "true");

      const res = await fetch(importUrl, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "שגיאה בניתוח הקובץ");
      }

      const data: PreviewResult = await res.json();
      setPreview(data);
      setStage("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בניתוח הקובץ");
      setStage("idle");
      setFile(null);
    }
  }, [importUrl]);

  const handleExecute = async () => {
    if (!file) return;
    setStage("executing");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "false");

      const res = await fetch(importUrl, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "שגיאה בייבוא");
      }

      const data: ExecuteResult = await res.json();
      setResult(data);
      setStage("done");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בייבוא");
      setStage("preview");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div
        className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-500" />
            {title}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Idle: Upload + Template ─────────────────────── */}
        {stage === "idle" && (
          <div className="space-y-4">
            <a
              href={templateUrl}
              className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              <Download className="w-4 h-4" />
              הורד קובץ לדוגמא (Excel)
            </a>

            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                dragOver
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-300 hover:border-brand-300 hover:bg-slate-50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-8 h-8 text-petra-muted mx-auto mb-3" />
              <p className="text-sm text-petra-muted mb-1">גרור קובץ לכאן או לחץ לבחירה</p>
              <p className="text-xs text-petra-muted/70">Excel (.xlsx) או CSV</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {/* ── Uploading: Spinner ──────────────────────────── */}
        {stage === "uploading" && (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
            <p className="text-sm text-petra-muted">...מנתח קובץ</p>
          </div>
        )}

        {/* ── Preview: Stats + Issues ─────────────────────── */}
        {stage === "preview" && preview && (
          <div className="space-y-4">
            <p className="text-sm text-petra-muted">
              קובץ: <span className="font-medium text-foreground">{file?.name}</span>
            </p>

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center">
                <p className="text-2xl font-bold">{preview.total}</p>
                <p className="text-xs text-petra-muted">סה״כ שורות</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{preview.valid}</p>
                <p className="text-xs text-petra-muted">תקינות</p>
              </div>
              <div className="card p-3 text-center">
                <p className={cn("text-2xl font-bold", preview.issues.length > 0 ? "text-red-600" : "text-slate-400")}>
                  {preview.issues.length}
                </p>
                <p className="text-xs text-petra-muted">שגיאות</p>
              </div>
            </div>

            {/* Issues list */}
            {preview.issues.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-red-50 px-4 py-2 border-b flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700">שגיאות ({preview.issues.length})</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y">
                  {preview.issues.map((issue, idx) => (
                    <div key={idx} className="px-4 py-2 text-sm flex items-start gap-2">
                      <span className="text-petra-muted shrink-0">שורה {issue.rowNumber}:</span>
                      <span className="text-red-600">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleExecute}
                disabled={preview.valid === 0}
                className="btn-primary flex-1"
              >
                ייבא {preview.valid} רשומות
              </button>
              <button
                onClick={() => { setStage("idle"); setFile(null); setPreview(null); }}
                className="btn-secondary"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* ── Executing: Spinner ──────────────────────────── */}
        {stage === "executing" && (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
            <p className="text-sm text-petra-muted">...מייבא</p>
          </div>
        )}

        {/* ── Done: Success ───────────────────────────────── */}
        {stage === "done" && result && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <p className="text-lg font-bold text-emerald-700">הייבוא הושלם!</p>
              <p className="text-sm text-petra-muted mt-1">
                נוצרו {result.created} רשומות מתוך {result.total}
              </p>
              {result.issues.length > 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  {result.issues.length} שגיאות
                </p>
              )}
            </div>
            <button onClick={onClose} className="btn-primary mx-auto">
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
