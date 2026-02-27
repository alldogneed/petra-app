"use client";

import { useState } from "react";

const DURATION_OPTIONS = [
  { value: "30", label: "30 דק׳" },
  { value: "45", label: "45 דק׳" },
  { value: "60", label: "שעה" },
  { value: "90", label: "שעה וחצי" },
  { value: "120", label: "שעתיים" },
];

interface StepFirstServiceProps {
  onNext: () => void;
  onSkip: () => void;
  isPending: boolean;
}

export default function StepFirstService({
  onNext,
  onSkip,
  isPending,
}: StepFirstServiceProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: price ? parseFloat(price) : 0,
          duration: parseInt(duration),
          type: "אילוף",
        }),
      });
      if (!res.ok) throw new Error("Failed to save service");
      onNext();
    } catch (_err) {
      setError("שגיאה בשמירת השירות. אנא נסה שוב.");
    } finally {
      setIsSaving(false);
    }
  };

  const isComplete = name.trim().length > 0 && price.trim().length > 0;
  const busy = isSaving || isPending;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-4xl mb-3">🏷️</div>
        <h1 className="text-2xl font-bold text-petra-text">השירות הראשון שלך</h1>
        <p className="text-petra-muted">
          הוסף שירות אחד עכשיו — אפשר לשנות ולהוסיף עוד בהמשך מדף ההגדרות
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="label">
            שם השירות <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            placeholder='למשל: "שיעור אילוף פרטי" או "גיזום מלא"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="rtl"
          />
        </div>

        <div>
          <label className="label">
            מחיר (₪) <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            type="number"
            placeholder="250"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            dir="rtl"
          />
        </div>

        <div>
          <label className="label">משך השירות</label>
          <div className="flex gap-2 flex-wrap">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  duration === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 hover:border-brand-200 text-petra-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleContinue}
          disabled={!isComplete || busy}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {busy ? "שומר..." : "שמור והמשך ←"}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="btn-secondary w-full justify-center py-2.5 text-sm"
        >
          דלג לעת עתה
        </button>
      </div>
    </div>
  );
}
