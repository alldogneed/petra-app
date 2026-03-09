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
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "ברוך הבא", icon: Sparkles },
  { label: "לקוח ראשון", icon: UserPlus },
  { label: "מחירון", icon: Tag },
  { label: "יומן Google", icon: CalendarDays },
  { label: "סיום", icon: CheckCircle2 },
];

// ─── Inner page (uses useSearchParams — must be inside Suspense) ───────────────

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [gcalConnected, setGcalConnected] = useState(false);

  // Detect return from Google OAuth
  useEffect(() => {
    const gcal = searchParams.get("gcal");
    if (gcal === "connected") {
      setGcalConnected(true);
      setStep(4);
    }
  }, [searchParams]);

  async function handleSkip() {
    // Mark onboarding as skipped so dashboard doesn't redirect back
    await fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: new Date().toISOString(), skipped: true }),
    });
    // Full reload to bypass Next.js router cache (avoids layout re-redirecting to onboarding)
    window.location.href = "/dashboard";
  }

  return (
    <div className="w-full max-w-2xl">

      {/* Skip button */}
      {step < 4 && (
        <div className="text-right mb-4">
          <button
            onClick={handleSkip}
            className="text-sm text-petra-muted hover:text-petra-text flex items-center gap-1 ms-auto"
          >
            <X className="w-3.5 h-3.5" />
            דלג לדשבורד
          </button>
        </div>
      )}

      {/* Progress bar */}
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

      {/* Step content */}
      <div className="card p-8 shadow-lg animate-fade-in">
        {step === 4 ? (
          <StepDone gcalConnected={gcalConnected} onGoToDashboard={async () => {
            await fetch("/api/onboarding/progress", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ completedAt: new Date().toISOString() }),
            });
            window.location.href = "/dashboard";
          }} />
        ) : step === 0 ? (
          <StepWelcome onNext={() => setStep(1)} />
        ) : step === 1 ? (
          <StepClient onNext={() => setStep(2)} onBack={() => setStep(0)} />
        ) : step === 2 ? (
          <StepPricing onNext={() => setStep(3)} onBack={() => setStep(1)} />
        ) : (
          <StepGoogle
            gcalConnected={gcalConnected}
            onSkip={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Page export (wraps inner in Suspense) ────────────────────────────────────

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-petra-muted">טוען...</div>}>
        <OnboardingInner />
      </Suspense>
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto">
        <Image src="/logo.svg" alt="Petra" width={64} height={64} className="w-full h-full object-cover" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-petra-text mb-2">ברוך הבא ל-Petra! 🎉</h1>
        <p className="text-petra-muted leading-relaxed">
          נגדיר יחד את העסק שלך בכמה שלבים קצרים.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-right">
        {[
          { icon: UserPlus, text: "לקוח ראשון", desc: "הוסף לקוח ראשון לאנשי הקשר שלך" },
          { icon: Tag, text: "מחירון", desc: "הגדר שירות עם מחיר" },
          { icon: Calendar, text: "יומן Google", desc: "סנכרן תורים אוטומטית" },
        ].map(({ icon: Icon, text, desc }, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl text-center">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-brand-600" />
            </div>
            <p className="text-sm font-semibold text-petra-text">{text}</p>
            <p className="text-xs text-petra-muted leading-snug">{desc}</p>
          </div>
        ))}
      </div>
      <button onClick={onNext} className="btn-primary w-full justify-center flex items-center gap-2">
        בואו נתחיל
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

// ─── Step 2: Pricing (first service) ─────────────────────────────────────────

const SERVICE_TYPES = ["אילוף", "פנסיון", "גריפינג", "ביקור בית", "טיפול", "אחר"];

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

// ─── Step 3: Google Calendar ──────────────────────────────────────────────────

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

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ gcalConnected, onGoToDashboard }: { gcalConnected: boolean; onGoToDashboard: () => void }) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-petra-text mb-2">הכל מוכן! 🐾</h2>
        <p className="text-petra-muted leading-relaxed">
          Petra מוכנה לשרת את העסק שלך.
          {!gcalConnected && (
            <> תוכל לחבר את יומן Google בכל עת תחת <a href="/settings" className="text-brand-600 underline">הגדרות</a>.</>
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
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
