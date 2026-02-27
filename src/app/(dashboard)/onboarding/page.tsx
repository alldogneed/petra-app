"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dog,
  Hotel,
  Scissors,
  Layers,
  Users,
  Calendar,
  Target,
  Bell,
  Sparkles,
  Building2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingProgress {
  currentStep: number;
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4: boolean;
  skipped: boolean;
  completedAt: string | null;
}

type BusinessType = "מאלף כלבים" | "פנסיון" | "מספרה" | "משולב";
type ClientsRange = "עד 20" | "20–50" | "50+";
type PrimaryGoal = "סדר ביומן" | "ניהול לקוחות" | "לידים ומכירות" | "תזכורות אוטומטיות";

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: "ברוך הבא", icon: Sparkles },
  { label: "פרטי עסק", icon: Building2 },
  { label: "שירות ראשון", icon: Calendar },
  { label: "לקוח ראשון", icon: UserPlus },
  { label: "סיום", icon: CheckCircle2 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const { data } = useQuery<{ progress: OnboardingProgress | null }>({
    queryKey: ["onboarding-progress"],
    queryFn: () => fetch("/api/onboarding/progress").then((r) => r.json()),
    staleTime: 30000,
  });

  const progress = data?.progress;

  // If already completed, show completion screen immediately
  const isCompleted = !!progress?.completedAt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Skip button */}
        {step < 4 && !isCompleted && (
          <div className="text-left mb-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-petra-muted hover:text-petra-text flex items-center gap-1 mr-auto"
            >
              <X className="w-3.5 h-3.5" />
              דלג לדשבורד
            </button>
          </div>
        )}

        {/* Progress bar */}
        {!isCompleted && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {STEPS.map((s, i) => {
                const done = i < step || isCompleted;
                const active = i === step;
                const Icon = s.icon;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                        done
                          ? "bg-brand-500 border-brand-500 text-white"
                          : active
                            ? "bg-white border-brand-500 text-brand-500"
                            : "bg-white border-slate-200 text-petra-muted"
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
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
          {isCompleted || step === 4 ? (
            <StepDone onGoToDashboard={() => router.push("/dashboard")} />
          ) : step === 0 ? (
            <StepWelcome onNext={() => setStep(1)} />
          ) : step === 1 ? (
            <StepBusinessProfile onNext={() => setStep(2)} onBack={() => setStep(0)} />
          ) : step === 2 ? (
            <StepService onNext={() => setStep(3)} onBack={() => setStep(1)} />
          ) : (
            <StepClient onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8 text-brand-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-petra-text mb-2">ברוך הבא ל-Petra! 🎉</h1>
        <p className="text-petra-muted leading-relaxed">
          נגדיר יחד את העסק שלך בכמה שלבים פשוטים.
          <br />
          זה ייקח פחות מ-3 דקות.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-right">
        {[
          { icon: Building2, text: "פרטי העסק שלך" },
          { icon: Calendar, text: "שירות ראשון" },
          { icon: UserPlus, text: "לקוח ראשון" },
          { icon: CheckCircle2, text: "הכל מוכן!" },
        ].map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-brand-600" />
            </div>
            <span className="text-sm text-petra-text font-medium">{text}</span>
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

// ─── Step 1: Business Profile ─────────────────────────────────────────────────

const BUSINESS_TYPES: { value: BusinessType; icon: React.ElementType; desc: string }[] = [
  { value: "מאלף כלבים", icon: Dog, desc: "אימון, ציות ושיקום" },
  { value: "פנסיון", icon: Hotel, desc: "לינת כלבים ושמירה" },
  { value: "מספרה", icon: Scissors, desc: "גריפינג וטיפוח" },
  { value: "משולב", icon: Layers, desc: "שילוב כמה שירותים" },
];

const CLIENTS_RANGES: ClientsRange[] = ["עד 20", "20–50", "50+"];
const GOALS: { value: PrimaryGoal; icon: React.ElementType }[] = [
  { value: "סדר ביומן", icon: Calendar },
  { value: "ניהול לקוחות", icon: Users },
  { value: "לידים ומכירות", icon: Target },
  { value: "תזכורות אוטומטיות", icon: Bell },
];

function StepBusinessProfile({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [businessType, setBusinessType] = useState<BusinessType>("מאלף כלבים");
  const [clientsRange, setClientsRange] = useState<ClientsRange>("עד 20");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>("סדר ביומן");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, activeClientsRange: clientsRange, primaryGoal, currentStep: 2 }),
      });
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">ספר לנו על העסק שלך</h2>
        <p className="text-sm text-petra-muted">נתאים את Petra לצרכים שלך</p>
      </div>

      <div>
        <label className="label mb-2">סוג עסק</label>
        <div className="grid grid-cols-2 gap-3">
          {BUSINESS_TYPES.map(({ value, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => setBusinessType(value)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all",
                businessType === value
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-brand-300"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                businessType === value ? "bg-brand-500 text-white" : "bg-slate-100 text-petra-muted"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-petra-text">{value}</p>
                <p className="text-xs text-petra-muted">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label mb-2">כמה לקוחות פעילים?</label>
        <div className="flex gap-2">
          {CLIENTS_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setClientsRange(r)}
              className={cn(
                "flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                clientsRange === r
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-petra-muted hover:border-brand-300"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label mb-2">המטרה העיקרית שלך</label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setPrimaryGoal(value)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all",
                primaryGoal === value
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-slate-200 text-petra-muted hover:border-brand-300"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />
          חזור
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
          {saving ? "שומר..." : "המשך"}
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: First Service ────────────────────────────────────────────────────

const SERVICE_TYPES = ["אילוף", "פנסיון", "גריפינג", "ביקור בית", "טיפול", "אחר"];

function StepService({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
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
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: 3 }),
      });
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-petra-text mb-1">הגדר את השירות הראשון שלך</h2>
        <p className="text-sm text-petra-muted">תוכל להוסיף עוד שירותים בהמשך תחת הגדרות</p>
      </div>

      <div>
        <label className="label">שם השירות *</label>
        <input
          className="input w-full mt-1"
          placeholder="לדוגמה: שיעור אילוף בסיסי"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label mb-2">קטגוריה</label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-all",
                type === t
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-slate-200 text-petra-muted hover:border-brand-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">משך (דקות)</label>
          <input
            type="number"
            className="input w-full mt-1"
            value={duration}
            min={15}
            step={15}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div>
          <label className="label">מחיר (₪) *</label>
          <input
            type="number"
            className="input w-full mt-1"
            placeholder="200"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />
          חזור
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
          {saving ? "שומר..." : "המשך"}
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: First Client ─────────────────────────────────────────────────────

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
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: 4 }),
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
          <input
            className="input w-full mt-1"
            placeholder="ישראל ישראלי"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">טלפון *</label>
          <input
            className="input w-full mt-1"
            placeholder="050-0000000"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium text-petra-text mb-3">פרטי כלב (אופציונלי)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">שם הכלב</label>
            <input
              className="input w-full mt-1"
              placeholder="רקס"
              value={dogName}
              onChange={(e) => setDogName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">גזע</label>
            <input
              className="input w-full mt-1"
              placeholder="גרמני"
              value={dogBreed}
              onChange={(e) => setDogBreed(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />
          חזור
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center flex items-center gap-2">
          {saving ? "שומר..." : "סיים הגדרה"}
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
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
        <p className="text-petra-muted leading-relaxed">
          Petra מוכנה לשרת את העסק שלך.
          <br />
          כעת תוכל להוסיף לקוחות, לנהל תורים ולעקוב אחרי הכנסות.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { href: "/customers", label: "לקוחות" },
          { href: "/calendar", label: "יומן" },
          { href: "/leads", label: "לידים" },
        ].map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="p-3 bg-slate-50 rounded-xl text-sm font-medium text-petra-text hover:bg-brand-50 hover:text-brand-600 transition-colors border border-slate-200"
          >
            {label}
          </a>
        ))}
      </div>
      <button
        onClick={onGoToDashboard}
        className="btn-primary w-full justify-center flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        עבור לדשבורד
      </button>
    </div>
  );
}
