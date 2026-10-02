"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TIERS } from "@/lib/constants";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { TIER_ICONS } from "./shared";

// ─── Subscription Card ───────────────────────────────────────────────────────

export function SubscriptionCard({ tier, customerCount, appointmentCount }: { tier: string; customerCount: number; appointmentCount: number }) {
  const queryClient = useQueryClient();
  const { refreshUser, isOwner } = useAuth();
  const { subscriptionEndsAt, subscriptionDaysLeft, subscriptionExpired, subscriptionActive, cancelPending, subscriptionStatus, hasRecurring, awaitingRecurringCharge } = usePlan();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const TierIcon = TIER_ICONS[tier] ?? Star;
  const tierInfo = TIERS[tier as keyof typeof TIERS];
  const isFree = tier === "free";

  const endsAtFormatted = subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString("he-IL") : "";

  const statusLabel = isFree
    ? "חינמי"
    : cancelPending
    ? `בתהליך ביטול — גישה מלאה עד ${endsAtFormatted}`
    : subscriptionExpired
    ? "פג תוקף"
    : awaitingRecurringCharge
    ? "פעיל — החיוב החודשי בעיבוד"
    : subscriptionActive && hasRecurring
    ? `פעיל — מתחדש אוטומטית ב-${endsAtFormatted}`
    : subscriptionActive
    ? `פעיל עד ${endsAtFormatted}`
    : "לא פעיל";

  const statusColor = subscriptionExpired
    ? "text-red-500"
    : cancelPending
    ? "text-amber-600"
    : subscriptionActive && !hasRecurring && subscriptionDaysLeft <= 7
    ? "text-amber-500"
    : "text-emerald-500";

  // Only the owner can cancel (server enforces it too).
  const canCancel = isOwner && !isFree && !cancelPending && (subscriptionActive || subscriptionStatus === "active");
  const renewHref = `/checkout?tier=${tier === "pro" || tier === "basic" ? tier : "basic"}`;

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "שגיאה בביטול המנוי");
        return;
      }
      toast.success(endsAtFormatted ? `הביטול נקלט. תמשיך ליהנות מהמנוי עד ${endsAtFormatted}.` : "המנוי בוטל.");
      setShowCancelConfirm(false);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      toast.error("שגיאת רשת. נסה שוב.");
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
          <p className="text-sm font-semibold text-petra-text">מנוי: {tierInfo?.name ?? tier}</p>
          <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
          <p className="text-xs text-petra-muted">{customerCount} לקוחות · {appointmentCount} פגישות</p>
        </div>
        <a href="/upgrade" className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
          שנה מסלול
        </a>
      </div>

      {/* Cancel pending banner */}
      {cancelPending && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-between">
          <span>הביטול נקלט — גישה מלאה עד <strong>{endsAtFormatted}</strong>. לאחר מכן תעבור למסלול חינמי.</span>
        </div>
      )}

      {subscriptionActive && !cancelPending && !hasRecurring && subscriptionDaysLeft <= 7 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-between">
          <span>המנוי שלך יפוג בעוד {subscriptionDaysLeft} ימים</span>
          <a href={renewHref} className="font-semibold underline">חדש עכשיו</a>
        </div>
      )}
      {subscriptionExpired && !isFree && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center justify-between">
          <span>המנוי שלך פג — חזרת למסלול חינמי</span>
          <a href={renewHref} className="font-semibold underline">חדש עכשיו</a>
        </div>
      )}

      {/* Cancel subscription */}
      {canCancel && !showCancelConfirm && (
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
          >
            ביטול מנוי
          </button>
        </div>
      )}

      {canCancel && showCancelConfirm && (
        <div className="px-4 py-3 border-t border-red-100 bg-red-50 flex flex-col gap-2">
          <p className="text-xs text-red-700 font-medium">
            {endsAtFormatted
              ? `המנוי יבוטל בסוף תקופת החיוב (${endsAtFormatted}). עד אז תמשיך ליהנות מכל התכונות — ללא חיוב נוסף.`
              : "המנוי יבוטל מיד והעסק יעבור למסלול החינמי."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {cancelling && <Loader2 className="w-3 h-3 animate-spin" />}
              {cancelling ? "מבטל..." : "כן, בטל מנוי"}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              חזרה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
