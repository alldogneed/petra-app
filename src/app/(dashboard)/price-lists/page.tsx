"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Plus, X, Search, Edit2, Copy, Tag, Package, Clock,
  CheckCircle2, XCircle, Layers, Link2, Share2, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const UNITS: { id: string; label: string }[] = [
  { id: "per_session", label: "לפגישה" },
  { id: "per_day", label: "ליום" },
  { id: "per_night", label: "ללילה" },
  { id: "per_hour", label: "לשעה" },
  { id: "per_item", label: "ליחידה" },
  { id: "fixed", label: "מחיר קבוע" },
];

const CATEGORIES = ["אילוף", "טיפוח", "פנסיון", "ייעוץ", "מוצרים", "תוסף", "אחר"];

const UNIT_LABEL: Record<string, string> = Object.fromEntries(UNITS.map((u) => [u.id, u.label]));

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
      }).then((r) => r.json());
    },
    onSuccess: (res) => {
      if (res.error) { setErrors({ general: res.error }); return; }
      qc.invalidateQueries({ queryKey: ["price-list-items", priceListId] });
      onClose();
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "שם חובה";
    if (form.basePrice === "" || isNaN(parseFloat(form.basePrice)) || parseFloat(form.basePrice) < 0) e.basePrice = "מחיר חייב להיות >= 0";
    if (!form.unit) e.unit = "יחידה חובה";
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
            <h2 className="text-lg font-bold text-petra-text">{isEdit ? "עריכת פריט" : "פריט חדש"}</h2>
            <p className="text-xs text-petra-muted mt-0.5">הוסף שירות או מוצר למחירון</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["service", "product"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                  form.type === t
                    ? "border-brand-400 bg-brand-50 text-brand-600"
                    : "border-petra-border text-petra-muted hover:bg-slate-50"
                )}
              >
                {t === "service" ? "🔧 שירות" : "📦 מוצר"}
              </button>
            ))}
          </div>

          <div>
            <label className="label">שם *</label>
            <input
              className={cn("input", errors.name && "border-red-400")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="לדוגמה: שיעור אילוף יחיד"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <input
                className="input"
                list="categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="לדוגמה: אילוף"
              />
              <datalist id="categories">
                {CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="label">יחידה *</label>
              <select
                className={cn("input", errors.unit && "border-red-400")}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מחיר בסיס (₪) *</label>
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
              <label className="label">מע&quot;מ</label>
              <select
                className="input"
                value={form.taxMode}
                onChange={(e) => setForm({ ...form, taxMode: e.target.value })}
              >
                <option value="taxable">חייב מע&quot;מ</option>
                <option value="exempt">פטור מע&quot;מ</option>
                <option value="inherit">לפי הגדרת עסק</option>
              </select>
            </div>
          </div>

          {form.type === "service" && (
            <div>
              <label className="label">משך (דקות)</label>
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
            <label className="label">תיאור</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="תיאור קצר (אופציונלי)"
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-petra-muted" />
              קישור לדף תשלום
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
              קישור לדף תשלום של המסלקה שלך (Meshulam, Tranzila, iCount וכו׳). יישלח ללקוח בסיום הזמנה.
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
            {mutation.isPending ? "שומר..." : isEdit ? "שמור" : "הוסף פריט"}
          </button>
          <button onClick={onClose} className="btn-secondary">ביטול</button>
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
}: {
  item: PriceListItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
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
              <Clock className="w-2.5 h-2.5" />{item.durationMinutes}ד׳
            </span>
          )}
        </div>
        {item.description && <p className="text-xs text-petra-muted truncate mt-0.5">{item.description}</p>}
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-petra-text">₪{item.basePrice.toFixed(2)}</p>
        <p className="text-[10px] text-petra-muted">{UNIT_LABEL[item.unit] ?? item.unit}</p>
      </div>

      {item.paymentUrl && (
        <a
          href={item.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="דף תשלום"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 className="w-3.5 h-3.5" />
        </a>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} title="ערוך" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDuplicate} title="שכפל" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggle} title={item.isActive ? "השבת" : "הפעל"} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
          {item.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
        </button>
        <button
          onClick={() => {
            if (confirm(`למחוק את "${item.name}"?`)) onDelete();
          }}
          title="מחק"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PriceListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; item: PriceListItem | null }>({ open: false, item: null });

  // Load the first (default) price list
  const { data: priceLists = [] } = useQuery<PriceList[]>({
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
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (item: PriceListItem) =>
      fetch(`/api/price-lists/${item.priceListId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${item.name} (עותק)`,
          type: item.type, category: item.category, unit: item.unit,
          basePrice: item.basePrice, taxMode: item.taxMode,
          durationMinutes: item.durationMinutes, description: item.description,
          defaultQuantity: item.defaultQuantity,
        }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-list-items/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] }),
  });

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
      const cat = item.category || "ללא קטגוריה";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [filtered]);

  if (!priceList && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="empty-state-icon mx-auto">
          <Layers className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm text-petra-muted">טוען מחירון...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap flex-shrink-0">
        <h1 className="page-title flex items-center gap-2">מחירון</h1>
        <p className="text-sm text-petra-muted">
          {items.filter((i) => i.isActive).length} פריטים פעילים · {priceList?.name}
        </p>
        <button
          onClick={() => setModalState({ open: true, item: null })}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          פריט חדש
        </button>
        {items.filter((i) => i.isActive).length > 0 && (
          <a
            href={(() => {
              const activeItems = items.filter((i) => i.isActive);
              const grouped: Record<string, typeof activeItems> = {};
              for (const item of activeItems) {
                const cat = item.category || "כללי";
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
              }
              const lines = [`📋 *מחירון ${priceList?.name ?? ""}*`, ""];
              for (const [cat, catItems] of Object.entries(grouped)) {
                lines.push(`*${cat}:*`);
                for (const item of catItems) {
                  const price = `₪${item.basePrice.toFixed(0)}`;
                  const dur = item.durationMinutes ? ` · ${item.durationMinutes} דק׳` : "";
                  lines.push(`• ${item.name} — ${price}${dur}`);
                }
                lines.push("");
              }
              return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            title="שתף מחירון בוואטסאפ"
          >
            <Share2 className="w-4 h-4" />
            שתף מחירון
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pr-10 w-56"
            placeholder="חיפוש..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input w-40 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="input w-36 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">הכל</option>
          <option value="service">שירותים</option>
          <option value="product">מוצרים</option>
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
          {showInactive ? "הסתר לא פעילים" : "הצג לא פעילים"}
        </button>
      </div>

      {/* Items grouped by category */}
      <div className="flex-1 overflow-y-auto card">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="empty-state-icon mx-auto">
              <Tag className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-petra-text mb-1">
              {search || filterCategory || filterType ? "לא נמצאו פריטים" : "המחירון ריק"}
            </p>
            <p className="text-xs text-petra-muted mb-4">
              {search ? "נסה חיפוש אחר" : "הוסף את הפריט הראשון"}
            </p>
            {!search && (
              <button onClick={() => setModalState({ open: true, item: null })} className="btn-primary">
                <Plus className="w-4 h-4" /> פריט חדש
              </button>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div className="px-4 py-2 bg-slate-50/80 border-b border-petra-border">
                <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">{cat}</span>
                <span className="text-xs text-slate-400 mr-2">({catItems.length})</span>
              </div>
              {catItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => setModalState({ open: true, item })}
                  onDuplicate={() => duplicateMutation.mutate(item)}
                  onToggle={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                  onDelete={() => deleteMutation.mutate(item.id)}
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
    </div>
  );
}
