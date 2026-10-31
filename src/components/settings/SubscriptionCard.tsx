"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Star, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { TIERS } from "@/lib/constants";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { TIER_ICONS } from "./shared";

// ─── Subscription Card ───────────────────────────────────────────────────────

export function SubscriptionCard({ tier, customerCount, appointmentCount }: { tier: string; customerCount: number; appointmentCount: number }) {
  const queryClient = useQueryClient();
  const t = useTranslations("settings.subscriptionCard");
  const { locale } = useBusinessLocale();
  const { user, refreshUser, isOwner } = useAuth();
  const { subscriptionEndsAt, subscriptionDaysLeft, subscriptionExpired, subscriptionActive, cancelPending, subscriptionStatus, hasRecurring, awaitingRecurringCharge } = usePlan();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [openingCard, setOpeningCard] = useState(false);
  const [cardPrompt, setCardPrompt] = useState(false);

  // Back from Cardcom (?card=updated|error) or deep link from the "charge failed" notice (?update-card=1).
  useEffect(() => {
    const url = new URL(window.location.href);
    const card = url.searchParams.get("card");
    if (card === "updated") toast.success(t("toasts.cardUpdated"));
    if (card === "error") toast.error(t("toasts.cardUpdateFailed"));
    if (url.searchParams.get("update-card") === "1") setCardPrompt(true);
    if (card || url.searchParams.has("update-card")) {
      url.searchParams.delete("card");
      url.searchParams.delete("update-card");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const TierIcon = TIER_ICONS[tier] ?? Star;
  const tierInfo = TIERS[tier as keyof typeof TIERS];
  const isFree = tier === "free";

  const endsAtFormatted = subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString(locale) : "";

  const statusLabel = isFree
    ? t("status.free")
    : cancelPending
    ? t("status.cancelPending", { date: endsAtFormatted })
    : subscriptionExpired
    ? t("status.expired")
    : awaitingRecurringCharge
    ? t("status.awaitingCharge")
    : subscriptionActive && hasRecurring
    ? t("status.activeRecurring", { date: endsAtFormatted })
    : subscriptionActive
    ? t("status.activeUntil", { date: endsAtFormatted })
    : t("status.inactive");

  const statusColor = subscriptionExpired
    ? "text-red-500"
    : cancelPending
    ? "text-amber-600"
    : subscriptionActive && !hasRecurring && subscriptionDaysLeft <= 7
    ? "text-amber-500"
    : "text-emerald-500";

  // Only the owner can cancel (server enforces it too).
  const canCancel = isOwner && !user?.isImpersonating && !isFree && !cancelPending && (subscriptionActive || subscriptionStatus === "active");
  // Replace the card the monthly charge runs on — no charge now (owner only, server enforces it too).
  const canUpdateCard = isOwner && !user?.isImpersonating && !isFree && !cancelPending && subscriptionStatus === "active";
  // Same threshold as renew-subscriptions (renew_overdue): before that the charge is simply still in flight.
  const chargeOverdue =
    awaitingRecurringCharge && !!subscriptionEndsAt && Date.now() - new Date(subscriptionEndsAt).getTime() > 3 * 86_400_000;
  const showCardWarning = canUpdateCard && (chargeOverdue || cardPrompt);

  async function handleUpdateCard() {
    setOpeningCard(true);
    try {
      const res = await fetch("/api/cardcom/update-card", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) {
        toast.error(d.error ?? t("toasts.openCardUpdateError"));
        return;
      }
      window.location.href = d.url;
    } catch {
      toast.error(t("toasts.networkError"));
    } finally {
      setOpeningCard(false);
    }
  }

  const renewHref = `/checkout?tier=${tier === "pro" || tier === "basic" ? tier : "basic"}`;

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? t("toasts.cancelError"));
        return;
      }
      toast.success(endsAtFormatted ? t("toasts.cancelledUntil", { date: endsAtFormatted }) : t("toasts.cancelled"));
      setShowCancelConfirm(false);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      toast.error(t("toasts.networkError"));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "rgba(249,115,22,0.15)" }}
    >
      <div className="flex items-center gap-3 p-4"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(251,146,60,0.04) 100%)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)" }}>
          <TierIcon className="w-5 h-5 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-petra-text">{t("header.plan", { name: tierInfo?.name ?? (tier === "service_dog" ? "Service Dog" : tier) })}</p>
          <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
          <p className="text-xs text-petra-muted">{t("header.counts", { customers: customerCount, appointments: appointmentCount })}</p>
        </div>
        <a href="/upgrade" className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
          {t("header.changePlan")}
        </a>
      </div>

      {/* Cancel pending banner */}
      {cancelPending && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-between">
          <span>{t.rich("banners.cancelPending", { date: endsAtFormatted, b: (c) => <strong>{c}</strong> })}</span>
        </div>
      )}

      {subscriptionActive && !cancelPending && !hasRecurring && subscriptionDaysLeft <= 7 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-between">
          <span>{t("banners.expiresIn", { days: subscriptionDaysLeft })}</span>
          <a href={renewHref} className="font-semibold underline">{t("banners.renewNow")}</a>
        </div>
      )}
      {subscriptionExpired && !isFree && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center justify-between">
          <span>{t("banners.expired")}</span>
          <a href={renewHref} className="font-semibold underline">{t("banners.renewNow")}</a>
        </div>
      )}

      {showCardWarning && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 flex items-center justify-between gap-3 flex-wrap">
          <span>{t("banners.chargeFailed")}</span>
          <button onClick={handleUpdateCard} disabled={openingCard} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            {openingCard ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            {t("actions.updateCard")}
          </button>
        </div>
      )}

      {/* Cancel subscription */}
      {(canCancel || canUpdateCard) && !showCancelConfirm && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {canUpdateCard && !showCardWarning ? (
            <button
              onClick={handleUpdateCard}
              disabled={openingCard}
              className="text-xs text-slate-500 hover:text-brand-600 transition-colors flex items-center gap-1.5"
            >
              {openingCard ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              {t("actions.updateCard")}
            </button>
          ) : <span />}
          {canCancel && <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
          >
            {t("actions.cancelSubscription")}
          </button>}
        </div>
      )}

      {canCancel && showCancelConfirm && (
        <div className="px-4 py-3 border-t border-red-100 bg-red-50 flex flex-col gap-2">
          <p className="text-xs text-red-700 font-medium">
            {endsAtFormatted
              ? t("confirm.atPeriodEnd", { date: endsAtFormatted })
              : t("confirm.immediate")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {cancelling && <Loader2 className="w-3 h-3 animate-spin" />}
              {cancelling ? t("confirm.cancelling") : t("confirm.yes")}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t("confirm.back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
