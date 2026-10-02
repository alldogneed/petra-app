"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Search,
  RefreshCw,
  CheckCircle2,
  Users,
  Filter,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import type { ConsentRow } from "@/app/api/owner/consents/route";
import { PetraLoader } from "@/components/ui/PetraLoader";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function truncateUA(ua: string | null) {
  if (!ua) return "—";
  // Extract browser name from UA string
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

interface ConsentsResponse {
  rows: ConsentRow[];
  total: number;
  totalAll: number;
  versions: string[];
}

export default function ConsentsPage() {
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (version) params.set("version", version);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ConsentsResponse>({
    queryKey: ["owner", "consents", { search: debouncedSearch, version }],
    queryFn: () => fetchJSON<ConsentsResponse>(`/api/owner/consents?${params}`),
  });

  const rows = data?.rows ?? [];
  const versions = data?.versions ?? [];

  function downloadCSV() {
    const dlParams = new URLSearchParams(params);
    dlParams.set("format", "csv");
    window.open(`/api/owner/consents?${dlParams}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">הסכמות תנאי שימוש</h1>
          <p className="text-sm text-slate-500 mt-1">
            רשימת כל המשתמשים שחתמו על תנאי השימוש ומדיניות הפרטיות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="רענון"
            title="רענון"
            className="btn-ghost p-2"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
          <button type="button" onClick={downloadCSV} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" />
            ייצוא CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-900">{data?.totalAll ?? "—"}</p>
              <p className="text-xs text-slate-500">סה״כ הסכמות</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-900">
                {data ? new Set(rows.map((r) => r.userId)).size : "—"}
              </p>
              <p className="text-xs text-slate-500">משתמשים ייחודיים</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, מייל, או שם עסק..."
            aria-label="חיפוש הסכמות"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pr-10"
          />
        </div>
        {versions.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              aria-label="סינון לפי גרסה"
              className="input w-auto"
            >
              <option value="">כל הגרסאות</option>
              {versions.map((v) => (
                <option key={v} value={v}>גרסה {v}</option>
              ))}
            </select>
          </div>
        )}
        {(search || version) && (
          <span className="text-xs text-slate-500">
            מציג {rows.length} מתוך {data?.totalAll ?? 0}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">שגיאה בטעינת נתונים</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {debouncedSearch || version
              ? "לא נמצאו הסכמות התואמות את החיפוש או הסינון."
              : "עדיין לא נרשמו הסכמות לתנאי השימוש."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="table-header-cell text-right">שם משתמש</th>
                  <th className="table-header-cell text-right">כתובת מייל</th>
                  <th className="table-header-cell text-right">שם עסק</th>
                  <th className="table-header-cell text-right">גרסה</th>
                  <th className="table-header-cell text-right">תאריך ושעה</th>
                  <th className="table-header-cell text-right">כתובת IP</th>
                  <th className="table-header-cell text-right">דפדפן</th>
                  <th className="table-header-cell text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium text-slate-900">{row.userName}</td>
                    <td className="table-cell font-mono text-xs text-slate-700 text-right" dir="ltr">{row.userEmail}</td>
                    <td className="table-cell text-slate-700">{row.businessName ?? "—"}</td>
                    <td className="table-cell">
                      <span className="badge badge-brand">v{row.termsVersion}</span>
                    </td>
                    <td className="table-cell text-xs text-slate-700 whitespace-nowrap">{formatDate(row.acceptedAt)}</td>
                    <td className="table-cell font-mono text-xs text-slate-500 text-right" dir="ltr">{row.ipAddress ?? "—"}</td>
                    <td className="table-cell text-xs text-slate-500">{truncateUA(row.userAgent)}</td>
                    <td className="table-cell">
                      <a
                        href={`/api/owner/consents/pdf?userId=${encodeURIComponent(row.userId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`הורדת PDF של ההסכמה — ${row.userName}`}
                        title="הורדת PDF"
                        className="btn-ghost p-2 inline-flex"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{rows.length} רשומות</p>
            <button
              type="button"
              onClick={downloadCSV}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              הורד CSV
            </button>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="flex items-start gap-2.5 p-4 bg-white rounded-xl border border-slate-200">
        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          מסמך זה מהווה ראיה משפטית לקבלת תנאי השימוש. כתובת ה-IP, סוכן הדפדפן ותאריך ההסכמה נרשמו בזמן אמת בעת הרשמת המשתמש.
          ייצוא ה-CSV כולל את כל השדות. לייצוא PDF של משתמש ספציפי — לחצו על סמל ה-PDF בשורה שלו.
        </p>
      </div>
    </div>
  );
}
