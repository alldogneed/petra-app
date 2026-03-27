"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Check, Loader2, Crown, ArrowRight, Lock, Gift, CreditCard, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";

// ─── Plan details for the summary panel ───────────────────────────────────────
// Only public tiers (Free/Basic/Pro). Legacy tiers (groomer, service_dog) are
// no longer sold — navigating to /checkout?tier=groomer redirects to /upgrade.
const PLAN_DETAILS = {
  basic: {
    name: "Basic",
    price: 99,
    tagline: "מושלם לגרומרים ומאלפים עצמאיים — יחיד, מקצועי, חסכוני",
    features: [
      "לקוחות ותורים ללא הגבלה",
      "תזכורות WhatsApp אוטומטיות",
      "תיק עבודות לפני/אחרי",
      "יומן תורים + Google Calendar",
      "בקשת תשלום, טפסי קליטה ודוחות",
    ],
    highlight: false,
  },
  pro: {
    name: "Pro",
    price: 199,
    tagline: "מושלם לפנסיונים ומרכזי אילוף — צוות, גדילה, שליטה מלאה",
    features: [
      "הכל ב-Basic",
      "ניהול צוות והרשאות מתקדמות",
      "ניהול פנסיון וחדרים",
      "מודול אילוף מתקדם",
      "הזמנות אונליין 24/7",
    ],
    highlight: true,
  },
} as const;

type PlanKey = keyof typeof PLAN_DETAILS;

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const tier = (searchParams.get("tier") ?? "") as PlanKey;
  const isTrial = searchParams.get("trial") === "1";
  const plan = PLAN_DETAILS[tier];

  // ── Cardcom iframe state ──────────────────────────────────────────────────
  const [cardcomUrl, setCardcomUrl] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);

  // ── Step 1 form state ────────────────────────────────────────────────────
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formBusinessName, setFormBusinessName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formVatNumber, setFormVatNumber] = useState("");
  const [formTos, setFormTos] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [onStep2, setOnStep2] = useState(false);
  // Pre-fill loading for authenticated users
  const [authPrefillLoaded, setAuthPrefillLoaded] = useState(false);

  useEffect(() => {
    if (!plan) {
      router.replace("/upgrade");
      return;
    }
    if (authLoading) return;
    // Unauthenticated: show step 1 form — nothing to pre-fetch
    if (!user) return;
    // Authenticated: pre-fill address/vatNumber from settings
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.address)   setFormAddress(data.address);
        if (data.vatNumber) setFormVatNumber(data.vatNumber);
      })
      .catch(() => {})
      .finally(() => setAuthPrefillLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Submit step 1 form
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormErrorCode(null);
    setFormSubmitting(true);

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (user) {
        // Authenticated user — invoice fields only
        endpoint = isTrial ? "/api/cardcom/create-tokenization" : "/api/cardcom/create-payment";
        body = { tier, address: formAddress || undefined, vatNumber: formVatNumber || undefined };
      } else {
        // New user — full checkout-first form
        endpoint = isTrial ? "/api/cardcom/create-trial" : "/api/cardcom/create-checkout";
        body = {
          name: formName,
          email: formEmail,
          phone: formPhone || undefined,
          businessName: formBusinessName || undefined,
          address: formAddress || undefined,
          vatNumber: formVatNumber || undefined,
          tier,
          tosAccepted: formTos,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        router.replace(`/login?redirect=/checkout?tier=${tier}${isTrial ? "&trial=1" : ""}`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "שגיאה ביצירת טופס תשלום");
        setFormErrorCode(data.code ?? null);
        return;
      }

      if (data.url) {
        setCardcomUrl(data.url);
        setOnStep2(true);
      } else {
        setFormError("שגיאה ביצירת טופס תשלום. נסה שוב.");
      }
    } catch {
      setFormError("שגיאה בחיבור לשרת. נסה שוב.");
    } finally {
      setFormSubmitting(false);
    }
  }

  if (!plan) return null;

  // Determine what to render in the right panel
  const isNewUser = !authLoading && !user;
  // Step 1: show for everyone until they advance to step 2
  const showStep1 = !authLoading && (!user || authPrefillLoaded) && !onStep2;
  const showIframe = !!cardcomUrl && onStep2;
  const showAuthLoading = authLoading || (!!user && !authPrefillLoaded && !onStep2);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <Image
            src="/petra-logo.png"
            alt="לוגו פטרה"
            width={36}
            height={36}
            className="object-contain flex-shrink-0"
            priority
          />
          <span className="text-slate-300 mx-0.5 hidden sm:inline">·</span>
          <span className="text-slate-500 text-sm hidden sm:inline">
            {isTrial ? "ניסיון חינמי 14 יום" : isNewUser ? "רכישת מנוי" : "שדרוג מנוי"}
          </span>
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

              {/* Trust section */}
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

          {/* ── Right: Form or Cardcom iframe (appears SECOND on mobile) ── */}
          <div className="w-full lg:w-3/5 order-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Panel header */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <h2 className="font-semibold text-slate-800 text-sm">
                    {isTrial ? "אימות כרטיס — לא יחויב עכשיו" : "פרטי תשלום"}
                  </h2>
                </div>
                {/* Step indicator */}
                {!authLoading && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${!onStep2 ? "bg-brand-500 text-white" : "bg-emerald-100 text-emerald-600"}`}>
                      פרטים להפקת חשבונית
                    </span>
                    <ChevronLeft className="w-3 h-3 text-slate-300" />
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${onStep2 ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                      חיוב באשראי
                    </span>
                  </div>
                )}
              </div>

              {/* Auth loading spinner */}
              {showAuthLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                </div>
              )}

              {/* ── Step 1: Name + Email + TOS form (new user, unauthenticated trial) ── */}
              {showStep1 && (
                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    {user
                      ? "אנא אמת/י את פרטי החשבונית לפני המשך לתשלום."
                      : isTrial
                        ? "הזן את הפרטים שלך — נשלח לך כניסה למערכת באימייל לאחר שמירת הכרטיס."
                        : "הזן את הפרטים שלך — נשלח לך כניסה למערכת באימייל לאחר השלמת התשלום."}
                  </p>

                  {/* ── New-user only fields ── */}
                  {!user && (
                    <>
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          שם מלא <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="ישראל ישראלי"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          אימייל <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={formEmail}
                          onChange={(e) => { setFormEmail(e.target.value); setFormError(null); setFormErrorCode(null); }}
                          placeholder="name@example.com"
                          dir="ltr"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          טלפון נייד <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="05X-XXXXXXX"
                          dir="ltr"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>

                      {/* Business Name */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          שם העסק <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={formBusinessName}
                          onChange={(e) => setFormBusinessName(e.target.value)}
                          placeholder='למשל: "טיפוח פאו"'
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Invoice fields (everyone) ── */}
                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      כתובת <span className="text-red-500">*</span>
                      <span className="text-xs font-normal text-slate-400 mr-1">(לצורך חשבונית)</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder='למשל: רחוב הרצל 12, תל אביב'
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                    />
                  </div>

                  {/* VAT / business reg number */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      מספר עוסק / ח.פ
                      <span className="text-xs font-normal text-slate-400 mr-1">(אופציונלי)</span>
                    </label>
                    <input
                      type="text"
                      value={formVatNumber}
                      onChange={(e) => setFormVatNumber(e.target.value)}
                      placeholder="למשל: 012345678"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                    />
                  </div>

                  {/* TOS — new users only */}
                  {!user && (
                    <div className="flex items-start gap-2.5">
                      <input
                        id="tos"
                        type="checkbox"
                        required
                        checked={formTos}
                        onChange={(e) => setFormTos(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400 flex-shrink-0"
                      />
                      <label htmlFor="tos" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                        קראתי ואני מסכים/ה ל
                        <Link href="/tos" target="_blank" className="text-brand-600 hover:underline mx-1">תנאי השימוש</Link>
                        ול
                        <Link href="/privacy" target="_blank" className="text-brand-600 hover:underline mx-1">מדיניות הפרטיות</Link>
                        של פטרה
                      </label>
                    </div>
                  )}

                  {/* Error */}
                  {formError && (
                    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                      <p className="text-sm text-red-600">{formError}</p>
                      {formErrorCode === "email_exists" && (
                        <Link
                          href={`/login?redirect=/checkout?tier=${tier}${isTrial ? "&trial=1" : ""}`}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          כבר יש לך חשבון? התחבר ←
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Trial note — only shown when isTrial and new user */}
                  {isTrial && !user && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <Gift className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        לאחר שמירת הכרטיס תקבל אימייל עם פרטי הכניסה למערכת.
                        <br />
                        <span className="font-semibold">לא תחויב כלום עד תום 14 ימי הניסיון.</span>
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={formSubmitting || (!user && !formTos)}
                    className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {formSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> טוען...</>
                    ) : (
                      <><CreditCard className="w-4 h-4" /> {isTrial ? "המשך לאימות כרטיס" : "המשך לתשלום"}</>
                    )}
                  </button>

                  {!user && (
                    <p className="text-center text-xs text-slate-400">
                      כבר יש לך חשבון?{" "}
                      <Link href="/login" className="text-brand-600 hover:underline font-medium">
                        התחבר
                      </Link>
                    </p>
                  )}
                </form>
              )}

              {/* ── Loading (authenticated flow) ── */}
              {iframeLoading && (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
                  <p className="text-xs text-slate-400">טוען דף תשלום מאובטח...</p>
                </div>
              )}

              {/* ── Error (authenticated flow) ── */}
              {!iframeLoading && iframeError && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                  <p className="text-sm text-red-600">{iframeError}</p>
                  <button
                    onClick={() => setOnStep2(false)}
                    className="text-xs px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                  >
                    נסה שוב
                  </button>
                </div>
              )}

              {/* ── Cardcom iframe ── */}
              {showIframe && (
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
