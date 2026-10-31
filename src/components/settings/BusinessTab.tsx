"use client";
import NextImage from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Building2, Loader2, Upload, ImagePlus, Trash2 } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessSettings, patchBusinessSettings, BUSINESS_SETTINGS_QUERY_KEY } from "@/hooks/useBusinessSettings";
import { ValidationErrors, validatePhone, validateVatNumber } from "./shared";
import { ReadOnlyNotice, SettingsFieldset, SettingsSaveBar, SettingsSectionHeader } from "./settings-ui";

export function BusinessTab() {
  const t = useTranslations("settings.businessTab");
  const ts = useTranslations("settings.shared");
  const { values, isLoading, set, reset, save, dirty, isSaving, canEdit } = useBusinessSettings({
    dirtyKey: "business",
    successMessage: t("saved"),
  });
  const [errors, setErrors] = useState<ValidationErrors>({});

  if (isLoading) return <PetraLoader />;
  if (!values) return null;

  function handleSave() {
    if (!values) return;
    const newErrors: ValidationErrors = {};
    if (!values.name?.trim()) newErrors.name = t("errors.nameRequired");
    const phoneErr = validatePhone(values.phone || "", ts);
    if (phoneErr) newErrors.phone = phoneErr;
    if (values.customerContactPhone?.trim()) {
      const contactErr = validatePhone(values.customerContactPhone, ts);
      if (contactErr) newErrors.customerContactPhone = contactErr;
    }
    if (values.legalEntityType !== "עוסק פטור") { // i18n-ok — DB value
      const vatErr = validateVatNumber(values.vatNumber || "", ts);
      if (vatErr) newErrors.vatNumber = vatErr;
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error(t("errors.fixFields"));
      return;
    }
    save();
  }

  function handleReset() {
    setErrors({});
    reset();
  }

  const clearError = (field: keyof ValidationErrors) => {
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
  };

  return (
    <div className="max-w-xl">
      <SettingsSectionHeader icon={Building2} title={t("header.title")} description={t("header.description")} />
      {!canEdit && <ReadOnlyNotice className="mb-5" />}

      <div className="mb-6">
        <span className="label" id="logo-label">{t("logo.label")}</span>
        <LogoUpload currentLogo={values.logo ?? null} readOnly={!canEdit} />
      </div>

      <SettingsFieldset readOnly={!canEdit}>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="biz-name">{t("fields.nameRequired")}</label>
            <input
              id="biz-name"
              className={cn("input", errors.name && "border-red-300 focus:ring-red-200")}
              value={values.name ?? ""}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "biz-name-error" : undefined}
              onChange={(e) => { set("name", e.target.value); clearError("name"); }}
            />
            {errors.name && <p id="biz-name-error" className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="biz-phone">{t("fields.phone")}</label>
              <input
                id="biz-phone"
                type="tel"
                dir="ltr"
                className={cn("input text-right", errors.phone && "border-red-300 focus:ring-red-200")}
                value={values.phone ?? ""}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "biz-phone-error" : "biz-phone-hint"}
                onChange={(e) => { set("phone", e.target.value); clearError("phone"); }}
              />
              {errors.phone
                ? <p id="biz-phone-error" className="text-xs text-red-500 mt-1">{errors.phone}</p>
                : <p id="biz-phone-hint" className="text-xs text-petra-muted mt-1">{t("fields.phoneHint")}</p>}
            </div>
            <div>
              <label className="label" htmlFor="biz-email">{t("fields.email")}</label>
              <input
                id="biz-email"
                className="input text-right"
                type="email"
                dir="ltr"
                value={values.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="biz-contact-phone">{t("fields.contactPhone")}</label>
            <input
              id="biz-contact-phone"
              type="tel"
              dir="ltr"
              className={cn("input text-right", errors.customerContactPhone && "border-red-300 focus:ring-red-200")}
              value={values.customerContactPhone ?? ""}
              placeholder={values.phone ?? ""}
              aria-invalid={!!errors.customerContactPhone}
              aria-describedby={errors.customerContactPhone ? "biz-contact-phone-error" : "biz-contact-phone-hint"}
              onChange={(e) => { set("customerContactPhone", e.target.value); clearError("customerContactPhone"); }}
            />
            {errors.customerContactPhone
              ? <p id="biz-contact-phone-error" className="text-xs text-red-500 mt-1">{errors.customerContactPhone}</p>
              : <p id="biz-contact-phone-hint" className="text-xs text-petra-muted mt-1">{t("fields.contactPhoneHint")}</p>}
          </div>
          <div>
            <label className="label" htmlFor="biz-address">{t("fields.address")}</label>
            <input id="biz-address" className="input" value={values.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="biz-entity">{t("fields.legalEntityType")}</label>
            <select
              id="biz-entity"
              className="input"
              value={values.legalEntityType ?? ""}
              onChange={(e) => { set("legalEntityType", e.target.value || null); clearError("vatNumber"); }}
            >
              <option value="">{t("entityTypes.none")}</option>
              <option value="עוסק מורשה">{t("entityTypes.licensed")}</option>{/* i18n-ok — value is a DB enum */}
              <option value="עוסק פטור">{t("entityTypes.exempt")}</option>{/* i18n-ok — value is a DB enum */}
              <option value="חברה">{t("entityTypes.company")}</option>{/* i18n-ok — value is a DB enum */}
            </select>
            {values.legalEntityType === "עוסק פטור" && ( // i18n-ok — DB value
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
                {t("exemptNotice")}
              </p>
            )}
          </div>
          {values.legalEntityType !== "עוסק פטור" && ( // i18n-ok — DB value
            <div>
              <label className="label" htmlFor="biz-vat">{values.legalEntityType === "חברה" /* i18n-ok — DB value */ ? t("fields.companyNumber") : t("fields.licensedNumber")}</label>
              <input
                id="biz-vat"
                inputMode="numeric"
                dir="ltr"
                className={cn("input text-right", errors.vatNumber && "border-red-300 focus:ring-red-200")}
                placeholder="000000000"
                value={values.vatNumber ?? ""}
                aria-invalid={!!errors.vatNumber}
                aria-describedby={errors.vatNumber ? "biz-vat-error" : undefined}
                onChange={(e) => { set("vatNumber", e.target.value); clearError("vatNumber"); }}
              />
              {errors.vatNumber && <p id="biz-vat-error" className="text-xs text-red-500 mt-1">{errors.vatNumber}</p>}
            </div>
          )}
        </div>
      </SettingsFieldset>

      <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={handleSave} onReset={handleReset} canEdit={canEdit} />
    </div>
  );
}

// ─── LogoUpload ───────────────────────────────────────────────────────────────
// Upload and removal both take effect immediately (no "save" needed) — the
// server stores the uploaded logo right away, so removal must behave the same.

function LogoUpload({ currentLogo, readOnly }: { currentLogo: string | null; readOnly: boolean }) {
  const t = useTranslations("settings.businessTab");
  const tu = useTranslations("settings.useBusinessSettings");
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = uploading || removing;

  const refresh = () => queryClient.invalidateQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("logo.uploadError"));
      await refresh();
      toast.success(t("logo.updated"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("logo.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await patchBusinessSettings({ logo: null }, tu("saveError"));
      await refresh();
      toast.success(t("logo.removed"));
      setConfirmRemove(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("logo.removeError"));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || readOnly}
        aria-labelledby="logo-label"
        className={cn(
          "relative w-28 h-28 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all group disabled:cursor-not-allowed",
          currentLogo ? "border-slate-200 bg-white hover:border-brand-300" : "border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/30",
        )}
      >
        {currentLogo ? (
          <>
            <NextImage src={currentLogo} alt={t("logo.label")} width={112} height={112} className="w-full h-full object-contain p-2" />
            {!readOnly && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            {uploading ? (
              <Loader2 className="w-7 h-7 text-slate-300 animate-spin" />
            ) : (
              <ImagePlus className="w-7 h-7 text-slate-300 group-hover:text-brand-400 transition-colors" />
            )}
            <span className="text-[10px] text-slate-400 group-hover:text-brand-500 transition-colors">
              {uploading ? t("logo.uploading") : readOnly ? t("logo.noLogo") : t("logo.clickToUpload")}
            </span>
          </div>
        )}
      </button>

      {!readOnly && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-1.5"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? t("logo.uploading") : currentLogo ? t("logo.replace") : t("logo.upload")}
          </button>
          {currentLogo && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={busy}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("logo.remove")}
            </button>
          )}
          <span className="text-xs text-petra-muted">{t("logo.formats")}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        title={t("logo.confirm.title")}
        description={t("logo.confirm.description")}
        confirmLabel={t("logo.confirm.confirmLabel")}
        danger
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
