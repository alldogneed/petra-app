"use client";
import { Hotel, Clock, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import type { Business } from "./shared";
import { ReadOnlyNotice, SettingsFieldset, SettingsSaveBar, SettingsSectionHeader } from "./settings-ui";

const BOARDING_DEFAULTS: Partial<Business> = {
  boardingCheckInTime: "14:00",
  boardingCheckOutTime: "11:00",
  boardingCalcMode: "nights",
  boardingMinNights: 1,
};

export function BoardingSettingsTab() {
  const t = useTranslations("settings.boardingSettingsTab");
  const { values, isLoading, set, reset, save, dirty, isSaving, canEdit } = useBusinessSettings({
    dirtyKey: "boarding",
    successMessage: t("saved"),
    defaults: BOARDING_DEFAULTS,
  });

  if (isLoading) return <PetraLoader />;
  if (!values) return null;

  const minNights = values.boardingMinNights ?? 1;
  const unit = values.boardingCalcMode === "days" ? t("units.days") : t("units.nights");

  function handleSave() {
    if (!Number.isInteger(minNights) || minNights < 0 || minNights > 365) {
      toast.error(t("errors.minNightsRange"));
      return;
    }
    save();
  }

  return (
    <div className="max-w-xl">
      <SettingsSectionHeader icon={Hotel} title={t("header.title")} description={t("header.description")} />
      {!canEdit && <ReadOnlyNotice className="mb-5" />}
      <SettingsFieldset readOnly={!canEdit}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1.5" htmlFor="boarding-checkin">
                <Clock className="w-3.5 h-3.5" />
                {t("fields.checkIn")}
              </label>
              <input id="boarding-checkin" type="time" className="input" value={values.boardingCheckInTime ?? "14:00"} onChange={(e) => set("boardingCheckInTime", e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1.5" htmlFor="boarding-checkout">
                <Clock className="w-3.5 h-3.5" />
                {t("fields.checkOut")}
              </label>
              <input id="boarding-checkout" type="time" className="input" value={values.boardingCheckOutTime ?? "11:00"} onChange={(e) => set("boardingCheckOutTime", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1.5" htmlFor="boarding-calc">
                <Moon className="w-3.5 h-3.5" />
                {t("fields.calcMode")}
              </label>
              <select id="boarding-calc" className="input" value={values.boardingCalcMode ?? "nights"} onChange={(e) => set("boardingCalcMode", e.target.value)}>
                <option value="nights">{t("units.nights")}</option>
                <option value="days">{t("units.days")}</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="boarding-min">{t("fields.minimum", { unit })}</label>
              <input
                id="boarding-min"
                type="number"
                min={0}
                max={365}
                step={1}
                className="input"
                value={Number.isFinite(minNights) ? minNights : ""}
                onChange={(e) => set("boardingMinNights", e.target.value === "" ? 0 : Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </SettingsFieldset>
      <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={handleSave} onReset={reset} canEdit={canEdit} />
    </div>
  );
}
