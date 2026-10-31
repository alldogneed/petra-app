"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Plus, X, Search, Edit2, Copy, Tag, Package, Clock,
  CheckCircle2, XCircle, Link2, Share2, Trash2,
  ChevronUp, ChevronDown, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerLimitModal } from "@/lib/limit-reached";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriceListItem {
  id: string;
  priceListId: string;
  type: "service" | "product";
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  basePrice: number;
  taxMode: string;
  durationMinutes: number | null;
  defaultQuantity: number;
  isActive: boolean;
  sortOrder: number;
  paymentUrl: string | null;
}

interface PriceList {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  _count: { items: number };
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Unit ids are stored values; labels come from messages (pricing.priceListsPage.units.*)
const UNITS: { id: string; key: string }[] = [
  { id: "per_session", key: "perSession" },
  { id: "per_day", key: "perDay" },
  { id: "per_night", key: "perNight" },
  { id: "per_hour", key: "perHour" },
  { id: "per_item", key: "perItem" },
  { id: "fixed", key: "fixed" },
];

// Category suggestions (datalist) — labels from messages (pricing.priceListsPage.categories.*)
const CATEGORY_KEYS = ["training", "grooming", "boarding", "consulting", "products", "addon", "other"] as const;

const UNIT_KEY: Record<string, string> = Object.fromEntries(UNITS.map((u) => [u.id, u.key]));

// ─── Item Form Modal ──────────────────────────────────────────────────────────

function ItemFormModal({
  priceListId,
  item,
  isOpen,
  onClose,
}: {
  priceListId: string;
  item: PriceListItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const t = useTranslations("pricing.priceListsPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    type: item?.type ?? "service",
    category: item?.category ?? "",
    unit: item?.unit ?? "per_session",
    basePrice: item?.basePrice?.toString() ?? "",
    description: item?.description ?? "",
    taxMode: item?.taxMode ?? "taxable",
    durationMinutes: item?.durationMinutes?.toString() ?? "",
    defaultQuantity: item?.defaultQuantity?.toString() ?? "1",
    paymentUrl: item?.paymentUrl ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (isEdit) {
        return fetch(`/api/price-list-items/${item!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, basePrice: parseFloat(data.basePrice) }),
        }).then((r) => r.json());
      }
      return fetch(`/api/price-lists/${priceListId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, basePrice: parseFloat(data.basePrice) }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: t("errors.generic") }));
          const err = new Error(body.error || t("errors.generic"));
          if (body.code) (err as unknown as Record<string, unknown>).code = body.code;
          throw err;
        }
        return r.json();
      });
    },
    onSuccess: (res) => {
      if (res.error) { setErrors({ general: res.error }); return; }
      qc.invalidateQueries({ queryKey: ["price-list-items", priceListId] });
      onClose();
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error(err.message || t("form.addError"));
      }
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("form.nameRequired");
    if (form.basePrice === "" || isNaN(parseFloat(form.basePrice)) || parseFloat(form.basePrice) < 0) e.basePrice = t("form.priceInvalid");
    if (!form.unit) e.unit = t("form.unitRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{isEdit ? t("form.editTitle") : t("newItem")}</h2>
            <p className="text-xs text-petra-muted mt-0.5">{t("form.subtitle")}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["service", "product"] as const).map((typ) => (
              <button
                key={typ}
                onClick={() => setForm({ ...form, type: typ })}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                  form.type === typ
                    ? "border-brand-400 bg-brand-50 text-brand-600"
                    : "border-petra-border text-petra-muted hover:bg-slate-50"
                )}
              >
                {typ === "service" ? t("form.typeService") : t("form.typeProduct")}
              </button>
            ))}
          </div>

          <div>
            <label className="label">{t("form.nameLabel")}</label>
            <input
              className={cn("input", errors.name && "border-red-400")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("form.namePlaceholder")}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.categoryLabel")}</label>
              <input
                className="input"
                list="categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={t("form.categoryPlaceholder")}
              />
              <datalist id="categories">
                {CATEGORY_KEYS.map((c) => <option key={c} value={t(`categories.${c}`)} />)}
              </datalist>
            </div>
            <div>
              <label className="label">{t("form.unitLabel")}</label>
              <select
                className={cn("input", errors.unit && "border-red-400")}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => <option key={u.id} value={u.id}>{t(`units.${u.key}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.basePriceLabel", { currency: currencySymbol({ locale, currency }) })}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={cn("input", errors.basePrice && "border-red-400")}
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                placeholder="0.00"
                dir="ltr"
              />
              {errors.basePrice && <p className="text-xs text-red-500 mt-1">{errors.basePrice}</p>}
            </div>
            <div>
              <label className="label">{t("form.vatLabel")}</label>
              <select
                className="input"
                value={form.taxMode}
                onChange={(e) => setForm({ ...form, taxMode: e.target.value })}
              >
                <option value="taxable">{t("form.taxable")}</option>
                <option value="exempt">{t("form.exempt")}</option>
                <option value="inherit">{t("form.inherit")}</option>
              </select>
            </div>
          </div>

          {form.type === "service" && (
            <div>
              <label className="label">{t("form.durationLabel")}</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                placeholder="60"
                dir="ltr"
              />
            </div>
          )}

          <div>
            <label className="label">{t("form.descriptionLabel")}</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("form.descriptionPlaceholder")}
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-petra-muted" />
              {t("form.paymentUrlLabel")}
            </label>
            <input
              className="input"
              type="url"
              value={form.paymentUrl}
              onChange={(e) => setForm({ ...form, paymentUrl: e.target.value })}
              placeholder="https://meshulam.co.il/..."
              dir="ltr"
            />
            <p className="text-[11px] text-petra-muted mt-1">
              {t("form.paymentUrlHint")}
            </p>
          </div>
        </div>

        {errors.general && (
          <p className="text-sm text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{errors.general}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={() => validate() && mutation.mutate(form)}
          >
            {mutation.isPending ? tc("progress.saving") : isEdit ? tc("actions.save") : t("form.addItem")}
          </button>
          <button onClick={onClose} className="btn-secondary">{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Row ────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  readOnly = false,
}: {
  item: PriceListItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** No PRICING_WRITE — hide all mutation buttons (server returns 403 anyway) */
  readOnly?: boolean;
}) {
  const t = useTranslations("pricing.priceListsPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 border-b border-petra-border hover:bg-slate-50/50 transition-colors group",
      !item.isActive && "opacity-50"
    )}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
        {item.type === "service" ? <Clock className="w-3.5 h-3.5 text-slate-500" /> : <Package className="w-3.5 h-3.5 text-slate-500" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-petra-text">{item.name}</span>
          {item.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-petra-muted font-medium">{item.category}</span>
          )}
          {item.durationMinutes && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />{t("row.minutesShort", { minutes: item.durationMinutes })}
            </span>
          )}
        </div>
        {item.description && <p className="text-xs text-petra-muted truncate mt-0.5">{item.description}</p>}
      </div>

      <div className="text-start flex-shrink-0">
        <p className="text-sm font-bold text-petra-text">{currencySymbol({ locale, currency })}{item.basePrice.toFixed(2)}</p>
        <p className="text-[10px] text-petra-muted">{UNIT_KEY[item.unit] ? t(`units.${UNIT_KEY[item.unit]}`) : item.unit}</p>
      </div>

      {item.paymentUrl && (
        <a
          href={item.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t("row.paymentPage")}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 className="w-3.5 h-3.5" />
        </a>
      )}

      {!readOnly && (
      <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {onMoveUp && (
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title={t("row.moveUp")}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title={t("row.moveDown")}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onEdit} title={t("row.edit")} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDuplicate} title={t("row.duplicate")} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggle} title={item.isActive ? t("row.deactivate") : t("row.activate")} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
          {item.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
        </button>
        <button
          onClick={onDelete}
          title={tc("actions.delete")}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PriceListPage() {
  const qc = useQueryClient();
  const t = useTranslations("pricing.priceListsPage");
  const tc = useTranslations("common");
  const { canEditPricing } = usePermissions();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; item: PriceListItem | null }>({ open: false, item: null });
  const [deleteItem, setDeleteItem] = useState<PriceListItem | null>(null);

  // Load the first (default) price list
  const { data: priceLists = [], isLoading: priceListsLoading } = useQuery<PriceList[]>({
    queryKey: ["price-lists"],
    queryFn: () => fetch("/api/price-lists").then((r) => r.json()),
  });

  const priceList = priceLists[0];

  const { data: items = [], isLoading } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items", priceList?.id],
    queryFn: () => fetch(`/api/price-lists/${priceList!.id}/items?active=false`).then((r) => r.json()),
    enabled: !!priceList?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/price-list-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (item: PriceListItem) =>
      fetch(`/api/price-lists/${item.priceListId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t("copyName", { name: item.name }),
          type: item.type, category: item.category, unit: item.unit,
          basePrice: item.basePrice, taxMode: item.taxMode,
          durationMinutes: item.durationMinutes, description: item.description,
          defaultQuantity: item.defaultQuantity,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.duplicate")); return d; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-list-items/${id}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.delete")); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      setDeleteItem(null);
      toast.success(t("itemDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.delete")),
  });

  // Persist a new order within a displayed group: reindex sortOrder sequentially
  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sortOrder: number }[]) => {
      for (const u of updates) {
        const r = await fetch(`/api/price-list-items/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: u.sortOrder }),
        });
        if (!r.ok) throw new Error(t("errors.saveOrder"));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] }),
    onError: () => toast.error(t("errors.saveItemsOrder")),
  });

  function moveItem(group: PriceListItem[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= group.length || reorderMutation.isPending) return;
    const newOrder = [...group];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(target, 0, moved);
    const updates = newOrder
      .map((it, idx) => ({ id: it.id, sortOrder: idx, changed: it.sortOrder !== idx }))
      .filter((u) => u.changed)
      .map(({ id, sortOrder }) => ({ id, sortOrder }));
    if (updates.length > 0) reorderMutation.mutate(updates);
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!showInactive && !item.isActive) return false;
      if (filterType && item.type !== filterType) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase()) &&
        !(item.category || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, filterCategory, filterType, showInactive]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items]
  );

  const grouped = useMemo(() => {
    const map: Record<string, PriceListItem[]> = {};
    filtered.forEach((item) => {
      const cat = item.category || t("uncategorized");
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [filtered, t]);

  const createPriceListMutation = useMutation({
    mutationFn: () =>
      fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || t("errors.create"));
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-lists"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (priceListsLoading) {
    return <PetraLoader />;
  }

  // Business has no price list yet — was an endless loader before
  if (!priceList) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon mx-auto">
          <Tag className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-petra-text mb-1">{t("empty.title")}</p>
        <p className="text-xs text-petra-muted mb-4">{t("empty.hint")}</p>
        {canEditPricing && (
        <button
          className="btn-primary"
          onClick={() => createPriceListMutation.mutate()}
          disabled={createPriceListMutation.isPending}
        >
          <Plus className="w-4 h-4" />
          {createPriceListMutation.isPending ? t("empty.creating") : t("empty.create")}
        </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap flex-shrink-0">
        <h1 className="page-title flex items-center gap-2">{t("title")}</h1>
        <p className="text-sm text-petra-muted">
          {t("activeCount", { count: items.filter((i) => i.isActive).length, name: priceList?.name ?? "" })}
        </p>
        {canEditPricing && (
        <button
          onClick={() => setModalState({ open: true, item: null })}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {t("newItem")}
        </button>
        )}
        {items.filter((i) => i.isActive).length > 0 && (
          <a
            href={(() => {
              const activeItems = items.filter((i) => i.isActive);
              const grouped: Record<string, typeof activeItems> = {};
              for (const item of activeItems) {
                const cat = item.category || "כללי"; // i18n-ok — WhatsApp text the owner sends to clients
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
              }
              const lines = [`📋 *מחירון ${priceList?.name ?? ""}*`, ""]; // i18n-ok — WhatsApp text the owner sends to clients
              for (const [cat, catItems] of Object.entries(grouped)) {
                lines.push(`*${cat}:*`);
                for (const item of catItems) {
                  const price = `₪${item.basePrice.toFixed(0)}`; // i18n-ok — WhatsApp text the owner sends to clients
                  const dur = item.durationMinutes ? ` · ${item.durationMinutes} דק׳` : ""; // i18n-ok — WhatsApp text the owner sends to clients
                  lines.push(`• ${item.name} — ${price}${dur}`);
                }
                lines.push("");
              }
              return `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n"))}`;
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            title={t("shareTitle")}
          >
            <Share2 className="w-4 h-4" />
            {t("share")}
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input ps-10 w-56"
            placeholder={tc("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input w-40 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">{t("filters.allCategories")}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="input w-36 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">{t("filters.allTypes")}</option>
          <option value="service">{t("filters.services")}</option>
          <option value="product">{t("filters.products")}</option>
        </select>

        <button
          onClick={() => setShowInactive(!showInactive)}
          className={cn(
            "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
            showInactive
              ? "bg-slate-100 border-slate-300 text-petra-text"
              : "border-petra-border text-petra-muted hover:bg-slate-50"
          )}
        >
          {showInactive ? t("filters.hideInactive") : t("filters.showInactive")}
        </button>
      </div>

      {/* Items grouped by category */}
      <div className="flex-1 overflow-y-auto card">
        {isLoading ? (
          <PetraLoader />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="empty-state-icon mx-auto">
              <Tag className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-petra-text mb-1">
              {search || filterCategory || filterType ? t("list.noResults") : t("list.empty")}
            </p>
            <p className="text-xs text-petra-muted mb-4">
              {search ? t("list.tryOtherSearch") : t("list.addFirst")}
            </p>
            {!search && canEditPricing && (
              <button onClick={() => setModalState({ open: true, item: null })} className="btn-primary">
                <Plus className="w-4 h-4" /> {t("newItem")}
              </button>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="px-4 py-2 bg-slate-50/80 border-b border-petra-border">
                <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">{cat}</span>
                <span className="text-xs text-slate-400 ms-2">({catItems.length})</span>
              </div>
              {catItems.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  readOnly={!canEditPricing}
                  onEdit={() => setModalState({ open: true, item })}
                  onDuplicate={() => duplicateMutation.mutate(item)}
                  onToggle={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                  onDelete={() => setDeleteItem(item)}
                  onMoveUp={() => moveItem(catItems, idx, -1)}
                  onMoveDown={() => moveItem(catItems, idx, 1)}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < catItems.length - 1}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <ItemFormModal
        priceListId={priceList?.id ?? ""}
        item={modalState.item}
        isOpen={modalState.open}
        onClose={() => setModalState({ open: false, item: null })}
      />

      {/* Delete item confirm dialog */}
      {deleteItem && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteItem(null)} />
          <div className="modal-content max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-petra-text mb-1">
              {t("deleteDialog.title", { name: deleteItem.name })}
            </h3>
            <p className="text-sm text-petra-muted mb-4">{t("deleteDialog.irreversible")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deleteItem.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? tc("progress.deleting") : t("deleteDialog.confirm")}
              </button>
              <button onClick={() => setDeleteItem(null)} className="btn-secondary flex-1">
                {t("deleteDialog.back")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
