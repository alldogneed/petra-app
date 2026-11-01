"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  Dog,
  Heart,
  Brain,
  Pill,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  } from "lucide-react";
import { cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

interface FormInfo {
  id: string;
  businessName: string;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
}

const STEPS = [
  { id: "dogDetails", icon: Dog },
  { id: "health", icon: Heart },
  { id: "behavior", icon: Brain },
  { id: "medications", icon: Pill },
] as const;

const BEHAVIOR_FLAGS = [
  { key: "dogAggression" },
  { key: "humanAggression" },
  { key: "leashReactivity" },
  { key: "leashPulling" },
  { key: "jumping" },
  { key: "separationAnxiety" },
  { key: "excessiveBarking" },
  { key: "destruction" },
  { key: "resourceGuarding" },
  { key: "fears" },
  { key: "badWithKids" },
  { key: "houseSoiling" },
  { key: "biteHistory" },
];

export default function IntakeFormPage({ params }: { params: { token: string } }) {
  const t = useTranslations("publicIntake.intakeDetailPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Dog info
  const [dog, setDog] = useState({
    name: "",
    breed: "",
    gender: "",
    weight: "",
    birthDate: "",
    customerName: "",
    customerPhone: "",
  });

  // Health info
  const [health, setHealth] = useState({
    allergies: "",
    medicalConditions: "",
    surgeriesHistory: "",
    activityLimitations: "",
    foodNotes: "",
    vetName: "",
    vetPhone: "",
    neuteredSpayed: null as boolean | null,
    originInfo: "",
    timeWithOwner: "",
  });

  // Behavior info
  const [behavior, setBehavior] = useState<Record<string, boolean | string>>({
    customIssues: "",
    dogAggression: false,
    humanAggression: false,
    leashReactivity: false,
    leashPulling: false,
    jumping: false,
    separationAnxiety: false,
    excessiveBarking: false,
    destruction: false,
    resourceGuarding: false,
    fears: false,
    badWithKids: false,
    houseSoiling: false,
    biteHistory: false,
    biteDetails: "",
    triggers: "",
    priorTraining: false,
    priorTrainingDetails: "",
  });

  // Medications
  const [medications, setMedications] = useState<
    Array<{ medName: string; dosage: string; frequency: string; instructions: string }>
  >([]);

  useEffect(() => {
    fetch(`/api/intake/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setFormInfo(data);
          if (data.customerName) {
            setDog((d) => ({ ...d, customerName: data.customerName, customerPhone: data.customerPhone || "" }));
          }
        }
      })
      .catch(() => setError(t("errors.loadFailed")))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/intake/${params.token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dog, health, behavior, medications }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("errors.saveFailed"));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("errors.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PetraLoader variant="splash" />;
  }

  if (error && !formInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir={cfg.dir}>
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900 mb-1">{error}</h1>
          <p className="text-sm text-slate-500">{t("errorState.contactBusiness")}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir={cfg.dir}>
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t("success.title")}</h1>
          <p className="text-sm text-slate-500">{t("success.thanks")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4" dir={cfg.dir}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-4 pt-4">
          <div className="w-10 h-10 rounded-xl mx-auto mb-2 overflow-hidden">
            <Image src="/logo.svg" alt="Petra" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-base font-bold text-slate-900">{t("header.title")}</h1>
          <p className="text-xs text-slate-500">{formInfo?.businessName}</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={i}
                onClick={() => i <= step && setStep(i)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                  i === step
                    ? "bg-orange-100 text-orange-600"
                    : i < step
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`steps.${s.id}`)}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          {/* Step 0: Dog Details */}
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 mb-3">{t("steps.dogDetails")}</h2>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("dog.nameLabel")}</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                  value={dog.name}
                  onChange={(e) => setDog({ ...dog, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{t("dog.breedLabel")}</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    value={dog.breed}
                    onChange={(e) => setDog({ ...dog, breed: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{t("dog.genderLabel")}</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    value={dog.gender}
                    onChange={(e) => setDog({ ...dog, gender: e.target.value })}
                  >
                    <option value="">{t("dog.genderSelect")}</option>
                    <option value="male">{t("dog.genderMale")}</option>
                    <option value="female">{t("dog.genderFemale")}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{t("dog.weightLabel")}</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    value={dog.weight}
                    onChange={(e) => setDog({ ...dog, weight: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{t("dog.birthDateLabel")}</label>
                  <input
                    type="date" lang={cfg.lang}
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    value={dog.birthDate}
                    onChange={(e) => setDog({ ...dog, birthDate: e.target.value })}
                  />
                </div>
              </div>
              {!formInfo?.customerName && (
                <>
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">{t("owner.sectionTitle")}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">{t("owner.nameLabel")}</label>
                    <input
                      className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      value={dog.customerName}
                      onChange={(e) => setDog({ ...dog, customerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">{t("owner.phoneLabel")}</label>
                    <input
                      className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      value={dog.customerPhone}
                      onChange={(e) => setDog({ ...dog, customerPhone: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 1: Health */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 mb-3">{t("steps.health")}</h2>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.allergiesLabel")}</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={health.allergies}
                  onChange={(e) => setHealth({ ...health, allergies: e.target.value })}
                  placeholder={t("health.allergiesPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.conditionsLabel")}</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={health.medicalConditions}
                  onChange={(e) => setHealth({ ...health, medicalConditions: e.target.value })}
                  placeholder={t("health.conditionsPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.surgeriesLabel")}</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={health.surgeriesHistory}
                  onChange={(e) => setHealth({ ...health, surgeriesHistory: e.target.value })}
                  placeholder={t("health.surgeriesPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.activityLabel")}</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={health.activityLimitations}
                  onChange={(e) => setHealth({ ...health, activityLimitations: e.target.value })}
                  placeholder={t("health.activityPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.foodLabel")}</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={health.foodNotes}
                  onChange={(e) => setHealth({ ...health, foodNotes: e.target.value })}
                  placeholder={t("health.foodPlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.vetNameLabel")}</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    value={health.vetName}
                    onChange={(e) => setHealth({ ...health, vetName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.vetPhoneLabel")}</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                    value={health.vetPhone}
                    onChange={(e) => setHealth({ ...health, vetPhone: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.neuteredLabel")}</label>
                <div className="flex gap-3">
                  {[
                    { id: "yes", value: true },
                    { id: "no", value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setHealth({ ...health, neuteredSpayed: opt.value })}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                        health.neuteredSpayed === opt.value
                          ? "bg-orange-100 text-orange-600 border-2 border-orange-400"
                          : "bg-slate-50 text-slate-600 border border-slate-200"
                      )}
                    >
                      {t(`yesNo.${opt.id}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.originLabel")}</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                  value={health.originInfo}
                  onChange={(e) => setHealth({ ...health, originInfo: e.target.value })}
                  placeholder={t("health.originPlaceholder")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">{t("health.timeWithOwnerLabel")}</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                  value={health.timeWithOwner}
                  onChange={(e) => setHealth({ ...health, timeWithOwner: e.target.value })}
                  placeholder={t("health.timeWithOwnerPlaceholder")}
                />
              </div>
            </div>
          )}

          {/* Step 2: Behavior */}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 mb-1">{t("steps.behavior")}</h2>
              <p className="text-xs text-slate-500 mb-3">{t("behavior.markRelevant")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BEHAVIOR_FLAGS.map((flag) => (
                  <button
                    key={flag.key}
                    onClick={() =>
                      setBehavior({ ...behavior, [flag.key]: !behavior[flag.key] })
                    }
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-xl text-start text-xs font-medium transition-all",
                      behavior[flag.key]
                        ? "bg-red-50 text-red-700 border-2 border-red-300"
                        : "bg-slate-50 text-slate-600 border border-slate-200"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        behavior[flag.key]
                          ? "bg-red-500 border-red-500"
                          : "border-slate-300"
                      )}
                    >
                      {behavior[flag.key] && (
                        <span className="text-white text-[10px]">✓</span>
                      )}
                    </div>
                    {t(`behaviorFlags.${flag.key}`)}
                  </button>
                ))}
              </div>

              {behavior.biteHistory && (
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    {t("behavior.biteDetailsLabel")}
                  </label>
                  <textarea
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                    rows={2}
                    value={behavior.biteDetails as string}
                    onChange={(e) => setBehavior({ ...behavior, biteDetails: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  {t("behavior.triggersLabel")}
                </label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={behavior.triggers as string}
                  onChange={(e) => setBehavior({ ...behavior, triggers: e.target.value })}
                  placeholder={t("behavior.triggersPlaceholder")}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  {t("behavior.notesLabel")}
                </label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                  rows={2}
                  value={behavior.customIssues as string}
                  onChange={(e) => setBehavior({ ...behavior, customIssues: e.target.value })}
                  placeholder={t("behavior.notesPlaceholder")}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  {t("behavior.priorTrainingLabel")}
                </label>
                <div className="flex gap-3 mb-2">
                  {[
                    { id: "yes", value: true },
                    { id: "no", value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() =>
                        setBehavior({ ...behavior, priorTraining: opt.value })
                      }
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                        behavior.priorTraining === opt.value
                          ? "bg-orange-100 text-orange-600 border-2 border-orange-400"
                          : "bg-slate-50 text-slate-600 border border-slate-200"
                      )}
                    >
                      {t(`yesNo.${opt.id}`)}
                    </button>
                  ))}
                </div>
                {behavior.priorTraining && (
                  <textarea
                    className="w-full px-3 py-2.5 rounded-xl border border-petra-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 resize-none"
                    rows={2}
                    value={behavior.priorTrainingDetails as string}
                    onChange={(e) =>
                      setBehavior({ ...behavior, priorTrainingDetails: e.target.value })
                    }
                    placeholder={t("behavior.priorTrainingPlaceholder")}
                  />
                )}
              </div>
            </div>
          )}

          {/* Step 3: Medications */}
          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 mb-3">{t("steps.medications")}</h2>
              {medications.map((med, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      {t("medications.itemTitle", { n: i + 1 })}
                    </span>
                    <button
                      onClick={() =>
                        setMedications(medications.filter((_, j) => j !== i))
                      }
                      className="text-[10px] text-red-500"
                    >
                      {t("medications.remove")}
                    </button>
                  </div>
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-petra-border text-sm"
                    placeholder={t("medications.namePlaceholder")}
                    value={med.medName}
                    onChange={(e) => {
                      const updated = [...medications];
                      updated[i].medName = e.target.value;
                      setMedications(updated);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="px-3 py-2 rounded-xl border border-petra-border text-sm"
                      placeholder={t("medications.dosagePlaceholder")}
                      value={med.dosage}
                      onChange={(e) => {
                        const updated = [...medications];
                        updated[i].dosage = e.target.value;
                        setMedications(updated);
                      }}
                    />
                    <input
                      className="px-3 py-2 rounded-xl border border-petra-border text-sm"
                      placeholder={t("medications.frequencyPlaceholder")}
                      value={med.frequency}
                      onChange={(e) => {
                        const updated = [...medications];
                        updated[i].frequency = e.target.value;
                        setMedications(updated);
                      }}
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={() =>
                  setMedications([
                    ...medications,
                    { medName: "", dosage: "", frequency: "", instructions: "" },
                  ])
                }
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-orange-300 hover:text-orange-500 transition-colors"
              >
                {t("medications.add")}
              </button>

              {medications.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">
                  {t("medications.noneHint")}
                </p>
              )}

              {/* Submit */}
              <div className="pt-3 border-t border-slate-100">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 text-sm text-red-600 mb-3">
                    {error}
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !dog.name}
                  className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors"
                >
                  {submitting ? t("submit.sending") : t("submit.button")}
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <ChevronRight className="w-3 h-3 ltr:-scale-x-100" />
                {t("nav.back")}
              </button>
            ) : (
              <div />
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !dog.name}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium disabled:opacity-50 hover:bg-orange-600 transition-colors"
              >
                {t("nav.next")}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6">
          Powered by Petra
        </p>
      </div>
    </div>
  );
}
