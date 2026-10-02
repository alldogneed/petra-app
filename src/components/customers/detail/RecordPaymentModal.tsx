"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { fetchJSON, formatCurrency } from "@/lib/utils";
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "./constants";
import { formatDayDate, type OrderInfo } from "./types";

/** Same allowlist as POST /api/payments (src/app/api/payments/route.ts). */
const METHODS = ["cash", "credit_card", "bank_transfer", "bit", "paybox", "check"] as const;
type Method = (typeof METHODS)[number];

/** Orders that can still receive a payment. */
export const OPEN_ORDER_STATUSES = ["draft", "confirmed", "partially_paid"];

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
  const openOrders = orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status));
  const [amount, setAmount] = useState(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : "");
  const [method, setMethod] = useState<Method>("cash");
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [orderId, setOrderId] = useState("");
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
      toast.success(status === "paid" ? "התשלום נרשם" : "התשלום נרשם כממתין");
      onClose();
    },
    onError: (e: Error) => setError(e.message || "שגיאה ברישום התשלום"),
  });

  const submit = () => {
    setError(null);
    const value = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0) return setError("יש להזין סכום חיובי");
    if (value > 1_000_000) return setError("סכום חורג מהמותר (מקסימום ₪1,000,000)");
    if (method === "credit_card" && cardLast4 && !/^\d{4}$/.test(cardLast4)) return setError("4 ספרות אחרונות — 4 ספרות בדיוק");
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
    <div className="modal-overlay" dir="rtl">
      <div className="modal-backdrop" onClick={() => !mutation.isPending && onClose()} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">רישום תשלום</h2>
            <p className="text-xs text-petra-muted">{customerName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סכום (₪)</label>
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
              <label className="label">אמצעי תשלום</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m] ?? m}</option>
                ))}
              </select>
            </div>
          </div>

          {method === "credit_card" && (
            <div>
              <label className="label">4 ספרות אחרונות (אופציונלי)</label>
              <input className="input" inputMode="numeric" maxLength={4} value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))} dir="ltr" />
            </div>
          )}
          {method === "check" && (
            <div>
              <label className="label">מספר צ׳ק (אופציונלי)</label>
              <input className="input" maxLength={30} value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} dir="ltr" />
            </div>
          )}

          <div>
            <label className="label">סטטוס</label>
            <div className="flex gap-2">
              {([["paid", "שולם"], ["pending", "ממתין"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={status === key ? "btn-primary text-xs py-1.5 px-4" : "btn-secondary text-xs py-1.5 px-4"}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {openOrders.length > 0 && (
            <div>
              <label className="label">שיוך להזמנה (אופציונלי)</label>
              <select
                className="input"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  const o = openOrders.find((x) => x.id === e.target.value);
                  if (o && !amount) setAmount(String(orderRemaining(o)));
                }}
              >
                <option value="">ללא שיוך</option>
                {openOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {ORDER_TYPE_LABELS[o.orderType] || o.orderType} · {formatDayDate(o.createdAt)} · יתרה {formatCurrency(orderRemaining(o))}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">הערות</label>
            <textarea className="input resize-none" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-petra-text cursor-pointer">
            <input type="checkbox" checked={isDeposit} onChange={(e) => setIsDeposit(e.target.checked)} />
            מקדמה
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>ביטול</button>
            <button className="btn-primary" onClick={submit} disabled={mutation.isPending || !amount}>
              {mutation.isPending ? "שומר..." : "רשום תשלום"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
