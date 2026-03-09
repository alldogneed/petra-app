"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload, Database, CheckCircle2, AlertTriangle, XCircle,
  Building2, Users, PawPrint, SkipForward, Play, RefreshCw, FileSpreadsheet,
} from "lucide-react";

interface Business {
  id: string;
  name: string;
  tier: string;
  status: string;
}

interface ParseResult {
  batchId: string;
  businessName: string;
  stats: {
    totalCustomers: number;
    totalPets: number;
    skippedRows: number;
    inFileDuplicates: number;
    dbDuplicates: number;
    orphanPets: number;
  };
  topIssues: { row: number; type: string; code: string; message: string }[];
}

const inputStyle = {
  background: "#0A0A0F",
  border: "1px solid #1E1E2E",
  color: "#E2E8F0",
};

export default function AdminMigrationPage() {
  const [targetBusinessId, setTargetBusinessId] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(businessSearch), 300);
    return () => clearTimeout(t);
  }, [businessSearch]);
  const [executeResult, setExecuteResult] = useState<{ createdCustomers: number; mergedCustomers: number; createdPets: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load business list — dedicated endpoint with case-insensitive search
  const { data: bizData, isFetching: bizLoading } = useQuery({
    queryKey: ["admin-migration-businesses", debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ search: debouncedSearch });
      return fetch(`/api/admin/migration/businesses?${params}`).then((r) => r.json());
    },
  });
  const businesses: Business[] = bizData?.businesses ?? [];

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("בחר קובץ");
      if (!targetBusinessId) throw new Error("בחר עסק");
      const formData = new FormData();
      formData.append("targetBusinessId", targetBusinessId);
      formData.append("file", file);
      const res = await fetch("/api/admin/migration/parse", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בניתוח");
      return json as ParseResult;
    },
    onSuccess: (data) => {
      setParseResult(data);
      setExecuteResult(null);
    },
  });

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult?.batchId) throw new Error("אין batch לביצוע");
      const res = await fetch("/api/admin/migration/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: parseResult.batchId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "שגיאה בייבוא");
      return json;
    },
    onSuccess: (data) => {
      setExecuteResult(data);
      setParseResult(null);
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  function reset() {
    setParseResult(null);
    setExecuteResult(null);
    parseMutation.reset();
    executeMutation.reset();
    if (fileRef.current) fileRef.current.value = "";
  }

  const selectedBusiness = businesses.find((b) => b.id === targetBusinessId);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">מיגרציה ידנית</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            ייבא לקוחות וחיות מקובץ CSV/XLSX לעסק ספציפי
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(6,182,212,0.15)" }}>
          <Database className="w-5 h-5" style={{ color: "#06B6D4" }} />
        </div>
      </div>

      {/* Success result */}
      {executeResult && (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6" style={{ color: "#22C55E" }} />
            <h2 className="text-base font-semibold" style={{ color: "#22C55E" }}>הייבוא הושלם בהצלחה!</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "לקוחות חדשים", value: executeResult.createdCustomers, icon: Users, color: "#06B6D4" },
              { label: "לקוחות מוזגו", value: executeResult.mergedCustomers, icon: Users, color: "#F59E0B" },
              { label: "חיות נוספו", value: executeResult.createdPets, icon: PawPrint, color: "#A78BFA" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#0A0A0F", border: "1px solid #1E1E2E" }}>
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>{label}</div>
              </div>
            ))}
          </div>
          <button onClick={reset} className="flex items-center gap-2 text-sm" style={{ color: "#64748B" }}>
            <RefreshCw className="w-3.5 h-3.5" /> ייבוא נוסף
          </button>
        </div>
      )}

      {!executeResult && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <h2 className="text-sm font-semibold text-white">הגדרות ייבוא</h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Step 1: Business selector */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#94A3B8" }}>
                1. בחר עסק יעד
              </label>
              <div className="relative mb-2">
                <input
                  type="text"
                  value={businessSearch}
                  onChange={(e) => { setBusinessSearch(e.target.value); setTargetBusinessId(""); }}
                  placeholder="חפש עסק לפי שם, אימייל או טלפון..."
                  dir="rtl"
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-600"
                  style={inputStyle}
                />
                {bizLoading && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#475569" }}>טוען...</span>
                )}
              </div>
              {businesses.length > 0 && (
                <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto" style={{ border: "1px solid #1E1E2E" }}>
                  {businesses.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setTargetBusinessId(b.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors"
                      style={{
                        background: targetBusinessId === b.id ? "rgba(6,182,212,0.1)" : "transparent",
                        borderBottom: "1px solid #1E1E2E",
                        color: targetBusinessId === b.id ? "#06B6D4" : "#94A3B8",
                      }}
                    >
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-sm flex-1 text-right">{b.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#1E1E2E", color: "#475569" }}>
                        {b.tier}
                      </span>
                      {targetBusinessId === b.id && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#06B6D4" }} />}
                    </button>
                  ))}
                </div>
              )}
              {selectedBusiness && (
                <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: "#22C55E" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  נבחר: <strong>{selectedBusiness.name}</strong>
                </div>
              )}
            </div>

            {/* Step 2: File upload */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#94A3B8" }}>
                2. העלה קובץ לקוחות (CSV / XLSX)
              </label>
              <label
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl cursor-pointer transition-colors"
                style={{ background: "#0A0A0F", border: "2px dashed #1E1E2E" }}
                onDragOver={(e) => e.preventDefault()}
              >
                <FileSpreadsheet className="w-8 h-8" style={{ color: "#334155" }} />
                <span className="text-sm" style={{ color: "#475569" }}>גרור קובץ לכאן או לחץ לבחירה</span>
                <span className="text-xs" style={{ color: "#334155" }}>CSV, XLSX — עמודות: full_name, phone (חובה), email, city, notes</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={() => { setParseResult(null); setExecuteResult(null); parseMutation.reset(); }}
                />
              </label>
            </div>

            {/* Errors */}
            {parseMutation.isError && (
              <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {(parseMutation.error as Error).message}
              </div>
            )}

            {/* Parse button */}
            {!parseResult && (
              <button
                onClick={() => parseMutation.mutate()}
                disabled={parseMutation.isPending || !targetBusinessId}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.25)" }}
              >
                <Upload className="w-4 h-4" />
                {parseMutation.isPending ? "מנתח..." : "נתח קובץ"}
              </button>
            )}

            {/* Parse result preview */}
            {parseResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "לקוחות לייבוא", value: parseResult.stats.totalCustomers, icon: Users, color: "#06B6D4" },
                    { label: "חיות לייבוא", value: parseResult.stats.totalPets, icon: PawPrint, color: "#A78BFA" },
                    { label: "כפילויות בקובץ", value: parseResult.stats.inFileDuplicates, icon: SkipForward, color: "#F59E0B" },
                    { label: "כבר קיימים ב-DB", value: parseResult.stats.dbDuplicates, icon: Database, color: "#64748B" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#0A0A0F", border: "1px solid #1E1E2E" }}>
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                      <div>
                        <div className="text-base font-bold text-white">{value}</div>
                        <div className="text-[11px]" style={{ color: "#64748B" }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {parseResult.topIssues.length > 0 && (
                  <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="flex items-center gap-2 mb-2 text-xs font-medium" style={{ color: "#F59E0B" }}>
                      <AlertTriangle className="w-3.5 h-3.5" /> {parseResult.topIssues.length} שורות עם בעיות (עד 10 מוצגות):
                    </div>
                    {parseResult.topIssues.map((issue, i) => (
                      <div key={i} className="text-xs" style={{ color: "#94A3B8" }}>
                        שורה {issue.row}: {issue.message}
                      </div>
                    ))}
                  </div>
                )}

                {executeMutation.isError && (
                  <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    {(executeMutation.error as Error).message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => executeMutation.mutate()}
                    disabled={executeMutation.isPending || parseResult.stats.totalCustomers === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <Play className="w-4 h-4" />
                    {executeMutation.isPending ? "מייבא..." : `בצע ייבוא (${parseResult.stats.totalCustomers} לקוחות)`}
                  </button>
                  <button
                    onClick={reset}
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: "#1E1E2E", color: "#64748B" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
