"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Home } from "lucide-react";
import { cn, fetchJSON, formatCurrency } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";
import type { StayBilling } from "@/lib/stay-billing";
import { StayAddonForm } from "@/components/boarding/StayBillingBlock";

/** GET /api/customers/[id]/boarding — paidAmount is null without FINANCE_READ. */
interface CustomerStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  /** Temporary hold (waiting for contract). Optional until the API selects it. */
  isTentative?: boolean;
  notes: string | null;
  pet: { id: string; name: string };
  room: { id: string; name: string } | null;
  paidAmount: number | null;
}
interface CustomerStaysResponse {
  stays: CustomerStay[];
  total: number;
  activeCount: number;
}

interface StayBillingResponse {
  billing: Record<string, StayBilling>;
}

/** Same allowlist as POST /api/payments. */
const PAYMENT_METHODS: { id: string; label: string }[] = [
  { id: "cash", label: "מזומן" },
  { id: "credit_card", label: "אשראי" },
  { id: "bank_transfer", label: "העברה בנקאית" },
  { id: "bit", label: "ביט" },
  { id: "paybox", label: "פייבוקס" },
  { id: "check", label: "צ׳ק" },
];

const PREVIEW = 5;
const FULL_LIMIT = 100;

const STAY_STATUS: Record<string, { label: string; color: string }> = {
  reserved: { label: "הזמנה", color: "text-blue-600" },
  checked_in: { label: "בפנסיון", color: "text-emerald-600" },
  checked_out: { label: "יצא", color: "text-slate-500" },
  canceled: { label: "בוטל", color: "text-red-500" },
};

const TZ = "Asia/Jerusalem";

function formatStayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit", timeZone: TZ });
}

/** Israel calendar day as a UTC midnight timestamp — nights = difference in days. */
function israelDay(iso: string): number {
  const [y, m, d] = new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function nightsOf(stay: CustomerStay): number | null {
  if (!stay.checkOut) return null;
  const n = Math.round((israelDay(stay.checkOut) - israelDay(stay.checkIn)) / 86_400_000);
  return n >= 0 ? n : null;
}

/**
 * "פנסיון" card in the customer file — every boarding stay of the customer (newest first).
 * The parent renders it only when the business vertical has boarding (useVertical().hides).
 */
export function BoardingSection({ customerId }: { customerId: string }) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? FULL_LIMIT : PREVIEW;

  const query = useQuery<CustomerStaysResponse>({
    queryKey: ["customer", customerId, "boarding", limit],
    queryFn: () => fetchJSON<CustomerStaysResponse>(`/api/customers/${customerId}/boarding?limit=${limit}`),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const stays = query.data?.stays ?? [];
  const total = query.data?.total ?? 0;
  const activeCount = query.data?.activeCount ?? 0;

  const { canSeeFinance, canWritePayments } = usePermissions();
  const stayIds = stays.map((s) => s.id).join(",");
  const billingQuery = useQuery<StayBillingResponse>({
    queryKey: ["customer", customerId, "boarding-billing", stayIds],
    queryFn: () => fetchJSON<StayBillingResponse>(`/api/boarding/billing?ids=${encodeURIComponent(stayIds)}`),
    enabled: canSeeFinance && stayIds.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const billing = billingQuery.data?.billing ?? {};

  /** Stay id whose inline "רשום תשלום" form is open. */
  const [payingStayId, setPayingStayId] = useState<string | null>(null);

  return (
    <div id="boarding" className="card p-5 scroll-mt-32">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <Home className="w-4 h-4 text-petra-muted" />
          פנסיון ({total})
          {activeCount > 0 && <span className="text-xs font-medium text-emerald-600">· {activeCount} פעילות</span>}
        </h2>
        <Link href="/boarding" className="btn-ghost text-xs">
          <ExternalLink className="w-3.5 h-3.5" />
          לוח פנסיון
        </Link>
      </div>

      {query.isLoading ? (
        <PetraLoader variant="inline" className="py-4" />
      ) : query.isError ? (
        <p className="text-sm text-red-500 py-4 text-center">שגיאה בטעינת השהיות בפנסיון</p>
      ) : stays.length === 0 ? (
        <p className="text-sm text-petra-muted py-4 text-center">אין שהיות בפנסיון ללקוח זה</p>
      ) : (
        <div className="space-y-2">
          {stays.map((stay) => {
            const status = STAY_STATUS[stay.status] ?? { label: stay.status, color: "text-petra-muted" };
            const nights = nightsOf(stay);
            return (
              <div key={stay.id} className="rounded-xl">
              <Link
                href={`/boarding?stay=${encodeURIComponent(stay.id)}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                title="פתח את השהייה בלוח הפנסיון"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-petra-text truncate">
                    {stay.pet?.name ?? ""}
                    {stay.room && <span className="text-xs text-petra-muted font-normal"> · {stay.room.name}</span>}
                  </div>
                  <div className="text-xs text-petra-muted flex flex-wrap items-center gap-x-1.5">
                    <span>
                      {formatStayDate(stay.checkIn)} ← {stay.checkOut ? formatStayDate(stay.checkOut) : "ללא תאריך יציאה"}
                    </span>
                    {nights !== null && <span>· {nights === 1 ? "לילה אחד" : `${nights} לילות`}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className={cn("text-xs font-semibold", status.color)}>{status.label}</span>
                  {stay.status === "reserved" && stay.isTentative === true && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-dashed border-amber-400 whitespace-nowrap">
                      שמור זמנית
                    </span>
                  )}
                  {!canSeeFinance && stay.paidAmount !== null && stay.paidAmount > 0 && (
                    <span className="text-[11px] text-petra-muted">שולם {formatCurrency(stay.paidAmount)}</span>
                  )}
                </div>
              </Link>
              {canSeeFinance && !(stay.status === "canceled" && (billing[stay.id]?.total ?? null) === null) && (
                <StayBillingLine
                  billing={billing[stay.id]}
                  loading={billingQuery.isLoading}
                  canPay={canWritePayments}
                  paying={payingStayId === stay.id}
                  onTogglePay={() => setPayingStayId((cur) => (cur === stay.id ? null : stay.id))}
                  customerId={customerId}
                  stayId={stay.id}
                  onPaid={() => setPayingStayId(null)}
                />
              )}
              </div>
            );
          })}
          {total > stays.length && !showAll && (
            <button onClick={() => setShowAll(true)} className="btn-ghost text-xs mx-auto">
              הצג הכל ({total})
            </button>
          )}
          {showAll && total > stays.length && (
            <p className="text-xs text-petra-muted text-center pt-1">מוצגות {stays.length} השהיות האחרונות מתוך {total}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** "סה״כ · שולם · יתרה" under a stay (FINANCE_READ) + inline "רשום תשלום" (PAYMENTS_WRITE). */
function StayBillingLine({
  billing,
  loading,
  canPay,
  paying,
  onTogglePay,
  customerId,
  stayId,
  onPaid,
}: {
  billing: StayBilling | undefined;
  loading: boolean;
  canPay: boolean;
  paying: boolean;
  onTogglePay: () => void;
  customerId: string;
  stayId: string;
  onPaid: () => void;
}) {
  if (!billing) {
    if (loading) return null;
    return <p className="text-[11px] text-petra-muted px-3 pb-2 -mt-1 ps-14">אין הזמנה כספית</p>;
  }
  if (billing.total === null) {
    return <p className="text-[11px] text-petra-muted px-3 pb-2 -mt-1 ps-14">אין הזמנה כספית</p>;
  }
  const balance = billing.balance ?? 0;
  const canRecord = canPay && !!billing.orderId && balance > 0;
  return (
    <StayBillingDetails
      billing={billing}
      balance={balance}
      canRecord={canRecord}
      canPay={canPay}
      paying={paying}
      onTogglePay={onTogglePay}
      customerId={customerId}
      stayId={stayId}
      onPaid={onPaid}
    />
  );
}

function StayBillingDetails({
  billing, balance, canRecord, canPay, paying, onTogglePay, customerId, stayId, onPaid,
}: {
  billing: StayBilling; balance: number; canRecord: boolean; canPay: boolean; paying: boolean;
  onTogglePay: () => void; customerId: string; stayId: string; onPaid: () => void;
}) {
  const queryClient = useQueryClient();
  const [addingAddon, setAddingAddon] = useState(false);
  return (
    <div className="px-3 pb-2 -mt-1 ps-14">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        <span className="text-petra-muted">סה״כ {formatCurrency(billing.total ?? 0)}</span>
        <span className="text-petra-muted">· שולם {formatCurrency(billing.paid)}</span>
        {balance > 0 ? (
          <span className="font-semibold text-red-600">· יתרה {formatCurrency(balance)}</span>
        ) : (
          <span className="font-semibold text-emerald-600">· שולם במלואו</span>
        )}
        {billing.pending > 0 && (
          <span className="text-amber-600">· ממתין {formatCurrency(billing.pending)}</span>
        )}
        <span className="ms-auto flex items-center gap-1">
          {canPay && (
            <button type="button" onClick={() => setAddingAddon((v) => !v)} className="btn-ghost text-xs py-0.5 px-2">
              {addingAddon ? "סגור" : "הוסף תוספת"}
            </button>
          )}
          {canRecord && (
            <button type="button" onClick={onTogglePay} className="btn-ghost text-xs py-0.5 px-2">
              {paying ? "סגור" : "רשום תשלום"}
            </button>
          )}
        </span>
      </div>
      {addingAddon && (
        <div className="mt-2 rounded-xl border border-petra-border bg-slate-50 p-2">
          <StayAddonForm
            stayId={stayId}
            onClose={() => setAddingAddon(false)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
              queryClient.invalidateQueries({ queryKey: ["orders"] });
            }}
          />
        </div>
      )}
      {canRecord && paying && billing.orderId && (
        <StayPaymentForm
          customerId={customerId}
          stayId={stayId}
          orderId={billing.orderId}
          defaultAmount={balance}
          onDone={onPaid}
        />
      )}
    </div>
  );
}

function StayPaymentForm({
  customerId,
  stayId,
  orderId,
  defaultAmount,
  onDone,
}: {
  customerId: string;
  stayId: string;
  orderId: string;
  defaultAmount: number;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(defaultAmount));
  const [method, setMethod] = useState("cash");

  const mutation = useMutation({
    mutationFn: (amt: number) =>
      fetchJSON("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          method,
          status: "paid",
          customerId,
          orderId,
          boardingStayId: stayId,
        }),
      }),
    onSuccess: () => {
      toast.success("התשלום נרשם");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onDone();
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה ברישום התשלום"),
  });

  const submit = () => {
    const amt = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("סכום לא תקין");
      return;
    }
    mutation.mutate(amt);
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-petra-border bg-slate-50 p-2">
      <div className="w-28">
        <label className="label text-[11px] mb-0.5">סכום (₪)</label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          dir="ltr"
          className="input text-sm py-1.5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="w-36">
        <label className="label text-[11px] mb-0.5">אמצעי תשלום</label>
        <select className="input text-sm py-1.5" value={method} onChange={(e) => setMethod(e.target.value)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      <button type="button" onClick={submit} disabled={mutation.isPending} className="btn-primary text-xs py-1.5 px-3">
        {mutation.isPending ? "שומר..." : "שמור"}
      </button>
    </div>
  );
}
