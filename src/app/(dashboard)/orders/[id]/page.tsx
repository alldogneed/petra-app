"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { canCancelOrder } from "@/lib/order-cancel";
import { PaymentRequestDialog } from "@/components/orders/PaymentRequestDialog";
import {
  ArrowRight, CheckCircle2, Clock, XCircle, ShoppingCart,
  Trash2, User, FileText, Calendar, Tag, CreditCard, Plus, Send, GraduationCap,
  Pencil, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatDate, currencySymbol } from "@/lib/format";

interface OrderLine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  taxMode: string;
  priceListItemId: string | null;
}

interface OrderPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  isDeposit: boolean;
  cardLast4: string | null;
  cardType: string | null;
  checkNumber: string | null;
  checkBank: string | null;
  checkBranch: string | null;
  checkDate: string | null;
}

interface Order {
  id: string;
  status: string;
  orderType: string;
  startAt: string | null;
  endAt: string | null;
  subtotal: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string; email: string | null };
  lines: OrderLine[];
  payments: OrderPayment[];
}

// Labels: orders.ordersDetailPage.status.<key>
const STATUS_MAP: Record<string, { color: string; icon: React.ElementType }> = {
  draft:     { color: "bg-slate-100 text-slate-600 border-transparent",    icon: Clock },
  confirmed: { color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  completed: { color: "bg-blue-50 text-blue-700 border-blue-100",          icon: CheckCircle2 },
  cancelled: { color: "bg-red-50 text-red-600 border-red-100",             icon: XCircle },
};

// Labels: orders.ordersDetailPage.methods.<key> (order = select option order)
const METHOD_KEYS = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"] as const;

/** Translator scoped to `orders.ordersDetailPage`. */
interface DetailT {
  (key: string): string;
  has(key: string): boolean;
}

/** Known label key → translated label; unknown API value → the raw value. */
function labelOr(t: DetailT, group: "orderTypes" | "units" | "methods", value: string): string {
  const key = `${group}.${value}`;
  return t.has(key) ? t(key) : value;
}

/** "₪12.50" — symbol from the business currency (identical for ILS). */
function useMoney() {
  const { locale, currency } = useBusinessLocale();
  const sym = currencySymbol({ locale, currency });
  return (n: number) => `${sym}${n.toFixed(2)}`;
}

// Editable line shape for the draft-order lines editor (string fields for inputs)
interface EditableLine {
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  taxMode: string;
  priceListItemId: string | null;
}

// ── Add Payment Modal ──────────────────────────────────────────────────────────

function AddPaymentModal({
  orderId,
  customerId,
  defaultAmount,
  onClose,
  onSaved,
}: {
  orderId: string;
  customerId: string;
  defaultAmount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("orders.ordersDetailPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount.toFixed(2)) : "");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [isDeposit, setIsDeposit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cardLast4, setCardLast4] = useState("");
  const [cardType, setCardType] = useState("visa");
  const [checkNumber, setCheckNumber] = useState("");
  const [checkBank, setCheckBank] = useState("");
  const [checkBranch, setCheckBranch] = useState("");
  const [checkDate, setCheckDate] = useState("");

  async function save() {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error(t("addPayment.invalidAmount")); return; }
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parsed, method, status: "paid", customerId, orderId,
        notes: notes || null, isDeposit,
        cardLast4: method === "credit_card" ? (cardLast4 || null) : null,
        cardType: method === "credit_card" ? cardType : null,
        checkNumber: method === "check" ? (checkNumber || null) : null,
        checkBank: method === "check" ? (checkBank || null) : null,
        checkBranch: method === "check" ? (checkBranch || null) : null,
        checkDate: method === "check" ? (checkDate || null) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error(t("addPayment.saveError")); return; }
    toast.success(t("addPayment.saved"));
    onSaved();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6">
        <h3 className="text-base font-bold text-petra-text mb-4">{t("addPayment.title")}</h3>
        <div className="space-y-4">
          <div>
            <label className="label">{t("addPayment.amountLabel", { currency: currencySymbol({ locale, currency }) })}</label>
            <input type="number" min="0" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">{t("addPayment.methodLabel")}</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHOD_KEYS.map((v) => (
                <option key={v} value={v}>{t(`methods.${v}`)}</option>
              ))}
            </select>
          </div>
          {method === "credit_card" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("addPayment.cardLast4")}</label>
                <input type="text" inputMode="numeric" maxLength={4} placeholder="1234" className="input"
                  value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div>
                <label className="label">{t("addPayment.cardType")}</label>
                <select className="input" value={cardType} onChange={(e) => setCardType(e.target.value)}>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="diners">Diners</option>
                  <option value="isracard">Isracard</option>
                  <option value="other">{t("addPayment.cardTypeOther")}</option>
                </select>
              </div>
            </div>
          )}
          {method === "check" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("addPayment.checkNumber")}</label>
                <input type="text" placeholder="12345" className="input" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("addPayment.checkDate")}</label>
                <input type="date" className="input" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("addPayment.checkBank")}</label>
                <input type="text" placeholder={t("addPayment.checkBankPlaceholder")} className="input" value={checkBank} onChange={(e) => setCheckBank(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("addPayment.checkBranch")}</label>
                <input type="text" placeholder="900" className="input" value={checkBranch} onChange={(e) => setCheckBranch(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label className="label">{t("addPayment.notesLabel")}</label>
            <input type="text" className="input" placeholder={t("addPayment.notesPlaceholder")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="isDeposit" checked={isDeposit} onChange={(e) => setIsDeposit(e.target.checked)}
              className="w-4 h-4 rounded accent-petra-primary cursor-pointer" />
            <label htmlFor="isDeposit" className="text-sm text-petra-text cursor-pointer">{t("addPayment.markDeposit")}</label>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? tc("progress.saving") : t("addPayment.submit")}</button>
          <button className="btn-secondary flex-1" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const orderId = params.id as string;
  const t = useTranslations("orders.ordersDetailPage");
  const tc = useTranslations("common");
  const { locale, currency, timezone } = useBusinessLocale();
  const fmt = useMoney();
  // false = closed; "cancel" = cancel the order; "delete" = delete a cancelled order
  const [confirmCancel, setConfirmCancel] = useState<false | "cancel" | "delete">(false);
  // ?pay=1 (from the orders-list "רשום תשלום" button) opens the payment modal
  const searchParams = useSearchParams();
  const [showAddPayment, setShowAddPayment] = useState(searchParams.get("pay") === "1");
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);
  const [cancelPayment, setCancelPayment] = useState<OrderPayment | null>(null);
  // Draft-order lines editor state
  const [editingLines, setEditingLines] = useState(false);
  const [editLines, setEditLines] = useState<EditableLine[]>([]);
  const [editDiscountType, setEditDiscountType] = useState("none");
  const [editDiscountValue, setEditDiscountValue] = useState("");

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: () => fetch(`/api/orders/${orderId}`).then((r) => r.json()),
    staleTime: 30_000,
  });



  useEffect(() => {
    if (order) {
      document.title = t("documentTitle", { id: order.id.slice(-8).toUpperCase(), name: order.customer.name });
    }
  }, [order, t]);

  const confirmMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", orderId] }); toast.success(t("toasts.completed")); },
  });

  const deleteCancelledMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/orders/${orderId}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.delete")); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("toasts.deleted"));
      router.push("/orders");
    },
    onError: (err: Error) => toast.error(err.message || t("errors.deleteOrder")),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (order?.status === "draft") {
        // Draft → delete entirely
        const r = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || t("errors.delete"));
        return d;
      }
      // Confirmed/other → cancel via PATCH
      const r = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("errors.cancel"));
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (order?.status === "draft") {
        router.push("/orders");
      } else {
        qc.invalidateQueries({ queryKey: ["order", orderId] });
      }
    },
  });

  // Draft-only: replace lines + discount; totals recalculated server-side
  const saveLinesMutation = useMutation({
    mutationFn: (payload: { lines: Array<{ name: string; unit: string; quantity: number; unitPrice: number; taxMode: string; priceListItemId: string | null }>; discountType: string; discountValue: number }) =>
      fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.saveLines")); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setEditingLines(false);
      toast.success(t("toasts.linesUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.saveLines")),
  });

  // Void a payment (status → canceled) via the payments PATCH API
  const cancelPaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled" }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.cancelPayment")); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      setCancelPayment(null);
      toast.success(t("toasts.paymentCanceled"));
    },
    onError: (err: Error) => toast.error(err.message || t("errors.cancelPayment")),
  });

  function startEditLines() {
    if (!order) return;
    setEditLines(order.lines.map((l) => ({
      name: l.name,
      unit: l.unit,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
      taxMode: l.taxMode || "taxable",
      priceListItemId: l.priceListItemId,
    })));
    setEditDiscountType(order.discountType || "none");
    setEditDiscountValue(order.discountValue ? String(order.discountValue) : "");
    setEditingLines(true);
  }

  function updateEditLine(i: number, field: keyof EditableLine, value: string) {
    setEditLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  function saveEditLines() {
    const parsed = editLines.map((l) => ({
      name: l.name.trim(),
      unit: l.unit,
      quantity: parseFloat(l.quantity),
      unitPrice: parseFloat(l.unitPrice),
      taxMode: l.taxMode,
      priceListItemId: l.priceListItemId,
    }));
    if (parsed.length === 0) { toast.error(t("validation.atLeastOneLine")); return; }
    for (let i = 0; i < parsed.length; i++) {
      const l = parsed[i];
      if (!l.name) { toast.error(t("validation.lineNameRequired", { row: i + 1 })); return; }
      if (!l.quantity || l.quantity <= 0 || isNaN(l.quantity)) { toast.error(t("validation.lineQuantityInvalid", { row: i + 1 })); return; }
      if (isNaN(l.unitPrice) || l.unitPrice < 0) { toast.error(t("validation.linePriceInvalid", { row: i + 1 })); return; }
    }
    const discountValue = editDiscountType === "none" ? 0 : parseFloat(editDiscountValue) || 0;
    if (discountValue < 0) { toast.error(t("validation.discountInvalid")); return; }
    saveLinesMutation.mutate({ lines: parsed, discountType: editDiscountType, discountValue });
  }

  if (isLoading) {
    return <PetraLoader />;
  }

  if (!order || (order as { error?: string }).error) {
    return (
      <div className="py-20 text-center">
        <p className="text-petra-muted">{t("notFound")}</p>
        <Link href="/orders" className="text-brand-600 text-sm hover:underline mt-2 inline-block">{t("backToList")}</Link>
      </div>
    );
  }

  const statusKey = STATUS_MAP[order.status] ? order.status : "draft";
  const s = STATUS_MAP[statusKey];
  const StatusIcon = s.icon;

  return (
    <div className="space-y-5 animate-fade-in">
      {showPaymentRequest && <PaymentRequestDialog order={order} onClose={() => setShowPaymentRequest(false)} />}
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/orders" className="text-petra-muted hover:text-brand-600 transition-colors">{t("breadcrumb")}</Link>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 rotate-180 ltr:-scale-x-100" />
        <span className="text-petra-text font-medium">#{orderId.slice(-8).toUpperCase()}</span>
      </div>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-petra-text">
                  {t("title", { id: orderId.slice(-8).toUpperCase() })}
                </h1>
                <span className={cn("inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border", s.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {t(`status.${statusKey}`)}
                </span>
                <span className="text-xs text-petra-muted bg-slate-100 px-2 py-1 rounded-lg">
                  {labelOr(t, "orderTypes", order.orderType)}
                </span>
              </div>
              <p className="text-sm text-petra-muted mt-0.5">
                {t("createdAt", { date: formatDate(order.createdAt, { locale, style: "long" }) })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {order.status === "draft" && (
              <>
                <button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending || order.lines.length === 0}
                  className="btn-primary text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t("actions.confirmOrder")}
                </button>
                <button
                  onClick={() => setConfirmCancel("cancel")}
                  className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  {tc("actions.cancel")}
                </button>
              </>
            )}
            {order.status === "confirmed" && (
              <>
                <button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="btn-primary text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t("actions.markCompleted")}
                </button>
                <button
                  onClick={() => setConfirmCancel("cancel")}
                  className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200"
                >
                  <XCircle className="w-4 h-4" />
                  {t("actions.cancelOrder")}
                </button>
              </>
            )}
            {(order.status === "completed" || order.status === "in_progress") &&
              canCancelOrder(order.status, (order.payments ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)) && (
              <button
                onClick={() => setConfirmCancel("cancel")}
                className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200"
                title={t("actions.cancelUnpaidTitle")}
              >
                <XCircle className="w-4 h-4" />
                {t("actions.cancelOrder")}
              </button>
            )}
            {order.status === "cancelled" && (
              <button
                onClick={() => setConfirmCancel("delete")}
                disabled={deleteCancelledMutation.isPending}
                className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                {deleteCancelledMutation.isPending ? tc("progress.deleting") : t("actions.deleteOrder")}
              </button>
            )}
          </div>
        </div>

        {/* Customer + dates */}
        <div className="mt-4 pt-4 border-t border-petra-border grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> {t("info.customer")}
            </p>
            <Link
              href={`/customers/${order.customer.id}`}
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              {order.customer.name}
            </Link>
            <p className="text-xs text-petra-muted" dir="ltr">{order.customer.phone}</p>
          </div>
          {order.startAt && (
            <div>
              <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t("info.startDate")}
              </p>
              <p className="text-sm font-medium text-petra-text">
                {new Date(order.startAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone })}
              </p>
            </div>
          )}
          {order.endAt && (
            <div>
              <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t("info.endDate")}
              </p>
              <p className="text-sm font-medium text-petra-text">
                {new Date(order.endAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone })}
              </p>
            </div>
          )}
          {order.notes && (
            <div>
              <p className="text-xs text-petra-muted mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> {t("info.notes")}
              </p>
              <p className="text-sm text-petra-text">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Training link */}
      {order.orderType === "training" && (
        <Link
          href="/training"
          className="card p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-petra-text">{t("training.open")}</p>
            <p className="text-xs text-petra-muted">{t("training.description")}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-petra-muted group-hover:text-brand-500 transition-colors rotate-180 ltr:-scale-x-100" />
        </Link>
      )}

      {/* Lines table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-petra-border bg-slate-50/60 flex items-center justify-between">
          <h2 className="font-semibold text-petra-text text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-500" />
            {t("lines.title")}
            <span className="text-xs font-normal text-petra-muted bg-slate-100 px-1.5 py-0.5 rounded-md">{order.lines.length}</span>
          </h2>
          {order.status === "draft" && !editingLines && (
            <button
              className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
              onClick={startEditLines}
            >
              <Pencil className="w-3.5 h-3.5" />
              {t("lines.edit")}
            </button>
          )}
        </div>

        {editingLines ? (
          <div className="p-5 space-y-3">
            {/* Editable line rows */}
            <div className="space-y-2">
              {editLines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_32px] sm:grid-cols-[1fr_70px_100px_32px] gap-2 items-center">
                  <input
                    className="input text-sm col-span-3 sm:col-span-1"
                    placeholder={t("lines.namePlaceholder")}
                    value={line.name}
                    onChange={(e) => updateEditLine(i, "name", e.target.value)}
                  />
                  <input
                    className="input text-sm text-center"
                    type="number"
                    min="0"
                    step="1"
                    placeholder={t("lines.quantityPlaceholder")}
                    value={line.quantity}
                    onChange={(e) => updateEditLine(i, "quantity", e.target.value)}
                    dir="ltr"
                  />
                  <input
                    className="input text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("lines.unitPricePlaceholder")}
                    value={line.unitPrice}
                    onChange={(e) => updateEditLine(i, "unitPrice", e.target.value)}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors"
                    onClick={() => setEditLines((prev) => prev.filter((_, idx) => idx !== i))}
                    title={t("lines.removeLine")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1"
              onClick={() => setEditLines((prev) => [...prev, { name: "", unit: "per_item", quantity: "1", unitPrice: "", taxMode: "taxable", priceListItemId: null }])}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("lines.addLine")}
            </button>

            {/* Discount */}
            <div className="flex items-end gap-3 pt-2 border-t border-petra-border">
              <div>
                <label className="label">{t("lines.discount")}</label>
                <select
                  className="input mt-1 text-sm"
                  value={editDiscountType}
                  onChange={(e) => setEditDiscountType(e.target.value)}
                >
                  <option value="none">{t("lines.discountNone")}</option>
                  <option value="percent">{t("lines.discountPercentOption")}</option>
                  <option value="fixed">{t("lines.discountFixedOption", { currency: currencySymbol({ locale, currency }) })}</option>
                </select>
              </div>
              {editDiscountType !== "none" && (
                <div>
                  <label className="label">{editDiscountType === "percent" ? t("lines.discountPercentLabel") : t("lines.discountFixedLabel", { currency: currencySymbol({ locale, currency }) })}</label>
                  <input
                    className="input mt-1 text-sm"
                    type="number"
                    min="0"
                    step={editDiscountType === "percent" ? "1" : "0.01"}
                    max={editDiscountType === "percent" ? "100" : undefined}
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(e.target.value)}
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="btn-primary text-sm flex-1"
                onClick={saveEditLines}
                disabled={saveLinesMutation.isPending}
              >
                {saveLinesMutation.isPending ? tc("progress.saving") : t("lines.saveChanges")}
              </button>
              <button
                className="btn-secondary text-sm flex-1"
                onClick={() => setEditingLines(false)}
                disabled={saveLinesMutation.isPending}
              >
                {tc("actions.cancel")}
              </button>
            </div>
          </div>
        ) : order.lines.length === 0 ? (
          <div className="py-10 text-center text-sm text-petra-muted">{t("lines.empty")}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-petra-border">
                  <th className="table-header-cell">{t("lines.colName")}</th>
                  <th className="table-header-cell hidden sm:table-cell">{t("lines.colUnit")}</th>
                  <th className="table-header-cell">{t("lines.colQuantity")}</th>
                  <th className="table-header-cell">{t("lines.colUnitPrice")}</th>
                  <th className="table-header-cell hidden md:table-cell">{t("lines.colTax")}</th>
                  <th className="table-header-cell">{t("lines.colLineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petra-border">
                {order.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="table-cell font-medium text-petra-text">{line.name}</td>
                    <td className="table-cell hidden sm:table-cell text-xs text-petra-muted">
                      {labelOr(t, "units", line.unit)}
                    </td>
                    <td className="table-cell text-petra-text">{line.quantity}</td>
                    <td className="table-cell text-petra-text" dir="ltr">{fmt(line.unitPrice)}</td>
                    <td className="table-cell hidden md:table-cell text-petra-muted text-xs" dir="ltr">
                      {line.taxMode === "exempt" ? t("lines.taxExempt") : fmt(line.lineTax)}
                    </td>
                    <td className="table-cell font-bold text-petra-text" dir="ltr">{fmt(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Totals footer */}
            <div className="border-t border-petra-border px-5 py-4 space-y-1.5 bg-slate-50/40">
              <div className="flex justify-between text-sm text-petra-muted">
                <span>{t("totals.subtotal")}</span>
                <span dir="ltr">{fmt(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>
                    {order.discountType === "percent" ? t("totals.discountPercent", { value: order.discountValue }) : t("totals.discountFixed")}
                  </span>
                  <span dir="ltr">−{fmt(order.discountAmount)}</span>
                </div>
              )}
              {order.taxTotal > 0 && (
                <div className="flex justify-between text-sm text-petra-muted">
                  <span>{t("totals.tax")}</span>
                  <span dir="ltr">{fmt(order.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-petra-text border-t border-petra-border pt-2 mt-2">
                <span>{t("totals.total")}</span>
                <span dir="ltr" className="text-brand-600">{fmt(order.total)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payments section */}
      {(() => {
        const payments = order.payments ?? [];
        const paidTotal = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
        const remaining = order.total - paidTotal;
        const fullyPaid = paidTotal >= order.total;

        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-petra-border bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-petra-text text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-500" />
                {t("payments.title")}
                {fullyPaid ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("payments.fullyPaid")}
                  </span>
                ) : paidTotal > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium bg-amber-50 text-amber-700 border border-amber-100">
                    {t("payments.partiallyPaid")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium bg-red-50 text-red-600 border border-red-100">
                    {t("payments.unpaid")}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {order.status !== "cancelled" && (
                  <button
                    className="text-xs py-1.5 px-3 rounded-xl font-semibold flex items-center gap-1.5 border-2 transition-all disabled:opacity-60"
                    style={{ borderColor: "#25D366", color: "#16a34a", background: "#f0fdf4" }}
                    onClick={() => setShowPaymentRequest(true)}
                    title={t("payments.requestTitle")}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t("payments.request")}
                  </button>
                )}
                {!fullyPaid && order.status !== "cancelled" && (
                  <button
                    className="btn-primary text-xs py-1.5 px-3"
                    onClick={() => setShowAddPayment(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("payments.record")}
                  </button>
                )}
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="py-8 text-center text-sm text-petra-muted">
                {t("payments.empty")}
              </div>
            ) : (
              <div className="divide-y divide-petra-border">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-petra-text">
                        {labelOr(t, "methods", p.method)}
                        {p.method === "credit_card" && p.cardType && (
                          <span className="ms-1 text-xs text-petra-muted capitalize">{p.cardType}{p.cardLast4 ? ` ****${p.cardLast4}` : ""}</span>
                        )}
                        {p.isDeposit && <span className="ms-1.5 text-xs text-petra-muted">{t("payments.deposit")}</span>}
                      </p>
                      {p.method === "check" && (p.checkNumber || p.checkBank || p.checkDate) && (
                        <p className="text-xs text-petra-muted">
                          {[p.checkNumber && t("payments.checkNumber", { number: p.checkNumber }), p.checkBank, p.checkBranch && t("payments.checkBranch", { branch: p.checkBranch }), p.checkDate].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-xs text-petra-muted truncate">{p.notes}</p>
                      )}
                    </div>
                    <div className="text-start flex-shrink-0">
                      <p className="text-sm font-semibold text-petra-text" dir="ltr">{fmt(p.amount)}</p>
                      <p className="text-[11px] text-petra-muted">
                        {p.paidAt ? formatDate(p.paidAt, { locale, style: "long" }) : formatDate(p.createdAt, { locale, style: "long" })}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-lg font-medium border flex-shrink-0",
                      p.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      p.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-red-50 text-red-600 border-red-100"
                    )}>
                      {p.status === "paid" ? t("payments.statusPaid") : p.status === "pending" ? t("payments.statusPending") : t("payments.statusCanceled")}
                    </span>
                    {(p.status === "paid" || p.status === "pending") && (
                      <button
                        type="button"
                        onClick={() => setCancelPayment(p)}
                        className="p-1.5 rounded-lg text-petra-muted hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 flex-shrink-0"
                        title={t("payments.cancelTitle")}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Summary footer */}
            <div className="border-t border-petra-border px-5 py-3 bg-slate-50/40 space-y-1">
              <div className="flex justify-between text-sm text-petra-muted">
                <span>{t("payments.summaryTotal")}</span>
                <span dir="ltr">{fmt(order.total)}</span>
              </div>
              {paidTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-700 font-medium">
                  <span>{t("payments.paid")}</span>
                  <span dir="ltr">{fmt(paidTotal)}</span>
                </div>
              )}
              {remaining > 0.01 && (
                <div className="flex justify-between text-sm font-bold text-red-600 border-t border-petra-border pt-1.5">
                  <span>{t("payments.remaining")}</span>
                  <span dir="ltr">{fmt(remaining)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add payment modal */}
      {showAddPayment && (
        <AddPaymentModal
          orderId={order.id}
          customerId={order.customer.id}
          defaultAmount={Math.max(0, order.total - (order.payments ?? []).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0))}
          onClose={() => setShowAddPayment(false)}
          onSaved={() => {
            setShowAddPayment(false);
            qc.invalidateQueries({ queryKey: ["order", orderId] });
          }}
        />
      )}

      {/* Cancel payment confirm dialog */}
      {cancelPayment && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setCancelPayment(null)} />
          <div className="modal-content max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-petra-text mb-1">{t("cancelPaymentDialog.title")}</h3>
            <p className="text-sm text-petra-muted mb-4">
              {t("cancelPaymentDialog.body", { amount: fmt(cancelPayment.amount) })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => cancelPaymentMutation.mutate(cancelPayment.id)}
                disabled={cancelPaymentMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {cancelPaymentMutation.isPending ? t("cancelPaymentDialog.canceling") : t("cancelPaymentDialog.confirm")}
              </button>
              <button onClick={() => setCancelPayment(null)} className="btn-secondary flex-1">
                {t("cancelPaymentDialog.back")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm dialog */}
      {confirmCancel && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setConfirmCancel(false)} />
          <div className="modal-content max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-petra-text mb-1">
              {confirmCancel === "delete" ? t("cancelDialog.deleteTitle") : t("cancelDialog.cancelTitle")}
            </h3>
            <p className="text-sm text-petra-muted mb-4">
              {confirmCancel === "delete" ? t("cancelDialog.deleteBody") : t("cancelDialog.cancelBody")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (confirmCancel === "delete") deleteCancelledMutation.mutate();
                  else cancelMutation.mutate();
                  setConfirmCancel(false);
                }}
                disabled={cancelMutation.isPending || deleteCancelledMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                {confirmCancel === "delete" ? t("cancelDialog.confirmDelete") : cancelMutation.isPending ? t("cancelDialog.canceling") : t("cancelDialog.confirmCancel")}
              </button>
              <button onClick={() => setConfirmCancel(false)} className="btn-secondary flex-1">
                {t("cancelDialog.back")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
