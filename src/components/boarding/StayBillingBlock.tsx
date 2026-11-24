"use client";

/**
 * Billing of ONE boarding stay (דור 23/11/2026, round 2) — used in the boarding edit dialog and
 * the check-out dialog. Shows total / paid / balance from GET /api/boarding/billing, creates the
 * linked payment order (POST /api/orders with relatedEntityType "BoardingStay") and records a
 * payment on it (POST /api/payments with orderId + boardingStayId).
 * Money is shown only with FINANCE_READ; writing needs PAYMENTS_WRITE (the server checks too).
 */
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Plus, Wallet } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { stayOrderAmount, type StayBilling } from "@/lib/stay-billing";
import { formatIls } from "@/lib/lead-deal-value";

export const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "מזומן" },
  { value: "credit_card", label: "אשראי" },
  { value: "bank_transfer", label: "העברה בנקאית" },
  { value: "bit", label: "ביט" },
  { value: "paybox", label: "פייבוקס" },
  { value: "check", label: "צ׳ק" },
];

export interface BillingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  customer: { id: string; name: string } | null;
  pet: { id: string; name: string };
}

async function readError(r: Response, fallback: string): Promise<never> {
  const d = await r.json().catch(() => ({}));
  throw new Error((d as { error?: string }).error || fallback);
}

export function stayBillingKey(stayId: string) {
  return ["boarding-billing", stayId] as const;
}

export function StayBillingBlock({
  stay,
  nights,
  defaultPricePerNight,
  unitLabel = "לילות",
}: {
  stay: BillingStay;
  /** Nights / days of the stay as the screen calculates them. */
  nights: number;
  defaultPricePerNight: number;
  unitLabel?: string;
}) {
  const { canSeeFinance, canWritePayments } = usePermissions();
  const queryClient = useQueryClient();
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [price, setPrice] = useState<number>(defaultPricePerNight || 0);
  const [showPayForm, setShowPayForm] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState("cash");

  const enabled = canSeeFinance && !!stay.customer;
  const { data, isLoading } = useQuery<StayBilling | null>({
    queryKey: stayBillingKey(stay.id),
    enabled,
    queryFn: async () => {
      const r = await fetch(`/api/boarding/billing?ids=${encodeURIComponent(stay.id)}`);
      if (!r.ok) return readError(r, "שגיאה בטעינת החיוב");
      const d = (await r.json()) as { billing: Record<string, StayBilling> };
      return d.billing[stay.id] ?? null;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: stayBillingKey(stay.id) });
    if (stay.customer) queryClient.invalidateQueries({ queryKey: ["customer", stay.customer.id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  };

  const orderTotal = stayOrderAmount(nights, price, 1);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!stay.customer) throw new Error("לשהייה אין לקוח");
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stay.customer.id,
          orderType: "boarding",
          status: "confirmed",
          petId: stay.pet.id,
          startAt: stay.checkIn,
          endAt: stay.checkOut,
          relatedEntityType: "BoardingStay",
          relatedEntityId: stay.id,
          suppressPaymentRequest: true,
          lines: [{ name: `פנסיון — ${stay.pet.name}`, unit: unitLabel === "ימים" ? "יום" : "לילה", quantity: nights, unitPrice: price }],
        }),
      });
      if (!r.ok) return readError(r, "שגיאה ביצירת ההזמנה");
      return r.json();
    },
    onSuccess: () => {
      setShowOrderForm(false);
      invalidate();
      toast.success("הזמנה כספית נוצרה לשהייה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!stay.customer || !data?.orderId) throw new Error("אין הזמנה לשייך אליה את התשלום");
      if (!(value > 0)) throw new Error("יש להזין סכום");
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(value * 100) / 100,
          method,
          status: "paid",
          customerId: stay.customer.id,
          orderId: data.orderId,
          boardingStayId: stay.id,
        }),
      });
      if (!r.ok) return readError(r, "שגיאה ברישום התשלום");
      return r.json();
    },
    onSuccess: () => {
      setShowPayForm(false);
      setAmount("");
      invalidate();
      toast.success("התשלום נרשם");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!enabled) return null;

  return (
    <div className="p-3 rounded-xl border border-slate-200 space-y-2.5">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-petra-text">
        <Receipt className="w-4 h-4 text-petra-muted" />
        חיוב ותשלום
      </div>

      {isLoading ? (
        <PetraLoader variant="inline" className="py-3" />
      ) : data && data.total != null ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-petra-muted">סה״כ</div>
              <div className="text-sm font-bold text-petra-text">{formatIls(data.total)}</div>
            </div>
            <div>
              <div className="text-[11px] text-petra-muted">שולם</div>
              <div className="text-sm font-bold text-emerald-700">{formatIls(data.paid)}</div>
            </div>
            <div>
              <div className="text-[11px] text-petra-muted">יתרה</div>
              <div className={data.balance && data.balance > 0 ? "text-sm font-bold text-red-600" : "text-sm font-bold text-emerald-700"}>
                {data.balance && data.balance > 0 ? formatIls(data.balance) : "שולם במלואו"}
              </div>
            </div>
          </div>
          {data.pending > 0 && (
            <p className="text-[11px] text-amber-700">ממתין לתשלום: {formatIls(data.pending)}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {data.orderId && (
              <Link href={`/orders/${data.orderId}`} className="text-xs text-brand-600 hover:underline">
                פתח הזמנה{data.orderCount > 1 ? ` (${data.orderCount} הזמנות)` : ""}
              </Link>
            )}
            {canWritePayments && data.orderId && !showPayForm && (data.balance ?? 0) > 0 && (
              <button
                type="button"
                className="btn-secondary text-xs py-1 px-2.5 ms-auto"
                onClick={() => { setAmount(String(data.balance ?? "")); setShowPayForm(true); }}
              >
                <Wallet className="w-3.5 h-3.5" />
                רשום תשלום
              </button>
            )}
          </div>
          {showPayForm && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="label text-xs">סכום (₪)</label>
                <input type="number" min={0} step="0.01" inputMode="decimal" className="input w-full text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">אמצעי תשלום</label>
                <select className="input w-full text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="button" className="btn-primary text-sm flex-1" disabled={recordPayment.isPending} onClick={() => recordPayment.mutate()}>
                  {recordPayment.isPending ? "שומר..." : "שמור תשלום"}
                </button>
                <button type="button" className="btn-secondary text-sm" onClick={() => setShowPayForm(false)}>ביטול</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-petra-muted">
            אין עדיין הזמנה כספית לשהייה{data && data.paid > 0 ? ` · שולם ${formatIls(data.paid)}` : ""}
          </p>
          {canWritePayments && !showOrderForm && (
            <button type="button" className="btn-secondary text-xs py-1 px-2.5" onClick={() => setShowOrderForm(true)} disabled={nights <= 0}>
              <Plus className="w-3.5 h-3.5" />
              צור הזמנה כספית
            </button>
          )}
          {canWritePayments && nights <= 0 && (
            <p className="text-[11px] text-petra-muted">כדי ליצור הזמנה צריך תאריך יציאה</p>
          )}
          {showOrderForm && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <label className="label text-xs">מחיר ל{unitLabel === "ימים" ? "יום" : "לילה"} (₪)</label>
                  <input type="number" min={0} className="input w-full text-sm" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
                </div>
                <div className="text-sm text-petra-text pb-2">
                  {nights} {unitLabel} × ₪{price} = <span className="font-bold">{formatIls(orderTotal)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-sm flex-1" disabled={createOrder.isPending || nights <= 0} onClick={() => createOrder.mutate()}>
                  {createOrder.isPending ? "יוצר..." : "צור הזמנה"}
                </button>
                <button type="button" className="btn-secondary text-sm" onClick={() => setShowOrderForm(false)}>ביטול</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
