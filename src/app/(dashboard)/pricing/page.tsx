"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Globe,
  CreditCard,
  Link as LinkIcon,
  Copy,
  X,
  CheckCircle2,
  Scissors,
  GraduationCap,
  Hotel,
  Sun,
  MessageCircle,
  Package,
} from "lucide-react";
import { SERVICE_TYPES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

// ─── Types ───────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  color: string | null;
  isActive: boolean;
  description: string | null;
  includesVat: boolean;
  isPublicBookable: boolean;
  bookingMode: string;
  paymentUrl: string | null;
  depositRequired: boolean;
  depositAmount: number | null;
}

const EMPTY_FORM = {
  name: "",
  type: "training",
  description: "",
  price: "",
  duration: "60",
  color: "#F97316",
  isActive: true,
  includesVat: false,
  isPublicBookable: false,
  bookingMode: "automatic",
  paymentUrl: "",
  depositRequired: false,
  depositAmount: "",
};

const COLOR_OPTIONS = [
  "#F97316", // orange (brand)
  "#3B82F6", // blue
  "#10B981", // green
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#EAB308", // yellow
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  training: GraduationCap,
  grooming: Scissors,
  boarding: Hotel,
  daycare: Sun,
  consultation: MessageCircle,
  other: Package,
};

// ─── PriceListItem Types & Constants ──────────────────────────

interface PriceListItem {
  id: string;
  name: string;
  category: string | null;
  basePrice: number;
  unit: string;
  description: string | null;
  type: string;
  taxMode: string;
  durationMinutes: number | null;
  defaultQuantity: number;
  isActive: boolean;
  sortOrder: number;
  paymentUrl: string | null;
}

const UNIT_LABELS: Record<string, string> = {
  per_session: "לפי שיעור",
  per_hour: "לפי שעה",
  per_day: "לפי יום",
  flat: "מחיר קבוע",
  per_item: "לפי פריט",
};

const ITEM_CATEGORIES = ["אילוף", "פנסיון", "טיפוח", "מוצרים", "כללי"];

const EMPTY_ITEM_FORM = {
  name: "",
  category: "",
  basePrice: "",
  description: "",
  unit: "per_session",
  durationMinutes: "",
  paymentUrl: "",
  taxMode: "inherit",
  isActive: true,
};

// ─── ServiceModal ─────────────────────────────────────────────

function ServiceModal({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!service;
  const [form, setForm] = useState(
    service
      ? {
          name: service.name,
          type: service.type,
          description: service.description || "",
          price: String(service.price),
          duration: String(service.duration),
          color: service.color || "#F97316",
          isActive: service.isActive,
          includesVat: service.includesVat,
          isPublicBookable: service.isPublicBookable,
          bookingMode: service.bookingMode,
          paymentUrl: service.paymentUrl || "",
          depositRequired: service.depositRequired,
          depositAmount: service.depositAmount ? String(service.depositAmount) : "",
        }
      : { ...EMPTY_FORM }
  );

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = isEdit ? `/api/services/${service.id}` : "/api/services";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          price: parseFloat(data.price) || 0,
          duration: parseInt(data.duration) || 60,
          depositAmount: data.depositAmount ? parseFloat(data.depositAmount) : null,
          paymentUrl: data.paymentUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save service");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onClose();
    },
  });

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-xl w-full flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "עריכת שירות" : "שירות חדש"}
          </h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 p-0 flex items-center justify-center rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Section 1 — פרטי השירות */}
          <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-100 space-y-3">
            <p className="text-sm font-semibold text-slate-700">פרטי השירות</p>

            {/* Name */}
            <div>
              <label className="label">שם השירות *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="למשל: אימון פרטי"
              />
            </div>

            {/* Category */}
            <div>
              <label className="label">קטגוריה *</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="label">תיאור</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="תיאור קצר של השירות..."
              />
            </div>

            {/* Price + VAT */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">מחיר (₪) *</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-brand-500"
                    checked={form.includesVat}
                    onChange={(e) => set("includesVat", e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">כולל מע&quot;מ</span>
                </label>
              </div>
            </div>

            {/* Duration + Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">משך (דקות)</label>
                <input
                  className="input"
                  type="number"
                  min="5"
                  step="5"
                  value={form.duration}
                  onChange={(e) => set("duration", e.target.value)}
                />
              </div>
              <div>
                <label className="label">צבע</label>
                <div className="flex gap-2 pt-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("color", c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "#0F172A" : "transparent",
                        transform: form.color === c ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set("isActive", !form.isActive)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-brand-500" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isActive ? "right-0.5" : "left-0.5"}`}
                />
              </div>
              <span className="text-sm text-slate-700">שירות פעיל</span>
            </label>
          </div>

          {/* Section 2 — קישור לתשלום */}
          <div className="p-4 rounded-xl bg-green-50/50 border border-green-100 space-y-3">
            <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              קישור לתשלום
            </p>
            <div>
              <label className="label">קישור לדף נחיתה / תשלום (WhatsApp)</label>
              <input
                className="input"
                type="url"
                value={form.paymentUrl}
                onChange={(e) => set("paymentUrl", e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-petra-muted mt-1">
                הקישור יצורף אוטומטית להודעת בקשת תשלום ב-WhatsApp
              </p>
            </div>
          </div>

          {/* Section 3 — הזמנות אונליין */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              הזמנות אונליין
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set("isPublicBookable", !form.isPublicBookable)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isPublicBookable ? "bg-blue-500" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isPublicBookable ? "right-0.5" : "left-0.5"}`}
                />
              </div>
              <span className="text-sm text-slate-700">הצג שירות זה בהזמנות אונליין</span>
            </label>

            {form.isPublicBookable && (
              <div className="pt-1">
                <label className="label">אופן אישור הזמנה</label>
                <select
                  className="input"
                  value={form.bookingMode}
                  onChange={(e) => set("bookingMode", e.target.value)}
                >
                  <option value="automatic">אישור אוטומטי</option>
                  <option value="requires_approval">דורש אישור מנהל</option>
                </select>
              </div>
            )}
          </div>

          {/* Section 3 — תשלום מקדמה */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-3">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              תשלום מקדמה
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set("depositRequired", !form.depositRequired)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.depositRequired ? "bg-amber-500" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.depositRequired ? "right-0.5" : "left-0.5"}`}
                />
              </div>
              <span className="text-sm text-slate-700">דרוש פיקדון לשריון הזמנה אונליין</span>
            </label>

            {form.depositRequired && (
              <div className="pt-1">
                <label className="label">סכום פיקדון (₪)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.depositAmount}
                  onChange={(e) => set("depositAmount", e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-5 border-t border-slate-100 flex-shrink-0 gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            ביטול
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={!form.name || !form.price || mutation.isPending}
            className="btn-primary flex-[2]"
          >
            {mutation.isPending
              ? "שומר..."
              : isEdit
              ? "שמור שינויים"
              : "הוסף שירות"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ServiceCard ──────────────────────────────────────────────

function ServiceCard({
  service,
  onEdit,
  onDelete,
  bookingLink,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  bookingLink: string | null;
}) {
  const categoryLabel =
    SERVICE_TYPES.find((t) => t.id === service.type)?.label ?? service.type;
  const Icon = CATEGORY_ICONS[service.type] ?? Package;

  return (
    <div
      className={`card p-4 flex flex-col gap-3 transition-all hover:shadow-md ${
        !service.isActive ? "opacity-60" : ""
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: service.color + "22", color: service.color ?? "#F97316" }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: service.color + "22", color: service.color ?? "#F97316" }}
          >
            {categoryLabel}
          </span>
          {!service.isActive && (
            <span className="badge badge-neutral text-xs">לא פעיל</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="ערוך"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="מחק"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Name + price */}
      <div>
        <h3 className="font-bold text-slate-900 text-base leading-snug">
          {service.name}
        </h3>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-lg font-bold text-brand-600">
            {formatCurrency(service.price)}
          </span>
          {service.includesVat && (
            <span className="text-xs text-petra-muted">כולל מע&quot;מ</span>
          )}
          <span className="text-xs text-petra-muted">· {service.duration} דק׳</span>
        </div>
      </div>

      {/* Description */}
      {service.description && (
        <p className="text-sm text-petra-muted leading-relaxed line-clamp-2">
          {service.description}
        </p>
      )}

      {/* Badges */}
      {(service.isPublicBookable || service.depositRequired) && (
        <div className="flex flex-wrap gap-1.5">
          {service.isPublicBookable && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
              <Globe className="w-3 h-3" />
              הזמנה אונליין
              {service.bookingMode === "requires_approval" && (
                <span className="text-blue-400">· אישור ידני</span>
              )}
            </span>
          )}
          {service.depositRequired && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              <CreditCard className="w-3 h-3" />
              פיקדון {service.depositAmount ? formatCurrency(service.depositAmount) : ""}
            </span>
          )}
        </div>
      )}

      {/* Booking link for public-bookable services */}
      {service.isPublicBookable && bookingLink && (
        <div className="bg-slate-50 rounded-lg p-2.5 flex items-center gap-2">
          <code className="text-[11px] text-petra-muted font-mono truncate flex-1" dir="ltr">
            {bookingLink}
          </code>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(bookingLink);
            }}
            className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="העתק קישור"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Payment URL */}
      {service.paymentUrl && (
        <a
          href={service.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
          title={service.paymentUrl}
        >
          <LinkIcon className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">קישור לתשלום</span>
        </a>
      )}
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────

function DeleteConfirmModal({
  service,
  onConfirm,
  onClose,
}: {
  service: Service;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-sm w-full p-6 text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">מחיקת שירות</h3>
          <p className="text-sm text-petra-muted mt-1">
            האם למחוק את <strong>{service.name}</strong>? פעולה זו לא ניתנת לביטול.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          <button onClick={onConfirm} className="btn-danger flex-1">מחק</button>
        </div>
      </div>
    </div>
  );
}

// ─── PriceListItemModal ────────────────────────────────────────

function PriceListItemModal({
  item,
  onClose,
}: {
  item: PriceListItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!item;
  const [form, setForm] = useState(
    item
      ? {
          name: item.name,
          category: item.category || "",
          basePrice: String(item.basePrice),
          description: item.description || "",
          unit: item.unit,
          durationMinutes: item.durationMinutes ? String(item.durationMinutes) : "",
          paymentUrl: item.paymentUrl || "",
          taxMode: item.taxMode,
          isActive: item.isActive,
        }
      : { ...EMPTY_ITEM_FORM }
  );

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = isEdit ? `/api/price-list-items/${item.id}` : "/api/price-list-items";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          category: data.category || null,
          basePrice: parseFloat(data.basePrice) || 0,
          description: data.description || null,
          unit: data.unit,
          durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes) : null,
          paymentUrl: data.paymentUrl || null,
          taxMode: data.taxMode,
          isActive: data.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to save item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items-admin"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items"] });
      onClose();
    },
  });

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "עריכת פריט" : "פריט חדש"}
          </h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 p-0 flex items-center justify-center rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Name */}
          <div>
            <label className="label">שם הפריט *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="למשל: אימון פרטי, שמפו, לינה יומית"
            />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <input
                className="input"
                list="item-categories"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="בחר או הקלד..."
              />
              <datalist id="item-categories">
                {ITEM_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="label">יחידת חיוב</label>
              <select className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {Object.entries(UNIT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price + Tax */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מחיר (₪) *</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.basePrice}
                onChange={(e) => set("basePrice", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">מע&quot;מ</label>
              <select className="input" value={form.taxMode} onChange={(e) => set("taxMode", e.target.value)}>
                <option value="inherit">לפי ברירת מחדל</option>
                <option value="included">כולל מע&quot;מ</option>
                <option value="excluded">לא כולל מע&quot;מ</option>
              </select>
            </div>
          </div>

          {/* Duration — shown only for per_session */}
          {form.unit === "per_session" && (
            <div>
              <label className="label">משך (דקות)</label>
              <input
                className="input"
                type="number"
                min="5"
                step="5"
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.value)}
                placeholder="60"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="label">תיאור</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="תיאור קצר..."
            />
          </div>

          {/* Payment URL */}
          <div>
            <label className="label">קישור לתשלום</label>
            <input
              className="input"
              type="url"
              value={form.paymentUrl}
              onChange={(e) => set("paymentUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <div
              onClick={() => set("isActive", !form.isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-brand-500" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isActive ? "right-0.5" : "left-0.5"}`}
              />
            </div>
            <span className="text-sm text-slate-700">פריט פעיל</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-5 border-t border-slate-100 flex-shrink-0 gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={!form.name || !form.basePrice || mutation.isPending}
            className="btn-primary flex-[2]"
          >
            {mutation.isPending ? "שומר..." : isEdit ? "שמור שינויים" : "הוסף פריט"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PriceListItemCard ─────────────────────────────────────────

function PriceListItemCard({
  item,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  item: PriceListItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className={`card p-4 flex flex-col gap-3 transition-all hover:shadow-md ${!item.isActive ? "opacity-55" : ""}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {item.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
              {item.category}
            </span>
          )}
          {!item.isActive && (
            <span className="badge badge-neutral text-xs">לא פעיל</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggleActive}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${item.isActive ? "text-green-500 hover:text-slate-400 hover:bg-slate-50" : "text-slate-300 hover:text-green-600 hover:bg-green-50"}`}
            title={item.isActive ? "השבת פריט" : "הפעל פריט"}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="ערוך"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="הסר"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Name + price */}
      <div>
        <h3 className="font-bold text-slate-900 text-base leading-snug">{item.name}</h3>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-lg font-bold text-brand-600">{formatCurrency(item.basePrice)}</span>
          <span className="text-xs text-petra-muted">{UNIT_LABELS[item.unit] ?? item.unit}</span>
          {item.durationMinutes && (
            <span className="text-xs text-petra-muted">· {item.durationMinutes} דק׳</span>
          )}
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-petra-muted leading-relaxed line-clamp-2">{item.description}</p>
      )}

      {/* Payment URL */}
      {item.paymentUrl && (
        <a
          href={item.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
        >
          <LinkIcon className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">קישור לתשלום</span>
        </a>
      )}
    </div>
  );
}

// ─── DeleteItemConfirmModal ────────────────────────────────────

function DeleteItemConfirmModal({
  item,
  onConfirm,
  onClose,
}: {
  item: PriceListItem;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-sm w-full p-6 text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">הסרת פריט</h3>
          <p className="text-sm text-petra-muted mt-1">
            האם להסיר את <strong>{item.name}</strong>? הפריט יוסתר מבקשות תשלום חדשות.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          <button onClick={onConfirm} className="btn-danger flex-1">הסר</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function PricingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"services" | "items">("services");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [modalService, setModalService] = useState<Service | null | "new">(null);
  const [deleteService, setDeleteService] = useState<Service | null>(null);
  const [modalItem, setModalItem] = useState<PriceListItem | null | "new">(null);
  const [deleteItem, setDeleteItem] = useState<PriceListItem | null>(null);
  const [activeItemCategory, setActiveItemCategory] = useState("all");
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const bookingSlug = user?.businessSlug || "demo";
  const bookingLink = origin ? `${origin}/book/${bookingSlug}` : null;

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => fetch("/api/services").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/services/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setDeleteService(null);
    },
  });

  // ── Price list items ──────────────────────────────────────────
  const { data: allItems = [], isLoading: itemsLoading } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items-admin"],
    queryFn: () => fetch("/api/price-list-items?includeInactive=true").then((r) => r.json()),
    enabled: activeTab === "items",
  });

  const itemCategories = useMemo(() => {
    const cats = [...new Set(allItems.map((i) => i.category).filter(Boolean) as string[])].sort();
    return cats;
  }, [allItems]);

  const filteredItems = activeItemCategory === "all"
    ? allItems
    : allItems.filter((i) => i.category === activeItemCategory);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/price-list-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-list-items-admin"] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-list-items/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items-admin"] });
      setDeleteItem(null);
    },
  });

  const filtered =
    activeCategory === "all"
      ? services
      : services.filter((s) => s.type === activeCategory);

  const activeCount = services.filter((s) => s.isActive).length;
  const onlineCount = services.filter((s) => s.isPublicBookable).length;

  const categories = [
    { id: "all", label: "הכל" },
    ...SERVICE_TYPES.filter((t) => services.some((s) => s.type === t.id)),
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Tag className="w-6 h-6 text-brand-500" />
            מחירון
          </h1>
          <p className="text-sm text-petra-muted mt-0.5">
            ניהול שירותים, פריטי חיוב ומחירים
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "services" && (
            <>
              <div className="hidden sm:flex items-center gap-4 text-sm text-petra-muted">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {activeCount} פעילים
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4 text-blue-500" />
                  {onlineCount} אונליין
                </span>
              </div>
              <button
                onClick={() => setModalService("new")}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                הוסף שירות
              </button>
            </>
          )}
          {activeTab === "items" && (
            <button
              onClick={() => setModalItem("new")}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף פריט
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("services")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "services"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          שירותים
          <span className="mr-1.5 text-xs text-petra-muted">{services.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("items")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "items"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          פריטי חיוב
          {allItems.length > 0 && (
            <span className="mr-1.5 text-xs text-petra-muted">{allItems.length}</span>
          )}
        </button>
      </div>

      {/* ── Services tab ───────────────────────────────────────── */}
      {activeTab === "services" && (
        <>
          {/* Category filter */}
          {categories.length > 1 && (
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat.label}
                  {cat.id !== "all" && (
                    <span className="mr-1.5 text-xs text-petra-muted">
                      {services.filter((s) => s.type === cat.id).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Services grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 h-40 animate-pulse bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-20">
              <div className="empty-state-icon">
                <Tag className="w-8 h-8" />
              </div>
              <p className="font-medium text-slate-700 mt-3">
                {activeCategory === "all" ? "אין שירותים עדיין" : "אין שירותים בקטגוריה זו"}
              </p>
              {activeCategory === "all" && (
                <button
                  onClick={() => setModalService("new")}
                  className="btn-primary mt-4 flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  הוסף שירות
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onEdit={() => setModalService(service)}
                  onDelete={() => setDeleteService(service)}
                  bookingLink={bookingLink}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Price List Items tab ────────────────────────────────── */}
      {activeTab === "items" && (
        <>
          {/* Category filter */}
          {itemCategories.length > 0 && (
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
              {["all", ...itemCategories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveItemCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeItemCategory === cat
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat === "all" ? "הכל" : cat}
                  {cat !== "all" && (
                    <span className="mr-1.5 text-xs text-petra-muted">
                      {allItems.filter((i) => i.category === cat).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Items grid */}
          {itemsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 h-32 animate-pulse bg-slate-100" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state py-20">
              <div className="empty-state-icon">
                <Package className="w-8 h-8" />
              </div>
              <p className="font-medium text-slate-700 mt-3">
                {activeItemCategory === "all" ? "אין פריטים במחירון" : "אין פריטים בקטגוריה זו"}
              </p>
              {activeItemCategory === "all" && (
                <>
                  <p className="text-sm text-petra-muted mt-1">
                    פריטי חיוב משמשים לבקשות תשלום והזמנות
                  </p>
                  <button
                    onClick={() => setModalItem("new")}
                    className="btn-primary mt-4 flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    הוסף פריט
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <PriceListItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => setModalItem(item)}
                  onDelete={() => setDeleteItem(item)}
                  onToggleActive={() =>
                    toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {modalService !== null && (
        <ServiceModal
          service={modalService === "new" ? null : modalService}
          onClose={() => setModalService(null)}
        />
      )}

      {deleteService && (
        <DeleteConfirmModal
          service={deleteService}
          onConfirm={() => deleteMutation.mutate(deleteService.id)}
          onClose={() => setDeleteService(null)}
        />
      )}

      {modalItem !== null && (
        <PriceListItemModal
          item={modalItem === "new" ? null : modalItem}
          onClose={() => setModalItem(null)}
        />
      )}

      {deleteItem && (
        <DeleteItemConfirmModal
          item={deleteItem}
          onConfirm={() => deleteItemMutation.mutate(deleteItem.id)}
          onClose={() => setDeleteItem(null)}
        />
      )}
    </div>
  );
}
