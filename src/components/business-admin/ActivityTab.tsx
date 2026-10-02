"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { RefreshCw, Search, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { ACTION_FILTER_OPTIONS, actionLabel } from "@/lib/activity-actions";
import {
  ActivityPage,
  TeamMember,
  ActionIcon,
  EntityLabel,
  ActivityRow,
  relativeTime,
  formatTs,
} from "./shared";

const SEARCH_MAX = 100;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "שגיאה בטעינת הנתונים");
  return json as T;
}

export function ActivityTab() {
  const { user } = useAuth();
  const businessId = user?.businessId ?? "";
  const queryClient = useQueryClient();

  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Debounce the free-text search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().slice(0, SEARCH_MAX)), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: teamData } = useQuery<TeamMember[]>({
    queryKey: ["ba-team"],
    enabled: !!businessId,
    queryFn: () => fetch(`/api/admin/${businessId}/members`).then((r) => r.json()),
  });

  const dateError = from && to && from > to ? "תאריך ההתחלה אחרי תאריך הסיום" : null;

  /** Current filters as query params (no cursor/take). */
  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filterUser) p.set("userId", filterUser);
    if (filterAction) p.set("action", filterAction);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (search) p.set("q", search);
    return p;
  }, [filterUser, filterAction, from, to, search]);
  const filterKey = filterParams.toString();
  const hasFilters = filterKey.length > 0 || searchInput.length > 0;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ActivityPage>({
    queryKey: ["ba-activity", filterKey],
    enabled: !dateError,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(filterKey);
      p.set("take", "50");
      if (pageParam) p.set("cursor", String(pageParam));
      return fetchJson<ActivityPage>(`/api/business-admin/activity?${p}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((pg) => pg.items) ?? [];

  function clearFilters() {
    setFilterUser("");
    setFilterAction("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
  }

  async function handleExport() {
    if (dateError) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/business-admin/activity/export?${filterKey}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "שגיאה בייצוא");
      }
      const blob = await res.blob();
      const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] ?? "petra-activity.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("יומן הפעילות יוצא לאקסל");
      queryClient.invalidateQueries({ queryKey: ["ba-activity"] });
      queryClient.invalidateQueries({ queryKey: ["ba-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">חבר צוות</label>
            <select className="input py-2 text-sm w-full" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="">כל חברי הצוות</option>
              {Array.isArray(teamData) &&
                teamData.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">פעולה</label>
            <select className="input py-2 text-sm w-full" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              {ACTION_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
            <div>
              <label className="label">מתאריך</label>
              <input type="date" className="input py-2 text-sm w-full" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">עד תאריך</label>
              <input type="date" className="input py-2 text-sm w-full" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">חיפוש</label>
            <div className="relative">
              <Search className="w-4 h-4 text-petra-muted absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
              <input
                type="search"
                className="input py-2 text-sm w-full pr-9"
                placeholder="שם משתמש או פריט…"
                maxLength={SEARCH_MAX}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        {dateError && <p className="text-xs text-red-600">{dateError}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || !!dateError}
            className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-2"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            ייצוא לאקסל
          </button>
          <button
            onClick={() => refetch()}
            className="btn-ghost text-sm flex items-center gap-1.5 px-3 py-2"
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            רענן
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost text-sm flex items-center gap-1.5 px-3 py-2">
              <X className="w-3.5 h-3.5" />
              נקה סינון
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="card overflow-hidden">
        {isLoading && !dateError ? (
          <PetraLoader variant="inline" />
        ) : isError ? (
          <div className="p-10 text-center text-sm text-red-600">
            {error instanceof Error ? error.message : "שגיאה בטעינת יומן הפעילות"}
          </div>
        ) : !items.length ? (
          <div className="p-10 text-center text-sm text-petra-muted">
            {hasFilters ? "לא נמצאה פעילות שתואמת את הסינון" : "אין פעילות להצגה"}
          </div>
        ) : (
          <>
            {/* Mobile: stacked rows */}
            <div className="sm:hidden px-4">
              {items.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-petra-muted">
                    <th className="text-right px-4 py-3 font-medium">משתמש</th>
                    <th className="text-right px-4 py-3 font-medium">פעולה</th>
                    <th className="text-right px-4 py-3 font-medium">פריט</th>
                    <th className="text-right px-4 py-3 font-medium">זמן</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{entry.userName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActionIcon action={entry.action} size="sm" />
                          <span className="text-slate-700">{actionLabel(entry.action)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[16rem]">
                        {entry.entityLabel ? <EntityLabel entry={entry} /> : <span className="text-petra-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-petra-muted whitespace-nowrap">
                        <span title={formatTs(entry.createdAt)}>{relativeTime(entry.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasNextPage && (
              <div className="p-3 border-t border-slate-100 text-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="btn-ghost text-sm px-4 py-2 inline-flex items-center gap-1.5"
                >
                  {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  טען עוד
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
