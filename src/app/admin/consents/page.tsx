"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

export default function AdminConsentsPage() {
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as Window & { _st?: ReturnType<typeof setTimeout> })._st);
    (window as Window & { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(
      () => setDebouncedSearch(val),
      300
    );
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
    queryKey: ["admin-consents", debouncedSearch, version],
    queryFn: () => fetch(`/api/owner/consents?${params}`).then((r) => r.json()),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            תנאי שימוש חתומים
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            כל המשתמשים שחתמו על תנאי השימוש ומדיניות הפרטיות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4 border" style={{ background: "#13131F", borderColor: "#1E1E2E" }}>
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
        <div className="rounded-xl p-4 border" style={{ background: "#13131F", borderColor: "#1E1E2E" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-cyan-400" />
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
            className="w-full rounded-xl pr-10 pl-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 border"
            style={{ background: "#13131F", borderColor: "#1E1E2E" }}
            dir="rtl"
          />
        </div>
        {versions.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm text-white focus:outline-none border"
              style={{ background: "#13131F", borderColor: "#1E1E2E" }}
            >
              <option value="">כל הגרסאות</option>
              {versions.map((v) => (
                <option key={v} value={v}>
                  גרסה {v}
                </option>
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
      <div className="rounded-xl border overflow-hidden" style={{ background: "#13131F", borderColor: "#1E1E2E" }}>
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#1E1E2E" }} />
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
                <tr style={{ borderBottom: "1px solid #1E1E2E" }}>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">שם משתמש</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">כתובת מייל</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">שם עסק</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">גרסה</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">תאריך ושעה</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">כתובת IP</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">דפדפן</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-white/[0.03] transition-colors"
                    style={{ borderBottom: "1px solid #1E1E2E" }}
                  >
                    <td className="px-4 py-3 text-white font-medium">{row.userName}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs" dir="ltr">{row.userEmail}</td>
                    <td className="px-4 py-3 text-slate-300">{row.businessName ?? <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
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
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #1E1E2E" }}>
            <p className="text-xs text-slate-500">{rows.length} רשומות</p>
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
    </div>
  );
}
