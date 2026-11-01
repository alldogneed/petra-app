"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CreditCard, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, fetchJSON } from "@/lib/utils";
import { formatCurrency as formatMoney } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { PAYMENT_STATUS_COLORS, constantLabel } from "./constants";
import { formatDayDate, type CustomerDetail, type PagedPayments, type PaymentInfo } from "./types";

const INITIAL_VISIBLE = 8;
const PAGE_SIZE = 20;

/** Rendered only for FINANCE_READ. Stays visible (with a CTA) when there are no payments. */
export function PaymentsSection({
  customer,
  canWritePayments,
  onRecordPayment,
}: {
  customer: CustomerDetail;
  canWritePayments: boolean;
  onRecordPayment: () => void;
}) {
  const t = useTranslations("customers.paymentsSection");
  const tc = useTranslations("common");
  const tk = useTranslations("customers.constants");
  const { locale, currency } = useBusinessLocale();
  const formatCurrency = (amount: number) => formatMoney(amount, { locale, currency });
  const customerId = customer.id;
  const total = customer.summary?.counts.payments ?? customer.payments.length;
  const [expanded, setExpanded] = useState(false);

  // "Show more" switches to the paged endpoint (the card GET only carries the latest 20).
  const paged = useInfiniteQuery<PagedPayments>({
    queryKey: ["customer", customerId, "payments"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ take: String(PAGE_SIZE) });
      if (pageParam) qs.set("cursor", String(pageParam));
      return fetchJSON<PagedPayments>(`/api/customers/${customerId}/payments?${qs}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: expanded,
    staleTime: 30_000,
  });

  const rows: PaymentInfo[] = expanded
    ? paged.data?.pages.flatMap((p) => p.payments) ?? customer.payments
    : customer.payments.slice(0, INITIAL_VISIBLE);
  const canShowMore = expanded ? !!paged.hasNextPage : total > INITIAL_VISIBLE;

  return (
    <div id="payments" className="card p-5 scroll-mt-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-petra-muted" />
          {t("title", { total })}
        </h2>
        {canWritePayments && (
          <button onClick={onRecordPayment} className="btn-ghost text-xs">
            <Plus className="w-3.5 h-3.5" />
            {t("recordPayment")}
          </button>
        )}
      </div>

      {customer.payments.length === 0 ? (
        <div className="empty-state py-6">
          <div className="empty-state-icon">
            <CreditCard className="w-6 h-6" />
          </div>
          <p className="text-sm text-petra-muted mb-3">{t("empty")}</p>
          {canWritePayments && (
            <button onClick={onRecordPayment} className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
              {t("recordFirst")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((payment) => (
            <div key={payment.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-petra-text">
                  {formatCurrency(payment.amount)}
                  <span className="text-xs text-petra-muted ms-1">
                    · {constantLabel(tk, "paymentMethods", payment.method) || payment.method}
                    {payment.isDeposit ? t("depositSuffix") : ""}
                  </span>
                </div>
                <div className="text-xs text-petra-muted truncate">
                  {[
                    payment.appointment?.service?.name || (payment.boardingStay ? t("boardingLabel", { petName: payment.boardingStay.pet?.name ?? "" }) : ""),
                    formatDayDate(payment.paidAt || payment.createdAt, locale),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className={cn("badge text-[10px]", PAYMENT_STATUS_COLORS[payment.status] || "badge-neutral")}>
                {constantLabel(tk, "paymentStatuses", payment.status) || payment.status}
              </span>
            </div>
          ))}
          {expanded && paged.isLoading && <PetraLoader variant="inline" className="py-4" />}
          {expanded && paged.isError && <p className="text-xs text-red-500 text-center py-2">{t("loadError")}</p>}
          {canShowMore && (
            <button
              onClick={() => (expanded ? paged.fetchNextPage() : setExpanded(true))}
              disabled={paged.isFetchingNextPage}
              className="w-full mt-1 py-2 text-xs text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
            >
              {paged.isFetchingNextPage ? tc("loading") : t("loadMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
