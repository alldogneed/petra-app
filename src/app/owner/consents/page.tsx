"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Search,
  RefreshCw,
  CheckCircle2,
  Users,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsentRow } from "@/app/api/owner/consents/route";

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

export default function ConsentsPage() {
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as Window & { _st?: ReturnType<typeof setTimeout> })._st);
    (window as Window & { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(() => setDebouncedSearch(val), 300);
  }

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (version) params.set("version", version);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    rows: ConsentRow[];
    total: number;
    totalAll: number;
    versions: string[];
  }>({
    queryKey: ["owner-consents", debouncedSearch, version],
    queryFn: () => fetch(`/api/owner/consents?${params}`).then((r) => r.json()),
  });

  const rows = data?.rows ?? [];
  const versions = data?.versions ?? [];

  function downloadCSV() {
    const dlParams = new URLSearchParams(params);
    dlParams.set("format", "csv");
    window.open(`/api/owner/consents?${dlParams}`, "_blank");
  }

  function downloadAllPDF() {
    window.open("/api/owner/consents/pdf", "_blank");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-400" />
            הסכמות תנאי שימוש
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            רשימת כל המשתמשים שחתמו על תנאי השימוש ומדיניות הפרטיות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all"
          >
            <Download className="w-4 h-4" />
            ייצוא CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data?.totalAll ?? "—"}</p>
              <p className="text-xs text-slate-400">סה״כ הסכמות</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {data ? new Set(data.rows.map((r) => r.userId)).size : "—"}
              </p>
              <p className="text-xs text-slate-400">משתמשים ייחודיים</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, מייל, או שם עסק..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-10 pl-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            dir="rtl"
          />
        </div>
        {versions.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">כל הגרסאות</option>
              {versions.map((v) => (
                <option key={v} value={v}>גרסה {v}</option>
              ))}
            </select>
          </div>
        )}
        {(search || version) && (
          <span className="text-xs text-slate-400">
            מציג {rows.length} מתוך {data?.totalAll ?? 0}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">שגיאה בטעינת נתונים</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">לא נמצאו הסכמות</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">שם משתמש</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">כתובת מייל</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">שם עסק</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">גרסה</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">תאריך ושעה</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">כתובת IP</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">דפדפן</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{row.userName}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs" dir="ltr">{row.userEmail}</td>
                    <td className="px-4 py-3 text-slate-300">{row.businessName ?? <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/20 text-brand-300 border border-brand-500/30">
                        v{row.termsVersion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{formatDate(row.acceptedAt)}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs" dir="ltr">{row.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{truncateUA(row.userAgent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {rows.length} רשומות
              </p>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              הורד CSV
            </button>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="flex items-start gap-2.5 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          מסמך זה מהווה ראיה משפטית לקבלת תנאי השימוש. כתובת ה-IP, סוכן הדפדפן ותאריך ההסכמה נרשמו בזמן אמת בעת הרשמת המשתמש.
          ייצוא ה-CSV כולל את כל השדות. לייצוא PDF של עסק ספציפי — היכנסו לדף העסק ב&quot;עסקים&quot;.
        </p>
      </div>
    </div>
  );
}
