"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Tag,
  Sparkles,
  X,
  MessageCircle,
  Calendar,
  Users,
  CreditCard,
  Bell,
  BarChart3,
  ClipboardList,
  Building2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { hasFeature } from "@/lib/feature-flags";
import type { TierKey } from "@/lib/feature-flags";
import { LEGAL_ENTITY_TYPES } from "@/lib/legal-entity";
import { PetraLoader } from "@/components/ui/PetraLoader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessInfo {
  name: string;
  phone: string;
  tier: TierKey;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: "welcome",  icon: Sparkles    },  // 0
  { id: "business", icon: Building2   },  // 1 — mandatory
  { id: "pricing",  icon: Tag         },  // 2
  { id: "client",   icon: UserPlus    },  // 3 — skippable
  { id: "done",     icon: CheckCircle2 }, // 4
] as const;

// ─── Inner page ───────────────────────────────────────────────────────────────

function OnboardingInner() {
  const t = useTranslations("onboarding.onboardingPage");
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);

  // Load business info
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setBusiness({
          name: d.name ?? "",
          phone: d.phone ?? "",
          tier: (d.effectiveTier ?? d.tier ?? "free") as TierKey,
        });
      })
      .catch(() => setBusiness({ name: "", phone: "", tier: "free" }));
  }, []);

  // Detect return from Google OAuth (keep for backward-compat)
  useEffect(() => {
    const gcal = searchParams.get("gcal");
    if (gcal === "connected") {
      setStep(4);
      toast.success(t("toasts.gcalConnected"));
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const tier = business?.tier ?? "free";

  async function handleSkip() {
    await fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: new Date().toISOString(), skipped: true }),
    });
    const pendingPlan = sessionStorage.getItem("pending_plan");
    if (pendingPlan) {
      sessionStorage.removeItem("pending_plan");
      window.location.href = `/upgrade?autostart=${pendingPlan}`;
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="w-full max-w-2xl">

      {/* ── Logo ── */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-md">
          <Image src="/icon.png" alt="Petra" width={56} height={56} className="w-full h-full object-cover" />
        </div>
        <span className="text-lg font-bold text-petra-text tracking-tight">Petra</span>
      </div>

      {/* ── Skip button — only from client step (3) onwards ── */}
      {step === 3 && (
        <div className="text-start mb-4">
          <button
            onClick={handleSkip}
            className="text-sm text-petra-muted hover:text-petra-text flex items-center gap-1 ms-auto"
          >
            <X className="w-3.5 h-3.5" />
            {t("continueToDashboard")}
          </button>
        </div>
      )}

      {/* ── Progress bar ── */}
      {step < 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const Icon = s.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                    done ? "bg-brand-500 border-brand-500 text-white"
                      : active ? "bg-white border-brand-500 text-brand-500"
                        : "bg-white border-slate-200 text-petra-muted"
                  )}>
                    {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium hidden sm:block",
                    active ? "text-brand-600" : "text-petra-muted"
                  )}>
                    {t(`steps.${s.id}`)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="relative h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 start-0 bg-gradient-to-l ltr:bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Step content ── */}
      <div className="card p-8 shadow-lg animate-fade-in">
        {step === 4 ? (
          <StepDone
            onGoToDashboard={async () => {
              await fetch("/api/onboarding/progress", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completedAt: new Date().toISOString() }),
              });
              const pendingPlan = sessionStorage.getItem("pending_plan");
              if (pendingPlan) {
                sessionStorage.removeItem("pending_plan");
                window.location.href = `/upgrade?autostart=${pendingPlan}`;
              } else {
                window.location.href = "/dashboard";
              }
            }}
          />
        ) : step === 0 ? (
          <StepWelcome
            businessName={business?.name ?? ""}
            tier={tier}
            onNext={() => setStep(1)}
          />
        ) : step === 1 ? (
          <StepBusiness
            initialName={business?.name ?? ""}
            initialPhone={business?.phone ?? ""}
            onNext={(updatedName) => {
              setBusiness((prev) => prev ? { ...prev, name: updatedName } : prev);
              setStep(2);
            }}
          />
        ) : step === 2 ? (
          <StepPricing onNext={() => setStep(3)} onBack={() => setStep(1)} />
        ) : (
          <StepClient onNext={() => setStep(4)} onBack={() => setStep(2)} onSkip={handleSkip} />
        )}
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { cfg } = useBusinessLocale();
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-50 flex items-center justify-center p-4">
      <Toaster position="top-center" dir={cfg.dir} />
      <Suspense fallback={<PetraLoader variant="splash" />}>
        <OnboardingInner />
      </Suspense>
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

// `id` → welcome.features.<id>.{title,desc} in messages
const FEATURES_BY_TIER: Record<string, { icon: React.ComponentType<{ className?: string }>; id: string }[]> = {
  free: [
    { icon: Users,         id: "customers" },
    { icon: Calendar,      id: "calendar" },
    { icon: CreditCard,    id: "basicPayments" },
    { icon: ClipboardList, id: "tasks" },
  ],
  basic: [
    { icon: Users,         id: "unlimitedCustomers" },
    { icon: Calendar,      id: "calendarGoogle" },
    { icon: Bell,          id: "whatsappReminders" },
    { icon: CreditCard,    id: "payments" },
  ],
  default: [
    { icon: Users,         id: "customersLeads" },
    { icon: Calendar,      id: "calendarGoogle" },
    { icon: BarChart3,     id: "reports" },
    { icon: MessageCircle, id: "whatsappAutomations" },
  ],
};

function StepWelcome({
  businessName,
  tier,
  onNext,
}: {
  businessName: string;
  tier: TierKey;
  onNext: () => void;
}) {
  const t = useTranslations("onboarding.onboardingPage");
  const features = FEATURES_BY_TIER[tier] ?? FEATURES_BY_TIER.default;
  const greeting = businessName ? t("welcome.greetingNamed", { name: businessName }) : t("welcome.greeting");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-petra-text mb-2">{greeting}</h1>
        <p className="text-petra-muted text-sm leading-relaxed max-w-md mx-auto">
          {t("welcome.intro")}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-3 text-center">
          {t("welcome.whatAwaits")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, id }, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-petra-text leading-tight">{t(`welcome.features.${id}.title`)}</p>
                <p className="text-[11px] text-petra-muted mt-0.5 leading-snug">{t(`welcome.features.${id}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-sm text-petra-muted text-center">
          {t("welcome.setupTime")}
        </p>
      </div>

      <button onClick={onNext} className="btn-primary w-full justify-center flex items-center gap-2">
        {t("welcome.cta")}
        <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
      </button>
    </div>
  );
}

// ─── Step 1: Business Details (mandatory) ─────────────────────────────────────

function StepBusiness({
  initialName,
  initialPhone,
  onNext,
}: {
  initialName: string;
  initialPhone: string;
  onNext: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [legalEntityType, setLegalEntityType] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("onboarding.onboardingPage");
  const tc = useTranslations("common");

  const selectedEntity = LEGAL_ENTITY_TYPES.find((e) => e.key === legalEntityType);

  async function handleSubmit() {
    if (!name.trim()) { setError(t("business.errors.nameRequired")); return; }
    if (!phone.trim()) { setError(t("business.errors.phoneRequired")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          ...(legalEntityType ? { legalEntityType } : {}),
          ...(legalEntityType && vatNumber.trim() ? { vatNumber: vatNumber.trim() } : {}),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || t("business.errors.saveFailed")); return; }
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepCompleted1: true }),
      });
      toast.success(t("business.toasts.saved"));
      onNext(name.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">{t("business.title")}</h2>
        <p className="text-sm text-petra-muted">{t("business.subtitle")}</p>
      </div>

      <div>
        <label className="label">{t("business.fields.name")}</label>
        <input
          className="input w-full mt-1"
          placeholder={t("business.placeholders.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="label">{t("business.fields.phone")}</label>
        <input
          className="input w-full mt-1"
          placeholder="050-0000000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          dir="ltr"
        />
        <p className="text-xs text-petra-muted mt-1">{t("business.hints.phone")}</p>
      </div>

      <div>
        <label className="label">{t("business.fields.legalEntityType")}</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {LEGAL_ENTITY_TYPES.map((entity) => (
            <button
              key={entity.key}
              type="button"
              onClick={() => setLegalEntityType(legalEntityType === entity.key ? "" : entity.key)}
              className={`px-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                legalEntityType === entity.key
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-petra-muted hover:border-slate-300"
              }`}
            >
              {entity.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-petra-muted mt-1">{t("business.hints.legalEntityType")}</p>
      </div>

      {selectedEntity && !selectedEntity.vatExempt && (
        <div>
          <label className="label">{selectedEntity.regNumberLabel}</label>
          <input
            className="input w-full mt-1"
            placeholder={selectedEntity.regNumberLabel}
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            dir="ltr"
            inputMode="numeric"
          />
          <p className="text-xs text-petra-muted mt-1">{t("business.hints.vatNumber")}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="btn-primary w-full justify-center flex items-center gap-2"
      >
        {saving ? tc("progress.saving") : t("business.submit")}
        <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
      </button>

      <p className="text-center text-xs text-petra-muted">
        {t("business.cannotSkip")}
      </p>
    </div>
  );
}

// ─── Step 2: Pricing (encourage 2 services) ───────────────────────────────────

// `value` is stored as Service.type (data, sent to the API); `id` → pricing.serviceTypes.<id>
const SERVICE_TYPES = [
  { value: "אילוף", id: "training" }, // i18n-ok
  { value: "פנסיון", id: "boarding" }, // i18n-ok
  { value: "טיפוח", id: "grooming" }, // i18n-ok
  { value: "מוצרים", id: "products" }, // i18n-ok
] as const;
const DEFAULT_SERVICE_TYPE: string = SERVICE_TYPES[0].value;

function StepPricing({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useTranslations("onboarding.onboardingPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(DEFAULT_SERVICE_TYPE);
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [servicesAdded, setServicesAdded] = useState(0);

  function resetForm() {
    setName("");
    setPrice("");
    setType(DEFAULT_SERVICE_TYPE);
    setDuration("60");
    setError("");
  }

  async function handleSave() {
    if (!name.trim()) { setError(t("pricing.errors.nameRequired")); return; }
    if (!price.trim() || isNaN(Number(price))) { setError(t("pricing.errors.priceInvalid")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, duration: parseInt(duration), price: parseFloat(price) }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || t("pricing.errors.generic")); return; }
      if (servicesAdded === 0) {
        await fetch("/api/onboarding/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepCompleted2: true }),
        });
      }
      toast.success(t("pricing.toasts.added", { n: servicesAdded + 1 }));
      setServicesAdded((n) => n + 1);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">{t("pricing.title")}</h2>
        <p className="text-sm text-petra-muted">
          {servicesAdded === 0
            ? t("pricing.subtitle.none")
            : servicesAdded === 1
            ? t("pricing.subtitle.one")
            : t("pricing.subtitle.many", { count: servicesAdded })}
        </p>
      </div>

      {/* Services added so far */}
      {servicesAdded > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: servicesAdded }).map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              <CheckCircle2 className="w-3 h-3" />
              {t("pricing.serviceChip", { n: i + 1 })}
            </span>
          ))}
        </div>
      )}

      {/* Form */}
      <div>
        <label className="label">{servicesAdded === 0 ? t("pricing.fields.firstName") : t("pricing.fields.nextName")}</label>
        <input
          className="input w-full mt-1"
          placeholder={servicesAdded === 0 ? t("pricing.placeholders.firstName") : t("pricing.placeholders.nextName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label mb-2">{t("pricing.fields.category")}</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SERVICE_TYPES.map((st) => (
            <button key={st.value} onClick={() => setType(st.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-all",
                type === st.value
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-slate-200 text-petra-muted hover:border-brand-300"
              )}>
              {t(`pricing.serviceTypes.${st.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{t("pricing.fields.duration")}</label>
          <input type="number" className="input w-full mt-1" value={duration}
            min={15} step={15} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("pricing.fields.price", { currency: currencySymbol({ locale, currency }) })}</label>
          <input type="number" className="input w-full mt-1" placeholder="200"
            value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4 ltr:-scale-x-100" />{t("back")}
        </button>

        {servicesAdded === 0 ? (
          /* Must add at least 1 before continuing */
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
            {saving ? tc("progress.saving") : t("pricing.addService")}
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          /* After 1 service: can add more or continue */
          <>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="btn-secondary flex items-center gap-2 flex-1 justify-center">
              {saving ? tc("progress.saving") : (
                <>
                  <Plus className="w-4 h-4" />
                  {t("pricing.addAnother")}
                </>
              )}
            </button>
            <button onClick={onNext} className="btn-primary flex items-center gap-1">
              {t("continue")}
              <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
            </button>
          </>
        )}
      </div>

      {servicesAdded >= 1 && (
        <p className="text-center text-xs text-petra-muted">
          {t("pricing.recommendTwo")}
        </p>
      )}
    </div>
  );
}

// ─── Step 3: First Client (skippable) ────────────────────────────────────────

function StepClient({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [dogBreed, setDogBreed] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("onboarding.onboardingPage");
  const tc = useTranslations("common");

  async function handleSubmit() {
    if (!clientName.trim()) { setError(t("client.errors.nameRequired")); return; }
    if (!clientPhone.trim()) { setError(t("client.errors.phoneRequired")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, clientPhone, dogName, dogBreed }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || t("client.errors.generic")); return; }
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepCompleted3: true }),
      });
      toast.success(t("client.toasts.added"));
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">{t("client.title")}</h2>
        <p className="text-sm text-petra-muted">{t("client.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{t("client.fields.name")}</label>
          <input className="input w-full mt-1" placeholder={t("client.placeholders.name")}
            value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("client.fields.phone")}</label>
          <input className="input w-full mt-1" placeholder="050-0000000"
            value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium text-petra-text mb-3">{t("client.dogSection")}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t("client.fields.dogName")}</label>
            <input className="input w-full mt-1" placeholder={t("client.placeholders.dogName")}
              value={dogName} onChange={(e) => setDogName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("client.fields.breed")}</label>
            <input className="input w-full mt-1" placeholder={t("client.placeholders.breed")}
              value={dogBreed} onChange={(e) => setDogBreed(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4 ltr:-scale-x-100" />{t("back")}
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
          {saving ? tc("progress.saving") : t("continue")}
          <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
        </button>
      </div>

      <button onClick={onSkip} className="w-full text-sm text-petra-muted hover:text-petra-text transition-colors text-center py-1">
        {t("client.skip")}
      </button>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  const t = useTranslations("onboarding.onboardingPage");
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-petra-text mb-2">{t("done.title")}</h2>
        <p className="text-petra-muted leading-relaxed text-sm">
          {t.rich("done.body", {
            link: (chunks) => <a href="/settings" className="text-brand-600 underline">{chunks}</a>,
          })}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        {[
          { href: "/customers", id: "customers" },
          { href: "/calendar", id: "calendar" },
          { href: "/leads", id: "leads" },
        ].map(({ href, id }) => (
          <a key={href} href={href}
            className="p-3 bg-slate-50 rounded-xl text-sm font-medium text-petra-text hover:bg-brand-50 hover:text-brand-600 transition-colors border border-slate-200">
            {t(`done.links.${id}`)}
          </a>
        ))}
      </div>
      <button onClick={onGoToDashboard} className="btn-primary w-full justify-center flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        {t("done.goToDashboard")}
      </button>
    </div>
  );
}
