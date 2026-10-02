"use client";
/**
 * Customers list filters — every value maps 1:1 to a GET /api/customers query param
 * (src/lib/customer-filters.ts). Counts come from the server `stats` (whole business), never
 * from loaded pages.
 */
import type { ReactNode } from "react";
import { ChevronDown, Filter, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_TYPES } from "@/lib/constants";
import {
  CUSTOMER_SORTS,
  CUSTOMER_SORT_LABELS,
  FINANCE_SORTS,
  countActiveFilters,
  type CustomerFilters,
} from "@/lib/customer-filters";
import { FilterPill } from "./cells";
import { REFERRAL_SOURCES, type CustomerListStats } from "./types";

export type ListFilters = Omit<CustomerFilters, "search">;

const selectCls =
  "appearance-none bg-[#FAF7F3] border border-[#E8DFD5] rounded-full text-xs font-medium text-[#8B7355] pl-7 pr-3 py-1.5 hover:bg-[#F3EDE6] hover:border-[#D4C5B2] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C4956A]/20 max-w-[160px]";

function SelectPill({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex-shrink-0">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} aria-label={label}>
        {children}
      </select>
      <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0845C] pointer-events-none" />
    </div>
  );
}

export function CustomerFiltersPanel({
  filters,
  onChange,
  onReset,
  stats,
  presetTags,
  canSeeFinance,
  collapsed,
  onToggleCollapsed,
  manageTagsSlot,
}: {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  onReset: () => void;
  stats: CustomerListStats | null;
  presetTags: string[];
  canSeeFinance: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  manageTagsSlot?: ReactNode;
}) {
  const activeCount = countActiveFilters(filters);
  const hiddenOnMobile = collapsed ? "hidden sm:flex" : "flex";

  return (
    <>
      {/* Mobile filter toggle */}
      <button
        className="sm:hidden flex items-center justify-between w-full text-sm font-medium text-[#8B7355] py-0.5"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          סינון ומיון{activeCount > 0 ? ` (${activeCount})` : ""}
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-transform text-[#A0845C]", !collapsed && "rotate-180")} />
      </button>

      {/* Status / balance pills — scroll horizontally on narrow screens */}
      <div className={cn("items-center gap-1.5 overflow-x-auto flex-nowrap sm:flex-wrap pb-1 sm:pb-0 -mx-1 px-1", hiddenOnMobile)}>
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-[#8B7355] font-medium flex-shrink-0">
          <Filter className="w-3.5 h-3.5" /> סינון:
        </span>
        <FilterPill label="הכל" active={!filters.status} onClick={() => onChange({ status: null })} count={stats?.total} />
        <FilterPill
          label="פעילים"
          active={filters.status === "active"}
          onClick={() => onChange({ status: filters.status === "active" ? null : "active" })}
          count={stats?.active}
        />
        <FilterPill
          label="רדומים"
          active={filters.status === "dormant"}
          onClick={() => onChange({ status: filters.status === "dormant" ? null : "dormant" })}
          count={stats?.dormant}
        />
        <FilterPill
          label="VIP"
          active={filters.status === "vip"}
          onClick={() => onChange({ status: filters.status === "vip" ? null : "vip" })}
          count={stats?.vip}
        />
        {canSeeFinance && (
          <>
            <div className="hidden sm:block w-px h-5 bg-[#E8DFD5] flex-shrink-0" />
            <FilterPill
              label="חוב"
              active={filters.balance === "debt"}
              onClick={() => onChange({ balance: filters.balance === "debt" ? null : "debt" })}
              count={stats?.withDebt}
            />
            <FilterPill
              label="מאוזן"
              active={filters.balance === "balanced"}
              onClick={() => onChange({ balance: filters.balance === "balanced" ? null : "balanced" })}
            />
          </>
        )}
      </div>

      {/* Dropdown filters + sort */}
      <div className={cn("flex-wrap items-center gap-2", hiddenOnMobile)}>
        <SelectPill label="סוג שירות" value={filters.serviceType ?? ""} onChange={(v) => onChange({ serviceType: v || null })}>
          <option value="">סוג שירות</option>
          {SERVICE_TYPES.map((st) => (
            <option key={st.id} value={st.id}>{st.label}</option>
          ))}
        </SelectPill>
        <SelectPill
          label="ביקור אחרון"
          value={filters.lastVisit ?? ""}
          onChange={(v) => onChange({ lastVisit: (v || null) as ListFilters["lastVisit"] })}
        >
          <option value="">ביקור אחרון</option>
          <option value="30">לא ביקרו 30+ ימים</option>
          <option value="60">לא ביקרו 60+ ימים</option>
          <option value="90">לא ביקרו 90+ ימים</option>
          <option value="never">אף פעם</option>
        </SelectPill>
        <SelectPill
          label="סוג חיה"
          value={filters.species ?? ""}
          onChange={(v) => onChange({ species: (v || null) as ListFilters["species"] })}
        >
          <option value="">סוג חיה</option>
          <option value="dog">כלבים</option>
          <option value="cat">חתולים</option>
          <option value="other">אחר</option>
        </SelectPill>
        <SelectPill label="מקור הגעה" value={filters.source ?? ""} onChange={(v) => onChange({ source: v || null })}>
          <option value="">מקור הגעה</option>
          {REFERRAL_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </SelectPill>
        <div className="flex items-center gap-1 text-xs text-[#8B7355] flex-shrink-0">
          <span>הצטרפו:</span>
          <input
            type="date"
            lang="he"
            aria-label="הצטרפו מתאריך"
            className="bg-[#FAF7F3] border border-[#E8DFD5] rounded-full text-xs px-2 py-1 w-[128px]"
            value={filters.createdFrom ?? ""}
            onChange={(e) => onChange({ createdFrom: e.target.value || null })}
          />
          <span>–</span>
          <input
            type="date"
            lang="he"
            aria-label="הצטרפו עד תאריך"
            className="bg-[#FAF7F3] border border-[#E8DFD5] rounded-full text-xs px-2 py-1 w-[128px]"
            value={filters.createdTo ?? ""}
            onChange={(e) => onChange({ createdTo: e.target.value || null })}
          />
        </div>
        {canSeeFinance && (
          <div className="flex items-center gap-1 text-xs text-[#8B7355] flex-shrink-0">
            <span>חוב מעל ₪</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="חוב מינימלי"
              className="bg-[#FAF7F3] border border-[#E8DFD5] rounded-full text-xs px-2 py-1 w-[80px]"
              value={filters.minDebt ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ minDebt: e.target.value && Number.isFinite(n) && n > 0 ? n : null });
              }}
            />
          </div>
        )}
        <SelectPill
          label="מיון"
          value={filters.sortBy}
          onChange={(v) => onChange({ sortBy: v as ListFilters["sortBy"] })}
        >
          {CUSTOMER_SORTS.filter((s) => canSeeFinance || !FINANCE_SORTS.includes(s)).map((s) => (
            <option key={s} value={s}>מיון: {CUSTOMER_SORT_LABELS[s]}</option>
          ))}
        </SelectPill>
        {manageTagsSlot}
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
          >
            <X className="w-3 h-3" /> נקה סינון
          </button>
        )}
      </div>

      {/* Tag filter pills (exact tag) */}
      {presetTags.length > 0 && (
        <div className={cn("flex-wrap items-center gap-1.5 border-t border-[#F0E8DD] pt-2", hiddenOnMobile)}>
          <span className="text-[10px] text-[#8B7355] font-medium flex items-center gap-1">
            <Tag className="w-3 h-3" />
            תגיות:
          </span>
          {presetTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onChange({ tag: filters.tag === tag ? null : tag })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                filters.tag === tag
                  ? "bg-[#3D2E1F] text-white border-[#3D2E1F] shadow-sm"
                  : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:bg-[#F3EDE6]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
