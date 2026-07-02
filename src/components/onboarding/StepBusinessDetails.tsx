"use client";

import { useState } from "react";
import { LEGAL_ENTITY_TYPES } from "@/lib/legal-entity";

interface StepBusinessDetailsProps {
  onNext: () => void;
  isPending: boolean;
}

export default function StepBusinessDetails({
  onNext,
  isPending,
}: StepBusinessDetailsProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [legalEntityType, setLegalEntityType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedEntity = LEGAL_ENTITY_TYPES.find((t) => t.key === legalEntityType);

  const handleContinue = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          vatNumber,
          ...(legalEntityType ? { legalEntityType } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to save business details");
      onNext();
    } catch (_err) {
      setError("שגיאה בשמירת פרטי העסק. אנא נסה שוב.");
    } finally {
      setIsSaving(false);
    }
  };

  const isComplete = name.trim().length > 0;
  const busy = isSaving || isPending;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-4xl mb-3">🏢</div>
        <h1 className="text-2xl font-bold text-petra-text">פרטי העסק שלך</h1>
        <p className="text-petra-muted">
          הפרטים האלה יופיעו בהסכמים, בחשבוניות ובדפי ההזמנה ללקוחות
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="label">
            שם העסק <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            placeholder='למשל: "הכלבים של דני" או "Doggy Style"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="rtl"
          />
        </div>

        <div>
          <label className="label">טלפון העסק</label>
          <input
            className="input"
            placeholder="050-1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="rtl"
          />
        </div>

        <div>
          <label className="label">סוג עוסק</label>
          <div className="grid grid-cols-3 gap-2">
            {LEGAL_ENTITY_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() =>
                  setLegalEntityType(legalEntityType === t.key ? "" : t.key)
                }
                className={`px-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  legalEntityType === t.key
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-petra-muted hover:border-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-petra-muted mt-1">
            לא בטוח? אפשר לעדכן בהגדרות מאוחר יותר
          </p>
        </div>

        <div>
          <label className="label">
            {selectedEntity?.regNumberLabel ?? "מספר עוסק / ח.פ"}
          </label>
          <input
            className="input"
            placeholder={selectedEntity?.regNumberLabel ?? "מספר תאגיד / ת.ז (אופציונלי)"}
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            dir="rtl"
          />
        </div>

        <div>
          <label className="label">כתובת</label>
          <input
            className="input"
            placeholder="רחוב, עיר (לפגישות / פנסיון)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            dir="rtl"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={handleContinue}
        disabled={!isComplete || busy}
        className="btn-primary w-full justify-center py-3 text-base"
      >
        {busy ? "שומר..." : "המשך לשלב הבא ←"}
      </button>
    </div>
  );
}
