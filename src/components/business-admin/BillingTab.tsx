"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";
import { usePlan } from "@/hooks/usePlan";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  Clock,
  CreditCard,
} from "lucide-react";

// ── Billing Tab ───────────────────────────────────────────────────

interface SubscriptionEvent {
  id: string;
  eventType: string;
  tier: string | null;
  cardcomDealId: string | null;
  amount: number | null;
  createdAt: string;
}

const EVENT_TYPES = new Set(["activate", "renew", "cancel", "expired", "error"]);
const EVENT_TYPE_COLORS: Record<string, string> = {
  activate: "text-emerald-600 bg-emerald-50",
  renew: "text-blue-600 bg-blue-50",
  cancel: "text-amber-600 bg-amber-50",
  expired: "text-red-500 bg-red-50",
  error: "text-red-600 bg-red-50",
};
const TIERS = new Set(["free", "basic", "pro", "groomer", "service_dog"]);

export function BillingTab() {
  const t = useTranslations("businessAdmin.billingTab");
  const { locale, currency } = useBusinessLocale();
  const tierLabel = (id: string) => (TIERS.has(id) ? t(`tiers.${id}`) : id);
  const { subscriptionEndsAt, subscriptionActive, subscriptionExpired, subscriptionDaysLeft, tier } = usePlan();
  const { data: events = [], isLoading } = useQuery<SubscriptionEvent[]>({
    queryKey: ["billing-events"],
    queryFn: () => fetch("/api/billing/events").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-petra-text mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-500" />{t("current.title")}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t("current.plan"), value: tierLabel(tier) },
            { label: t("current.status"), value: subscriptionExpired ? t("current.expired") : subscriptionActive ? t("current.active") : t("current.inactive"),
              className: subscriptionExpired ? "text-red-500" : subscriptionActive ? "text-emerald-600" : "text-slate-400" },
            { label: t("current.validUntil"), value: subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString(locale) : "—" },
            { label: t("current.daysLeft"), value: subscriptionActive ? String(subscriptionDaysLeft) : "—",
              className: subscriptionDaysLeft <= 7 ? "text-amber-500" : "" },
          ].map(({ label, value, className }) => (
            <div key={label} className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-petra-muted mb-1">{label}</p>
              <p className={`font-bold text-sm ${className ?? "text-petra-text"}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href="/upgrade" className="btn-primary text-sm gap-2 inline-flex">
            <CreditCard className="w-4 h-4" />
            {subscriptionActive ? t("actions.changePlan") : tier === "free" ? t("actions.subscribe") : t("actions.changePlan")}
          </a>
          {tier !== "free" && (
            <a href="/upgrade" className="text-sm text-slate-400 hover:text-red-500 transition-colors underline">
              {t("actions.cancelOrDowngrade")}
            </a>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-petra-border">
          <h3 className="font-semibold text-petra-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-500" />{t("history.title")}
          </h3>
        </div>
        {isLoading ? (
          <PetraLoader variant="inline" />
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-petra-muted text-sm">{t("history.empty")}</div>
        ) : (
          <div className="divide-y divide-petra-border">
            {events.map((ev) => (
              <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EVENT_TYPE_COLORS[ev.eventType] ?? "text-slate-600 bg-slate-50"}`}>
                    {EVENT_TYPES.has(ev.eventType) ? t(`eventTypes.${ev.eventType}`) : ev.eventType}
                  </span>
                  {ev.tier && <span className="text-sm text-petra-text">{tierLabel(ev.tier)}</span>}
                  {ev.cardcomDealId && <span className="text-xs text-petra-muted">{t("history.deal", { id: ev.cardcomDealId })}</span>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {ev.amount != null && ev.amount > 0 && <span className="text-sm font-semibold text-emerald-600">{currencySymbol({ locale, currency })}{ev.amount}</span>}
                  <span className="text-xs text-petra-muted">{new Date(ev.createdAt).toLocaleDateString(locale)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
