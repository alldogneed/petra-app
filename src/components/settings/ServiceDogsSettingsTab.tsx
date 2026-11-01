"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessSettings, patchBusinessSettings, BUSINESS_SETTINGS_QUERY_KEY } from "@/hooks/useBusinessSettings";
import { ReadOnlyNotice, SettingsFieldset, SettingsSaveBar } from "./settings-ui";
import { SdSettings, DEFAULT_SD_SETTINGS, SD_VACCINE_TREATMENTS, SD_PUPPY_TREATMENTS, MONTH_KEYS_SETTINGS, PUPPY_WEEKS_OPTIONS, Business } from "./shared";

// Stable reference — the hook memoises on it.
const SD_DEFAULTS: Partial<Business> = { sdSettings: DEFAULT_SD_SETTINGS };

// ─── Service Dogs Settings Tab ───────────────────────────────────────────────

export function ServiceDogsSettingsTab() {
  const t = useTranslations("settings.serviceDogsSettingsTab");
  const ts = useTranslations("settings.shared");
  const queryClient = useQueryClient();
  const { values, isLoading, set, save, reset, dirty, changes, isSaving, canEdit } = useBusinessSettings({
    dirtyKey: "service-dogs",
    successMessage: t("saved"),
    defaults: SD_DEFAULTS,
  });
  const [confirmApply, setConfirmApply] = useState(false);

  const settings: SdSettings = { ...DEFAULT_SD_SETTINGS, ...(values?.sdSettings ?? {}) };
  const setForm = (next: SdSettings) => set("sdSettings", next);

  // "Apply to all dogs" rewrites the planned dates in every service dog's vaccine
  // plan from the SAVED schedule — so unsaved edits are saved first.
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (dirty && changes.sdSettings) {
        await patchBusinessSettings({ sdSettings: changes.sdSettings }, t("saveSettingsError"));
        await queryClient.invalidateQueries({ queryKey: BUSINESS_SETTINGS_QUERY_KEY });
        reset();
      }
      const r = await fetch("/api/service-dogs/vaccinations/apply-schedule", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t("apply.error"));
      return d as { updatedCount: number };
    },
    onSuccess: (d) => {
      setConfirmApply(false);
      toast.success(t("apply.success", { count: d.updatedCount }));
    },
    onError: (e: Error) => {
      setConfirmApply(false);
      toast.error(e.message || t("apply.error"));
    },
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  function toggle(field: keyof SdSettings) {
    setForm({ ...settings, [field]: !settings[field as "trackHours" | "allowManualCert"] });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {!canEdit && <ReadOnlyNotice />}
      <SettingsFieldset readOnly={!canEdit} className="space-y-6">
      {/* Track hours */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-petra-text">{t("trackHours.title")}</p>
            <p className="text-sm text-petra-muted mt-0.5">{t("trackHours.description")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.trackHours}
            aria-label={t("trackHours.title")}
            onClick={() => toggle("trackHours")}
            className={cn("flex-shrink-0 w-12 h-6 rounded-full transition-colors relative", settings.trackHours ? "bg-orange-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", settings.trackHours ? "start-0.5" : "end-0.5")} />
          </button>
        </div>

        {/* Default target hours — shown only when trackHours is on */}
        {settings.trackHours && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="label">{t("trackHours.defaultTargetLabel")}</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                max={999}
                className="input w-28 text-center"
                value={settings.defaultTargetHours}
                onChange={(e) => setForm({ ...settings, defaultTargetHours: Math.max(1, Number(e.target.value) || 1) })}
              />
              <span className="text-sm text-petra-muted">{t("trackHours.hours")}</span>
            </div>
            <p className="text-xs text-petra-muted mt-1">{t("trackHours.defaultTargetHint")}</p>
          </div>
        )}
      </div>

      {/* Allow manual certification */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-petra-text">{t("manualCert.title")}</p>
            <p className="text-sm text-petra-muted mt-0.5">
              {settings.trackHours
                ? t("manualCert.descriptionWithHours")
                : t("manualCert.descriptionNoHours")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.allowManualCert}
            aria-label={t("manualCert.title")}
            onClick={() => toggle("allowManualCert")}
            className={cn("flex-shrink-0 w-12 h-6 rounded-full transition-colors relative", settings.allowManualCert ? "bg-orange-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", settings.allowManualCert ? "start-0.5" : "end-0.5")} />
          </button>
        </div>
        {!settings.trackHours && !settings.allowManualCert && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t("manualCert.warning")}
          </p>
        )}
      </div>

      {/* Vaccination schedule */}
      <div className="card p-5">
        {/* Toggle header */}
        <div className="flex items-center justify-between gap-4 mb-1">
          <div>
            <p className="font-semibold text-petra-text">{t("vaccines.title")}</p>
            <p className="text-sm text-petra-muted mt-0.5">
              {t("vaccines.description")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!settings.vaccinationScheduleEnabled}
            aria-label={t("vaccines.title")}
            onClick={() => setForm({ ...settings, vaccinationScheduleEnabled: !settings.vaccinationScheduleEnabled })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings.vaccinationScheduleEnabled ? "bg-brand-500" : "bg-slate-200"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${settings.vaccinationScheduleEnabled ? "-translate-x-5 ltr:translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {settings.vaccinationScheduleEnabled ? (
          <div className="mt-4 space-y-6">
            {/* Adults section */}
            <div>
              <p className="text-sm font-semibold text-petra-text mb-3 pb-2 border-b border-slate-100">
                {t("vaccines.adultsTitle")}
                <span className="text-xs font-normal text-petra-muted ms-2">{t("vaccines.adultsHint")}</span>
              </p>
              <div className="space-y-3">
                {SD_VACCINE_TREATMENTS.map(tr => {
                  const currentMonths: number[] = (settings.vaccinationSchedule as Record<string, number[]> | undefined)?.[tr.key] ?? Array(tr.doses).fill(0);
                  const setMonths = (months: number[]) =>
                    setForm({ ...settings, vaccinationSchedule: { ...settings.vaccinationSchedule, [tr.key]: months } });
                  return (
                    <div key={tr.key} className="flex items-start gap-4">
                      <div className="w-36 pt-1.5 flex-shrink-0">
                        <p className="text-sm font-medium text-petra-text">{ts(tr.labelKey)}</p>
                        <p className="text-[11px] text-petra-muted">{t("vaccines.dosesPerYear", { count: tr.doses })}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: tr.doses }, (_, i) => (
                          <div key={i} className="flex items-center gap-1">
                            {tr.doses > 1 && <span className="text-xs text-petra-muted w-10">{t("vaccines.dose", { n: i + 1 })}</span>}
                            <select
                              value={currentMonths[i] || 0}
                              onChange={e => {
                                const updated = [...currentMonths];
                                while (updated.length <= i) updated.push(0);
                                updated[i] = Number(e.target.value);
                                setMonths(updated);
                              }}
                              className="input text-xs py-1 h-8 w-28"
                            >
                              <option value={0}>{t("vaccines.notSet")}</option>
                              {MONTH_KEYS_SETTINGS.map((k, idx) => (
                                <option key={idx + 1} value={idx + 1}>{ts(k)}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Puppies section */}
            <div>
              <p className="text-sm font-semibold text-petra-text mb-3 pb-2 border-b border-slate-100">
                {t("vaccines.puppiesTitle")}
                <span className="text-xs font-normal text-petra-muted ms-2">{t("vaccines.puppiesHint")}</span>
              </p>
              <div className="space-y-3">
                {SD_PUPPY_TREATMENTS.map(tr => {
                  const currentWeeks: number[] = (settings.puppyVaccinationSchedule as Record<string, number[]> | undefined)?.[tr.key] ?? Array(tr.doses).fill(0);
                  const setWeeks = (weeks: number[]) =>
                    setForm({ ...settings, puppyVaccinationSchedule: { ...settings.puppyVaccinationSchedule, [tr.key]: weeks } });
                  return (
                    <div key={tr.key} className="flex items-start gap-4">
                      <div className="w-36 pt-1.5 flex-shrink-0">
                        <p className="text-sm font-medium text-petra-text">{ts(tr.labelKey)}</p>
                        <p className="text-[11px] text-petra-muted">{t("vaccines.doses", { count: tr.doses })}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: tr.doses }, (_, i) => (
                          <div key={i} className="flex items-center gap-1">
                            {tr.doses > 1 && <span className="text-xs text-petra-muted w-10">{t("vaccines.dose", { n: i + 1 })}</span>}
                            <select
                              value={currentWeeks[i] || 0}
                              onChange={e => {
                                const updated = [...currentWeeks];
                                while (updated.length <= i) updated.push(0);
                                updated[i] = Number(e.target.value);
                                setWeeks(updated);
                              }}
                              className="input text-xs py-1 h-8 w-28"
                            >
                              <option value={0}>{t("vaccines.notSet")}</option>
                              {PUPPY_WEEKS_OPTIONS.map(w => (
                                <option key={w} value={w}>{t("vaccines.week", { week: w })}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-petra-muted border-t border-slate-100 pt-3">
              {t("vaccines.classificationNote")}
            </p>

            {/* Apply to all dogs */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-100 mt-1">
              <div>
                <p className="text-sm font-medium text-petra-text">{t("apply.title")}</p>
                <p className="text-xs text-petra-muted mt-0.5">
                  {t("apply.description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmApply(true)}
                disabled={applyMutation.isPending || isSaving}
                className="btn-secondary text-sm flex items-center gap-2 flex-shrink-0"
              >
                {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {applyMutation.isPending ? t("apply.applying") : t("apply.button")}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-petra-muted mt-3">
            {t("vaccines.disabledHint")}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-petra-muted space-y-1">
        <p className="font-medium text-petra-text mb-2">{t("summary.title")}</p>
        <p>{t("summary.trackHours")}<span className="font-medium text-petra-text">{settings.trackHours ? t("summary.on") : t("summary.off")}</span></p>
        {settings.trackHours && (
          <p>{t("summary.targetHours")}<span className="font-medium text-petra-text">{t("summary.hoursValue", { hours: settings.defaultTargetHours })}</span></p>
        )}
        <p>{t("summary.manualCert")}<span className="font-medium text-petra-text">{settings.allowManualCert ? t("summary.allowed") : t("summary.notAllowed")}</span></p>
      </div>

      </SettingsFieldset>

      <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={save} onReset={reset} canEdit={canEdit} />

      <ConfirmDialog
        open={confirmApply}
        title={t("confirmDialog.title")}
        description={
          <>
            {t.rich("confirmDialog.description", { b: (c) => <span className="font-medium text-petra-text">{c}</span> })}
            {dirty && <><br />{t("confirmDialog.unsavedNote")}</>}
          </>
        }
        confirmLabel={t("confirmDialog.confirm")}
        loading={applyMutation.isPending}
        onConfirm={() => applyMutation.mutate()}
        onCancel={() => setConfirmApply(false)}
      />
    </div>
  );
}
