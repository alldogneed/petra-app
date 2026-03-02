"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, Tag, ChevronRight, X,
  Loader2, PackageOpen, ToggleLeft, ToggleRight,
  ShoppingBag, AlertTriangle, Clock, Package, Copy,
  CheckCircle2, XCircle, Link2, CalendarCheck, CreditCard,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────

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
  isActive: boolean;
  sortOrder: number;
  paymentUrl: string | null;
  isBookableOnline: boolean;
  depositRequired: boolean;
  depositAmount: number | null;
}

interface PriceList {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  _count: { items: number };
}

// ─── Constants ───────────────────────────────────────────────

const UNITS: { id: string; label: string }[] = [
  { id: "per_session", label: "לפגישה" },
  { id: "per_day", label: "ליום" },
  { id: "per_night", label: "ללילה" },
  { id: "per_hour", label: "לשעה" },
  { id: "per_item", label: "ליחידה" },
  { id: "fixed", label: "מחיר קבוע" },
];

const UNIT_LABEL: Record<string, string> = Object.fromEntries(
  UNITS.map((u) => [u.id, u.label])
);

const TAX_LABELS: Record<string, string> = {
  taxable: "חייב מע״מ",
  exempt: "פטור מע״מ",
  inherit: "לפי הגדרת עסק",
  inclusive: "כולל מע״מ",
  exclusive: "+ מע״מ",
};

const CATEGORIES = ["אילוף", "טיפוח", "פנסיון", "ייעוץ", "מוצרים", "תוסף", "אחר"];

// ─── New Price List Modal ─────────────────────────────────────

function NewPriceListModal({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void;
  onSave: (data: { name: string; currency: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("ILS");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">מחירון חדש</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSave({ name: name.trim(), currency });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">שם המחירון *</label>
            <input
              className="input mt-1"
              placeholder="לדוגמה: מחירון אילוף 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">מטבע</label>
            <select
              className="input mt-1"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="ILS">שקל (₪)</option>
              <option value="USD">דולר ($)</option>
              <option value="EUR">יורו (€)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="btn-primary flex-1 gap-2 justify-center"
            >
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
  type: "service" | "product";
  category: string;
  unit: string;
  basePrice: string;
  description: string;
  taxMode: string;
  durationMinutes: string;
  paymentUrl: string;
  isBookableOnline: boolean;
  depositRequired: boolean;
  depositAmount: string;
}

function ItemModal({
  item,
  onClose,
  onSave,
  isSaving,
}: {
  item?: PriceListItem | null;
  onClose: () => void;
  onSave: (data: ItemFormData) => void;
  isSaving: boolean;
}) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState<ItemFormData>({
    name: item?.name ?? "",
    type: item?.type ?? "service",
    category: item?.category ?? "",
    unit: item?.unit ?? "per_session",
    basePrice: item?.basePrice?.toString() ?? "",
    description: item?.description ?? "",
    taxMode: item?.taxMode ?? "taxable",
    durationMinutes: item?.durationMinutes?.toString() ?? "",
    paymentUrl: item?.paymentUrl ?? "",
    isBookableOnline: item?.isBookableOnline ?? false,
    depositRequired: item?.depositRequired ?? false,
    depositAmount: item?.depositAmount?.toString() ?? "",
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">
            {isEdit ? "עריכת פריט" : "פריט חדש"}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim() || form.basePrice === "") return;
            onSave(form);
          }}
          className="space-y-4"
        >
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["service", "product"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2",
                  form.type === t
                    ? "border-brand-400 bg-brand-50 text-brand-600"
                    : "border-petra-border text-petra-muted hover:bg-slate-50"
                )}
              >
                {t === "service" ? (
                  <><Clock className="w-3.5 h-3.5" /> שירות</>
                ) : (
                  <><Package className="w-3.5 h-3.5" /> מוצר</>
                )}
              </button>
            ))}
          </div>

          <div>
            <label className="label">שם *</label>
            <input
              className="input mt-1"
              placeholder="לדוגמה: שיעור אילוף יחיד"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <input
                className="input mt-1"
                list="item-categories"
                placeholder="לדוגמה: אילוף"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="item-categories">
                {CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="label">יחידת מידה</label>
              <select
                className="input mt-1"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מחיר (₪) *</label>
              <input
                className="input mt-1"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="label">מע״מ</label>
              <select
                className="input mt-1"
                value={form.taxMode}
                onChange={(e) => setForm({ ...form, taxMode: e.target.value })}
              >
                <option value="taxable">חייב מע״מ</option>
                <option value="exempt">פטור מע״מ</option>
                <option value="inherit">לפי הגדרת עסק</option>
              </select>
            </div>
          </div>

          {form.type === "service" && (
            <div>
              <label className="label">משך (דקות)</label>
              <input
                className="input mt-1"
                type="number"
                min="0"
                placeholder="60"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                dir="ltr"
              />
            </div>
          )}

          <div>
            <label className="label">תיאור</label>
            <textarea
              className="input mt-1 resize-none"
              rows={2}
              placeholder="תיאור קצר (אופציונלי)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* ── קישור תשלום ── */}
          <div className="rounded-xl border border-petra-border p-4 space-y-3 bg-slate-50/50">
            <p className="text-xs font-semibold text-petra-text flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-brand-500" />
              קישור לדף תשלום
            </p>
            <input
              className="input bg-white"
              type="url"
              placeholder="https://meshulam.co.il/p/..."
              value={form.paymentUrl}
              onChange={(e) => setForm({ ...form, paymentUrl: e.target.value })}
              dir="ltr"
            />
            <p className="text-[11px] text-petra-muted">
              קישור לדף תשלום של המסלקה שלך (Meshulam, Tranzila, iCount וכו׳). יישלח ללקוח אחרי הזמנה.
            </p>
          </div>

          {/* ── תור אונליין ── */}
          <div className="rounded-xl border border-petra-border p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-petra-text flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-brand-500" />
                זמין לתיאום תור אונליין
              </p>
              <button
                type="button"
                onClick={() => setForm({ ...form, isBookableOnline: !form.isBookableOnline })}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  form.isBookableOnline ? "bg-brand-500" : "bg-slate-300"
                )}
              >
                <span className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                  form.isBookableOnline ? "translate-x-4" : "translate-x-1"
                )} />
              </button>
            </div>

            {form.isBookableOnline && (
              <>
                <p className="text-[11px] text-petra-muted">
                  הפריט יופיע בדף הזמנות האונליין שלך. הלקוח יוכל לבחור את השירות ולתאם תור.
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-petra-text">דרוש מקדמה</p>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, depositRequired: !form.depositRequired, depositAmount: "" })}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      form.depositRequired ? "bg-brand-500" : "bg-slate-300"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                      form.depositRequired ? "translate-x-4" : "translate-x-1"
                    )} />
                  </button>
                </div>
                {form.depositRequired && (
                  <div>
                    <label className="label">סכום מקדמה (₪)</label>
                    <input
                      className="input mt-1 bg-white"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="50.00"
                      value={form.depositAmount}
                      onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving || !form.name.trim() || form.basePrice === ""}
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

// ─── Item Row ─────────────────────────────────────────────────

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
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-petra-border hover:bg-slate-50/50 transition-colors group",
        !item.isActive && "opacity-50"
      )}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
        {item.type === "service" ? (
          <Clock className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <Package className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-petra-text">{item.name}</span>
          {item.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-petra-muted font-medium">
              {item.category}
            </span>
          )}
          {item.durationMinutes ? (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />{item.durationMinutes}ד׳
            </span>
          ) : null}
        </div>
        {item.description && (
          <p className="text-xs text-petra-muted truncate mt-0.5">{item.description}</p>
        )}
        <p className="text-[10px] text-petra-muted mt-0.5">{UNIT_LABEL[item.unit] ?? item.unit}</p>
      </div>

      <div className="text-left flex-shrink-0">
        <p className="text-sm font-bold text-petra-text">{formatCurrency(item.basePrice)}</p>
        {item.taxMode && item.taxMode !== "inherit" && (
          <p className="text-[10px] text-petra-muted">{TAX_LABELS[item.taxMode]}</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {item.isBookableOnline && (
          <span
            title="זמין לתיאום תור אונליין"
            className="w-6 h-6 rounded-lg flex items-center justify-center bg-brand-50 text-brand-500"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
          </span>
        )}
        {item.paymentUrl && (
          <a
            href={item.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="דף תשלום"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <CreditCard className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          title="ערוך"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="שכפל"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          title={item.isActive ? "השבת" : "הפעל"}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
        >
          {item.isActive ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="מחק"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Price List Panel ─────────────────────────────────────────

function PriceListPanel({
  priceList,
  onClose,
}: {
  priceList: PriceList;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<PriceListItem | null>(null);

  const { data: items = [], isLoading } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items", priceList.id],
    queryFn: () =>
      fetch(`/api/price-lists/${priceList.id}/items?active=false`).then((r) => r.json()),
  });

  const buildItemPayload = (data: ItemFormData) => ({
    ...data,
    basePrice: parseFloat(data.basePrice),
    durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes) : null,
    paymentUrl: data.paymentUrl || null,
    category: data.category || null,
    depositAmount: data.depositRequired && data.depositAmount ? parseFloat(data.depositAmount) : null,
  });

  const addMutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      fetch(`/api/price-lists/${priceList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildItemPayload(data)),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      setShowAddItem(false);
      toast.success("פריט נוסף");
    },
    onError: () => toast.error("שגיאה בהוספת פריט"),
  });

  const editMutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      fetch(`/api/price-list-items/${editItem!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildItemPayload(data)),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList.id] });
      setEditItem(null);
      toast.success("פריט עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון פריט"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/price-list-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList.id] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (item: PriceListItem) =>
      fetch(`/api/price-lists/${priceList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${item.name} (עותק)`,
          type: item.type,
          category: item.category,
          unit: item.unit,
          basePrice: item.basePrice,
          taxMode: item.taxMode,
          durationMinutes: item.durationMinutes,
          description: item.description,
          paymentUrl: item.paymentUrl,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success("פריט שוכפל");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-list-items/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success("פריט נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת פריט"),
  });

  // Group active items by category
  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);
  const grouped: Record<string, PriceListItem[]> = {};
  activeItems.forEach((item) => {
    const cat = item.category || "כללי";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex" dir="rtl">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

        {/* Panel slides in from the right */}
        <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost p-1.5 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-bold text-petra-text">{priceList.name}</h2>
                <p className="text-xs text-petra-muted">
                  {priceList.currency} · {items.length} פריטים
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state py-16">
                <div className="empty-state-icon">
                  <PackageOpen className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold text-petra-text mt-2">אין פריטים במחירון</p>
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
              <div>
                {Object.entries(grouped).map(([cat, catItems]) => (
                  <div key={cat}>
                    <div className="px-4 py-2 bg-slate-50/80 border-b border-petra-border">
                      <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">
                        {cat}
                      </span>
                      <span className="text-xs text-slate-400 mr-2">({catItems.length})</span>
                    </div>
                    {catItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onEdit={() => setEditItem(item)}
                        onDuplicate={() => duplicateMutation.mutate(item)}
                        onToggle={() =>
                          toggleMutation.mutate({ id: item.id, isActive: !item.isActive })
                        }
                        onDelete={() => {
                          if (confirm(`למחוק את "${item.name}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      />
                    ))}
                  </div>
                ))}

                {inactiveItems.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-50/80 border-b border-petra-border">
                      <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">
                        לא פעיל
                      </span>
                      <span className="text-xs text-slate-400 mr-2">({inactiveItems.length})</span>
                    </div>
                    {inactiveItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onEdit={() => setEditItem(item)}
                        onDuplicate={() => duplicateMutation.mutate(item)}
                        onToggle={() =>
                          toggleMutation.mutate({ id: item.id, isActive: !item.isActive })
                        }
                        onDelete={() => {
                          if (confirm(`למחוק את "${item.name}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddItem && (
        <ItemModal
          onClose={() => setShowAddItem(false)}
          onSave={(data) => addMutation.mutate(data)}
          isSaving={addMutation.isPending}
        />
      )}

      {editItem && (
        <ItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => editMutation.mutate(data)}
          isSaving={editMutation.isPending}
        />
      )}
    </>
  );
}

// ─── Price List Card ──────────────────────────────────────────

function PriceListCard({
  list,
  onOpen,
  onToggleActive,
  onDelete,
  isTogglingActive,
}: {
  list: PriceList;
  onOpen: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  isTogglingActive: boolean;
}) {
  return (
    <div
      className={cn(
        "card card-hover p-5 cursor-pointer transition-all group relative",
        !list.isActive && "opacity-70"
      )}
      onClick={onOpen}
    >
      {/* Status dot */}
      <div className="absolute top-3.5 left-4">
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            list.isActive ? "bg-emerald-400" : "bg-slate-300"
          )}
        />
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Tag className="w-5 h-5 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-petra-text truncate">{list.name}</h3>
            <p className="text-xs text-petra-muted mt-0.5">{list.currency}</p>
          </div>
        </div>

        {/* Actions on hover */}
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

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-petra-text">{list._count.items}</p>
          <p className="text-xs text-petra-muted">פריטים</p>
        </div>
        <span
          className={cn(
            "badge text-xs",
            list.isActive ? "badge-success" : "badge-neutral"
          )}
        >
          {list.isActive ? "פעיל" : "לא פעיל"}
        </span>
      </div>

      <p className="text-xs text-petra-muted mt-3 border-t border-slate-100 pt-3">
        לחץ לצפייה ועריכת פריטים
      </p>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────

function ConfirmDeleteModal({
  message,
  onConfirm,
  onClose,
  isDeleting,
}: {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) {
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

// ─── Main Page ────────────────────────────────────────────────

export default function PricingPage() {
  const queryClient = useQueryClient();
  const [showNewList, setShowNewList] = useState(false);
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  const [deleteList, setDeleteList] = useState<PriceList | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: priceLists = [], isLoading } = useQuery<PriceList[]>({
    queryKey: ["price-lists"],
    queryFn: () => fetch("/api/price-lists").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; currency: string }) =>
      fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      setShowNewList(false);
      toast.success("מחירון נוצר");
    },
    onError: () => toast.error("שגיאה ביצירת מחירון"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/price-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      setTogglingId(null);
    },
    onError: () => toast.error("שגיאה בעדכון מחירון"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-lists/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      setDeleteList(null);
      toast.success("מחירון נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת מחירון"),
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">מחירונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            נהל רשימות מחירים, שירותים ומוצרים
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
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
              onToggleActive={() => {
                setTogglingId(list.id);
                toggleActiveMutation.mutate({ id: list.id, isActive: !list.isActive });
              }}
              onDelete={() => setDeleteList(list)}
              isTogglingActive={togglingId === list.id}
            />
          ))}
        </div>
      )}

      {showNewList && (
        <NewPriceListModal
          onClose={() => setShowNewList(false)}
          onSave={(data) => createMutation.mutate(data)}
          isSaving={createMutation.isPending}
        />
      )}

      {selectedList && (
        <PriceListPanel
          priceList={selectedList}
          onClose={() => setSelectedList(null)}
        />
      )}

      {deleteList && (
        <ConfirmDeleteModal
          message={`האם למחוק את המחירון "${deleteList.name}" וכל הפריטים שבו?`}
          onConfirm={() => deleteMutation.mutate(deleteList.id)}
          onClose={() => setDeleteList(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
