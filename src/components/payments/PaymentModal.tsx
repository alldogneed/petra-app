"use client";

import { useState } from "react";
import { X, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  customerId: string;
  customerName?: string;
  // optional pre-fill from appointment/boarding
  appointmentId?: string;
  boardingStayId?: string;
  suggestedAmount?: number;
  suggestedDescription?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: "cash",     label: "מזומן",              emoji: "💵" },
  { value: "card",     label: "כרטיס אשראי",        emoji: "💳" },
  { value: "transfer", label: "העברה בנקאית",       emoji: "🏦" },
  { value: "bit",      label: "ביט",                emoji: "📱" },
  { value: "paybox",   label: "פייבוקס",             emoji: "📱" },
  { value: "check",    label: "צ׳ק",                emoji: "📝" },
];

export const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid:    { label: "שולם",       color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  pending: { label: "ממתין",      color: "bg-amber-50 text-amber-700 border-amber-100" },
  partial: { label: "חלקי",       color: "bg-blue-50 text-blue-700 border-blue-100" },
  refunded:{ label: "הוחזר",      color: "bg-red-50 text-red-600 border-red-100" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentModal({
  isOpen,
  onClose,
  onCreated,
  customerId,
  customerName,
  appointmentId,
  boardingStayId,
  suggestedAmount,
  suggestedDescription,
}: PaymentModalProps) {
  const [amount, setAmount] = useState(suggestedAmount?.toString() ?? "");
  const [method, setMethod] = useState("cash");
  const [status, setStatus] = useState("paid");
  const [isDeposit, setIsDeposit] = useState(false);
  const [notes, setNotes] = useState(suggestedDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAmount(suggestedAmount?.toString() ?? "");
    setMethod("cash");
    setStatus("paid");
    setIsDeposit(false);
    setNotes(suggestedDescription ?? "");
    setError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("יש להזין סכום תקין");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          amount: parsedAmount,
          method,
          status,
          isDeposit,
          notes: notes || null,
          appointmentId: appointmentId || null,
          boardingStayId: boardingStayId || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "שגיאה");
      }
      reset();
      onCreated();
    } catch (err) {
      setError((err as Error).message || "שגיאה בשמירת התשלום");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-petra-text">רישום תשלום</h2>
              {customerName && (
                <p className="text-xs text-petra-muted">{customerName}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="label">סכום (₪)</label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-petra-muted font-medium text-sm">₪</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input pr-8"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                dir="ltr"
              />
            </div>
          </div>

          {/* Payment method — pill selector */}
          <div>
            <label className="label">אמצעי תשלום</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-2 rounded-xl border text-sm font-medium transition-all",
                    method === m.value
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "bg-white border-petra-border text-petra-muted hover:border-slate-300"
                  )}
                >
                  <span className="text-base leading-none">{m.emoji}</span>
                  <span className="text-xs">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label">סטטוס</label>
            <div className="flex gap-2">
              {(["paid", "pending", "partial"] as const).map((s) => {
                const cfg = PAYMENT_STATUS_MAP[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl border text-xs font-medium transition-all",
                      status === s ? cfg.color : "bg-white border-petra-border text-petra-muted hover:border-slate-300"
                    )}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deposit toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              onClick={() => setIsDeposit(!isDeposit)}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                isDeposit ? "bg-brand-500" : "bg-slate-200"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                isDeposit ? "right-0.5" : "left-0.5"
              )} />
            </button>
            <span className="text-sm text-petra-text">מקדמה</span>
          </div>

          {/* Notes */}
          <div>
            <label className="label">הערות</label>
            <input
              type="text"
              className="input"
              placeholder="הערה אופציונלית..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleClose} className="btn-secondary flex-1">
              ביטול
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "שומר..." : "רשום תשלום"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
