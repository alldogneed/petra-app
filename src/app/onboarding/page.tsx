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
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { hasFeature } from "@/lib/feature-flags";
import type { TierKey } from "@/lib/feature-flags";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessInfo {
  name: string;
  phone: string;
  tier: TierKey;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { label: "ברוך הבא",    icon: Sparkles    },  // 0
  { label: "פרטי עסק",   icon: Building2   },  // 1 — mandatory
  { label: "מחירון",     icon: Tag         },  // 2
  { label: "לקוח ראשון", icon: UserPlus    },  // 3 — skippable
  { label: "סיום",       icon: CheckCircle2 }, // 4
];

// ─── Inner page ───────────────────────────────────────────────────────────────

function OnboardingInner() {
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
      toast.success("יומן Google חובר בהצלחה!");
    }
  }, [searchParams]);

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
        <div className="text-right mb-4">
          <button
            onClick={handleSkip}
            className="text-sm text-petra-muted hover:text-petra-text flex items-center gap-1 ms-auto"
          >
            <X className="w-3.5 h-3.5" />
            המשך לדשבורד
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
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="relative h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-brand-500 to-brand-400 rounded-full transition-all duration-500"
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-50 flex items-center justify-center p-4">
      <Toaster position="top-center" dir="rtl" />
      <Suspense fallback={<div className="text-petra-muted">טוען...</div>}>
        <OnboardingInner />
      </Suspense>
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

const FEATURES_BY_TIER: Record<string, { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[]> = {
  free: [
    { icon: Users,         title: "ניהול לקוחות",     desc: "כרטיסי לקוח, כלבים, היסטוריה" },
    { icon: Calendar,      title: "יומן תורים",        desc: "תזמון פגישות בקליק" },
    { icon: CreditCard,    title: "תשלומים בסיסיים",  desc: "מעקב הכנסות ותשלומים" },
    { icon: ClipboardList, title: "משימות",            desc: "ניהול רשימת מטלות" },
  ],
  basic: [
    { icon: Users,         title: "לקוחות ללא הגבלה", desc: "כרטיסי לקוח, כלבים, היסטוריה" },
    { icon: Calendar,      title: "יומן + Google",     desc: "סנכרון אוטומטי עם Google Calendar" },
    { icon: Bell,          title: "תזכורות WhatsApp",  desc: "אוטומטיות 48 שעות לפני כל תור" },
    { icon: CreditCard,    title: "תשלומים",           desc: "מעקב מלא + קישורי תשלום" },
  ],
  default: [
    { icon: Users,         title: "לקוחות ולידים",    desc: "CRM מלא כולל משפך מכירות" },
    { icon: Calendar,      title: "יומן + Google",     desc: "סנכרון אוטומטי עם Google Calendar" },
    { icon: BarChart3,     title: "דוחות",             desc: "גרפי הכנסות וביצועים" },
    { icon: MessageCircle, title: "אוטומציות WhatsApp", desc: "תזכורות, מעקבים, ימי הולדת" },
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
  const features = FEATURES_BY_TIER[tier] ?? FEATURES_BY_TIER.default;
  const greeting = businessName ? `ברוך הבא, ${businessName}! 🎉` : "ברוך הבא ל-Petra! 🎉";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-petra-text mb-2">{greeting}</h1>
        <p className="text-petra-muted text-sm leading-relaxed max-w-md mx-auto">
          Petra היא מערכת ניהול לעסקי חיות מחמד בישראל — מאלפים, פנסיון, גרומרים ומרכזי הכשרת כלבי שירות.
          כל הכלים שצריך במקום אחד: לקוחות, תורים, תשלומים ותקשורת.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-3 text-center">
          מה מחכה לך
        </p>
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-petra-text leading-tight">{title}</p>
                <p className="text-[11px] text-petra-muted mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-sm text-petra-muted text-center">
          ⏱ ההגדרה לוקחת כ-3 דקות — בואו נתחיל
        </p>
      </div>

      <button onClick={onNext} className="btn-primary w-full justify-center flex items-center gap-2">
        בואו נגדיר את העסק
        <ChevronLeft className="w-4 h-4" />
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) { setError("שם העסק הוא שדה חובה"); return; }
    if (!phone.trim()) { setError("טלפון עסק הוא שדה חובה"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "שגיאה בשמירה"); return; }
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepCompleted1: true }),
      });
      toast.success("פרטי העסק נשמרו!");
      onNext(name.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">פרטי העסק</h2>
        <p className="text-sm text-petra-muted">שם ומספר טלפון — נדרשים לתזכורות WhatsApp ולדף ההזמנות האונליין שלך</p>
      </div>

      <div>
        <label className="label">שם העסק *</label>
        <input
          className="input w-full mt-1"
          placeholder="לדוגמה: אילוף כלבים ישראלי"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="label">טלפון עסק *</label>
        <input
          className="input w-full mt-1"
          placeholder="050-0000000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          dir="ltr"
        />
        <p className="text-xs text-petra-muted mt-1">ישמש לשליחת תזכורות WhatsApp אוטומטיות ולדף ההזמנות שלך</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="btn-primary w-full justify-center flex items-center gap-2"
      >
        {saving ? "שומר..." : "המשך — הגדרת מחירון"}
        <ChevronLeft className="w-4 h-4" />
      </button>

      <p className="text-center text-xs text-petra-muted">
        לא ניתן לדלג — פרטים אלה נדרשים לתפקוד מלא של המערכת
      </p>
    </div>
  );
}

// ─── Step 2: Pricing (encourage 2 services) ───────────────────────────────────

const SERVICE_TYPES = ["אילוף", "פנסיון", "טיפוח", "מוצרים"];

function StepPricing({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("אילוף");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [servicesAdded, setServicesAdded] = useState(0);

  function resetForm() {
    setName("");
    setPrice("");
    setType("אילוף");
    setDuration("60");
    setError("");
  }

  async function handleSave() {
    if (!name.trim()) { setError("שם השירות הוא שדה חובה"); return; }
    if (!price.trim() || isNaN(Number(price))) { setError("מחיר לא תקין"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, duration: parseInt(duration), price: parseFloat(price) }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "שגיאה"); return; }
      if (servicesAdded === 0) {
        await fetch("/api/onboarding/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepCompleted2: true }),
        });
      }
      toast.success(`שירות ${servicesAdded + 1} נוסף בהצלחה!`);
      setServicesAdded((n) => n + 1);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">הגדרת מחירון</h2>
        <p className="text-sm text-petra-muted">
          {servicesAdded === 0
            ? "הוסף לפחות 2 שירותים — זה הלב של המערכת"
            : servicesAdded === 1
            ? "מצוין! הוסף עוד שירות אחד — מומלץ לפחות 2"
            : `${servicesAdded} שירותים נוספו ✓ — תוכל להוסיף עוד מהגדרות`}
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
              שירות {i + 1} נוסף
            </span>
          ))}
        </div>
      )}

      {/* Form */}
      <div>
        <label className="label">{servicesAdded === 0 ? "שם השירות הראשון *" : "שם השירות הנוסף *"}</label>
        <input
          className="input w-full mt-1"
          placeholder={servicesAdded === 0 ? "לדוגמה: שיעור אילוף בסיסי" : "לדוגמה: שיעור אילוף מתקדם"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label mb-2">קטגוריה</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SERVICE_TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-all",
                type === t
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-slate-200 text-petra-muted hover:border-brand-300"
              )}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">משך (דקות)</label>
          <input type="number" className="input w-full mt-1" value={duration}
            min={15} step={15} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="label">מחיר (₪) *</label>
          <input type="number" className="input w-full mt-1" placeholder="200"
            value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />חזור
        </button>

        {servicesAdded === 0 ? (
          /* Must add at least 1 before continuing */
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
            {saving ? "שומר..." : "הוסף שירות"}
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          /* After 1 service: can add more or continue */
          <>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="btn-secondary flex items-center gap-2 flex-1 justify-center">
              {saving ? "שומר..." : (
                <>
                  <Plus className="w-4 h-4" />
                  הוסף עוד שירות
                </>
              )}
            </button>
            <button onClick={onNext} className="btn-primary flex items-center gap-1">
              המשך
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {servicesAdded >= 1 && (
        <p className="text-center text-xs text-petra-muted">
          מומלץ להוסיף לפחות 2 שירותים לפני שממשיכים
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

  async function handleSubmit() {
    if (!clientName.trim()) { setError("שם הלקוח הוא שדה חובה"); return; }
    if (!clientPhone.trim()) { setError("טלפון הוא שדה חובה"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, clientPhone, dogName, dogBreed }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "שגיאה"); return; }
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepCompleted3: true }),
      });
      toast.success("לקוח ראשון נוסף בהצלחה!");
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">הוסף את הלקוח הראשון שלך</h2>
        <p className="text-sm text-petra-muted">תוכל לייבא לקוחות נוספים מאוחר יותר</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">שם הלקוח *</label>
          <input className="input w-full mt-1" placeholder="ישראל ישראלי"
            value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div>
          <label className="label">טלפון *</label>
          <input className="input w-full mt-1" placeholder="050-0000000"
            value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium text-petra-text mb-3">פרטי כלב (אופציונלי)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">שם הכלב</label>
            <input className="input w-full mt-1" placeholder="רקס"
              value={dogName} onChange={(e) => setDogName(e.target.value)} />
          </div>
          <div>
            <label className="label">גזע</label>
            <input className="input w-full mt-1" placeholder="גרמני"
              value={dogBreed} onChange={(e) => setDogBreed(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />חזור
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
          {saving ? "שומר..." : "המשך"}
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <button onClick={onSkip} className="w-full text-sm text-petra-muted hover:text-petra-text transition-colors text-center py-1">
        דלג לעת עתה — אוסיף לקוחות אחר כך
      </button>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-petra-text mb-2">הכל מוכן! 🐾</h2>
        <p className="text-petra-muted leading-relaxed text-sm">
          Petra מוכנה לשרת את העסק שלך.
          תוכל לחבר יומן Google ולהגדיר תזכורות WhatsApp תחת{" "}
          <a href="/settings" className="text-brand-600 underline">הגדרות</a>.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        {[
          { href: "/customers", label: "לקוחות" },
          { href: "/calendar", label: "יומן" },
          { href: "/leads", label: "לידים" },
        ].map(({ href, label }) => (
          <a key={href} href={href}
            className="p-3 bg-slate-50 rounded-xl text-sm font-medium text-petra-text hover:bg-brand-50 hover:text-brand-600 transition-colors border border-slate-200">
            {label}
          </a>
        ))}
      </div>
      <button onClick={onGoToDashboard} className="btn-primary w-full justify-center flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        עבור לדשבורד
      </button>
    </div>
  );
}
