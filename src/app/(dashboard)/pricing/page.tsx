"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  ChevronLeft,
  X,
  Loader2,
  PackageOpen,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

interface PriceListItem {
  id: string;
  priceListId: string;
  name: string;
  description: string | null;
  unit: string;
  basePrice: number;
  taxMode: string;
  isActive: boolean;
  sortOrder: number;
}

interface PriceList {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  items: PriceListItem[];
}

// ─── Constants ───────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: "יח׳", label: "יחידה (יח׳)" },
  { value: "שעה", label: "שעה" },
  { value: "חודש", label: "חודש" },
  { value: "ביקור", label: "ביקור" },
  { value: "קג", label: "קילוגרם (ק״ג)" },
];

const TAX_MODE_OPTIONS = [
  { value: "inclusive", label: "כולל מע״מ" },
  { value: "exclusive", label: "לא כולל מע״מ" },
  { value: "exempt", label: "פטור ממע״מ" },
];

const TAX_MODE_LABELS: Record<string, string> = {
  inclusive: "כולל מע״מ",
  exclusive: "+ מע״מ",
  exempt: "פטור",
  inherit: "כולל מע״מ",
};

const EMPTY_ITEM_FORM = {
  name: "",
  description: "",
  unit: "יח׳",
  unitPrice: "",
  taxMode: "inclusive",
  isActive: true,
};

const EMPTY_LIST_FORM = {
  name: "",
  currency: "ILS",
  isActive: true,
};

// ─── Modals ───────────────────────────────────────────────────

interface NewPriceListModalProps {
  onClose: () => void;
  onSave: (data: { name: string; currency: string; isActive: boolean }) => void;
  isSaving: boolean;
}

function NewPriceListModal({ onClose, onSave, isSaving }: NewPriceListModalProps) {
  const [form, setForm] = useState(EMPTY_LIST_FORM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">מחירון חדש</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">שם המחירון *</label>
            <input
              className="input mt-1"
              placeholder="לדוגמה: מחירון אילוף 2025"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">מטבע</label>
            <select
              className="input mt-1"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="ILS">שקל (ILS)</option>
              <option value="USD">דולר (USD)</option>
              <option value="EUR">יורו (EUR)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                form.isActive ? "bg-brand-500" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                  form.isActive ? "translate-x-4" : "translate-x-1"
                )}
              />
            </button>
            <label className="text-sm text-petra-text cursor-pointer" onClick={() => setForm({ ...form, isActive: !form.isActive })}>
              מחירון פעיל
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSaving || !form.name.trim()} className="btn-primary flex-1 gap-2 justify-center">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              צור מחירון
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Item Modal ───────────────────────────────────────────────

interface ItemFormData {
  name: string;
  description: string;
  unit: string;
  unitPrice: string;
  taxMode: string;
  isActive: boolean;
}

interface ItemModalProps {
  initialData?: PriceListItem | null;
  onClose: () => void;
  onSave: (data: ItemFormData) => void;
  isSaving: boolean;
}

function ItemModal({ initialData, onClose, onSave, isSaving }: ItemModalProps) {
  const [form, setForm] = useState<ItemFormData>(
    initialData
      ? {
          name: initialData.name,
          description: initialData.description ?? "",
          unit: initialData.unit,
          unitPrice: String(initialData.basePrice),
          taxMode: initialData.taxMode,
          isActive: initialData.isActive,
        }
      : EMPTY_ITEM_FORM
  );

  const isEdit = Boolean(initialData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.unitPrice) return;
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">
            {isEdit ? "עריכת פריט" : "פריט חדש"}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">שם הפריט *</label>
            <input
              className="input mt-1"
              placeholder="לדוגמה: שיעור פרטי - כלב גדול"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">תיאור (אופציונלי)</label>
            <textarea
              className="input mt-1 resize-none"
              rows={2}
              placeholder="תיאור קצר של השירות..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">יחידת מידה</label>
              <select
                className="input mt-1"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">מחיר (₪) *</label>
              <input
                className="input mt-1"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">מע״מ</label>
            <select
              className="input mt-1"
              value={form.taxMode}
              onChange={(e) => setForm({ ...form, taxMode: e.target.value })}
            >
              {TAX_MODE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                form.isActive ? "bg-brand-500" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                  form.isActive ? "translate-x-4" : "translate-x-1"
                )}
              />
            </button>
            <label
              className="text-sm text-petra-text cursor-pointer"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
            >
              פריט פעיל
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || !form.name.trim() || !form.unitPrice}
              className="btn-primary flex-1 gap-2 justify-center"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isEdit ? "שמור שינויים" : "הוסף פריט"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────

interface ConfirmDeleteModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}

function ConfirmDeleteModal({ message, onConfirm, onClose, isDeleting }: ConfirmDeleteModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-4 text-center py-2">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-petra-text font-medium">{message}</p>
          <p className="text-sm text-petra-muted">פעולה זו היא בלתי הפיכה.</p>
          <div className="flex gap-3 w-full pt-1">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="btn-danger flex-1 gap-2 justify-center"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              מחק
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Price List Panel ─────────────────────────────────────────

interface PriceListPanelProps {
  priceList: PriceList;
  onClose: () => void;
}

function PriceListPanel({ priceList, onClose }: PriceListPanelProps) {
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<PriceListItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PriceListItem | null>(null);

  // Current data from cache (updated reactively)
  const { data: lists = [] } = useQuery<PriceList[]>({
    queryKey: ["pricing"],
    queryFn: () => fetch("/api/pricing").then((r) => r.json()),
  });

  const currentList = lists.find((l) => l.id === priceList.id) ?? priceList;
  const items = currentList.items ?? [];

  // ── Add Item ──────────────────────────────────────────────
  const addItemMutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      fetch(`/api/pricing/${priceList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setShowAddItem(false);
    },
  });

  // ── Edit Item ─────────────────────────────────────────────
  const editItemMutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      fetch(`/api/pricing/${priceList.id}/items/${editItem!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setEditItem(null);
    },
  });

  // ── Delete Item ───────────────────────────────────────────
  const deleteItemMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pricing/${priceList.id}/items/${deleteItem!.id}`, {
        method: "DELETE",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setDeleteItem(null);
    },
  });

  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);

  return (
    <>
      <div className="fixed inset-0 z-40 flex" dir="rtl">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <div className="fixed top-0 left-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-slide-up overflow-hidden">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-bold text-petra-text">{currentList.name}</h2>
                <p className="text-xs text-petra-muted">
                  {currentList.currency} · {items.length} פריטים
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="btn-primary text-sm gap-1.5 py-2 px-3"
            >
              <Plus className="w-4 h-4" />
              הוסף פריט
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            {items.length === 0 ? (
              <div className="empty-state py-16">
                <div className="empty-state-icon">
                  <PackageOpen className="w-8 h-8" />
                </div>
                <p className="text-sm text-petra-muted mt-2">אין פריטים במחירון</p>
                <button
                  type="button"
                  onClick={() => setShowAddItem(true)}
                  className="btn-primary mt-4 text-sm gap-2"
                >
                  <Plus className="w-4 h-4" />
                  הוסף פריט ראשון
                </button>
              </div>
            ) : (
              <>
                {activeItems.length > 0 && (
                  <div className="space-y-2">
                    {activeItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        currency={currentList.currency}
                        onEdit={() => setEditItem(item)}
                        onDelete={() => setDeleteItem(item)}
                      />
                    ))}
                  </div>
                )}

                {inactiveItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-petra-muted pt-2 pb-1">לא פעיל</p>
                    {inactiveItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        currency={currentList.currency}
                        onEdit={() => setEditItem(item)}
                        onDelete={() => setDeleteItem(item)}
                        dimmed
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddItem && (
        <ItemModal
          onClose={() => setShowAddItem(false)}
          onSave={(data) => addItemMutation.mutate(data)}
          isSaving={addItemMutation.isPending}
        />
      )}

      {editItem && (
        <ItemModal
          initialData={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => editItemMutation.mutate(data)}
          isSaving={editItemMutation.isPending}
        />
      )}

      {deleteItem && (
        <ConfirmDeleteModal
          message={`האם למחוק את הפריט "${deleteItem.name}"?`}
          onConfirm={() => deleteItemMutation.mutate()}
          onClose={() => setDeleteItem(null)}
          isDeleting={deleteItemMutation.isPending}
        />
      )}
    </>
  );
}

// ─── Item Row ─────────────────────────────────────────────────

interface ItemRowProps {
  item: PriceListItem;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  dimmed?: boolean;
}

function ItemRow({ item, onEdit, onDelete, dimmed }: ItemRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all group",
        dimmed && "opacity-60"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-petra-text truncate">{item.name}</p>
          {item.taxMode && (
            <span className="badge badge-neutral text-[10px] shrink-0">
              {TAX_MODE_LABELS[item.taxMode] ?? item.taxMode}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-petra-muted mt-0.5 truncate">{item.description}</p>
        )}
        <p className="text-xs text-petra-muted mt-0.5">{item.unit}</p>
      </div>

      <div className="flex items-center gap-3 mr-3">
        <p className="text-sm font-bold text-petra-text whitespace-nowrap">
          {formatCurrency(item.basePrice)}
        </p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
            title="ערוך"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            title="מחק"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Price List Card ──────────────────────────────────────────

interface PriceListCardProps {
  list: PriceList;
  onOpen: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  isTogglingActive: boolean;
}

function PriceListCard({ list, onOpen, onToggleActive, onDelete, isTogglingActive }: PriceListCardProps) {
  const activeItems = list.items?.filter((i) => i.isActive).length ?? 0;
  const totalItems = list.items?.length ?? 0;

  return (
    <div
      className={cn(
        "card card-hover p-5 cursor-pointer transition-all group relative",
        !list.isActive && "opacity-70"
      )}
      onClick={onOpen}
    >
      {/* Active/inactive indicator */}
      <div className="absolute top-3 left-3">
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            list.isActive ? "bg-emerald-400" : "bg-slate-300"
          )}
        />
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Tag className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-petra-text">{list.name}</h3>
            <p className="text-xs text-petra-muted mt-0.5">{list.currency}</p>
          </div>
        </div>

        {/* Actions — shown on hover */}
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onToggleActive}
            disabled={isTogglingActive}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              list.isActive
                ? "hover:bg-amber-50 text-amber-500"
                : "hover:bg-emerald-50 text-emerald-500"
            )}
            title={list.isActive ? "השבת" : "הפעל"}
          >
            {isTogglingActive ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : list.isActive ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            title="מחק מחירון"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div>
          <p className="text-lg font-bold text-petra-text">{totalItems}</p>
          <p className="text-xs text-petra-muted">פריטים</p>
        </div>
        {totalItems > 0 && (
          <div>
            <p className="text-lg font-bold text-emerald-600">{activeItems}</p>
            <p className="text-xs text-petra-muted">פעילים</p>
          </div>
        )}
        <div className="mr-auto">
          <span
            className={cn(
              "badge text-xs",
              list.isActive ? "badge-success" : "badge-neutral"
            )}
          >
            {list.isActive ? "פעיל" : "לא פעיל"}
          </span>
        </div>
      </div>

      <p className="text-xs text-petra-muted mt-3 border-t border-slate-100 pt-3">
        לחץ לצפייה ועריכת פריטים
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function PricingPage() {
  const queryClient = useQueryClient();

  const [showNewList, setShowNewList] = useState(false);
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  const [deleteList, setDeleteList] = useState<PriceList | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Query ─────────────────────────────────────────────────

  const { data: priceLists = [], isLoading } = useQuery<PriceList[]>({
    queryKey: ["pricing"],
    queryFn: () => fetch("/api/pricing").then((r) => r.json()),
  });

  // ── Mutations ─────────────────────────────────────────────

  const createListMutation = useMutation({
    mutationFn: (data: { name: string; currency: string; isActive: boolean }) =>
      fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setShowNewList(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/pricing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setTogglingId(null);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/pricing/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setDeleteList(null);
    },
  });

  // ── Handlers ──────────────────────────────────────────────

  const handleToggleActive = (list: PriceList) => {
    setTogglingId(list.id);
    toggleActiveMutation.mutate({ id: list.id, isActive: !list.isActive });
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">מחירונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            נהל את רשימות המחירים, השירותים ועלויות הטיפול
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewList(true)}
          className="btn-primary gap-2"
        >
          <Plus className="w-4 h-4" />
          מחירון חדש
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-petra-muted text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          טוען מחירונים...
        </div>
      ) : priceLists.length === 0 ? (
        <div className="empty-state py-20">
          <div className="empty-state-icon">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <p className="text-petra-text font-semibold mt-3">אין מחירונים עדיין</p>
          <p className="text-sm text-petra-muted mt-1 max-w-xs text-center">
            צור מחירון ראשון כדי להתחיל לנהל את עלויות השירותים שלך
          </p>
          <button
            type="button"
            onClick={() => setShowNewList(true)}
            className="btn-primary mt-5 gap-2"
          >
            <Plus className="w-4 h-4" />
            צור מחירון ראשון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {priceLists.map((list) => (
            <PriceListCard
              key={list.id}
              list={list}
              onOpen={() => setSelectedList(list)}
              onToggleActive={() => handleToggleActive(list)}
              onDelete={() => setDeleteList(list)}
              isTogglingActive={togglingId === list.id}
            />
          ))}
        </div>
      )}

      {/* New Price List Modal */}
      {showNewList && (
        <NewPriceListModal
          onClose={() => setShowNewList(false)}
          onSave={(data) => createListMutation.mutate(data)}
          isSaving={createListMutation.isPending}
        />
      )}

      {/* Price List Panel (items) */}
      {selectedList && (
        <PriceListPanel
          priceList={selectedList}
          onClose={() => setSelectedList(null)}
        />
      )}

      {/* Delete Price List Confirm */}
      {deleteList && (
        <ConfirmDeleteModal
          message={`האם למחוק את המחירון "${deleteList.name}" וכל הפריטים שבו?`}
          onConfirm={() => deleteListMutation.mutate(deleteList.id)}
          onClose={() => setDeleteList(null)}
          isDeleting={deleteListMutation.isPending}
        />
      )}
    </div>
  );
}
