"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface AddCustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (customer: { id: string; name: string }) => void;
  loading?: boolean;
}

export function AddCustomerForm({
  open,
  onClose,
  onSaved,
  loading: externalLoading,
}: AddCustomerFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("onboarding.addCustomerForm");
  const tc = useTranslations("common");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim() || !petName.trim()) {
      setError(t("errors.fillAll"));
      return;
    }

    setSaving(true);
    try {
      // Create customer
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          source: "onboarding",
        }),
      });

      if (!custRes.ok) throw new Error("Failed to create customer");
      const customer = await custRes.json();

      // Create pet for the customer
      const petRes = await fetch(`/api/customers/${customer.id}/pets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: petName.trim(),
          species: "dog",
        }),
      });
      if (!petRes.ok) throw new Error("Failed to create pet");

      onSaved({ id: customer.id, name: customer.name });
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const isLoading = saving || externalLoading;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm p-6 animate-scale-in">
        <h3 className="text-lg font-bold text-petra-text mb-1">
          {t("title")}
        </h3>
        <p className="text-sm text-petra-muted mb-5">
          {t("subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("fields.name")}</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("placeholders.name")}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="label">{t("fields.phone")}</label>
            <input
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-1234567"
              dir="ltr"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="label">{t("fields.petName")}</label>
            <input
              type="text"
              className="input"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder={t("placeholders.petName")}
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full justify-center py-3"
          >
            {isLoading ? tc("progress.saving") : t("saveAndContinue")}
          </button>
        </form>
      </div>
    </div>
  );
}
