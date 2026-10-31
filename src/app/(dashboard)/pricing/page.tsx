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
  Clock, Package, Tag, Sparkles, ChevronUp, ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatCurrency, currencySymbol } from "@/lib/format";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { getMaxPriceItems } from "@/lib/feature-flags";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";

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

const UNITS: { id: string }[] = [
  { id: "per_session" },
  { id: "per_day" },
  { id: "per_night" },
  { id: "per_hour" },
  { id: "per_item" },
  { id: "fixed" },
];

const TAX_MODES = ["taxable", "exempt", "inherit", "inclusive", "exclusive"];

// These 4 main categories are used by the order modal to filter items
const CATEGORIES = ["פנסיון", "אילוף", "טיפוח", "מוצרים"]; // i18n-ok — stored category values (DB data)

// Display label key per stored category value (the values themselves stay Hebrew data)
const CATEGORY_KEY: Record<string, string> = {
  "פנסיון": "boarding", // i18n-ok
  "אילוף": "training", // i18n-ok
  "טיפוח": "grooming", // i18n-ok
  "מוצרים": "products", // i18n-ok
  "כללי": "general", // i18n-ok
};

// Fallback group for items without a category (internal grouping key)
const GENERAL_CATEGORY = "כללי"; // i18n-ok

type PricingT = ReturnType<typeof useTranslations<"pricing">>;

function categoryLabel(t: PricingT, cat: string): string {
  const key = CATEGORY_KEY[cat];
  return key ? t(`pricingPage.categories.${key}`) : cat;
}

function unitLabel(t: PricingT, unit: string): string {
  return t.has(`pricingPage.units.${unit}`) ? t(`pricingPage.units.${unit}`) : unit;
}

function taxLabel(t: PricingT, mode: string): string | undefined {
  return TAX_MODES.includes(mode) ? t(`pricingPage.taxModes.${mode}`) : undefined;
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
  maxBookingsPerDay: string;
  sessions: string;
}

function ItemModal({
  item,
  onClose,
  onSave,
  isSaving,
  isVatExempt,
}: {
  item?: PriceListItem | null;
  onClose: () => void;
  onSave: (data: ItemFormData) => void;
  isSaving: boolean;
  isVatExempt?: boolean;
}) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const isEdit = Boolean(item);
  const [form, setForm] = useState<ItemFormData>({
    name: item?.name ?? "",
    type: item?.type ?? "service",
    category: item?.category ?? "",
    unit: item?.unit ?? "per_session",
    basePrice: item?.basePrice?.toString() ?? "",
    description: item?.description ?? "",
    taxMode: isVatExempt ? "exempt" : (item?.taxMode ?? "taxable"),
    durationMinutes: item?.durationMinutes?.toString() ?? "",
    paymentUrl: item?.paymentUrl ?? "",
    isBookableOnline: item?.isBookableOnline ?? false,
    depositRequired: item?.depositRequired ?? false,
    depositAmount: item?.depositAmount?.toString() ?? "",
    maxBookingsPerDay: item?.maxBookingsPerDay?.toString() ?? "",
    sessions: item?.sessions?.toString() ?? "",
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">
            {isEdit ? t("pricingPage.modal.editTitle") : t("pricingPage.modal.newTitle")}
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
            {(["service", "product"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, type })}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2",
                  form.type === type
                    ? "border-brand-400 bg-brand-50 text-brand-600"
                    : "border-petra-border text-petra-muted hover:bg-slate-50"
                )}
              >
                {type === "service" ? (
                  <><Clock className="w-3.5 h-3.5" /> {t("pricingPage.modal.typeService")}</>
                ) : (
                  <><Package className="w-3.5 h-3.5" /> {t("pricingPage.modal.typeProduct")}</>
                )}
              </button>
            ))}
          </div>

          <div>
            <label className="label">{t("pricingPage.modal.nameLabel")}</label>
            <input
              className="input mt-1"
              placeholder={t("pricingPage.modal.namePlaceholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("pricingPage.modal.categoryLabel")}</label>
              <select
                className="input mt-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                <option value="">{t("pricingPage.modal.categoryPlaceholder")}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("pricingPage.modal.unitLabel")}</label>
              <select
                className="input mt-1"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>{unitLabel(t, u.id)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("pricingPage.modal.priceLabel", { currency: currencySymbol({ locale, currency }) })}</label>
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
            {!isVatExempt && (
              <div>
                <label className="label">{t("pricingPage.modal.vatLabel")}</label>
                <select
                  className="input mt-1"
                  value={form.taxMode}
                  onChange={(e) => setForm({ ...form, taxMode: e.target.value })}
                >
                  <option value="taxable">{t("pricingPage.taxModes.taxable")}</option>
                  <option value="exempt">{t("pricingPage.taxModes.exempt")}</option>
                  <option value="inherit">{t("pricingPage.taxModes.inherit")}</option>
                </select>
              </div>
            )}
          </div>

          {form.type === "service" && (
            <div>
              <label className="label">{t("pricingPage.modal.durationLabel")}</label>
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
          {form.category === "אילוף" && ( // i18n-ok — stored category value
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                {t("pricingPage.modal.trainingPackageTitle")}
              </p>
              <div>
                <label className="label text-[11px]">{t("pricingPage.modal.sessionsLabel")}</label>
                <input
                  className="input mt-1"
                  type="number"
                  min="1"
                  max="100"
                  placeholder={t("pricingPage.modal.sessionsPlaceholder")}
                  value={form.sessions}
                  onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                  dir="ltr"
                />
              </div>
              <p className="text-[11px] text-blue-600">
                {t("pricingPage.modal.sessionsHint")}
              </p>
            </div>
          )}

          <div>
            <label className="label">{t("pricingPage.modal.descriptionLabel")}</label>
            <textarea
              className="input mt-1 resize-none"
              rows={2}
              placeholder={t("pricingPage.modal.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* ── קישור תשלום ── */}
          <div className="rounded-xl border border-petra-border p-4 space-y-3 bg-slate-50/50">
            <p className="text-xs font-semibold text-petra-text flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-brand-500" />
              {t("pricingPage.modal.paymentUrlTitle")}
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
              {t("pricingPage.modal.paymentUrlHint")}
            </p>
          </div>

          {/* ── תור אונליין ── */}
          <div className="rounded-xl border border-petra-border p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-petra-text flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-brand-500" />
                {t("pricingPage.bookableOnline")}
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
                  form.isBookableOnline ? "-translate-x-4 ltr:translate-x-4" : "-translate-x-1 ltr:translate-x-1"
                )} />
              </button>
            </div>

            {form.isBookableOnline && (
              <>
                <p className="text-[11px] text-petra-muted">
                  {t("pricingPage.modal.bookableOnlineHint")}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-petra-text">{t("pricingPage.modal.depositRequired")}</p>
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
                      form.depositRequired ? "-translate-x-4 ltr:translate-x-4" : "-translate-x-1 ltr:translate-x-1"
                    )} />
                  </button>
                </div>
                {form.depositRequired && (
                  <div>
                    <label className="label">{t("pricingPage.modal.depositAmountLabel", { currency: currencySymbol({ locale, currency }) })}</label>
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
                  <label className="label">{t("pricingPage.modal.maxBookingsLabel")}</label>
                  <input
                    className="input mt-1 bg-white"
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("pricingPage.modal.maxBookingsPlaceholder")}
                    value={form.maxBookingsPerDay}
                    onChange={(e) => setForm({ ...form, maxBookingsPerDay: e.target.value })}
                    dir="ltr"
                  />
                  <p className="text-[11px] text-petra-muted mt-1">{t("pricingPage.modal.maxBookingsHint")}</p>
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
              {isEdit ? t("pricingPage.modal.saveChanges") : t("pricingPage.addItem")}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              {tc("actions.cancel")}
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
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isVatExempt,
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
  isVatExempt?: boolean;
  /** No PRICING_WRITE — hide all mutation buttons (server returns 403 anyway) */
  readOnly?: boolean;
}) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
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
                <Clock className="w-2.5 h-2.5" />{t("pricingPage.row.minutesShort", { count: item.durationMinutes })}
              </span>
            ) : null}
            {item.sessions ? (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                <Package className="w-2.5 h-2.5" />{t("pricingPage.row.sessions", { count: item.sessions })}
              </span>
            ) : null}
          </div>
          {item.description && (
            <p className="text-xs text-petra-muted truncate mt-0.5">{item.description}</p>
          )}
        </div>

        {/* Price — always top-right */}
        <div className="text-end flex-shrink-0">
          <p className="text-sm font-bold text-petra-text">{formatCurrency(item.basePrice, { locale, currency })}</p>
          {!isVatExempt && item.taxMode && item.taxMode !== "inherit" && (
            <p className="text-[10px] text-petra-muted">{taxLabel(t, item.taxMode)}</p>
          )}
        </div>
      </div>

      {/* Bottom row: unit + badges + action buttons */}
      <div className="flex items-center gap-1 mt-1.5 ps-9">
        <p className="text-[10px] text-petra-muted flex-shrink-0">{unitLabel(t, item.unit)}</p>

        {item.isBookableOnline && (
          <span
            title={t("pricingPage.bookableOnline")}
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
            title={t("pricingPage.row.paymentPage")}
            className="w-5 h-5 rounded-md flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <CreditCard className="w-3 h-3" />
          </a>
        )}

        {/* Push action buttons to the left */}
        <div className="flex-1" />

        {!readOnly && (
        <div className="flex items-center gap-0.5">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title={t("pricingPage.row.moveUp")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title={t("pricingPage.row.moveDown")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            title={t("pricingPage.row.edit")}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title={t("pricingPage.row.duplicate")}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title={item.isActive ? t("pricingPage.row.deactivate") : t("pricingPage.row.activate")}
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
            title={tc("actions.delete")}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

function PricingPageContent() {
  const t = useTranslations("pricing");
  const tcPage = useTranslations("common");
  const { currency } = useBusinessLocale();
  const { isFree, tier } = usePlan();
  const { canEditPricing } = usePermissions();
  const maxPriceItems = getMaxPriceItems(tier);
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<PriceListItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PriceListItem | null>(null);

  const { data: settings } = useQuery<{ legalEntityType: string | null }>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const isVatExempt = settings?.legalEntityType === "עוסק פטור"; // i18n-ok — DB value

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
        body: JSON.stringify({ name: t("pricingPage.defaultListName"), currency }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || t("pricingPage.errors.create"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success(t("pricingPage.toasts.listCreated"));
    },
    onError: () => toast.error(t("pricingPage.toasts.listCreateError")),
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
        if (!r.ok) throw new Error(d.error || t("pricingPage.errors.add"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
      setShowAddItem(false);
      toast.success(t("pricingPage.toasts.itemAdded"));
    },
    onError: () => toast.error(t("pricingPage.toasts.itemAddError")),
  });

  const editMutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      fetch(`/api/price-list-items/${editItem!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildItemPayload(data)),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || t("pricingPage.errors.update"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
      setEditItem(null);
      toast.success(t("pricingPage.toasts.itemUpdated"));
    },
    onError: () => toast.error(t("pricingPage.toasts.itemUpdateError")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/price-list-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || t("pricingPage.errors.update"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
    },
    onError: () => toast.error(t("pricingPage.toasts.toggleError")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (item: PriceListItem) =>
      fetch(`/api/price-lists/${priceList!.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t("pricingPage.copyName", { name: item.name }),
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
        if (!r.ok) throw new Error(d.error || t("pricingPage.errors.duplicate"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success(t("pricingPage.toasts.itemDuplicated"));
    },
    onError: () => toast.error(t("pricingPage.toasts.duplicateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/price-list-items/${id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || t("pricingPage.errors.delete"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
      setDeleteItem(null);
      toast.success(t("pricingPage.toasts.itemDeleted"));
    },
    onError: () => toast.error(t("pricingPage.toasts.deleteError")),
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
        if (!r.ok) throw new Error(t("pricingPage.errors.reorder"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-list-items", priceList?.id] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["price-list-items-all-active"] });
    },
    onError: () => toast.error(t("pricingPage.toasts.reorderError")),
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

  // Group active items by category (preserve CATEGORIES order)
  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);

  const grouped: Record<string, PriceListItem[]> = {};
  activeItems.forEach((item) => {
    const cat = item.category || GENERAL_CATEGORY;
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
          <h1 className="page-title">{t("pricingPage.title")}</h1>
          <p className="text-sm text-petra-muted mt-1 hidden sm:block">
            {t("pricingPage.subtitle")}
          </p>
        </div>
        {priceList && canEditPricing && (
          isFree && maxPriceItems !== null && activeItems.length >= maxPriceItems ? (
            <a href="/upgrade" className="btn-primary gap-2 bg-amber-500 hover:bg-amber-600 border-amber-500">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">{t("pricingPage.upgradeToBasic")}</span>
              <span className="sm:hidden">{t("pricingPage.upgrade")}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="btn-primary gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("pricingPage.addItem")}</span>
              <span className="sm:hidden">{tcPage("actions.add")}</span>
            </button>
          )
        )}
      </div>

      {/* VAT exempt banner */}
      {isVatExempt && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <span className="font-semibold">{t("pricingPage.vatExempt.title")}</span>
          <span className="text-emerald-600">{t("pricingPage.vatExempt.body")}</span>
        </div>
      )}

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
              {t("pricingPage.freeLimit.banner", { used: activeItems.length, max: maxPriceItems })}
            </span>
          </div>
          {activeItems.length >= maxPriceItems && (
            <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              {t("pricingPage.freeLimit.upgradeLink")}
            </a>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <PetraLoader />
      ) : !priceList ? (
        /* No price list exists — offer to create one */
        <div className="empty-state py-20">
          <div className="empty-state-icon">
            <Tag className="w-10 h-10" />
          </div>
          <p className="text-petra-text font-semibold mt-3">{t("pricingPage.emptyList.title")}</p>
          <p className="text-sm text-petra-muted mt-1 max-w-xs text-center">
            {t("pricingPage.emptyList.body")}
          </p>
          {canEditPricing && (
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
            {t("pricingPage.emptyList.create")}
          </button>
          )}
        </div>
      ) : items.length === 0 ? (
        /* Price list exists but no items */
        <div className="card">
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <PackageOpen className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-petra-text mt-2">{t("pricingPage.emptyItems.title")}</p>
            <p className="text-xs text-petra-muted mt-1 max-w-xs text-center">
              {t("pricingPage.emptyItems.body")}
            </p>
            {canEditPricing && (
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              className="btn-primary mt-4 text-sm gap-2"
            >
              <Plus className="w-4 h-4" />
              {t("pricingPage.emptyItems.addFirst")}
            </button>
            )}
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
                    {categoryLabel(t, cat)}
                  </span>
                  <span className="text-xs text-slate-400">({grouped[cat].length})</span>
                </div>
              </div>
              {grouped[cat].map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isVatExempt={isVatExempt}
                  readOnly={!canEditPricing}
                  onEdit={() => setEditItem(item)}
                  onDuplicate={() => duplicateMutation.mutate(item)}
                  onToggle={() =>
                    toggleMutation.mutate({ id: item.id, isActive: !item.isActive })
                  }
                  onDelete={() => setDeleteItem(item)}
                  onMoveUp={() => moveItem(grouped[cat], idx, -1)}
                  onMoveDown={() => moveItem(grouped[cat], idx, 1)}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < grouped[cat].length - 1}
                />
              ))}
            </div>
          ))}

          {/* Inactive items section */}
          {inactiveItems.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50/80 border-b border-petra-border">
                <span className="text-xs font-semibold text-petra-muted uppercase tracking-wider">
                  {t("pricingPage.inactive")}
                </span>
                <span className="text-xs text-slate-400 ms-2">({inactiveItems.length})</span>
              </div>
              {inactiveItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isVatExempt={isVatExempt}
                  readOnly={!canEditPricing}
                  onEdit={() => setEditItem(item)}
                  onDuplicate={() => duplicateMutation.mutate(item)}
                  onToggle={() =>
                    toggleMutation.mutate({ id: item.id, isActive: !item.isActive })
                  }
                  onDelete={() => setDeleteItem(item)}
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
          isVatExempt={isVatExempt}
        />
      )}

      {/* Edit item modal */}
      {editItem && (
        <ItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => editMutation.mutate(data)}
          isSaving={editMutation.isPending}
          isVatExempt={isVatExempt}
        />
      )}

      {/* Delete item confirm dialog */}
      {deleteItem && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteItem(null)} />
          <div className="modal-content max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-petra-text mb-1">
              {t("pricingPage.deleteDialog.title", { name: deleteItem.name })}
            </h3>
            <p className="text-sm text-petra-muted mb-4">{t("pricingPage.deleteDialog.body")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deleteItem.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? tcPage("progress.deleting") : t("pricingPage.deleteDialog.confirm")}
              </button>
              <button onClick={() => setDeleteItem(null)} className="btn-secondary flex-1">
                {t("pricingPage.deleteDialog.back")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  const t = useTranslations("pricing");
  return (
    <TierGate
      feature="pricing"
      title={t("pricingPage.tierGate.title")}
      description={t("pricingPage.tierGate.description")}
    >
      <PricingPageContent />
    </TierGate>
  );
}
