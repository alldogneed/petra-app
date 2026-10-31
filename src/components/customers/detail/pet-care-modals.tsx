"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import type { Pet } from "./types";

// Stored values (Pet.foodFrequency) — data, not UI; labels come from messages via FOOD_FREQUENCY_KEYS.
export const FOOD_FREQUENCIES = [
  "פעם ביום", // i18n-ok — stored value
  "2 פעמים ביום", // i18n-ok — stored value
  "3 פעמים ביום", // i18n-ok — stored value
  "4 פעמים ביום", // i18n-ok — stored value
  "לפי דרישה", // i18n-ok — stored value
];
/** Message key per FOOD_FREQUENCIES entry (same order). */
const FOOD_FREQUENCY_KEYS = ["once", "twice", "three", "four", "onDemand"] as const;

export function EditFeedingModal({
  petId,
  petName,
  pet,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  pet: Pet;
  customerId: string;
  onClose: () => void;
}) {
  const t = useTranslations("customers.petCareModals");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    foodBrand: pet.foodBrand ?? "",
    foodGramsPerDay: pet.foodGramsPerDay?.toString() ?? "",
    foodFrequency: pet.foodFrequency ?? "",
    foodNotes: pet.foodNotes ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodBrand: form.foodBrand || null,
          foodGramsPerDay: form.foodGramsPerDay ? parseFloat(form.foodGramsPerDay) : null,
          foodFrequency: form.foodFrequency || null,
          foodNotes: form.foodNotes || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.generic")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      toast.success(t("feeding.updated"));
      onClose();
    },
    onError: () => toast.error(t("feeding.updateError")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">{t("feeding.title", { petName })}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">{t("feeding.brand")}</label>
            <input
              className="input"
              placeholder={t("feeding.brandPlaceholder")}
              value={form.foodBrand}
              onChange={(e) => setForm({ ...form, foodBrand: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("feeding.gramsPerDay")}</label>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder={t("feeding.gramsPlaceholder")}
                value={form.foodGramsPerDay}
                onChange={(e) => setForm({ ...form, foodGramsPerDay: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("feeding.frequency")}</label>
              <select
                className="input"
                value={form.foodFrequency}
                onChange={(e) => setForm({ ...form, foodFrequency: e.target.value })}
              >
                <option value="">{t("feeding.choose")}</option>
                {FOOD_FREQUENCIES.map((f, i) => (
                  <option key={f} value={f}>{t(`feeding.frequencies.${FOOD_FREQUENCY_KEYS[i]}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t("feeding.notes")}</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder={t("feeding.notesPlaceholder")}
              value={form.foodNotes}
              onChange={(e) => setForm({ ...form, foodNotes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">{tc("actions.cancel")}</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? tc("progress.saving") : tc("actions.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Health Modal ────────────────────────────────────────────────────────

export function EditHealthModal({
  petId,
  petName,
  health,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  health: Pet["health"];
  customerId: string;
  onClose: () => void;
}) {
  const t = useTranslations("customers.petCareModals");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const toDateInput = (v: string | null) => (v ? v.split("T")[0] : "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = health as any;
  const existingFlags = (h?.notVaccinatedFlags as Record<string, boolean> | null) ?? {};
  const [form, setForm] = useState({
    rabiesLastDate: toDateInput(h?.rabiesLastDate ?? null),
    rabiesValidUntil: toDateInput(h?.rabiesValidUntil ?? null),
    dhppLastDate: toDateInput(h?.dhppLastDate ?? null),
    dhppPuppy1Date: toDateInput(h?.dhppPuppy1Date ?? null),
    dhppPuppy2Date: toDateInput(h?.dhppPuppy2Date ?? null),
    dhppPuppy3Date: toDateInput(h?.dhppPuppy3Date ?? null),
    bordatellaDate: toDateInput(h?.bordatellaDate ?? null),
    parkWormDate: toDateInput(h?.parkWormDate ?? null),
    dewormingLastDate: toDateInput(h?.dewormingLastDate ?? null),
    fleaTickType: h?.fleaTickType ?? "",
    fleaTickDate: toDateInput(h?.fleaTickDate ?? null),
    fleaTickExpiryDate: toDateInput(h?.fleaTickExpiryDate ?? null),
    allergies: h?.allergies ?? "",
    medicalConditions: h?.medicalConditions ?? "",
    surgeriesHistory: h?.surgeriesHistory ?? "",
    activityLimitations: h?.activityLimitations ?? "",
    vetName: h?.vetName ?? "",
    vetPhone: h?.vetPhone ?? "",
    neuteredSpayed: h?.neuteredSpayed ?? false,
    neuteredSpayedDate: toDateInput(h?.neuteredSpayedDate ?? null),
    originInfo: h?.originInfo ?? "",
    timeWithOwner: h?.timeWithOwner ?? "",
    notVaccinatedFlags: existingFlags as Record<string, boolean>,
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error(t("health.updateError")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">{t("health.title", { petName })}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-5">
          {/* Vaccines */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide">{t("health.vaccinesSection")}</p>

            {/* כלבת */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-petra-text">{t("health.rabies")}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.notVaccinatedFlags.rabies}
                    onChange={(e) => setForm({ ...form, notVaccinatedFlags: { ...form.notVaccinatedFlags, rabies: e.target.checked } })}
                    className="w-3.5 h-3.5 accent-orange-500"
                  />
                  <span className="text-xs text-orange-600 font-medium">{t("health.notVaccinated")}</span>
                </label>
              </div>
              {!form.notVaccinatedFlags.rabies && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("health.vaccineDate")}</label>
                    <input className="input" type="date" lang={cfg.lang} value={form.rabiesLastDate} onChange={(e) => setForm({ ...form, rabiesLastDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{t("health.validUntil")}</label>
                    <input className="input" type="date" lang={cfg.lang} value={form.rabiesValidUntil} onChange={(e) => setForm({ ...form, rabiesValidUntil: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* משושה גורים */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">{t("health.dhppPuppy")}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t("health.dose1")}</label>
                  <input className="input" type="date" lang={cfg.lang} value={form.dhppPuppy1Date} onChange={(e) => setForm({ ...form, dhppPuppy1Date: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t("health.dose2")}</label>
                  <input className="input" type="date" lang={cfg.lang} value={form.dhppPuppy2Date} onChange={(e) => setForm({ ...form, dhppPuppy2Date: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t("health.dose3")}</label>
                  <input className="input" type="date" lang={cfg.lang} value={form.dhppPuppy3Date} onChange={(e) => setForm({ ...form, dhppPuppy3Date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* משושה בוגר */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-petra-text">{t("health.dhppAdult")}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!form.notVaccinatedFlags.dhpp} onChange={(e) => setForm({ ...form, notVaccinatedFlags: { ...form.notVaccinatedFlags, dhpp: e.target.checked } })} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">{t("health.notVaccinated")}</span>
                </label>
              </div>
              {!form.notVaccinatedFlags.dhpp && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("health.vaccineDate")}</label>
                    <input className="input" type="date" lang={cfg.lang} value={form.dhppLastDate} onChange={(e) => setForm({ ...form, dhppLastDate: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* תילוע */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-petra-text">{t("health.deworming")}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!form.notVaccinatedFlags.deworming} onChange={(e) => setForm({ ...form, notVaccinatedFlags: { ...form.notVaccinatedFlags, deworming: e.target.checked } })} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">{t("health.notTreated")}</span>
                </label>
              </div>
              {!form.notVaccinatedFlags.deworming && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("health.dewormingDate")}</label>
                    <input className="input" type="date" lang={cfg.lang} value={form.dewormingLastDate} onChange={(e) => setForm({ ...form, dewormingLastDate: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* תולעת הפארק */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-petra-text">{t("health.parkWorm")}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!form.notVaccinatedFlags.parkWorm} onChange={(e) => setForm({ ...form, notVaccinatedFlags: { ...form.notVaccinatedFlags, parkWorm: e.target.checked } })} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">{t("health.notTreated")}</span>
                </label>
              </div>
              {!form.notVaccinatedFlags.parkWorm && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("health.treatmentDate")}</label>
                    <input className="input" type="date" lang={cfg.lang} value={form.parkWormDate} onChange={(e) => setForm({ ...form, parkWormDate: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* קרציות ופרעושים */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-petra-text">{t("health.fleaTick")}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!form.notVaccinatedFlags.fleaTick} onChange={(e) => setForm({ ...form, notVaccinatedFlags: { ...form.notVaccinatedFlags, fleaTick: e.target.checked } })} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">{t("health.notTreated")}</span>
                </label>
              </div>
              {!form.notVaccinatedFlags.fleaTick && (
                <div className="space-y-2">
                  <div>
                    <label className="label">{t("health.fleaTickType")}</label>
                    <input className="input" placeholder="Nexgard, Bravecto, Advocate..." value={form.fleaTickType} onChange={(e) => setForm({ ...form, fleaTickType: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t("health.treatmentDate")}</label>
                      <input className="input" type="date" lang={cfg.lang} value={form.fleaTickDate} onChange={(e) => setForm({ ...form, fleaTickDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">{t("health.validUntil")}</label>
                      <input className="input" type="date" lang={cfg.lang} value={form.fleaTickExpiryDate} onChange={(e) => setForm({ ...form, fleaTickExpiryDate: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* שעלת מכלאות */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-petra-text">{t("health.bordetella")}</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!form.notVaccinatedFlags.bordetella} onChange={(e) => setForm({ ...form, notVaccinatedFlags: { ...form.notVaccinatedFlags, bordetella: e.target.checked } })} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">{t("health.notVaccinated")}</span>
                </label>
              </div>
              {!form.notVaccinatedFlags.bordetella && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("health.bordetellaDate")}</label>
                    <input className="input" type="date" lang={cfg.lang} value={form.bordatellaDate} onChange={(e) => setForm({ ...form, bordatellaDate: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Medical */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("health.medicalSection")}</p>
            <div className="space-y-3">
              <div>
                <label className="label">{t("health.allergies")}</label>
                <input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder={t("health.allergiesPlaceholder")} />
              </div>
              <div>
                <label className="label">{t("health.medicalConditions")}</label>
                <textarea className="input min-h-[60px]" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("health.surgeries")}</label>
                <input className="input" value={form.surgeriesHistory} onChange={(e) => setForm({ ...form, surgeriesHistory: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("health.activityLimitations")}</label>
                <input className="input" value={form.activityLimitations} onChange={(e) => setForm({ ...form, activityLimitations: e.target.value })} />
              </div>
            </div>
          </div>
          {/* Vet */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("health.vetSection")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("health.vetName")}</label>
                <input className="input" value={form.vetName} onChange={(e) => setForm({ ...form, vetName: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("health.vetPhone")}</label>
                <input className="input" value={form.vetPhone} onChange={(e) => setForm({ ...form, vetPhone: e.target.value })} />
              </div>
            </div>
          </div>
          {/* General */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("health.generalSection")}</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.neuteredSpayed}
                  onChange={(e) => setForm({ ...form, neuteredSpayed: e.target.checked })}
                  className="w-4 h-4 accent-brand-500"
                />
                <span className="text-sm text-petra-text">{t("health.neutered")}</span>
              </label>
              {form.neuteredSpayed && (
                <div>
                  <label className="label">{t("health.neuteredDate")}</label>
                  <input type="date" lang={cfg.lang} className="input" value={form.neuteredSpayedDate} onChange={(e) => setForm({ ...form, neuteredSpayedDate: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">{t("health.origin")}</label>
                <input className="input" value={form.originInfo} onChange={(e) => setForm({ ...form, originInfo: e.target.value })} placeholder={t("health.originPlaceholder")} />
              </div>
              <div>
                <label className="label">{t("health.timeWithOwner")}</label>
                <input className="input" value={form.timeWithOwner} onChange={(e) => setForm({ ...form, timeWithOwner: e.target.value })} placeholder={t("health.timeWithOwnerPlaceholder")} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tc("progress.saving") : t("saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Behavior Modal ──────────────────────────────────────────────────────

/** Label = messages `customers.petCareModals.behavior.flags.<key>`. */
type BehaviorFlagKey = Extract<
  keyof NonNullable<Pet["behavior"]>,
  | "dogAggression" | "humanAggression" | "leashReactivity" | "leashPulling" | "jumping"
  | "separationAnxiety" | "excessiveBarking" | "destruction" | "resourceGuarding"
  | "badWithKids" | "houseSoiling" | "biteHistory" | "priorTraining"
>;
export const BEHAVIOR_EDIT_FLAGS: { key: BehaviorFlagKey }[] = [
  { key: "dogAggression" },
  { key: "humanAggression" },
  { key: "leashReactivity" },
  { key: "leashPulling" },
  { key: "jumping" },
  { key: "separationAnxiety" },
  { key: "excessiveBarking" },
  { key: "destruction" },
  { key: "resourceGuarding" },
  { key: "badWithKids" },
  { key: "houseSoiling" },
  { key: "biteHistory" },
  { key: "priorTraining" },
];

export function EditBehaviorModal({
  petId,
  petName,
  behavior,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  behavior: Pet["behavior"];
  customerId: string;
  onClose: () => void;
}) {
  const t = useTranslations("customers.petCareModals");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [customInput, setCustomInput] = useState("");
  const [form, setForm] = useState({
    dogAggression: behavior?.dogAggression ?? false,
    humanAggression: behavior?.humanAggression ?? false,
    leashReactivity: behavior?.leashReactivity ?? false,
    leashPulling: behavior?.leashPulling ?? false,
    jumping: behavior?.jumping ?? false,
    separationAnxiety: behavior?.separationAnxiety ?? false,
    excessiveBarking: behavior?.excessiveBarking ?? false,
    destruction: behavior?.destruction ?? false,
    resourceGuarding: behavior?.resourceGuarding ?? false,
    badWithKids: behavior?.badWithKids ?? false,
    houseSoiling: behavior?.houseSoiling ?? false,
    biteHistory: behavior?.biteHistory ?? false,
    priorTraining: behavior?.priorTraining ?? false,
    biteDetails: behavior?.biteDetails ?? "",
    triggers: behavior?.triggers ?? "",
    priorTrainingDetails: behavior?.priorTrainingDetails ?? "",
    customIssues: (() => {
      try { return behavior?.customIssues ? JSON.parse(behavior.customIssues) : []; }
      catch { return []; }
    })() as string[],
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/behavior`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error(t("behavior.updateError")),
  });

  const toggle = (key: string) =>
    setForm((f) => ({ ...f, [key]: !f[key as keyof typeof f] }));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">{t("behavior.title", { petName })}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {/* Behavior flags */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("behavior.flagsSection")}</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              {BEHAVIOR_EDIT_FLAGS.map(({ key }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form[key as keyof typeof form]}
                    onChange={() => toggle(key)}
                    className="w-4 h-4 accent-brand-500"
                  />
                  <span className="text-xs text-petra-text">{t(`behavior.flags.${key}`)}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Extra text fields */}
          <div className="space-y-3">
            {form.biteHistory && (
              <div>
                <label className="label">{t("behavior.biteDetails")}</label>
                <textarea
                  className="input min-h-[60px]"
                  value={form.biteDetails}
                  onChange={(e) => setForm({ ...form, biteDetails: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label">{t("behavior.triggers")}</label>
              <input
                className="input"
                value={form.triggers}
                onChange={(e) => setForm({ ...form, triggers: e.target.value })}
                placeholder={t("behavior.triggersPlaceholder")}
              />
            </div>
            {form.priorTraining && (
              <div>
                <label className="label">{t("behavior.priorTrainingDetails")}</label>
                <input
                  className="input"
                  value={form.priorTrainingDetails}
                  onChange={(e) => setForm({ ...form, priorTrainingDetails: e.target.value })}
                />
              </div>
            )}
          </div>
          {/* Custom issues */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">{t("behavior.customIssues")}</p>
            {form.customIssues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.customIssues.map((issue, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                  >
                    {issue}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, customIssues: f.customIssues.filter((_, i) => i !== idx) }))}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={t("behavior.customIssuePlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = customInput.trim();
                    if (val && !form.customIssues.includes(val)) {
                      setForm((f) => ({ ...f, customIssues: [...f.customIssues, val] }));
                      setCustomInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                className="btn-secondary text-xs px-3"
                onClick={() => {
                  const val = customInput.trim();
                  if (val && !form.customIssues.includes(val)) {
                    setForm((f) => ({ ...f, customIssues: [...f.customIssues, val] }));
                    setCustomInput("");
                  }
                }}
              >
                {tc("actions.add")}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tc("progress.saving") : t("saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
