"use client";

import { useQuery } from "@tanstack/react-query";
import { useAnalyticsFilters, DatePreset } from "@/hooks/useAnalyticsFilters";
import { Filter } from "lucide-react";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "היום" },
  { value: "last_7_days", label: "7 ימים" },
  { value: "last_30_days", label: "30 ימים" },
  { value: "this_month", label: "החודש" },
  { value: "last_month", label: "חודש קודם" },
  { value: "custom", label: "מותאם" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "מתוכנן" },
  { value: "completed", label: "הושלם" },
  { value: "canceled", label: "בוטל" },
  { value: "no_show", label: "לא הגיע" },
];

interface Service {
  id: string;
  name: string;
}

export function GlobalFilters() {
  const filters = useAnalyticsFilters();

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services-for-filter"],
    queryFn: async () => {
      const r = await fetch("/api/services");
      if (!r.ok) throw new Error("Failed to fetch services");
      return r.json();
    },
    staleTime: 300_000,
  });

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter icon */}
        <div className="flex items-center gap-1.5 text-gray-400 ml-1">
          <Filter size={14} />
          <span className="text-xs font-medium">סינון</span>
        </div>

        {/* Date Presets */}
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => filters.setPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filters.preset === p.value
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {filters.preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => filters.setCustomRange(e.target.value, filters.to)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <span className="text-xs text-gray-400">עד</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => filters.setCustomRange(filters.from, e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        )}

        <div className="h-5 w-px bg-gray-200 mx-1 hidden sm:block" />

        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => filters.toggleStatus(s.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                filters.statuses.includes(s.value)
                  ? "bg-orange-100 text-orange-700 border-orange-300"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Service filter */}
        {services.length > 0 && (
          <>
            <div className="h-5 w-px bg-gray-200 mx-1 hidden sm:block" />
            <div className="flex flex-wrap gap-1">
              {services.slice(0, 8).map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => filters.toggleService(svc.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    filters.services.includes(svc.id)
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {svc.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Active filter count badge */}
        {(filters.services.length > 0 || filters.statuses.length > 0) && (
          <button
            onClick={() => {
              filters.setPreset(filters.preset);
            }}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium ms-auto"
            title="נקה פילטרים"
          >
            נקה הכל
          </button>
        )}
      </div>
    </div>
  );
}
