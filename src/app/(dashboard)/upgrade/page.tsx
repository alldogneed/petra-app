"use client";

import { Check, X, MessageCircle, Crown, Zap, CreditCard, Loader2 } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";
import type { TierKey } from "@/lib/feature-flags";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";

// ─── Public plans (sold via checkout) ────────────────────────────────────────
const PLANS: {
  key: TierKey;
  name: string;
  price: number;
  description: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
  notIncluded: string[];
}[] = [
  {
    key: "free",
    name: "חינמי",
    price: 0,
    description: "התחל לנהל את העסק שלך — בחינם, ללא הגבלת זמן",
    features: [
      "עד 30 לקוחות",
      "CRM / לידים (עד 15)",
      "מערכת ניהול תהליכי אילוף (עד 10 תוכניות)",
      "תורים (עד 20 סה״כ)",
      "הזמנות (עד 15 סה״כ)",
      "ניהול משימות (עד 20 פתוחות)",
      "מחירון שירותים (עד 8 פריטים)",
    ],
    notIncluded: [
      "מערכת תורים + Google Calendar ללא הגבלה",
      "תזכורות WhatsApp ללקוחות",
      "ניהול פנסיון",
      "שליחת טפסי קליטה ללקוח",
      "ניהול צוות",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    price: 99,
    description: "מושלם לגרומרים ומאלפים עצמאיים — יחיד, מקצועי, חסכוני",
    features: [
      "לקוחות ותורים ללא הגבלה",
      "יומן תורים ופגישות + Google Calendar",
      "תזכורות WhatsApp אוטומטיות",
      "תיק עבודות לפני/אחרי",
      "בקשת תשלום + טפסי קליטה דיגיטליים",
      "CRM / לידים ללא הגבלה",
      "דוחות ואנליטיקס",
    ],
    notIncluded: [
      "ניהול צוות ומשתמשים",
      "ניהול פנסיון",
      "הזמנות אונליין",
      "אוטומציות WhatsApp מתקדמות",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 199,
    description: "מושלם לפנסיונים ומרכזי אילוף — צוות, גדילה, שליטה מלאה",
    highlight: true,
    badge: "הכי פופולרי",
    features: [
      "הכל ב-Basic",
      "ניהול צוות והרשאות מתקדמות",
      "ניהול פנסיון וחדרים",
      "מודול אילוף מתקדם",
      "הזמנות אונליין — לקוחות קובעים לבד 24/7",
      "אוטומציות WhatsApp מתקדמות",
      "חשבוניות דיגיטליות + ייצוא Excel",
    ],
    notIncluded: [],
  },
];

// ─── Legacy plans (DB only — for display when user is currently on one) ───────
const LEGACY_PLANS: typeof PLANS = [
  {
    key: "groomer",
    name: "Groomer+ (legacy)",
    price: 169,
    description: "מסלול ישן — כבר לא נמכר. ניתן לעבור ל-Basic או Pro.",
    features: [
      "תיק עבודות לפני/אחרי",
      "אוטומציות WhatsApp",
      "ניהול צוות",
      "ייצוא Excel",
    ],
    notIncluded: ["פנסיון", "אילוף מתקדם"],
  },
  {
    key: "service_dog",
    name: "Service Dog",
    price: 229,
    description: "מסלול ארגוני לכלבי שירות — ניהול זכאים, הכשרות ורגולציה.",
    features: [
      "הכל ב-Pro",
      "ניהול כלבי שירות ותיק זכאים",
      "מבחני הסמכה ופרוטוקולים רפואיים",
      "דיווח למשרד החקלאות",
    ],
    notIncluded: [],
  },
];

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

  const endsAtFormatted = subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString("he-IL") : "";
  const isFree = tier === "free";
  const canCancel = !isFree && !cancelPending;

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "שגיאה בביטול המנוי");
        return;
      }
      toast.success(endsAtFormatted ? `הביטול נקלט. תמשיך ליהנות מהמנוי עד ${endsAtFormatted}.` : "הביטול נקלט.");
      setShowCancelConfirm(false);
      await refreshUser();
    } catch {
      toast.error("שגיאת רשת. נסה שוב.");
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
    const action = isDowngrade ? "לשנמך" : "לשדרג";
    const msg = encodeURIComponent(
      `שלום, אני רוצה ${action} את המנוי שלי ב-Petra למסלול ${planName} (₪${price}/חודש). תוכלו לעזור לי?`
    );
    window.open(`https://wa.me/${WHATSAPP_UPGRADE_PHONE}?text=${msg}`, "_blank");
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Crown className="w-4 h-4" />
          שדרג את המנוי שלך
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">בחר את המסלול המתאים לך</h1>
        <p className="text-slate-500 max-w-lg mx-auto">
          כל המסלולים כוללים גישה מלאה לפיצ׳רים הבסיסיים. ניתן לשדרג, להוריד מסלול, או לבטל בכל עת.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {visiblePlans.map((plan) => {
          const isCurrent = tier === plan.key;
          const isHighlight = plan.highlight;
          const isDowngrade = TIER_RANK[plan.key] < TIER_RANK[tier ?? "free"];

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
              {plan.badge && !isCurrent && (
                <div className={cn(
                  "absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full",
                  isHighlight ? "bg-brand-500 text-white" : "bg-amber-500 text-white"
                )}>
                  {plan.badge}
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full bg-green-500 text-white">
                  המסלול הנוכחי שלך
                </div>
              )}

              {/* Plan info */}
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mt-1 mb-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {plan.price === 0 ? "חינם" : `₪${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-slate-400 text-sm">/חודש</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
                {plan.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-400">
                    <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold bg-green-100 text-green-700">
                  ✓ המסלול שלך
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
                  בטל מנוי ← מעבר לחינמי
                </button>
              ) : isDowngrade ? (
                <button
                  onClick={() => openWhatsApp(plan.name, plan.price, true)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors bg-slate-200 hover:bg-slate-300 text-slate-700"
                >
                  <MessageCircle className="w-4 h-4" />
                  {`שנמך ל-${plan.name}`}
                </button>
              ) : plan.price === 0 ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm text-slate-400 border border-dashed border-slate-300">
                  חינמי תמיד
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
                    שלם עכשיו
                  </button>
                  <button
                    onClick={() => openWhatsApp(plan.name, plan.price, false)}
                    className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors text-slate-500 hover:text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    שדרג דרך WhatsApp
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openWhatsApp(plan.name, plan.price, false)}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                    isHighlight
                      ? "bg-brand-500 hover:bg-brand-600 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                  {`שדרג ל-${plan.name}`}
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
          הביטול נקלט — גישה מלאה עד <strong>{endsAtFormatted}</strong>. לאחר מכן תעבור למסלול חינמי.
        </div>
      )}

      {canCancel && !showCancelConfirm && (
        <div className="mb-6 text-center">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-sm text-slate-400 hover:text-red-500 transition-colors underline"
          >
            רוצה לבטל את המנוי?
          </button>
        </div>
      )}

      {canCancel && showCancelConfirm && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-700 font-medium mb-3">
            המנוי יבוטל בסוף תקופת החיוב{endsAtFormatted ? ` (${endsAtFormatted})` : ""}. עד אז תמשיך ליהנות מכל התכונות — ללא חיוב נוסף.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {cancelling ? "מבטל..." : "כן, בטל מנוי"}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              חזרה
            </button>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="card p-6">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          שאלות נפוצות
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { q: "איך משדרגים?", a: "לחץ על \"שלם עכשיו\" — תועבר לדף תשלום מאובטח. המסלול יתעדכן מיד לאחר אישור התשלום." },
            { q: "האם ניתן לבטל?", a: "כן, ניתן לבטל בכל עת ללא קנסות. לחץ \"רוצה לבטל את המנוי?\" למעלה, או עבור להגדרות ← ניהול מנוי." },
            { q: "מה קורה לנתונים בביטול?", a: "הנתונים נשמרים. בתום המנוי תחזור לסלול החינמי עם הגבלות הרגילות שלו." },
            { q: "האם התשלום מאובטח?", a: "כן. פרטי הכרטיס מוזנים ישירות בסביבה המאובטחת של Cardcom (PCI DSS). Petra אינה רואה את פרטי הכרטיס." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-slate-50 rounded-xl p-4">
              <div className="font-medium text-slate-800 text-sm mb-1">{q}</div>
              <div className="text-slate-500 text-xs leading-relaxed">{a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-400">
          שאלות? פנה אלינו ב-WhatsApp ונשמח לעזור בבחירת המסלול המתאים.
        </p>
        <button
          onClick={() => window.open(`https://wa.me/${WHATSAPP_UPGRADE_PHONE}`, "_blank")}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
        >
          <MessageCircle className="w-4 h-4" />
          צור קשר עכשיו
        </button>
      </div>
    </div>
  );
}
