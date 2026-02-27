"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  Users,
  PawPrint,
  SkipForward,
  Undo2,
  FileWarning,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParseResult {
  batchId: string;
  stats: {
    totalCustomers: number;
    totalPets: number;
    skippedRows: number;
    inFileDuplicates: number;
    dbDuplicates: number;
    orphanPets: number;
  };
  topIssues: { row: number; type: string; code: string; message: string }[];
  customerMappingConfidence: number;
  petMappingConfidence: number;
}

interface ExecuteResult {
  success: boolean;
  batchId: string;
  createdCustomers: number;
  mergedCustomers: number;
  createdPets: number;
}

interface BatchRecord {
  id: string;
  sourceFilename: string;
  status: string;
  createdAt: string;
  rollbackDeadline: string;
  canRollback: boolean;
  totalCustomers: number;
  totalPets: number;
  createdCustomers: number | null;
  createdPets: number | null;
  issueCount: number;
}

type Step = "upload" | "preview" | "success";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  validated: "ממתין לאישור",
  imported: "יובא",
  rolled_back: "בוטל",
  failed: "נכשל",
};

const STATUS_CLASSES: Record<string, string> = {
  validated: "badge badge-warning",
  imported: "badge badge-success",
  rolled_back: "badge badge-neutral",
  failed: "badge badge-danger",
};

function ConfidencePill({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    pct >= 50 ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-red-600 bg-red-50 border-red-200";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium", color)}>
      {label}: {pct}%
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [includePets, setIncludePets] = useState(true);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Batch history
  const { data: batches = [], refetch: refetchBatches } = useQuery<BatchRecord[]>({
    queryKey: ["importBatches"],
    queryFn: () => fetch("/api/import").then((r) => r.json()),
    staleTime: 30000,
  });

  // Execute import mutation
  const executeMutation = useMutation({
    mutationFn: (batchId: string) =>
      fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      }).then((r) => r.json()),
    onSuccess: (data: ExecuteResult) => {
      setExecuteResult(data);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["importBatches"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["pets"] });
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: (batchId: string) =>
      fetch(`/api/import/${batchId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["importBatches"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const processFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("includePets", String(includePets));

        const res = await fetch("/api/import/parse", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setUploadError(data.error ?? "שגיאה בניתוח הקובץ");
          return;
        }
        setParseResult(data);
        setStep("preview");
      } catch {
        setUploadError("שגיאה בחיבור לשרת");
      } finally {
        setIsUploading(false);
      }
    },
    [includePets]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const reset = () => {
    setStep("upload");
    setParseResult(null);
    setExecuteResult(null);
    setUploadError(null);
    refetchBatches();
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ייבוא נתונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            ייבא לקוחות וחיות מחמד מקובץ Excel / CSV
          </p>
        </div>
        <a
          href="/api/import/template"
          className="btn-secondary gap-2 inline-flex items-center"
        >
          <Download className="w-4 h-4" />
          הורד תבנית Excel
        </a>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        {(["upload", "preview", "success"] as Step[]).map((s, i) => {
          const labels = { upload: "העלאת קובץ", preview: "תצוגה מקדימה", success: "סיום" };
          const isDone = (step === "preview" && i === 0) || step === "success";
          const isActive = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-slate-200" />}
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2",
                isActive ? "bg-brand-500 border-brand-500 text-white" :
                isDone ? "bg-emerald-500 border-emerald-500 text-white" :
                "bg-white border-slate-200 text-petra-muted"
              )}>
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "font-medium",
                isActive ? "text-brand-600" : isDone ? "text-emerald-600" : "text-petra-muted"
              )}>
                {labels[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <p className="font-semibold text-petra-text text-sm">העלה קובץ לקוחות</p>
              <p className="text-xs text-petra-muted">CSV או Excel (.xlsx / .xls). הורד תבנית לפורמט הנכון.</p>
            </div>
          </div>

          {/* Include pets toggle */}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={includePets}
              onChange={(e) => setIncludePets(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-brand-500"
            />
            <span className="text-sm text-petra-text">כלול גיליון חיות מחמד (אם קיים)</span>
          </label>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
              isDragging
                ? "border-brand-400 bg-brand-50"
                : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
            )}
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-sm text-petra-muted">מנתח קובץ...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-petra-text">
                    גרור קובץ לכאן או לחץ לבחירה
                  </p>
                  <p className="text-xs text-petra-muted mt-1">CSV, XLSX, XLS עד 10MB</p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          <div className="text-xs text-petra-muted space-y-1 border-t pt-4">
            <p className="font-medium text-petra-text">מה צריך להיות בקובץ?</p>
            <p>• גיליון לקוחות: שם_מלא, טלפון (חובה), אימייל, עיר, הערות</p>
            <p>• גיליון חיות (אופציונלי): שם_חיה, טלפון_בעלים, גזע, מין, הערות</p>
            <p>• לקוחות קיימים (לפי טלפון) יעודכנו, חדשים ייוצרו</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === "preview" && parseResult && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold text-petra-text">תצוגה מקדימה – אנא אשר את היבוא</h2>
          </div>

          {/* Mapping confidence */}
          <div className="flex flex-wrap gap-2">
            <ConfidencePill value={parseResult.customerMappingConfidence} label="מיפוי עמודות לקוחות" />
            {includePets && <ConfidencePill value={parseResult.petMappingConfidence} label="מיפוי עמודות חיות" />}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<Users className="w-4 h-4 text-brand-500" />} label="לקוחות לייבא" value={parseResult.stats.totalCustomers} />
            <StatCard icon={<PawPrint className="w-4 h-4 text-emerald-500" />} label="חיות לייבא" value={parseResult.stats.totalPets} />
            <StatCard icon={<SkipForward className="w-4 h-4 text-amber-500" />} label="שורות דלוגות" value={parseResult.stats.skippedRows} warn />
            <StatCard icon={<Users className="w-4 h-4 text-slate-400" />} label="כפולות בקובץ" value={parseResult.stats.inFileDuplicates} />
            <StatCard icon={<Users className="w-4 h-4 text-slate-400" />} label="כפולות מהמסד" value={parseResult.stats.dbDuplicates} />
            {parseResult.stats.orphanPets > 0 && (
              <StatCard icon={<PawPrint className="w-4 h-4 text-red-400" />} label="חיות ללא בעלים" value={parseResult.stats.orphanPets} warn />
            )}
          </div>

          {/* Issues preview */}
          {parseResult.topIssues.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-petra-text flex items-center gap-1.5">
                  <FileWarning className="w-4 h-4 text-amber-500" />
                  בעיות ({parseResult.topIssues.length}{parseResult.topIssues.length === 10 ? "+" : ""})
                </p>
                <button
                  onClick={() => setShowAllIssues((v) => !v)}
                  className="text-xs text-brand-600 flex items-center gap-1"
                >
                  {showAllIssues ? "הסתר" : "הצג"}
                  {showAllIssues ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              {showAllIssues && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {parseResult.topIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-100 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <span className="font-medium">שורה {issue.row}</span> ({issue.type}) – {issue.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t">
            <button
              onClick={() => executeMutation.mutate(parseResult.batchId)}
              disabled={executeMutation.isPending || parseResult.stats.totalCustomers === 0}
              className="btn-primary gap-2 inline-flex items-center disabled:opacity-50"
            >
              {executeMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              אשר וייבא {parseResult.stats.totalCustomers} לקוחות
            </button>
            <button onClick={reset} className="btn-secondary">
              ביטול
            </button>
          </div>
          {executeMutation.isError && (
            <p className="text-sm text-red-500">שגיאה בייבוא – נסה שנית</p>
          )}
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === "success" && executeResult && (
        <div className="card p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-petra-text">הייבוא הסתיים בהצלחה!</h2>
            <p className="text-sm text-petra-muted mt-1">
              הנתונים נשמרו במסד הנתונים
            </p>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-600">{executeResult.createdCustomers}</p>
              <p className="text-petra-muted">לקוחות חדשים</p>
            </div>
            {executeResult.mergedCustomers > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-600">{executeResult.mergedCustomers}</p>
                <p className="text-petra-muted">עודכנו</p>
              </div>
            )}
            {executeResult.createdPets > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{executeResult.createdPets}</p>
                <p className="text-petra-muted">חיות מחמד</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={reset} className="btn-primary">
              ייבוא נוסף
            </button>
          </div>
          <p className="text-xs text-petra-muted">
            ניתן לבטל ייבוא זה תוך 24 שעות מרשימת ההיסטוריה למטה
          </p>
        </div>
      )}

      {/* ── History ── */}
      {batches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-petra-text">היסטוריית ייבואים</h2>
          <div className="card divide-y">
            {batches.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                onRollback={(id) => rollbackMutation.mutate(id)}
                isRollingBack={rollbackMutation.isPending && rollbackMutation.variables === batch.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      warn && value > 0 ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"
    )}>
      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-petra-text leading-tight">{value}</p>
        <p className="text-xs text-petra-muted truncate">{label}</p>
      </div>
    </div>
  );
}

function BatchRow({
  batch,
  onRollback,
  isRollingBack,
}: {
  batch: BatchRecord;
  onRollback: (id: string) => void;
  isRollingBack: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex items-center justify-between p-4 gap-4 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-petra-text truncate">{batch.sourceFilename}</p>
          <p className="text-xs text-petra-muted">
            {new Date(batch.createdAt).toLocaleDateString("he-IL", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          {batch.createdCustomers !== null ? (
            <p className="text-xs text-petra-muted">
              {batch.createdCustomers} לקוחות
              {batch.createdPets !== null && batch.createdPets > 0 && ` · ${batch.createdPets} חיות`}
            </p>
          ) : (
            <p className="text-xs text-petra-muted">
              {batch.totalCustomers} לקוחות
            </p>
          )}
          {batch.issueCount > 0 && (
            <p className="text-xs text-amber-600">{batch.issueCount} בעיות</p>
          )}
        </div>

        <span className={STATUS_CLASSES[batch.status] ?? "badge badge-neutral"}>
          {STATUS_LABELS[batch.status] ?? batch.status}
        </span>

        {batch.canRollback && !showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            בטל יבוא
          </button>
        )}
        {batch.canRollback && showConfirm && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onRollback(batch.id); setShowConfirm(false); }}
              disabled={isRollingBack}
              className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isRollingBack ? "מבטל..." : "אישור"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
            >
              לא
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
