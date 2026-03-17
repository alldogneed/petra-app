"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Check, Loader2, Crown, ArrowRight, Lock, Gift, CreditCard } from "lucide-react";
import { useState, useEffect, Suspense } from "react";

// ─── Plan details for the summary panel ───────────────────────────────────────
const PLAN_DETAILS = {
  basic: {
    name: "Basic",
    price: 99,
    tagline: "לעסקים שרוצים את הכלים הבסיסיים לניהול מסודר",
    features: [
      "לקוחות ללא הגבלה",
      "יומן תורים ופגישות",
      "תזכורות WhatsApp ללקוחות",
      "דוחות ואנליטיקס מלאים",
      "סנכרון Google Calendar",
    ],
    highlight: false,
  },
  pro: {
    name: "Pro",
    price: 199,
    tagline: "שליטה מלאה — לעסק שגדל",
    features: [
      "הכל ב-Basic",
      "הזמנות אונליין ללקוחות",
      "פנסיון + ניהול חדרים",
      "אוטומציות WhatsApp מתקדמות",
      "ניהול צוות ומשתמשים",
    ],
    highlight: true,
  },
  groomer: {
    name: "Groomer+",
    price: 169,
    tagline: "מסלול ייעודי לגרומרים",
    features: [
      "לקוחות ללא הגבלה",
      "יומן תורים ופגישות",
      "תיק עבודות לפני/אחרי",
      "אוטומציות WhatsApp מתקדמות",
      "ניהול צוות + ייצוא Excel",
    ],
    highlight: false,
  },
  service_dog: {
    name: "Service Dog",
    price: 229,
    tagline: "המערכת המתקדמת הראשונה בישראל לניהול כלבי שירות",
    features: [
      "הכל ב-Pro",
      "ניהול כלבי שירות בתהליך",
      "ניהול תיק זכאים",
      "מבחני הסמכה",
      "פרוטוקולים רפואיים",
    ],
    highlight: false,
  },
} as const;

type PlanKey = keyof typeof PLAN_DETAILS;

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tier = (searchParams.get("tier") ?? "") as PlanKey;
  const isTrial = searchParams.get("trial") === "1";
  const plan = PLAN_DETAILS[tier];

  const [cardcomUrl, setCardcomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchPaymentUrl() {
    setLoading(true);
    setError(null);

    const endpoint = isTrial
      ? "/api/cardcom/create-tokenization"
      : "/api/cardcom/create-payment";

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    })
      .then((r) => {
        if (r.status === 401) {
          router.replace(`/login?redirect=/checkout?tier=${tier}`);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.url) {
          setCardcomUrl(data.url);
        } else {
          setError(data.error ?? "שגיאה ביצירת דף תשלום");
        }
      })
      .catch(() => setError("שגיאה בחיבור לשרת. נסה שוב."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!plan) {
      router.replace("/upgrade");
      return;
    }
    fetchPaymentUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)" }}
          >
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="font-bold text-slate-800 text-sm">Petra</span>
          <span className="text-slate-300 mx-0.5 hidden sm:inline">·</span>
          <span className="text-slate-500 text-sm hidden sm:inline">{isTrial ? "אימות כרטיס לניסיון חינמי" : "שדרוג מנוי"}</span>
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          חזרה
        </button>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

          {/* ── Left: Order Summary (appears FIRST on mobile) ── */}
          <div className="w-full lg:w-2/5 order-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-5">
                החבילה שלך
              </p>

              {/* Plan name + price */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className={`w-4 h-4 ${plan.highlight ? "text-brand-500" : "text-amber-500"}`} />
                    <span className="text-lg font-bold text-slate-900">מסלול {plan.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug max-w-[180px]">{plan.tagline}</p>
                </div>
                <div className="text-left flex-shrink-0 mr-2">
                  <div className="text-3xl font-extrabold text-slate-900 leading-none">₪{plan.price}</div>
                  <div className="text-xs text-slate-400 mt-1 text-center">/חודש</div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 border-t border-slate-100 pt-4 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Total row */}
              {isTrial ? (
                <div className="py-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">חיוב היום</span>
                    <span className="text-base font-extrabold text-emerald-600">₪0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">לאחר 14 יום ניסיון</span>
                    <span className="text-sm font-semibold text-slate-700">₪{plan.price} <span className="text-xs font-normal text-slate-400">/ חודש</span></span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between py-3 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">סה״כ לתשלום</span>
                  <span className="text-base font-extrabold text-slate-900">₪{plan.price} <span className="text-xs font-normal text-slate-400">/ חודש</span></span>
                </div>
              )}

              {/* Trust badge */}
              {isTrial ? (
                <div className="mt-4 space-y-2">
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 font-bold text-[10px]">✓</span>
                      <span><strong>היום:</strong> לא תחויב כלום — הכרטיס רק נשמר</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 font-bold text-[10px]">14</span>
                      <span><strong>לאחר 14 יום:</strong> חיוב אוטומטי ₪{plan.price}/חודש</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-500 font-bold text-[10px]">✕</span>
                      <span><strong>בטלת בניסיון?</strong> ₪0 — ללא שום חיוב</span>
                    </li>
                  </ul>
                  <p className="text-[10px] text-slate-400 pt-1">ביטול בכל עת מהגדרות → ניהול מנוי</p>
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    תשלום מאובטח בתקן PCI DSS.<br />
                    חשבונית מס תישלח אוטומטית למייל.
                  </p>
                </div>
              )}

              {/* Bottom badges */}
              <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  מאובטח על ידי Cardcom
                </span>
                <span>·</span>
                <span>ביטול בכל עת</span>
                <span>·</span>
                <span>ללא קנסות</span>
              </div>
            </div>
          </div>

          {/* ── Right: Cardcom payment iframe (appears SECOND on mobile) ── */}
          <div className="w-full lg:w-3/5 order-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <h2 className="font-semibold text-slate-800 text-sm">
                  {isTrial ? "אימות כרטיס — לא יחויב עכשיו" : "פרטי תשלום"}
                </h2>
              </div>

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
                  <p className="text-xs text-slate-400">טוען דף תשלום מאובטח...</p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                  <p className="text-sm text-red-600">{error}</p>
                  <button
                    onClick={fetchPaymentUrl}
                    className="text-xs px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                  >
                    נסה שוב
                  </button>
                </div>
              )}

              {/* Iframe */}
              {!loading && !error && cardcomUrl && (
                <iframe
                  src={cardcomUrl}
                  title="טופס תשלום מאובטח"
                  allow="payment"
                  className="w-full block"
                  style={{ height: "560px", border: "none" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export with Suspense ─────────────────────────────────────────────────
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
