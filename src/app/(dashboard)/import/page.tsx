"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImportRow {
  name: string;
  phone: string;
  email?: string;
  petName?: string;
  petBreed?: string;
  petSpecies?: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface ValidationResult {
  total: number;
  valid: number;
  errors: RowError[];
}

interface ImportResult {
  total: number;
  valid: number;
  errors: RowError[];
  created: number;
  createdPets: number;
  batchId: string;
}

interface BatchRecord {
  id: string;
  sourceFilename: string;
  status: string;
  createdAt: string;
  rollbackDeadline: string;
  canRollback: boolean;
  total: number;
  valid: number;
  created: number | null;
  issueCount: number;
}

type Step = "upload" | "preview" | "result";

// ── CSV helpers (no external packages) ────────────────────────────────────────

/**
 * Parse a single CSV line, handling quoted fields.
 * Supports commas inside double quotes and escaped double-quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Normalize a header name: lowercase, trim, remove BOM characters.
 */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/^\uFEFF/, "") // BOM
    .replace(/[^a-z\u0590-\u05FF\s]/g, "")
    .trim();
}

/** Map Hebrew / English header variants to our canonical field names */
function detectField(header: string): keyof ImportRow | null {
  const h = normalizeHeader(header);
  if (h === "שם" || h === "שם מלא" || h === "name" || h === "fullname" || h === "full name") return "name";
  if (h === "טלפון" || h === "phone" || h === "mobile" || h === "נייד") return "phone";
  if (h === "אימייל" || h === "email" || h === "מייל") return "email";
  if (h === "שם כלב" || h === "שם חיה" || h === "petname" || h === "pet name" || h === "dog name") return "petName";
  if (h === "גזע" || h === "breed" || h === "petbreed" || h === "pet breed") return "petBreed";
  if (h === "מין" || h === "species" || h === "petspecies" || h === "סוג חיה") return "petSpecies";
  return null;
}

/**
 * Parse CSV text into ImportRow objects.
 * Returns an array of rows and the filename (for display).
 */
function parseCsvText(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headerFields = parseCsvLine(lines[0]);
  const columnMap: Array<keyof ImportRow | null> = headerFields.map(detectField);

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Partial<ImportRow> = {};
    columnMap.forEach((field, colIdx) => {
      if (field && cells[colIdx] !== undefined && cells[colIdx] !== "") {
        (row as Record<string, string>)[field] = cells[colIdx];
      }
    });
    // Only include rows that have at least a name or phone
    if (row.name || row.phone) {
      rows.push(row as ImportRow);
    }
  }

  return rows;
}

/** Generate a template CSV for download */
function generateTemplateCsv(): string {
  const headers = "שם,טלפון,אימייל,שם כלב,גזע,מין";
  const example = "ישראל ישראלי,0501234567,israel@example.com,רקס,לברדור,dog";
  return `\uFEFF${headers}\n${example}\n`;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  imported: "יובא",
  rolled_back: "בוטל",
  failed: "נכשל",
  validated: "ממתין",
  uploaded: "הועלה",
};

const STATUS_COLORS: Record<string, string> = {
  imported: "badge-success",
  rolled_back: "badge-neutral",
  failed: "badge-danger",
  validated: "badge-warning",
  uploaded: "badge-warning",
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [sourceFilename, setSourceFilename] = useState("import.csv");
  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History
  const {
    data: batches = [],
    refetch: refetchBatches,
  } = useQuery<BatchRecord[]>({
    queryKey: ["importBatches"],
    queryFn: () => fetch("/api/import").then((r) => r.json()),
    staleTime: 30_000,
  });

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    setSourceFilename(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "txt"].includes(ext)) {
      // For non-CSV files we show a clear error (no xlsx parsing without a library)
      setParseError(
        "פורמט לא נתמך. אנא השתמש בקובץ CSV. לייבוא Excel – שמור תחילה כ-CSV מתוך Excel."
      );
      return;
    }

    const text = await file.text();
    const rows = parseCsvText(text);
    if (rows.length === 0) {
      setParseError("לא נמצאו שורות תקינות בקובץ. ודא שיש כותרות וייצא מחדש.");
      return;
    }

    setParsedRows(rows);

    // Run server-side dry-run validation
    setIsValidating(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, dryRun: true, sourceFilename: file.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "שגיאה בוולידציה");
        return;
      }
      setValidation(data as ValidationResult);
      setStep("preview");
    } catch {
      setParseError("שגיאה בחיבור לשרת");
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Import ────────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows, dryRun: false, sourceFilename }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "שגיאה בייבוא");
        return;
      }
      setImportResult(data as ImportResult);
      setStep("result");
      refetchBatches();
    } catch {
      setImportError("שגיאה בחיבור לשרת");
    } finally {
      setIsImporting(false);
    }
  };

  // ── Template download ─────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const csv = generateTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "תבנית-ייבוא-לקוחות.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setValidation(null);
    setImportResult(null);
    setParseError(null);
    setImportError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ייבוא נתונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            ייבא לקוחות וחיות מחמד מקובץ CSV
          </p>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary gap-2 inline-flex items-center">
          <Download className="w-4 h-4" />
          הורד תבנית CSV
        </button>
      </div>

      {/* ── Step 1: Upload ───────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p className="font-semibold text-petra-text">העלה קובץ לקוחות</p>
              <p className="text-xs text-petra-muted">
                עמודות נדרשות: <strong>שם, טלפון</strong> | אופציונלי: אימייל, שם כלב, גזע, מין
              </p>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              isDragging
                ? "border-brand-400 bg-brand-50"
                : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
            }`}
          >
            {isValidating ? (
              <>
                <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-petra-muted">מאמת נתונים...</p>
              </>
            ) : (
              <>
                <FileText className="w-10 h-10 text-slate-300" />
                <div className="text-center">
                  <p className="font-medium text-petra-text">גרור קובץ CSV לכאן</p>
                  <p className="text-sm text-petra-muted mt-1">או לחץ לבחירת קובץ</p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-slate-50 rounded-xl p-4 text-xs text-petra-muted space-y-1 border border-slate-100">
            <p className="font-semibold text-petra-text text-sm mb-2">הוראות לקובץ CSV</p>
            <p>• שורה ראשונה – כותרות עמודות (שם, טלפון, אימייל, שם כלב, גזע, מין)</p>
            <p>• כל שורה נוספת – לקוח אחד</p>
            <p>• שם וטלפון – חובה לכל שורה</p>
            <p>• שם כלב – אם קיים, ייצור חיית מחמד ותשויך ללקוח</p>
            <p>• ניתן לפתוח ב-Excel ולשמור בתור "CSV UTF-8"</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview + Validation ─────────────────────────────────────── */}
      {step === "preview" && validation && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500" />
              <h2 className="font-semibold text-petra-text">תצוגה מקדימה – {sourceFilename}</h2>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                <p className="text-2xl font-bold text-petra-text">{validation.total}</p>
                <p className="text-xs text-petra-muted mt-1">סה"כ שורות</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                <p className="text-2xl font-bold text-emerald-600">{validation.valid}</p>
                <p className="text-xs text-petra-muted mt-1">שורות תקינות</p>
              </div>
              <div className={`rounded-xl p-4 text-center border ${validation.errors.length > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                <p className={`text-2xl font-bold ${validation.errors.length > 0 ? "text-red-600" : "text-petra-text"}`}>
                  {validation.errors.length > 0
                    ? [...new Set(validation.errors.map((e) => e.row))].length
                    : 0}
                </p>
                <p className="text-xs text-petra-muted mt-1">שורות שגויות</p>
              </div>
            </div>

            <p className="text-sm text-petra-muted">
              {validation.valid} שורות תקינות
              {validation.errors.length > 0 &&
                `, ${[...new Set(validation.errors.map((e) => e.row))].length} שגויות`}
            </p>
          </div>

          {/* Data table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-medium text-petra-text">נתונים שנקראו מהקובץ</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="table-header-cell">שורה</th>
                    <th className="table-header-cell">שם</th>
                    <th className="table-header-cell">טלפון</th>
                    <th className="table-header-cell">אימייל</th>
                    <th className="table-header-cell">שם כלב</th>
                    <th className="table-header-cell">גזע</th>
                    <th className="table-header-cell">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => {
                    const rowNum = i + 1;
                    const rowErrors = validation.errors.filter((e) => e.row === rowNum);
                    const hasError = rowErrors.length > 0;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-50 ${hasError ? "bg-red-50" : ""}`}
                      >
                        <td className="table-cell text-petra-muted">{rowNum}</td>
                        <td className="table-cell font-medium">{row.name || <span className="text-red-400 italic">חסר</span>}</td>
                        <td className="table-cell">{row.phone || <span className="text-red-400 italic">חסר</span>}</td>
                        <td className="table-cell text-petra-muted">{row.email || "—"}</td>
                        <td className="table-cell">{row.petName || "—"}</td>
                        <td className="table-cell text-petra-muted">{row.petBreed || "—"}</td>
                        <td className="table-cell">
                          {hasError ? (
                            <span className="badge badge-danger">שגוי</span>
                          ) : (
                            <span className="badge badge-success">תקין</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedRows.length > 50 && (
                <p className="text-xs text-petra-muted text-center py-3">
                  מוצגות 50 שורות ראשונות מתוך {parsedRows.length}
                </p>
              )}
            </div>
          </div>

          {/* Errors list */}
          {validation.errors.length > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-petra-text">שגיאות ואזהרות</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">שורה {err.row}</span>
                      {" · "}
                      <span className="text-red-600">{err.field}</span>
                      {" – "}
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={isImporting || validation.valid === 0}
              className="btn-primary gap-2 inline-flex items-center disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  מייבא...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  בצע ייבוא ({validation.valid} לקוחות)
                </>
              )}
            </button>
            <button onClick={reset} className="btn-secondary">
              ביטול
            </button>
          </div>

          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {importError}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Result ────────────────────────────────────────────────────── */}
      {step === "result" && importResult && (
        <div className="card p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-petra-text">הייבוא הושלם בהצלחה</h2>
            <p className="text-petra-muted mt-1 text-sm">הנתונים נשמרו במערכת</p>
          </div>

          {/* Created counts */}
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-3xl font-bold text-brand-600">{importResult.created}</p>
              <p className="text-sm text-petra-muted mt-1">לקוחות נוצרו</p>
            </div>
            {importResult.createdPets > 0 && (
              <div>
                <p className="text-3xl font-bold text-emerald-600">{importResult.createdPets}</p>
                <p className="text-sm text-petra-muted mt-1">חיות מחמד נוצרו</p>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div>
                <p className="text-3xl font-bold text-red-500">
                  {[...new Set(importResult.errors.map((e) => e.row))].length}
                </p>
                <p className="text-sm text-petra-muted mt-1">שורות שנכשלו</p>
              </div>
            )}
          </div>

          {/* Error list */}
          {importResult.errors.length > 0 && (
            <div className="text-right space-y-2 max-h-40 overflow-y-auto">
              <p className="text-sm font-semibold text-petra-text">שגיאות שנותרו:</p>
              {importResult.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-100 text-xs text-right"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>
                    שורה {err.row} · {err.field} – {err.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-petra-muted">
            ניתן לבטל ייבוא זה תוך 24 שעות מרשימת ההיסטוריה למטה
          </p>

          <button onClick={reset} className="btn-primary mx-auto inline-flex gap-2 items-center">
            <Upload className="w-4 h-4" />
            ייבוא נוסף
          </button>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────────── */}
      {batches.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-petra-text">היסטוריית ייבואים</h2>
          <div className="card divide-y divide-slate-100">
            {batches.map((batch) => (
              <BatchHistoryRow key={batch.id} batch={batch} onRefresh={() => refetchBatches()} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── BatchHistoryRow ────────────────────────────────────────────────────────────

function BatchHistoryRow({
  batch,
  onRefresh,
}: {
  batch: BatchRecord;
  onRefresh: () => void;
}) {
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    setIsRollingBack(true);
    try {
      await fetch(`/api/import/${batch.id}`, { method: "DELETE" });
      onRefresh();
    } finally {
      setIsRollingBack(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-slate-500" />
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
          {batch.created !== null ? (
            <p className="text-xs text-petra-muted">{batch.created} לקוחות נוצרו</p>
          ) : (
            <p className="text-xs text-petra-muted">{batch.total} שורות</p>
          )}
          {batch.issueCount > 0 && (
            <p className="text-xs text-amber-600">{batch.issueCount} שגיאות</p>
          )}
        </div>

        <span className={`badge ${STATUS_COLORS[batch.status] ?? "badge-neutral"}`}>
          {STATUS_LABELS[batch.status] ?? batch.status}
        </span>

        {/* Delete / Rollback button */}
        {batch.status !== "rolled_back" && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={isRollingBack}
                className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isRollingBack ? "מבצע..." : "אישור"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
              >
                לא
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition-colors"
            >
              {batch.canRollback ? "בטל ייבוא" : "מחק"}
            </button>
          )
        )}
      </div>
    </div>
  );
}
