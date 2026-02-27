"use client";

import { useState } from "react";

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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, vatNumber }),
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

        <div className="grid grid-cols-2 gap-4">
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
            <label className="label">ח.פ / עוסק מורשה</label>
            <input
              className="input"
              placeholder="מספר תאגיד / ת.ז (אופציונלי)"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              dir="rtl"
            />
          </div>
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
