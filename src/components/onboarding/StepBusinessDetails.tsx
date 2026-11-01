"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LEGAL_ENTITY_TYPES } from "@/lib/legal-entity";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

interface StepBusinessDetailsProps {
  onNext: () => void;
  isPending: boolean;
}

export default function StepBusinessDetails({
  onNext,
  isPending,
}: StepBusinessDetailsProps) {
  const t = useTranslations("onboarding.stepBusinessDetails");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [legalEntityType, setLegalEntityType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedEntity = LEGAL_ENTITY_TYPES.find((et) => et.key === legalEntityType);

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
      setError(t("errors.saveFailed"));
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
        <h1 className="text-2xl font-bold text-petra-text">{t("title")}</h1>
        <p className="text-petra-muted">
          {t("subtitle")}
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="label">
            {t("nameLabel")}{" "}<span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir={cfg.dir}
          />
        </div>

        <div>
          <label className="label">{t("phoneLabel")}</label>
          <input
            className="input"
            placeholder="050-1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir={cfg.dir}
          />
        </div>

        <div>
          <label className="label">{t("entityTypeLabel")}</label>
          <div className="grid grid-cols-3 gap-2">
            {LEGAL_ENTITY_TYPES.map((et) => (
              <button
                key={et.key}
                type="button"
                onClick={() =>
                  setLegalEntityType(legalEntityType === et.key ? "" : et.key)
                }
                className={`px-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  legalEntityType === et.key
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-petra-muted hover:border-slate-300"
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-petra-muted mt-1">
            {t("entityTypeHint")}
          </p>
        </div>

        <div>
          <label className="label">
            {selectedEntity?.regNumberLabel ?? t("regNumberLabel")}
          </label>
          <input
            className="input"
            placeholder={selectedEntity?.regNumberLabel ?? t("regNumberPlaceholder")}
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            dir={cfg.dir}
          />
        </div>

        <div>
          <label className="label">{t("addressLabel")}</label>
          <input
            className="input"
            placeholder={t("addressPlaceholder")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            dir={cfg.dir}
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
        {busy ? tc("progress.saving") : t("continue")}
      </button>
    </div>
  );
}
