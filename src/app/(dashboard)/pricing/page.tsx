"use client";

import { TierGate } from "@/components/paywall/TierGate";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, X,
  Loader2, PackageOpen,
  Copy, CheckCircle2, XCircle, CalendarCheck, CreditCard,
  Clock, Package, Tag, Sparkles,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { getMaxPriceItems } from "@/lib/feature-flags";

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
  maxBookingsPerDay: number | null;
  sessions: number | null;
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

// These 4 main categories are used by the order modal to filter items
const CATEGORIES = ["פנסיון", "אילוף", "טיפוח", "מוצרים"];

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
  maxBookingsPerDay: string;
  sessions: string;
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
    maxBookingsPerDay: item?.maxBookingsPerDay?.toString() ?? "",
    sessions: item?.sessions?.toString() ?? "",
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
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
              <label className="label">קטגוריה *</label>
              <select
                className="input mt-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                <option value="">בחר קטגוריה...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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

          {/* Sessions field — shown for training category items */}
          {form.category === "אילוף" && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                חבילת אילוף (אופציונלי)
              </p>
              <div>
                <label className="label text-[11px]">כמות מפגשים בחבילה</label>
                <input
                  className="input mt-1"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="לדוגמה: 8 מפגשים"
                  value={form.sessions}
                  onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                  dir="ltr"
                />
              </div>
              <p className="text-[11px] text-blue-600">
                אם מוגדרת כמות מפגשים, הפריט יוצג כ&quot;חבילת אילוף&quot; בהזמנה ויפתח מעקב מפגשים אוטומטי.
              </p>
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
                <div>
                  <label className="label">מקסימום הזמנות ביום</label>
                  <input
                    className="input mt-1 bg-white"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="ללא הגבלה"
                    value={form.maxBookingsPerDay}
                    onChange={(e) => setForm({ ...form, maxBookingsPerDay: e.target.value })}
                    dir="ltr"
                  />
                  <p className="text-[11px] text-petra-muted mt-1">הגבל כמה הזמנות אפשר לקבוע לשירות זה ביום אחד</p>
                </div>
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
        "px-3 py-3 sm:px-4 border-b border-petra-border hover:bg-slate-50/50 transition-colors group",
        !item.isActive && "opacity-50"
      )}
    >
      {/* Top row: icon + name + price */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
          {item.type === "service" ? (
            <Clock className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <Package className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-petra-text leading-tight">{item.name}</span>
            {item.durationMinutes ? (
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />{item.durationMinutes}ד׳
              </span>
            ) : null}
            {item.sessions ? (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                <Package className="w-2.5 h-2.5" />{item.sessions} מפגשים
              </span>
            ) : null}
          </div>
          {item.description && (
            <p className="text-xs text-petra-muted truncate mt-0.5">{item.description}</p>
          )}
        </div>

        {/* Price — always top-right */}
        <div className="text-left flex-shrink-0">
          <p className="text-sm font-bold text-petra-text">{formatCurrency(item.basePrice)}</p>
          {item.taxMode && item.taxMode !== "inherit" && (
            <p className="text-[10px] text-petra-muted">{TAX_LABELS[item.taxMode]}</p>
          )}
        </div>
      </div>

      {/* Bottom row: unit + badges + action buttons */}
      <div className="flex items-center gap-1 mt-1.5 pr-9">
        <p className="text-[10px] text-petra-muted flex-shrink-0">{UNIT_LABEL[item.unit] ?? item.unit}</p>

        {item.isBookableOnline && (
          <span
            title="זמין לתיאום תור אונליין"
            className="w-5 h-5 rounded-md flex items-center justify-center bg-brand-50 text-brand-500 flex-shrink-0"
          >
            <CalendarCheck className="w-3 h-3" />
          </span>
        )}
        {item.paymentUrl && (
          <a
            href={item.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="דף תשלום"
            className="w-5 h-5 rounded-md flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <CreditCard className="w-3 h-3" />
          </a>
        )}

        {/* Push action buttons to the left */}
        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
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
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

function PricingPageContent() {
  const { isFree, tier } = usePlan();
  const maxPriceItems = getMaxPriceItems(tier);
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<PriceListItem | null>(null);

  // Fetch all price lists, use the first active one (or first one)
  const { data: priceLists = [], isLoading: listsLoading } = useQuery<PriceList[]>({
    queryKey: ["price-lists"],
    queryFn: () => fetch("/api/price-lists").then((r) => r.json()),
  });

  const priceList = priceLists.find((l) => l.isActive) ?? priceLists[0] ?? null;

  const { data: items = [], isLoading: itemsLoading } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items", priceList?.id],
    queryFn: () =>
      fetch(`/api/price-lists/${priceList!.id}/items?active=false`).then((r) => r.json()),
    enabled: !!priceList,
  });

  // Auto-create a default price list if none exist
  const createDefaultMutation = useMutation({
    mutationFn: () =>
      fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "מחירון ראשי", currency: "ILS" }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה ביצירה");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success("מחירון ראשי נוצר");
    },
    onError: () => toast.error("שגיאה ביצירת מחירון"),
  });

  const buildItemPayload = (data: ItemFormData) => ({
    ...data,
    basePrice: parseFloat(data.basePrice),
    durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes) : null,
    paymentUrl: data.paymentUrl || null,
    category: data.category || null,
    depositAmount: data.depositRequired && data.depositAmount ? parseFloat(data.depositAmount) : null,
    maxBookingsPerDay: data.maxBookingsPerDay ? parseInt(data.maxBookingsPerDay) : null,
    sessions: data.sessions ? parseInt(data.sessions) : null,
  });

  const addMutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      fetch(`/api/price-lists/${priceList!.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildItemPayload(data)),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה בהוספה");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
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
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה בעדכון");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
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
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה בעדכון");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
    },
    onError: () => toast.error("שגיאה בעדכון המצב. נסה שוב."),
  });

  const duplicateMutation = useMutation({
    mutationFn: (item: PriceListItem) =>
      fetch(`/api/price-lists/${priceList!.id}/items`, {
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
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה בשכפול");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success("פריט שוכפל");
    },
    onError: () => toast.error("שגיאה בשכפול הפריט. נסה שוב."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-list-items/${id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה במחיקה");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
      toast.success("פריט נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת פריט"),
  });

  // Group active items by category (preserve CATEGORIES order)
  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);

  const grouped: Record<string, PriceListItem[]> = {};
  activeItems.forEach((item) => {
    const cat = item.category || "כללי";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  // Sort categories: known ones first in defined order, then unknown
  const sortedCats = [
    ...CATEGORIES.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORIES.includes(c)),
  ];

  const isLoading = listsLoading || (!!priceList && itemsLoading);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <FinanceTabs />

      {/* Header */}
      <DesktopBanner />
      <div className="page-header">
        <div>
          <h1 className="page-title">מחירון</h1>
          <p className="text-sm text-petra-muted mt-1 hidden sm:block">
            ניהול שירותים ומוצרים לפי קטגוריות
          </p>
        </div>
        {priceList && (
          isFree && maxPriceItems !== null && activeItems.length >= maxPriceItems ? (
            <a href="/upgrade" className="btn-primary gap-2 bg-amber-500 hover:bg-amber-600 border-amber-500">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">שדרג לבייסיק</span>
              <span className="sm:hidden">שדרג</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="btn-primary gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">הוסף פריט</span>
              <span className="sm:hidden">הוסף</span>
            </button>
          )
        )}
      </div>

      {/* Free tier item limit banner */}
      {isFree && maxPriceItems !== null && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
          activeItems.length >= maxPriceItems
            ? "bg-amber-50 border-amber-200"
            : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className={`w-4 h-4 flex-shrink-0 ${activeItems.length >= maxPriceItems ? "text-amber-500" : "text-slate-400"}`} />
            <span className={activeItems.length >= maxPriceItems ? "text-amber-800" : "text-slate-600"}>
              {activeItems.length}/{maxPriceItems} פריטי מחירון — מגבלת המנוי החינמי
            </span>
          </div>
          {activeItems.length >= maxPriceItems && (
            <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              שדרג לבייסיק ←
            </a>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="card">
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : !priceList ? (
        /* No price list exists — offer to create one */
        <div className="empty-state py-20">
          <div className="empty-state-icon">
            <Tag className="w-10 h-10" />
          </div>
          <p className="text-petra-text font-semibold mt-3">אין מחירון עדיין</p>
          <p className="text-sm text-petra-muted mt-1 max-w-xs text-center">
            צור מחירון ראשי כדי להתחיל להגדיר שירותים ומוצרים
          </p>
          <button
            type="button"
            onClick={() => createDefaultMutation.mutate()}
            disabled={createDefaultMutation.isPending}
            className="btn-primary mt-5 gap-2"
          >
            {createDefaultMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            צור מחירון ראשי
          </button>
        </div>
      ) : items.length === 0 ? (
        /* Price list exists but no items */
        <div className="card">
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <PackageOpen className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-petra-text mt-2">אין פריטים במחירון</p>
            <p className="text-xs text-petra-muted mt-1 max-w-xs text-center">
              הוסף שירותים ומוצרים לפי קטגוריות (פנסיון, אילוף, טיפוח, מוצרים)
            </p>
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="btn-primary mt-4 text-sm gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף פריט ראשון
            </button>
          </div>
        </div>
      ) : (
        /* Items grouped by category */
        <div className="card overflow-hidden">
          {sortedCats.map((cat) => (
            <div key={cat}>
              <div className="px-4 py-2 bg-slate-50/80 border-b border-petra-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">
                    {cat}
                  </span>
                  <span className="text-xs text-slate-400">({grouped[cat].length})</span>
                </div>
              </div>
              {grouped[cat].map((item) => (
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

          {/* Inactive items section */}
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

      {/* Add item modal */}
      {showAddItem && (
        <ItemModal
          onClose={() => setShowAddItem(false)}
          onSave={(data) => addMutation.mutate(data)}
          isSaving={addMutation.isPending}
        />
      )}

      {/* Edit item modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => editMutation.mutate(data)}
          isSaving={editMutation.isPending}
        />
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <TierGate
      feature="pricing"
      title="ניהול תמחור ושירותים"
      description="הגדר שירותים, מחירונים ופריטי חיוב. הכלי הבסיסי לניהול הכנסות של העסק."
    >
      <PricingPageContent />
    </TierGate>
  );
}
