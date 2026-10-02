"use client";
/**
 * Customers list. Every filter / sort / count is computed server-side (GET /api/customers,
 * contract in src/lib/customer-filters.ts + src/services/customer-list.ts) — never over the
 * loaded pages. Modals / popovers / cells live in src/components/customers/list/*.
 */
import { PageTitle } from "@/components/ui/PageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Crown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckSquare,
  Square,
  MinusSquare,
  ShoppingCart,
  MessageCircle,
  Tag,
  Trash2,
  FileDown,
  Upload,
  RefreshCw,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  EMPTY_CUSTOMER_FILTERS,
  FINANCE_SORTS,
  customerFiltersToParams,
  type CustomerSort,
} from "@/lib/customer-filters";
import { useSubscription } from "@/hooks/useSubscription";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DEFAULT_CUSTOMER_TAGS,
  type CustomerListPage,
  type EnhancedCustomer,
} from "@/components/customers/list/types";
import {
  StatusBadge,
  FinancialBadge,
  PetsCell,
  AppointmentDates,
  QuickActions,
} from "@/components/customers/list/cells";
import { InlineTagEditor } from "@/components/customers/list/InlineTagEditor";
import { ManageTagsPopover } from "@/components/customers/list/ManageTagsPopover";
import { EditCustomerModal } from "@/components/customers/list/EditCustomerModal";
import { NewCustomerModal } from "@/components/customers/list/NewCustomerModal";
import { BulkWhatsAppModal } from "@/components/customers/list/BulkWhatsAppModal";
import { BulkTagModal } from "@/components/customers/list/BulkTagModal";
import { CustomerFiltersPanel, type ListFilters } from "@/components/customers/list/CustomerFiltersPanel";

const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);

const { search: _omitSearch, ...DEFAULT_LIST_FILTERS } = EMPTY_CUSTOMER_FILTERS;
void _omitSearch;

function getAvatarGradient(status: string) {
  switch (status) {
    case "vip":
      return "linear-gradient(135deg, #F59E0B, #D97706)";
    case "dormant":
      return "linear-gradient(135deg, #94A3B8, #64748B)";
    default:
      return "linear-gradient(135deg, #F97316, #FB923C)";
  }
}

function NewBadge({ createdAt }: { createdAt: string }) {
  const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (daysAgo > 7) return null;
  const label = daysAgo <= 0 ? "היום" : daysAgo === 1 ? "אתמול" : `לפני ${daysAgo} ימים`;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200 flex-shrink-0">
      חדש · {label}
    </span>
  );
}

/** Clickable, sortable desktop column header. */
function SortHeader({
  label,
  sortBy,
  primary,
  secondary,
  onSort,
  className,
}: {
  label: string;
  sortBy: CustomerSort;
  primary: CustomerSort;
  /** Second click toggles to this sort (or back to "newest" when absent). */
  secondary?: CustomerSort;
  onSort: (s: CustomerSort) => void;
  className?: string;
}) {
  const active = sortBy === primary || (secondary !== undefined && sortBy === secondary);
  const next = sortBy === primary ? secondary ?? "newest" : primary;
  const ariaSort = active ? (sortBy === "last_visit_asc" || sortBy === "name_asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" className={cn("table-header-cell", className)} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn("inline-flex items-center gap-1 hover:text-petra-text transition-colors", active && "text-petra-text font-bold")}
        title="מיון"
      >
        {label}
        {active ? (
          sortBy === secondary ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

function CustomersPermGate({ children }: { children: React.ReactNode }) {
  const perms = usePermissions();
  if (!perms.canSeePii) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-petra-text mb-2">אין הרשאה</h2>
        <p className="text-sm text-petra-muted">אין לך הרשאה לצפות בלקוחות. פנה למנהל העסק.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function CustomersPage() {
  return (
    <CustomersPermGate>
      <CustomersList />
    </CustomersPermGate>
  );
}

function CustomersList() {
  const queryClient = useQueryClient();
  const { canExportData, canImportData, canSeeFinance, canSendMessages, canCriticalDelete } = usePermissions();
  const { maxCustomers, tier } = useSubscription();

  // ── State ──
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().slice(0, 100)), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [rawFilters, setRawFilters] = useState<ListFilters>(DEFAULT_LIST_FILTERS);
  // Money filters/sorts only for FINANCE_READ (the server ignores them anyway).
  const filters = useMemo<ListFilters>(
    () =>
      canSeeFinance
        ? rawFilters
        : {
            ...rawFilters,
            balance: null,
            minDebt: null,
            sortBy: FINANCE_SORTS.includes(rawFilters.sortBy) ? "newest" : rawFilters.sortBy,
          },
    [rawFilters, canSeeFinance]
  );
  const updateFilters = useCallback((patch: Partial<ListFilters>) => setRawFilters((f) => ({ ...f, ...patch })), []);

  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewModal, setShowNewModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<EnhancedCustomer | null>(null);
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [showBulkTags, setShowBulkTags] = useState(false);
  const [bulkDeleteStep, setBulkDeleteStep] = useState<0 | 1 | 2>(0);
  const [exporting, setExporting] = useState(false);

  // ── Business settings (customer tag presets) ──
  const { data: businessSettings } = useQuery<{ customerTags?: string }>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<{ customerTags?: string }>("/api/settings"),
    staleTime: 0,
  });

  const customerPresetTags = useMemo<string[]>(() => {
    if (!businessSettings?.customerTags) return DEFAULT_CUSTOMER_TAGS;
    try {
      const parsed = JSON.parse(businessSettings.customerTags);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CUSTOMER_TAGS;
    } catch {
      return DEFAULT_CUSTOMER_TAGS;
    }
  }, [businessSettings?.customerTags]);

  const saveTagsMutation = useMutation({
    mutationFn: (tags: string[]) =>
      fetchJSON("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerTags: JSON.stringify(tags) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("התגיות נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת התגיות. נסה שוב."),
  });

  // ── Data: server-side filters + cursor pagination ──
  const listParams = useMemo(
    () => customerFiltersToParams({ ...filters, search: debouncedSearch || null }).toString(),
    [filters, debouncedSearch]
  );

  const {
    data: customerPages,
    isLoading,
    isFetching: isCustomersFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<CustomerListPage>({
    queryKey: ["customers", "list", listParams],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams(listParams);
      params.set("enhanced", "1");
      params.set("take", "50");
      if (pageParam) params.set("cursor", pageParam as string);
      return fetchJSON<CustomerListPage>(`/api/customers?${params}`);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    // Customers are created from many places the cache can't see (closed leads, intake forms,
    // the mobile drawer) — always refetch on entering the module.
    refetchOnMount: "always",
    staleTime: 0,
  });

  const customers = useMemo(() => customerPages?.pages.flatMap((p) => p.customers) ?? [], [customerPages]);
  const firstPage = customerPages?.pages[0];
  const stats = firstPage?.stats ?? null;
  const filteredTotal = firstPage?.total ?? customers.length;
  const businessTotal = stats?.businessTotal ?? null;
  const atFreeLimit = tier === "free" && maxCustomers !== null && businessTotal !== null && businessTotal >= maxCustomers;

  // ── Selection: reset whenever the visible set changes ──
  useEffect(() => {
    setSelectedIds(new Set());
  }, [listParams]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = customers.length > 0 && customers.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visible = customers.map((c) => c.id);
      if (visible.length > 0 && visible.every((id) => prev.has(id))) return new Set();
      return new Set(visible);
    });
  }, [customers]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectedCustomers = useMemo(() => customers.filter((c) => selectedIds.has(c.id)), [customers, selectedIds]);

  // ── Bulk delete (each delete = long sequential cleanup server-side → low concurrency) ──
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await mapWithConcurrency(ids, 2, (id) =>
        fetch(`/api/customers/${id}`, {
          method: "DELETE",
          headers: { "x-confirm-action": `DELETE_CUSTOMER_${id}` },
        })
          .then((r) => (r.status === 202 ? ("pending" as const) : r.ok ? ("deleted" as const) : ("failed" as const)))
          .catch(() => "failed" as const)
      );
      return {
        deleted: results.filter((r) => r === "deleted").length,
        pending: results.filter((r) => r === "pending").length,
        failed: results.filter((r) => r === "failed").length,
      };
    },
    onSuccess: ({ deleted, pending, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      clearSelection();
      setBulkDeleteStep(0);
      const parts = [
        deleted > 0 && `${deleted} נמחקו`,
        pending > 0 && `${pending} נשלחו לאישור הבעלים`,
        failed > 0 && `${failed} נכשלו`,
      ].filter(Boolean);
      if (failed > 0) toast.error(parts.join(", "));
      else toast.success(parts.join(", ") || "לא נמחקו לקוחות");
    },
    onError: () => toast.error("שגיאה במחיקת הלקוחות. נסה שוב."),
  });

  // ── Export (current filters, or the selected rows) ──
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = selectedIds.size > 0
        ? await fetch("/api/customers/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          })
        : await fetch(`/api/customers/export?${new URLSearchParams(listParams)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-export-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("הקובץ הורד בהצלחה");
    } catch (e) {
      toast.error(e instanceof Error && e.message !== "Export failed" ? e.message : "שגיאה בייצוא. נסה שוב.");
    } finally {
      setExporting(false);
    }
  }, [listParams, selectedIds]);

  const onSort = useCallback((s: CustomerSort) => updateFilters({ sortBy: s }), [updateFilters]);
  const hasAnyFilter = !!debouncedSearch || JSON.stringify(filters) !== JSON.stringify(DEFAULT_LIST_FILTERS);

  return (
    <div className="min-w-0">
      <PageTitle title="לקוחות" />
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="page-title">לקוחות</h1>
            <p className="text-sm text-petra-muted">
              {businessTotal === null ? "—" : <>{businessTotal} {businessTotal === 1 ? "לקוח" : "לקוחות"} במערכת</>}
            </p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
            title="רענן נתונים"
            aria-label="רענן נתונים"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCustomersFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {atFreeLimit ? (
            <a href="/upgrade" className="btn-primary gap-2 bg-amber-500 hover:bg-amber-600 border-amber-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center">
              <Sparkles className="w-4 h-4" />
              שדרג לבייסיק
            </a>
          ) : (
            <button className="btn-primary" onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4" />
              לקוח חדש
            </button>
          )}
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm shadow-sm transition-all hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #f38d49, #FB923C)" }}
            onClick={() => setShowOrderModal(true)}
          >
            <ShoppingCart className="w-4 h-4" />
            הזמנה חדשה
          </button>
          {canExportData && (
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
              title={selectedIds.size > 0 ? "ייצוא הלקוחות הנבחרים לאקסל" : "ייצוא הלקוחות המסוננים לאקסל"}
              onClick={handleExport}
              disabled={exporting}
            >
              <FileDown className="w-4 h-4" />
              {selectedIds.size > 0 ? `ייצוא ${selectedIds.size}` : "ייצוא"}
            </button>
          )}
          {canImportData && (
            <Link
              href="/settings?tab=data"
              prefetch={false}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="ייבוא לקוחות מאקסל"
            >
              <Upload className="w-4 h-4" />
              ייבוא
            </Link>
          )}
        </div>
      </div>

      {/* Free tier customer limit banner (whole business, not loaded rows) */}
      {tier === "free" && maxCustomers !== null && businessTotal !== null && (
        <div className={`flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border ${atFreeLimit ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className={`w-4 h-4 flex-shrink-0 ${atFreeLimit ? "text-amber-500" : "text-slate-400"}`} />
            <span className={atFreeLimit ? "text-amber-800" : "text-slate-600"}>
              {businessTotal}/{maxCustomers} לקוחות — מגבלת המנוי החינמי
            </span>
          </div>
          {atFreeLimit && (
            <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              שדרג לבייסיק ←
            </a>
          )}
        </div>
      )}

      {/* ─── Search & Filters Card ─── */}
      <div className="card p-4 mb-4 space-y-3 bg-gradient-to-b from-[#FDFBF8] to-white border-[#E8DFD5] min-w-0">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0845C]" />
          <input
            type="search"
            placeholder="חיפוש לפי שם, טלפון, אימייל או שם חיה..."
            className="input pr-10 bg-white border-[#E8DFD5] focus:border-[#C4956A] focus:ring-[#C4956A]/20"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="חיפוש לקוחות"
          />
        </div>
        <CustomerFiltersPanel
          filters={filters}
          onChange={updateFilters}
          onReset={() => setRawFilters(DEFAULT_LIST_FILTERS)}
          stats={stats}
          presetTags={customerPresetTags}
          canSeeFinance={canSeeFinance}
          collapsed={filtersCollapsed}
          onToggleCollapsed={() => setFiltersCollapsed((c) => !c)}
          manageTagsSlot={
            <ManageTagsPopover
              tags={customerPresetTags}
              onSave={(updatedTags) => {
                if (filters.tag && !updatedTags.includes(filters.tag)) updateFilters({ tag: null });
                saveTagsMutation.mutate(updatedTags);
              }}
              isSaving={saveTagsMutation.isPending}
            />
          }
        />
      </div>

      {/* ─── Bulk Action Bar ─── */}
      {selectedIds.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 sm:gap-3 bg-[#FEF9F4] border-brand-200 animate-slide-up">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-semibold text-petra-text">{selectedIds.size} נבחרו</span>
          </div>
          {canSendMessages && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
              onClick={() => setShowBulkWhatsApp(true)}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              שלח הודעה
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            onClick={() => setShowBulkTags(true)}
          >
            <Tag className="w-3.5 h-3.5" />
            תגיות
          </button>
          {canCriticalDelete && (
            <button
              className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
              onClick={() => setBulkDeleteStep(1)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              מחק נבחרים
            </button>
          )}
          <button
            className="text-xs text-petra-muted hover:text-petra-text transition-colors"
            onClick={() => { clearSelection(); setSelectionMode(false); }}
          >
            בטל בחירה
          </button>
        </div>
      )}

      {/* ─── List ─── */}
      {isLoading ? (
        <PetraLoader />
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            {hasAnyFilter ? <Search className="w-6 h-6 text-slate-400" /> : <Users className="w-6 h-6 text-slate-400" />}
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {debouncedSearch ? `לא נמצאו תוצאות עבור "${debouncedSearch}"` : hasAnyFilter ? "אין תוצאות" : "אין לקוחות"}
          </h3>
          <p className="text-sm text-petra-muted mb-4">
            {hasAnyFilter ? "נסה לשנות את החיפוש או הסינון" : "התחל על ידי הוספת הלקוח הראשון"}
          </p>
          {hasAnyFilter ? (
            <button
              className="btn-secondary text-sm"
              onClick={() => { setSearch(""); setRawFilters(DEFAULT_LIST_FILTERS); }}
            >
              נקה חיפוש וסינון
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4" />
              הוסף לקוח
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* ── Selection mode toggle bar ── */}
          <div className="flex items-center justify-start gap-3 px-4 py-2 border-b border-[#E8DFD5] bg-[#FDFBF8]">
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                selectionMode
                  ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
              )}
              onClick={() => {
                if (selectionMode) setSelectedIds(new Set());
                setSelectionMode(!selectionMode);
              }}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {selectionMode ? "בטל בחירה" : "בחר"}
            </button>
            {selectionMode && (
              <button onClick={toggleSelectAll} className="md:hidden flex items-center gap-1.5 text-xs text-[#8B7355]">
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-brand-500" />
                ) : someSelected ? (
                  <MinusSquare className="w-4 h-4 text-brand-400" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                בחר את כל המוצגים ({customers.length})
              </button>
            )}
          </div>

          {/* ── Mobile card list (< md) ── */}
          <div className="md:hidden divide-y divide-slate-50">
            {customers.map((customer) => {
              const isSelected = selectedIds.has(customer.id);
              return (
                <div
                  key={customer.id}
                  className={`px-4 py-3.5 transition-colors ${isSelected ? "bg-[#FEF9F4]" : "hover:bg-[#FDFBF8]"}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {selectionMode && (
                      <button
                        onClick={() => toggleSelect(customer.id)}
                        className="mt-1 flex-shrink-0 text-slate-400 hover:text-petra-text transition-colors"
                        aria-label={isSelected ? `בטל בחירה של ${customer.name}` : `בחר את ${customer.name}`}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-brand-500" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                          style={{ background: getAvatarGradient(customer.status) }}
                          aria-hidden="true"
                        >
                          {customer.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              href={`/customers/${customer.id}`}
                              prefetch={false}
                              className="text-sm font-semibold text-petra-text hover:text-brand-600 transition-colors leading-snug break-words"
                            >
                              {customer.name}
                            </Link>
                            <NewBadge createdAt={customer.createdAt} />
                          </div>
                          <div className="text-[11px] text-petra-muted flex items-center gap-1 mt-0.5 whitespace-nowrap" dir="ltr">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {customer.phone}
                          </div>
                        </div>
                        <StatusBadge status={customer.status} />
                      </div>

                      <div className="mt-1.5 ms-11">
                        <InlineTagEditor customer={customer} presetTags={customerPresetTags} />
                      </div>

                      <div className="mt-2 ms-11 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          {customer._count.pets > 0 && <PetsCell pets={customer.pets} count={customer._count.pets} />}
                          {canSeeFinance && <FinancialBadge financial={customer.financial} />}
                        </div>
                        <QuickActions customer={customer} onEdit={() => setEditingCustomer(customer)} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table (≥ md) ── */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <caption className="sr-only">רשימת לקוחות</caption>
              <thead>
                <tr className="bg-[#FAF7F3] border-b border-[#E8DFD5]">
                  {selectionMode && (
                    <th scope="col" className="text-right px-3 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-petra-text transition-colors"
                        aria-label="בחר את כל המוצגים"
                      >
                        {allSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-500" aria-hidden="true" />
                        ) : someSelected ? (
                          <MinusSquare className="w-4 h-4 text-brand-400" aria-hidden="true" />
                        ) : (
                          <Square className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                  )}
                  <SortHeader label="שם" sortBy={filters.sortBy} primary="name_asc" onSort={onSort} />
                  <th scope="col" className="table-header-cell">סטטוס</th>
                  <th scope="col" className="table-header-cell">חיות</th>
                  <SortHeader
                    label="פגישות"
                    sortBy={filters.sortBy}
                    primary="last_visit_desc"
                    secondary="last_visit_asc"
                    onSort={onSort}
                    className="hidden lg:table-cell"
                  />
                  {canSeeFinance && (
                    <SortHeader label="כספי" sortBy={filters.sortBy} primary="balance_desc" onSort={onSort} className="hidden lg:table-cell" />
                  )}
                  <th scope="col" className="table-header-cell w-44">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const isSelected = selectedIds.has(customer.id);
                  return (
                    <tr
                      key={customer.id}
                      className={`border-b border-slate-50 hover:bg-[#FDFBF8] transition-colors ${isSelected ? "bg-[#FEF9F4]" : ""}`}
                    >
                      {selectionMode && (
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => toggleSelect(customer.id)}
                            className="text-slate-400 hover:text-petra-text transition-colors"
                            aria-label={isSelected ? `בטל בחירה של ${customer.name}` : `בחר את ${customer.name}`}
                          >
                            {isSelected ? <CheckSquare className="w-4 h-4 text-brand-500" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                      )}

                      {/* Name (link) + phone/email/tags (siblings — no buttons inside the anchor) */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/customers/${customer.id}`}
                            prefetch={false}
                            tabIndex={-1}
                            aria-hidden="true"
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                            style={{ background: getAvatarGradient(customer.status) }}
                          >
                            {customer.name.charAt(0)}
                          </Link>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                href={`/customers/${customer.id}`}
                                prefetch={false}
                                className="text-sm font-semibold text-petra-text hover:text-brand-600 transition-colors"
                              >
                                {customer.name}
                              </Link>
                              <NewBadge createdAt={customer.createdAt} />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-petra-muted flex items-center gap-1" dir="ltr">
                                <Phone className="w-3 h-3" />
                                {customer.phone}
                              </span>
                              {customer.email && (
                                <a
                                  href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(customer.email)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-petra-muted hover:text-brand-600 flex items-center gap-1 transition-colors truncate max-w-[200px]"
                                >
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  {customer.email}
                                </a>
                              )}
                            </div>
                            <div className="mt-1">
                              <InlineTagEditor customer={customer} presetTags={customerPresetTags} />
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="table-cell">
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="table-cell">
                        <PetsCell pets={customer.pets} count={customer._count.pets} />
                      </td>
                      <td className="table-cell hidden lg:table-cell">
                        <AppointmentDates last={customer.lastAppointment} next={customer.nextAppointment} />
                      </td>
                      {canSeeFinance && (
                        <td className="table-cell hidden lg:table-cell">
                          <FinancialBadge financial={customer.financial} />
                        </td>
                      )}
                      <td className="px-2 py-3.5 whitespace-nowrap">
                        <QuickActions customer={customer} onEdit={() => setEditingCustomer(customer)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center py-3 border-t border-slate-100">
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-secondary text-sm gap-2">
                {isFetchingNextPage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isFetchingNextPage ? "טוען..." : "טען עוד לקוחות"}
              </button>
            </div>
          )}

          {/* Footer — server totals */}
          <div className="px-4 sm:px-5 py-3 bg-[#FAF7F3] border-t border-[#E8DFD5] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8B7355]">
            <span>
              מציג {customers.length} מתוך {filteredTotal} {filteredTotal === 1 ? "לקוח" : "לקוחות"}
            </span>
            <div className="flex-1" />
            {stats && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium text-[#6B5744]">{stats.total} סה״כ</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {stats.active} פעילים
                </span>
                <span className="flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600" />
                  {stats.vip} VIP
                </span>
                {canSeeFinance && stats.withDebt > 0 && (
                  <span className="text-red-500 font-medium">
                    {stats.withDebt} עם חוב{stats.totalDebt !== null ? ` · ₪${stats.totalDebt.toLocaleString("he-IL")}` : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}
      <NewCustomerModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} presetTags={customerPresetTags} />
      <EditCustomerModal
        isOpen={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        customer={editingCustomer}
        presetTags={customerPresetTags}
      />
      <CreateOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          setShowOrderModal(false);
        }}
      />
      {showBulkWhatsApp && canSendMessages && (
        <BulkWhatsAppModal customers={selectedCustomers} onClose={() => setShowBulkWhatsApp(false)} />
      )}
      {showBulkTags && (
        <BulkTagModal
          ids={Array.from(selectedIds)}
          presetTags={customerPresetTags}
          onClose={() => setShowBulkTags(false)}
          onDone={() => { setShowBulkTags(false); clearSelection(); }}
        />
      )}
      <ConfirmDialog
        open={bulkDeleteStep === 1}
        danger
        title="מחיקת לקוחות"
        description={
          <>
            אתה עומד למחוק <span className="font-semibold">{selectedIds.size} לקוחות</span>. פעולה זו תמחק גם את
            חיות המחמד, התורים ונתוני הלקוח לצמיתות.
          </>
        }
        confirmLabel="המשך"
        onConfirm={() => setBulkDeleteStep(2)}
        onCancel={() => setBulkDeleteStep(0)}
      />
      <ConfirmDialog
        open={bulkDeleteStep === 2}
        danger
        loading={bulkDeleteMutation.isPending}
        title="אישור סופי"
        description={
          <>
            למחוק <span className="font-bold text-red-700">{selectedIds.size} לקוחות</span> לצמיתות? לא ניתן לשחזר פעולה זו.
          </>
        }
        confirmLabel={`מחק ${selectedIds.size} לקוחות`}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        onCancel={() => setBulkDeleteStep(0)}
      />
    </div>
  );
}
