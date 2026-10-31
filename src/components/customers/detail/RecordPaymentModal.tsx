"use client";

import { useState } from "react";
import { OUTSTANDING_ORDER_STATUSES } from "@/lib/outstanding-balances";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { fetchJSON } from "@/lib/utils";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { formatCurrency as formatCurrencyL, currencySymbol } from "@/lib/format";
import { constantLabel } from "./constants";
import { formatDayDate, type OrderInfo } from "./types";

/** Same allowlist as POST /api/payments (src/app/api/payments/route.ts). */
const METHODS = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"] as const;
type Method = (typeof METHODS)[number];

/** Orders that can still receive a payment. */
// Same statuses the debt calculation counts (src/lib/outstanding-balances.ts) — a completed
// order that was never paid must be selectable, otherwise its payment can't be linked to it.
export const OPEN_ORDER_STATUSES = [...OUTSTANDING_ORDER_STATUSES, "partially_paid"];

function orderRemaining(order: OrderInfo): number {
  const paid = (order.payments || []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  return Math.max(0, Math.round((order.total - paid) * 100) / 100);
}

export function RecordPaymentModal({
  customerId,
  customerName,
  orders,
  defaultAmount,
  onClose,
}: {
  customerId: string;
  customerName: string;
  orders: OrderInfo[];
  /** Prefill (e.g. the outstanding balance). */
  defaultAmount?: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("customers.recordPaymentModal");
  const tc = useTranslations("common");
  const tk = useTranslations("customers.constants");
  const { locale, currency, cfg } = useBusinessLocale();
  const formatCurrency = (n: number) => formatCurrencyL(n, { locale, currency });
  const symbol = currencySymbol({ locale, currency });
  // Open orders that still have something to pay, oldest first.
  const openOrders = orders
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status) && orderRemaining(o) > 0.009)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const [amount, setAmount] = useState(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : "");
  const [method, setMethod] = useState<Method>("cash");
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  // Default: link to the oldest open order, so the payment visibly pays it off
  // (an unlinked payment used to leave the order looking unpaid).
  const [orderId, setOrderId] = useState(openOrders[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [isDeposit, setIsDeposit] = useState(false);
  const [cardLast4, setCardLast4] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJSON("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(status === "paid" ? t("toastPaid") : t("toastPending"));
      onClose();
    },
    onError: (e: Error) => setError(e.message || t("errorGeneric")),
  });

  const submit = () => {
    setError(null);
    const value = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0) return setError(t("errorPositive"));
    if (value > 1_000_000) return setError(t("errorMax", { currencySymbol: symbol }));
    if (method === "credit_card" && cardLast4 && !/^\d{4}$/.test(cardLast4)) return setError(t("errorCardLast4"));
    mutation.mutate({
      amount: value,
      method,
      status,
      customerId,
      ...(orderId ? { orderId } : {}),
      ...(notes.trim() ? { notes: notes.trim().slice(0, 500) } : {}),
      isDeposit,
      ...(method === "credit_card" && cardLast4 ? { cardLast4 } : {}),
      ...(method === "check" && checkNumber.trim() ? { checkNumber: checkNumber.trim().slice(0, 30) } : {}),
    });
  };

  return (
    <div className="modal-overlay" dir={cfg.dir}>
      <div className="modal-backdrop" onClick={() => !mutation.isPending && onClose()} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("title")}</h2>
            <p className="text-xs text-petra-muted">{customerName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" aria-label={tc("actions.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("amountLabel", { currencySymbol: symbol })}</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">{t("method")}</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{constantLabel(tk, "paymentMethods", m) ?? m}</option>
                ))}
              </select>
            </div>
          </div>

          {method === "credit_card" && (
            <div>
              <label className="label">{t("cardLast4")}</label>
              <input className="input" inputMode="numeric" maxLength={4} value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))} dir="ltr" />
            </div>
          )}
          {method === "check" && (
            <div>
              <label className="label">{t("checkNumber")}</label>
              <input className="input" maxLength={30} value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} dir="ltr" />
            </div>
          )}

          <div>
            <label className="label">{t("status")}</label>
            <div className="flex gap-2">
              {(["paid", "pending"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={status === key ? "btn-primary text-xs py-1.5 px-4" : "btn-secondary text-xs py-1.5 px-4"}
                >
                  {t(`statuses.${key}`)}
                </button>
              ))}
            </div>
          </div>

          {openOrders.length > 0 && (
            <div>
              <label className="label">{t("linkToOrder")}</label>
              <select
                className="input"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  const o = openOrders.find((x) => x.id === e.target.value);
                  if (o && !amount) setAmount(String(orderRemaining(o)));
                }}
              >
                <option value="">{t("noLink")}</option>
                {openOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {t("orderOption", { type: constantLabel(tk, "orderTypes", o.orderType) || o.orderType, date: formatDayDate(o.createdAt, locale), remaining: formatCurrency(orderRemaining(o)) })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">{t("notes")}</label>
            <textarea className="input resize-none" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-petra-text cursor-pointer">
            <input type="checkbox" checked={isDeposit} onChange={(e) => setIsDeposit(e.target.checked)} />
            {t("deposit")}
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>{tc("actions.cancel")}</button>
            <button className="btn-primary" onClick={submit} disabled={mutation.isPending || !amount}>
              {mutation.isPending ? tc("progress.saving") : t("submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
