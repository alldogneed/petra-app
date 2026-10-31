"use client";

import { Check, X, MessageCircle, Crown, Zap, CreditCard, Loader2 } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";
import type { TierKey } from "@/lib/feature-flags";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";

// ─── Public plans (sold via checkout) ────────────────────────────────────────
// Texts live in messages under paywall.upgradePage.plans.<msgKey>.*
type PlanDef = {
  key: TierKey;
  /** messages key under paywall.upgradePage.plans */
  msgKey: string;
  price: number;
  hasBadge?: boolean;
  highlight?: boolean;
  features: string[];
  notIncluded: string[];
};

const PLANS: PlanDef[] = [
  {
    key: "free",
    msgKey: "free",
    price: 0,
    features: ["clients", "leads", "trainingPrograms", "appointments", "orders", "tasks", "priceList"],
    notIncluded: ["unlimitedCalendar", "whatsappReminders", "boarding", "intakeForms", "team"],
  },
  {
    key: "basic",
    msgKey: "basic",
    price: 99,
    features: ["unlimitedClients", "calendar", "portfolio", "paymentsAndForms", "unlimitedLeads", "reports"],
    notIncluded: ["whatsappReminders", "teamAndUsers", "boarding", "onlineBooking", "whatsappAutomations"],
  },
  {
    key: "pro",
    msgKey: "pro",
    price: 199,
    highlight: true,
    hasBadge: true,
    features: [
      "everythingInBasic",
      "whatsappReminders",
      "contracts",
      "teamPermissions",
      "boardingRooms",
      "onlineBooking",
      "whatsappAutomations",
    ],
    notIncluded: [],
  },
];

// ─── Legacy plans (DB only — for display when user is currently on one) ───────
const LEGACY_PLANS: PlanDef[] = [
  {
    key: "groomer",
    msgKey: "groomer",
    price: 169,
    features: ["portfolio", "whatsappAutomations", "team", "excelExport"],
    notIncluded: ["boarding", "advancedTraining"],
  },
  {
    key: "service_dog",
    msgKey: "serviceDog",
    price: 229,
    features: ["everythingInPro", "serviceDogs", "certification", "ministryReporting"],
    notIncluded: [],
  },
];

const FAQ_KEYS = ["howToUpgrade", "canCancel", "dataOnCancel", "securePayment"] as const;

const WHATSAPP_UPGRADE_PHONE = "972504828080";

const TIER_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  groomer: 1.5,      // legacy — between basic and pro
  groomer_plus: 1.5, // legacy alias
  pro: 2,
  service_dog: 3,    // enterprise
};

// Tiers that support online Cardcom checkout (public paid tiers only)
const CARDCOM_TIERS = new Set(["basic", "pro"]);

export default function UpgradePage() {
  const { tier, cancelPending, subscriptionEndsAt } = usePlan();
  const { refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const t = useTranslations("paywall.upgradePage");
  const { locale, currency } = useBusinessLocale();
  // Plan prices are ILS amounts; the symbol follows the business (USD pricing = Phase 6)
  const symbol = currencySymbol({ locale, currency });

  const endsAtFormatted = subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString(locale) : "";
  const isFree = tier === "free";
  const canCancel = !isFree && !cancelPending;

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? t("toasts.cancelError"));
        return;
      }
      toast.success(endsAtFormatted ? t("toasts.cancelSuccessUntil", { date: endsAtFormatted }) : t("toasts.cancelSuccess"));
      setShowCancelConfirm(false);
      await refreshUser();
    } catch {
      toast.error(t("toasts.networkError"));
    } finally {
      setCancelling(false);
    }
  }

  // Auto-redirect to checkout if ?autostart=plan is present (e.g. after registration)
  useEffect(() => {
    const autostart = searchParams.get("autostart");
    if (autostart && CARDCOM_TIERS.has(autostart)) {
      router.replace(`/checkout?tier=${autostart}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user is on a legacy tier, append their current plan card so they see it
  const isLegacyTier = tier && !["free", "basic", "pro"].includes(tier);
  const visiblePlans = isLegacyTier
    ? [...PLANS, ...(LEGACY_PLANS.filter(p => p.key === tier))]
    : PLANS;

  function goToCheckout(planKey: string) {
    router.push(`/checkout?tier=${planKey}`);
  }

  function openWhatsApp(planName: string, price: number, isDowngrade: boolean) {
    const action = isDowngrade ? t("whatsapp.downgradeAction") : t("whatsapp.upgradeAction");
    const msg = encodeURIComponent(
      t("whatsapp.message", { action, planName, currencySymbol: symbol, price })
    );
    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_UPGRADE_PHONE}&text=${msg}`, "_blank");
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Crown className="w-4 h-4" />
          {t("header.badge")}
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">{t("header.title")}</h1>
        <p className="text-slate-500 max-w-lg mx-auto">
          {t("header.subtitle")}
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {visiblePlans.map((plan) => {
          const isCurrent = tier === plan.key;
          const isHighlight = plan.highlight;
          const isDowngrade = TIER_RANK[plan.key] < TIER_RANK[tier ?? "free"];
          const planName = t(`plans.${plan.msgKey}.name`);

          return (
            <div
              key={plan.key}
              className={cn(
                "rounded-2xl border-2 p-6 flex flex-col relative",
                isHighlight
                  ? "border-brand-500 bg-brand-50 shadow-lg shadow-brand-100"
                  : "border-slate-200 bg-white",
                isCurrent && "border-green-400 bg-green-50"
              )}
            >
              {/* Badge */}
              {plan.hasBadge && !isCurrent && (
                <div className={cn(
                  "absolute -top-3 start-4 text-xs font-bold px-3 py-1 rounded-full",
                  isHighlight ? "bg-brand-500 text-white" : "bg-amber-500 text-white"
                )}>
                  {t(`plans.${plan.msgKey}.badge`)}
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 start-4 text-xs font-bold px-3 py-1 rounded-full bg-green-500 text-white">
                  {t("card.currentBadge")}
                </div>
              )}

              {/* Plan info */}
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">{planName}</h2>
                <div className="flex items-baseline gap-1 mt-1 mb-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {plan.price === 0 ? t("card.free") : t("card.price", { currencySymbol: symbol, price: plan.price })}
                  </span>
                  {plan.price > 0 && <span className="text-slate-400 text-sm">{t("card.perMonth")}</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{t(`plans.${plan.msgKey}.description`)}</p>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {t(`plans.${plan.msgKey}.features.${f}`)}
                  </div>
                ))}
                {plan.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-400">
                    <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    {t(`plans.${plan.msgKey}.notIncluded.${f}`)}
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold bg-green-100 text-green-700">
                  {t("card.yourPlan")}
                </div>
              ) : plan.key === "free" && !isFree ? (
                // Downgrade to free = cancellation, not a plan switch
                <button
                  onClick={() => {
                    const el = document.getElementById("cancel-section");
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    setShowCancelConfirm(true);
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200"
                >
                  {t("card.cancelToFree")}
                </button>
              ) : isDowngrade ? (
                <button
                  onClick={() => openWhatsApp(planName, plan.price, true)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors bg-slate-200 hover:bg-slate-300 text-slate-700"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("card.downgradeTo", { planName })}
                </button>
              ) : plan.price === 0 ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm text-slate-400 border border-dashed border-slate-300">
                  {t("card.alwaysFree")}
                </div>
              ) : CARDCOM_TIERS.has(plan.key) ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => goToCheckout(plan.key)}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                      isHighlight
                        ? "bg-brand-500 hover:bg-brand-600 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                    {t("card.payNow")}
                  </button>
                  <button
                    onClick={() => openWhatsApp(planName, plan.price, false)}
                    className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors text-slate-500 hover:text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {t("card.upgradeViaWhatsapp")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openWhatsApp(planName, plan.price, false)}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                    isHighlight
                      ? "bg-brand-500 hover:bg-brand-600 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("card.upgradeTo", { planName })}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Cancel subscription */}
      <div id="cancel-section" />
      {cancelPending && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700">
          {t.rich("cancel.pending", { date: endsAtFormatted, strong: (c) => <strong>{c}</strong> })}
        </div>
      )}

      {canCancel && !showCancelConfirm && (
        <div className="mb-6 text-center">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-sm text-slate-400 hover:text-red-500 transition-colors underline"
          >
            {t("cancel.wantToCancel")}
          </button>
        </div>
      )}

      {canCancel && showCancelConfirm && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-700 font-medium mb-3">
            {endsAtFormatted ? t("cancel.confirmWithDate", { date: endsAtFormatted }) : t("cancel.confirm")}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {cancelling ? t("cancel.cancelling") : t("cancel.yesCancel")}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t("cancel.back")}
            </button>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="card p-6">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          {t("faq.title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQ_KEYS.map((k) => (
            <div key={k} className="bg-slate-50 rounded-xl p-4">
              <div className="font-medium text-slate-800 text-sm mb-1">{t(`faq.${k}.q`)}</div>
              <div className="text-slate-500 text-xs leading-relaxed">{t(`faq.${k}.a`)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-400">
          {t("contact.text")}
        </p>
        <button
          onClick={() => window.open(`https://wa.me/${WHATSAPP_UPGRADE_PHONE}`, "_blank")}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
        >
          <MessageCircle className="w-4 h-4" />
          {t("contact.cta")}
        </button>
      </div>
    </div>
  );
}
