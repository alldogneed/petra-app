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
  CalendarDays,
  Sparkles,
  X,
  MessageCircle,
  Calendar,
  Users,
  CreditCard,
  Bell,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { hasFeature } from "@/lib/feature-flags";
import type { TierKey } from "@/lib/feature-flags";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessInfo {
  name: string;
  tier: TierKey;
  trialActive: boolean;
  trialEndsAt: string | null;
}

// ─── Step definitions (dynamic per tier) ─────────────────────────────────────

function getSteps(tier: TierKey) {
  const gcal = hasFeature(tier, "gcal_sync");
  return [
    { label: "ברוך הבא", icon: Sparkles },
    { label: "לקוח ראשון", icon: UserPlus },
    { label: "מחירון", icon: Tag },
    gcal
      ? { label: "יומן Google", icon: CalendarDays }
      : { label: "תזכורות", icon: Bell },
    { label: "סיום", icon: CheckCircle2 },
  ];
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);

  // Load business info (tier, name, trial)
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setBusiness({
          name: d.name ?? "",
          tier: (d.effectiveTier ?? d.tier ?? "free") as TierKey,
          trialActive: d.trialActive ?? false,
          trialEndsAt: d.trialEndsAt ?? null,
        });
      })
      .catch(() => setBusiness({ name: "", tier: "free", trialActive: false, trialEndsAt: null }));
  }, []);

  // Detect return from Google OAuth
  useEffect(() => {
    const gcal = searchParams.get("gcal");
    if (gcal === "connected") {
      setGcalConnected(true);
      setStep(4);
      toast.success("יומן Google חובר בהצלחה!");
    }
  }, [searchParams]);

  const tier = business?.tier ?? "free";
  const gcalAvailable = hasFeature(tier, "gcal_sync");
  const STEPS = getSteps(tier);

  async function handleSkip() {
    await fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: new Date().toISOString(), skipped: true }),
    });
    window.location.href = "/dashboard";
  }

  const trialDaysLeft = business?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="w-full max-w-2xl">

      {/* ── Logo — always visible ── */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-md">
          <Image src="/icon.png" alt="Petra" width={56} height={56} className="w-full h-full object-cover" />
        </div>
        <span className="text-lg font-bold text-petra-text tracking-tight">Petra</span>
      </div>

      {/* ── Trial badge ── */}
      {business?.trialActive && trialDaysLeft !== null && step < 4 && (
        <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
          <Sparkles className="w-4 h-4 text-amber-500" />
          תקופת ניסיון פרו פעילה — עוד {trialDaysLeft} ימים עם גישה לכל הפיצ׳רים
        </div>
      )}

      {/* ── Skip button ── */}
      {step >= 2 && step < 4 && (
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
                    "text-[10px] font-medium",
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
            gcalConnected={gcalConnected}
            gcalAvailable={gcalAvailable}
            tier={tier}
            onGoToDashboard={async () => {
              await fetch("/api/onboarding/progress", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completedAt: new Date().toISOString() }),
              });
              window.location.href = "/dashboard";
            }}
          />
        ) : step === 0 ? (
          <StepWelcome
            businessName={business?.name ?? ""}
            tier={tier}
            trialActive={business?.trialActive ?? false}
            onNext={() => setStep(1)}
          />
        ) : step === 1 ? (
          <StepClient onNext={() => setStep(2)} onBack={() => setStep(0)} />
        ) : step === 2 ? (
          <StepPricing onNext={() => setStep(3)} onBack={() => setStep(1)} />
        ) : gcalAvailable ? (
          <StepGoogle
            gcalConnected={gcalConnected}
            onSkip={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        ) : (
          <StepReminders onNext={() => setStep(4)} onBack={() => setStep(2)} />
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

// ─── Step 0: Welcome (rich intro) ─────────────────────────────────────────────

const FEATURES_BY_TIER: Record<string, { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[]> = {
  free: [
    { icon: Users,          title: "ניהול לקוחות",     desc: "כרטיסי לקוח, כלבים, היסטוריה" },
    { icon: Calendar,       title: "יומן תורים",        desc: "תזמון פגישות בקליק" },
    { icon: CreditCard,     title: "תשלומים בסיסיים",  desc: "מעקב הכנסות ותשלומים" },
    { icon: ClipboardList,  title: "משימות",            desc: "ניהול רשימת מטלות" },
  ],
  basic: [
    { icon: Users,          title: "לקוחות ללא הגבלה", desc: "כרטיסי לקוח, כלבים, היסטוריה" },
    { icon: Calendar,       title: "יומן + Google",     desc: "סנכרון אוטומטי עם Google Calendar" },
    { icon: Bell,           title: "תזכורות WhatsApp",  desc: "אוטומטיות 48 שעות לפני כל תור" },
    { icon: CreditCard,     title: "תשלומים",           desc: "מעקב מלא + קישורי תשלום" },
  ],
  default: [
    { icon: Users,          title: "לקוחות ולידים",    desc: "CRM מלא כולל משפך מכירות" },
    { icon: Calendar,       title: "יומן + Google",     desc: "סנכרון אוטומטי עם Google Calendar" },
    { icon: BarChart3,      title: "אנליטיקה",          desc: "גרפי הכנסות וביצועים" },
    { icon: MessageCircle,  title: "אוטומציות WhatsApp","desc": "תזכורות, מעקבים, ימי הולדת" },
  ],
};

function StepWelcome({
  businessName,
  tier,
  trialActive,
  onNext,
}: {
  businessName: string;
  tier: TierKey;
  trialActive: boolean;
  onNext: () => void;
}) {
  const features = FEATURES_BY_TIER[tier] ?? FEATURES_BY_TIER.default;
  const greeting = businessName ? `ברוך הבא, ${businessName}! 🎉` : "ברוך הבא ל-Petra! 🎉";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-petra-text mb-2">{greeting}</h1>
        <p className="text-petra-muted text-sm leading-relaxed max-w-md mx-auto">
          Petra היא מערכת ניהול לעסקי חיות מחמד בישראל — מאלפים, פנסיון, וגרומרים.
          כל הכלים שצריך במקום אחד: לקוחות, תורים, תשלומים ותקשורת.
        </p>
      </div>

      {/* What you get */}
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

      {/* Trial note */}
      {trialActive && (
        <div className="flex items-center gap-2 p-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-700">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-brand-500" />
          <span>תקופת הניסיון שלך פעילה — כל הפיצ׳רים פתוחים. תוכל לבחור מנוי בהמשך.</span>
        </div>
      )}

      {/* Setup hint */}
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

// ─── Step 1: First Client ─────────────────────────────────────────────────────

function StepClient({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
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
        body: JSON.stringify({ stepCompleted1: true }),
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
    </div>
  );
}

// ─── Step 2: Pricing ──────────────────────────────────────────────────────────

const SERVICE_TYPES = ["אילוף", "פנסיון", "טיפוח", "מוצרים"];

function StepPricing({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("אילוף");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
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
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepCompleted2: true }),
      });
      toast.success("שירות נוסף בהצלחה!");
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">הגדר שירות במחירון</h2>
        <p className="text-sm text-petra-muted">הוסף לפחות שירות אחד — תוכל להוסיף עוד תחת הגדרות</p>
      </div>

      <div>
        <label className="label">שם השירות *</label>
        <input className="input w-full mt-1" placeholder="לדוגמה: שיעור אילוף בסיסי"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="label mb-2">קטגוריה</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SERVICE_TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-all",
                type === t ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
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
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
          {saving ? "שומר..." : "המשך"}
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3a: Google Calendar (Basic+ only) ───────────────────────────────────

function StepGoogle({
  gcalConnected,
  onSkip,
  onBack,
}: {
  gcalConnected: boolean;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">סנכרן עם יומן Google</h2>
        <p className="text-sm text-petra-muted">
          תורים יתווספו אוטומטית ליומן Google שלך — ותקבל תזכורות ישירות לטלפון
        </p>
      </div>

      {gcalConnected ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800">יומן Google מחובר בהצלחה!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            {[
              "תורים יתווספו ביומן שלך אוטומטית",
              "תזכורות לפני כל תור",
              "שינויים מסונכרנים בזמן אמת",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-petra-text">
                <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>

          <a
            href="/api/integrations/google/connect?from=onboarding"
            className="btn-primary w-full justify-center flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" />
            חבר יומן Google
          </a>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />חזור
        </button>
        <button onClick={onSkip} className="flex-1 text-sm text-petra-muted hover:text-petra-text transition-colors text-center py-2">
          {gcalConnected ? "המשך" : "דלג לעת עתה"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3b: Reminders (Free tier — replaces GCal) ──────────────────────────

function StepReminders({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-3">
          <MessageCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-petra-text mb-1">תזכורות WhatsApp אוטומטיות</h2>
        <p className="text-sm text-petra-muted">
          הלקוחות שלך יקבלו תזכורת לפני כל תור — בלי שתצטרך לשלוח ידנית
        </p>
      </div>

      {/* Blurred preview */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200">
        {/* Fake message rows — blurred */}
        <div className="p-4 space-y-2 blur-[3px] select-none pointer-events-none bg-green-50" aria-hidden>
          <div className="bg-white rounded-lg p-3 text-[12px] text-slate-700 border border-green-100 font-mono" dir="rtl">
            שלום ישראל! 👋<br />
            תזכורת לתור עם העסק שלנו<br />
            📅 מחר, 14:00 — רקס — שיעור אילוף
          </div>
          <div className="bg-white rounded-lg p-3 text-[12px] text-slate-700 border border-green-100 font-mono" dir="rtl">
            שלום שרה! תזכורת לתור מחר בשעה 10:00 🐕
          </div>
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px]">
          <div className="text-center px-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <span className="text-xl">🔒</span>
            </div>
            <p className="text-sm font-bold text-petra-text">זמין במנוי בייסיק ומעלה</p>
            <p className="text-[12px] text-petra-muted mt-1">שדרג ותפעיל תזכורות אוטומטיות</p>
          </div>
        </div>
      </div>

      {/* What you get on upgrade */}
      <div className="space-y-2">
        {[
          { icon: "✅", text: "תזכורת WhatsApp אוטומטית 48 שעות לפני כל תור" },
          { icon: "✅", text: "הלקוח מאשר — אתה מקבל עדכון בזמן אמת" },
          { icon: "✅", text: "תזכורות ימי הולדת לכלבים" },
          { icon: "✅", text: "יומן Google מסונכרן" },
        ].map(({ icon, text }, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-petra-muted">
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a
        href="/settings?tab=billing"
        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        שדרג לבייסיק — ₪99 לחודש
      </a>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />חזור
        </button>
        <button onClick={onNext} className="flex-1 text-sm text-petra-muted hover:text-petra-text transition-colors text-center py-2">
          דלג לעת עתה
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({
  gcalConnected,
  gcalAvailable,
  tier,
  onGoToDashboard,
}: {
  gcalConnected: boolean;
  gcalAvailable: boolean;
  tier: TierKey;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-petra-text mb-2">הכל מוכן! 🐾</h2>
        <p className="text-petra-muted leading-relaxed text-sm">
          Petra מוכנה לשרת את העסק שלך.
          {gcalAvailable && !gcalConnected && (
            <> תוכל לחבר את יומן Google בכל עת תחת <a href="/settings" className="text-brand-600 underline">הגדרות</a>.</>
          )}
          {!gcalAvailable && (
            <> שדרג ל<a href="/settings" className="text-brand-600 underline">בייסיק</a> כדי לחבר יומן Google.</>
          )}
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
