"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

interface StepFirstClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNext: (data?: any) => void;
  onSkip: () => void;
  isPending: boolean;
  businessId?: string;
}

export default function StepFirstClient({
  onNext,
  onSkip,
  isPending,
}: StepFirstClientProps) {
  const t = useTranslations("onboarding.stepFirstClient");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [dogBreed, setDogBreed] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, clientPhone, dogName, dogBreed }),
      });
      if (!res.ok) throw new Error("Failed to save client");
      const data = await res.json();
      onNext({ lastCustomerId: data.customerId });
    } catch (_err) {
      setError(t("saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const isComplete =
    clientName.trim().length > 0 && clientPhone.trim().length > 0;
  const busy = isSaving || isPending;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-4xl mb-3">🐶</div>
        <h1 className="text-2xl font-bold text-petra-text">{t("title")}</h1>
        <p className="text-petra-muted">
          {t("subtitle")}
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Customer section */}
        <div
          className="space-y-4 p-4 rounded-xl border border-slate-200"
          style={{ background: "#F8FAFC" }}
        >
          <h3 className="text-sm font-semibold text-petra-text">{t("clientSection")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                {t("clientName")} <span className="text-red-500">*</span>
              </label>
              <input
                className="input bg-white"
                placeholder={t("clientNamePlaceholder")}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                dir={cfg.dir}
              />
            </div>
            <div>
              <label className="label">
                {t("phone")} <span className="text-red-500">*</span>
              </label>
              <input
                className="input bg-white"
                placeholder="050-0000000"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                dir={cfg.dir}
              />
            </div>
          </div>
        </div>

        {/* Dog section */}
        <div
          className="space-y-4 p-4 rounded-xl border border-brand-100"
          style={{ background: "#FFF7ED" }}
        >
          <h3 className="text-sm font-semibold" style={{ color: "#9A3412" }}>
            {t("dogSection")}{" "}
            <span className="font-normal text-petra-muted">{t("optional")}</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("dogName")}</label>
              <input
                className="input bg-white"
                placeholder={t("dogNamePlaceholder")}
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                dir={cfg.dir}
              />
            </div>
            <div>
              <label className="label">{t("breed")}</label>
              <input
                className="input bg-white"
                placeholder={t("breedPlaceholder")}
                value={dogBreed}
                onChange={(e) => setDogBreed(e.target.value)}
                dir={cfg.dir}
              />
            </div>
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
          {busy ? tc("progress.saving") : t("saveAndContinue")}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="btn-secondary w-full justify-center py-2.5 text-sm"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
