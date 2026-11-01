"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Check, Loader2, Crown, ArrowRight, Lock, CreditCard, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";
import { currencySymbol } from "@/lib/format";

// Petra subscriptions are charged in ILS through Cardcom (USD/Stripe = Phase 6).
const PLAN_CURRENCY = "ILS"; // i18n-ok: Cardcom subscription charges are ILS

// ─── Plan details for the summary panel ───────────────────────────────────────
// Only public tiers (Free/Basic/Pro). Legacy tiers (groomer, service_dog) are
// no longer sold — navigating to /checkout?tier=groomer redirects to /upgrade.
const PLAN_DETAILS = {
  basic: {
    name: "Basic",
    price: 99,
    // tagline + feature labels: checkout.checkoutPage.plans.basic.*
    features: ["unlimitedClients", "calendar", "paymentRequests", "portfolio", "reports"],
    highlight: false,
  },
  pro: {
    name: "Pro",
    price: 199,
    // tagline + feature labels: checkout.checkoutPage.plans.pro.*
    features: ["everythingInBasic", "whatsappReminders", "contracts", "teamBoarding", "onlineBookings"],
    highlight: true,
  },
} as const;

type PlanKey = keyof typeof PLAN_DETAILS;

// Business-type values are sent to the API / stored as-is (Hebrew = data); labels come from messages.
const BUSINESS_TYPES = [
  { value: "חברה (ח.פ)", key: "company" }, // i18n-ok: value sent to the API
  { value: "עוסק מורשה (ע.מ)", key: "licensedDealer" }, // i18n-ok: value sent to the API
  { value: "עוסק פטור", key: "exemptDealer" }, // i18n-ok: value sent to the API
] as const;

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("checkout.checkoutPage");
  const tc = useTranslations("common");
  const locale = localeFromBusiness({ locale: useLocale() });
  const cfg = LOCALE_CONFIG[locale];
  const symbol = currencySymbol({ locale, currency: PLAN_CURRENCY });

  const tier = (searchParams.get("tier") ?? "") as PlanKey;
  // trial param is read but ignored — trial flow removed
  const testAmount = searchParams.get("test_amount");
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
  const [formBusinessType, setFormBusinessType] = useState("");
  const [formBillingEmail, setFormBillingEmail] = useState("");
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
    // Authenticated: pre-fill billing email + address/vatNumber from settings
    if (user.email) setFormBillingEmail(user.email);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.address)   setFormAddress(data.address);
        if (data.vatNumber) setFormVatNumber(data.vatNumber);
        if (data.businessRegNumber) setFormBusinessType(data.businessRegNumber);
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

    // Client-side validation for businessType (not covered by native required)
    if (!formBusinessType) {
      setFormError(t("errors.businessTypeRequired"));
      return;
    }

    setFormSubmitting(true);

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (user) {
        // Authenticated user — invoice fields only
        endpoint = "/api/cardcom/create-payment";
        body = {
          tier,
          phone: formPhone || undefined,
          address: formAddress || undefined,
          vatNumber: formVatNumber || undefined,
          businessType: formBusinessType || undefined,
          billingEmail: formBillingEmail || undefined,
          ...(testAmount ? { testAmount } : {}),
        };
      } else {
        // New user — full checkout-first form
        endpoint = "/api/cardcom/create-checkout";
        body = {
          name: formName,
          email: formEmail,
          phone: formPhone || undefined,
          businessName: formBusinessName || undefined,
          address: formAddress || undefined,
          vatNumber: formVatNumber || undefined,
          businessType: formBusinessType || undefined,
          billingEmail: formBillingEmail || undefined,
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
        router.replace(`/login?redirect=/checkout?tier=${tier}`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? t("errors.createPaymentForm"));
        setFormErrorCode(data.code ?? null);
        return;
      }

      if (data.url) {
        // Save lowProfileCode for success page to activate subscription (auth user flow)
        if (data.lowProfileCode) {
          try { localStorage.setItem("pendingLowProfileCode", data.lowProfileCode); } catch {}
        }
        // Save checkoutId for new user flow (not actually needed since success-redirect handles it,
        // but kept for diagnostics)
        if (data.checkoutId) {
          try { localStorage.setItem("pendingCheckoutId", data.checkoutId); } catch {}
        }
        setCardcomUrl(data.url);
        setOnStep2(true);
      } else {
        setFormError(t("errors.createPaymentFormRetry"));
      }
    } catch {
      setFormError(t("errors.serverConnection"));
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
    <div className="min-h-screen bg-slate-50" dir={cfg.dir}>
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <Image
            src="/petra-logo.png"
            alt={t("topBar.logoAlt")}
            width={36}
            height={36}
            className="object-contain flex-shrink-0"
            priority
          />
          <span className="text-slate-300 mx-0.5 hidden sm:inline">·</span>
          <span className="text-slate-500 text-sm hidden sm:inline">
            {isNewUser ? t("topBar.purchase") : t("topBar.upgrade")}
          </span>
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5 ltr:-scale-x-100" />
          {t("topBar.back")}
        </button>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

          {/* ── Left: Order Summary (appears FIRST on mobile) ── */}
          <div className="w-full lg:w-2/5 order-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-5">
                {t("summary.yourPackage")}
              </p>

              {/* Plan name + price */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className={`w-4 h-4 ${plan.highlight ? "text-brand-500" : "text-amber-500"}`} />
                    <span className="text-lg font-bold text-slate-900">{t("summary.planName", { name: plan.name })}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug max-w-[180px]">{t(`plans.${tier}.tagline`)}</p>
                </div>
                <div className="text-end flex-shrink-0 ms-2">
                  {testAmount ? (
                    <>
                      <div className="text-3xl font-extrabold text-red-600 leading-none">{symbol}{testAmount}</div>
                      <div className="text-xs text-red-400 mt-1 text-center line-through">{symbol}{plan.price}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-extrabold text-slate-900 leading-none">{symbol}{plan.price}</div>
                      <div className="text-xs text-slate-400 mt-1 text-center">{t("summary.perMonth")}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 border-t border-slate-100 pt-4 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t(`plans.${tier}.features.${f}`)}
                  </li>
                ))}
              </ul>

              {/* Total row */}
              <div className="flex items-center justify-between py-3 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-700">{t("summary.totalDue")}</span>
                <span className={`text-base font-extrabold ${testAmount ? "text-red-600" : "text-slate-900"}`}>
                  {symbol}{testAmount ?? plan.price} <span className="text-xs font-normal text-slate-400">{t("summary.perMonthSpaced")}</span>
                </span>
              </div>
              {testAmount && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 text-center font-medium">
                  {t("summary.testMode", { currencySymbol: symbol, testAmount, price: plan.price })}
                </div>
              )}

              {/* Trust section */}
              <div className="mt-4 flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {t("summary.securePayment")}<br />
                  {t("summary.taxInvoiceByEmail")}
                </p>
              </div>

              {/* Bottom badges */}
              <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {t("summary.securedByCardcom")}
                </span>
                <span>·</span>
                <span>{t("summary.cancelAnytime")}</span>
                <span>·</span>
                <span>{t("summary.noPenalties")}</span>
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
                    {t("panel.title")}
                  </h2>
                </div>
                {/* Step indicator */}
                {!authLoading && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${!onStep2 ? "bg-brand-500 text-white" : "bg-emerald-100 text-emerald-600"}`}>
                      {t("panel.stepInvoiceDetails")}
                    </span>
                    <ChevronLeft className="w-3 h-3 text-slate-300 ltr:-scale-x-100" />
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${onStep2 ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {t("panel.stepCardCharge")}
                    </span>
                  </div>
                )}
              </div>

              {/* Auth loading spinner */}
              {showAuthLoading && (
                <PetraLoader variant="inline" />
              )}

              {/* ── Step 1: Name + Email + TOS form (new user, unauthenticated trial) ── */}
              {showStep1 && (
                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    {user
                      ? t("form.introAuthenticated")
                      : t("form.introNewUser")}
                  </p>

                  {/* ── New-user only fields ── */}
                  {!user && (
                    <>
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {t("form.fullName")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder={t("form.fullNamePlaceholder")}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {t("form.email")} <span className="text-red-500">*</span>
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
                          {t("form.mobilePhone")} <span className="text-red-500">*</span>
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
                          {t("form.businessName")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={formBusinessName}
                          onChange={(e) => setFormBusinessName(e.target.value)}
                          placeholder={t("form.businessNamePlaceholder")}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Invoice fields (everyone) ── */}

                  {/* Billing Email (authenticated users only — show their email) */}
                  {user && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {t("form.billingEmail")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={formBillingEmail}
                          onChange={(e) => setFormBillingEmail(e.target.value)}
                          placeholder="name@example.com"
                          dir="ltr"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {t("form.billingPhone")} <span className="text-red-500">*</span>
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
                    </>
                  )}

                  {/* Business Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t("form.businessType")} <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {BUSINESS_TYPES.map(({ value: type, key }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormBusinessType(type)}
                          className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition-colors ${
                            formBusinessType === type
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {t(`form.businessTypes.${key}`)}
                        </button>
                      ))}
                    </div>
                    {/* Hidden required input for native form validation */}
                    <input
                      type="text"
                      required
                      value={formBusinessType}
                      onChange={() => {}}
                      className="sr-only"
                      tabIndex={-1}
                    />
                  </div>

                  {/* VAT / business reg number */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t("form.vatNumber")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={8}
                      maxLength={15}
                      value={formVatNumber}
                      onChange={(e) => setFormVatNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder={t("form.vatNumberPlaceholder")}
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-300"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t("form.address")} <span className="text-red-500">*</span>
                      <span className="text-xs font-normal text-slate-400 ms-1">{t("form.addressHint")}</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder={t("form.addressPlaceholder")}
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
                        {t.rich("form.tos", {
                          tos: (chunks) => <Link href="/tos" target="_blank" className="text-brand-600 hover:underline mx-1">{chunks}</Link>,
                          privacy: (chunks) => <Link href="/privacy" target="_blank" className="text-brand-600 hover:underline mx-1">{chunks}</Link>,
                        })}
                      </label>
                    </div>
                  )}

                  {/* Error */}
                  {formError && (
                    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                      <p className="text-sm text-red-600">{formError}</p>
                      {formErrorCode === "email_exists" && (
                        <Link
                          href={`/login?redirect=/checkout?tier=${tier}`}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          {t("form.emailExistsLogin")}
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={formSubmitting || (!user && !formTos)}
                    className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {formSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {tc("loading")}</>
                    ) : (
                      <><CreditCard className="w-4 h-4" /> {t("form.continueToPayment")}</>
                    )}
                  </button>

                  {!user && (
                    <p className="text-center text-xs text-slate-400">
                      {t("form.haveAccount")}{" "}
                      <Link href="/login" className="text-brand-600 hover:underline font-medium">
                        {t("form.login")}
                      </Link>
                    </p>
                  )}
                </form>
              )}

              {/* ── Loading (authenticated flow) ── */}
              {iframeLoading && (
                <div className="flex flex-col items-center justify-center pb-10">
                  <PetraLoader variant="inline" />
                  <p className="text-xs text-slate-400">{t("iframe.loading")}</p>
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
                    {t("iframe.retry")}
                  </button>
                </div>
              )}

              {/* ── Cardcom iframe ── */}
              {showIframe && (
                <iframe
                  src={cardcomUrl}
                  title={t("iframe.title")}
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
      fallback={<PetraLoader variant="splash" />}
    >
      <CheckoutContent />
    </Suspense>
  );
}
