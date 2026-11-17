"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Home } from "lucide-react";
import { cn, fetchJSON, formatCurrency } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";

/** GET /api/customers/[id]/boarding — paidAmount is null without FINANCE_READ. */
interface CustomerStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
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
              <Link
                key={stay.id}
                href="/boarding"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                title="פתח את לוח הפנסיון"
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
                  {stay.paidAmount !== null && stay.paidAmount > 0 && (
                    <span className="text-[11px] text-petra-muted">שולם {formatCurrency(stay.paidAmount)}</span>
                  )}
                </div>
              </Link>
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
