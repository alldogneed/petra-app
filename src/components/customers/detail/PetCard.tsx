"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ChevronDown, ChevronUp, FileText, Gift, GraduationCap, Heart, PawPrint, Pencil, Pill, Scissors,
  Trash2, UtensilsCrossed,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { BEHAVIOR_FLAG_SEVERITY, SEVERITY_COLORS, constantLabel } from "./constants";
import { waLink } from "./customer-actions";
import { calcAge, type DogMedication, type Pet, type TrainingProgramInfo } from "./types";

/** Row/card action buttons: always visible on touch screens, revealed on hover from sm up. */
const HOVER_ACTION =
  "sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 w-7 h-7 sm:w-5 sm:h-5 flex items-center justify-center rounded transition-all";

export interface PetCardActions {
  onEdit: (pet: Pet) => void;
  onDelete: (pet: Pet) => void;
  onFeeding: (pet: Pet) => void;
  onMedication: (pet: Pet, med: DogMedication | null) => void;
  onDeleteMedication: (pet: Pet, med: DogMedication) => void;
  onHealth: (pet: Pet) => void;
  onBehavior: (pet: Pet) => void;
  onNote: (pet: Pet, field: "medicalNotes" | "behaviorNotes", label: string, value: string) => void;
  onDocuments: (pet: Pet) => void;
}

export function PetCard({
  pet,
  programs,
  customerPhone,
  isGroomer,
  isExpanded,
  onToggle,
  canSendMessages,
  canDelete,
  deleteIsRequest,
  actions,
}: {
  pet: Pet;
  /** Training programs of this pet. */
  programs: TrainingProgramInfo[];
  customerPhone: string;
  isGroomer: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  canSendMessages: boolean;
  canDelete: boolean;
  deleteIsRequest: boolean;
  actions: PetCardActions;
}) {
  const t = useTranslations("customers.petCard");
  const tCustomers = useTranslations("customers");
  const tk = useTranslations("customers.constants");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (section: string) => setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  const isSectionOpen = (section: string) => !!openSections[section];

  const petTags: string[] = (() => {
    try {
      return JSON.parse(pet.tags || "[]");
    } catch {
      return [];
    }
  })();
  const age = calcAge(pet.birthDate, tCustomers);
  const attachmentsList: { type: string; url: string; mimeType?: string }[] = (() => {
    try { return JSON.parse(pet.attachments || "[]"); } catch { return []; }
  })();
  const profilePhotoUrl = attachmentsList.find((a) => a.type === "profile_photo" || a.mimeType?.startsWith("image/"))?.url ?? null;
  const docCount = attachmentsList.length;
  const hasWarning =
    pet.behavior?.dogAggression ||
    pet.behavior?.humanAggression ||
    pet.behavior?.biteHistory;
  const hasMeds = pet.medications && pet.medications.length > 0;
  const hasFood = !!pet.foodNotes;

  // Gather active behavior flags
  const activeBehaviorFlags = pet.behavior
    ? Object.entries(BEHAVIOR_FLAG_SEVERITY).filter(
        ([key]) => pet.behavior?.[key as keyof typeof pet.behavior] === true
      )
    : [];

  const petPrograms = programs;

  return (
    <div
      className={cn(
        "group rounded-2xl bg-amber-50/50 border border-amber-100 p-4 space-y-3 transition-all",
        isExpanded && "sm:col-span-2 border-amber-200 shadow-sm"
      )}
    >
      {/* Clickable header area */}
      <div
        className="cursor-pointer"
        onClick={() => onToggle()}
      >
        {/* Pet header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} className="w-full h-full object-cover" alt={pet.name} />
            ) : (
              <PawPrint className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/pets/${pet.id}`}
                className="text-sm font-bold text-petra-text hover:text-brand-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {pet.name}
              </Link>
              {hasWarning && (
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              )}
              {pet.health?.neuteredSpayed && (
                <Scissors className="w-3 h-3 text-stone-400 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-petra-muted">
              {pet.species === "dog"
                ? t("species.dog")
                : pet.species === "cat"
                ? t("species.cat")
                : pet.species}
              {pet.breed ? ` · ${pet.breed}` : ""}
              {pet.gender
                ? ` · ${pet.gender === "male" ? t("gender.male") : t("gender.female")}`
                : ""}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1">
            {customerPhone && canSendMessages && (() => {
              const agePart = age ? ` ${age}` : "";
              const bdMsg = `יום הולדת שמח ל-${pet.name}! 🎂🐾\n\n${pet.name} מלא/ה${agePart} היום – כל הכבוד! 🎉\n\nכמתנה קטנה, נשמח להעניק לכם 10% הנחה על הפגישה הבאה 🎁\n(ציינו שקיבלתם הודעה זו בעת קביעת הפגישה)`; // i18n-ok
              return (
                <a
                  href={waLink(customerPhone, bdMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={HOVER_ACTION + " hover:bg-amber-200"}
                  title={t("birthdayWhatsApp")}
                  aria-label={t("birthdayWhatsApp")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Gift className="w-3 h-3 text-amber-700" />
                </a>
              );
            })()}
            {/* Always visible — renaming a pet must not depend on discovering a hover. */}
            <button
              className="w-7 h-7 flex items-center justify-center rounded transition-all hover:bg-amber-200"
              onClick={(e) => { e.stopPropagation(); actions.onEdit(pet); }}
              title={t("editDetails")}
              aria-label={t("editDetailsAria")}
            >
              <Pencil className="w-3.5 h-3.5 text-amber-700" />
            </button>
            {canDelete && (
              <button
                className={HOVER_ACTION + " hover:bg-red-100"}
                onClick={(e) => { e.stopPropagation(); actions.onDelete(pet); }}
                title={deleteIsRequest ? t("sendDeleteRequest") : tc("actions.delete")}
                aria-label={deleteIsRequest ? t("sendDeleteRequest") : t("deletePetAria")}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-stone-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-stone-400" />
            )}
          </div>
        </div>

        {/* Quick info: age, weight, indicators */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-stone-500">
          {age && <span>{t("quick.age", { age })}</span>}
          {pet.weight && <span>{t("quick.weight", { weight: pet.weight })}</span>}
          {pet.microchip && (
            <span className="text-stone-400">{t("quick.microchip", { microchip: pet.microchip })}</span>
          )}
          {hasMeds && (
            <span className="flex items-center gap-0.5 text-red-500">
              <Pill className="w-3 h-3" />
              {t("quick.medsCount", { count: pet.medications.length })}
            </span>
          )}
          {hasFood && (
            <span className="flex items-center gap-0.5 text-amber-600">
              <UtensilsCrossed className="w-3 h-3" />
              {t("feeding.title")}
            </span>
          )}
        </div>
      </div>

      {/* Behavioral tags */}
      {petTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {petTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Expanded details ── */}
      {isExpanded && (
        <div className="pt-3 border-t border-amber-200/50 space-y-4 animate-fade-in">
          {/* Feeding info */}
          <div>
            <div
              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
              onClick={(e) => { e.stopPropagation(); toggleSection("feeding"); }}
            >
              <div className="flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-petra-text">{t("feeding.title")}</span>
                {isSectionOpen("feeding") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
              </div>
              <button
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-amber-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); actions.onFeeding(pet); }}
                title={t("feeding.edit")}
              >
                <Pencil className="w-3 h-3 text-amber-600" />
              </button>
            </div>
            {isSectionOpen("feeding") && ((pet.foodBrand || pet.foodGramsPerDay || pet.foodFrequency || pet.foodNotes) ? (
              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                {pet.foodBrand && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("feeding.brand")}</span>
                    <span className="text-stone-700 font-medium">{pet.foodBrand}</span>
                  </div>
                )}
                <div className="flex gap-4 text-[11px]">
                  {pet.foodGramsPerDay && (
                    <div>
                      <span className="text-stone-500">{t("feeding.amount")}</span>
                      <span className="text-stone-700 font-medium">{t("feeding.gramsPerDay", { grams: pet.foodGramsPerDay })}</span>
                    </div>
                  )}
                  {pet.foodFrequency && (
                    <div>
                      <span className="text-stone-500">{t("feeding.frequency")}</span>
                      <span className="text-stone-700">{pet.foodFrequency}</span>
                    </div>
                  )}
                </div>
                {pet.foodNotes && (
                  <p className="text-[11px] text-stone-500 whitespace-pre-line">{pet.foodNotes}</p>
                )}
              </div>
            ) : (
              <button
                className="w-full text-xs text-amber-400 hover:text-amber-600 py-1.5 border border-dashed border-amber-200 hover:border-amber-300 rounded-lg transition-colors"
                onClick={(e) => { e.stopPropagation(); actions.onFeeding(pet); }}
              >
                {t("feeding.add")}
              </button>
            ))}
          </div>

          {/* Medications */}
          <div>
            <div
              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
              onClick={(e) => { e.stopPropagation(); toggleSection("medications"); }}
            >
              <div className="flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-bold text-petra-text">
                  {t("meds.title", { count: pet.medications.length })}
                </span>
                {isSectionOpen("medications") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
              </div>
              <button
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); actions.onMedication(pet, null); }}
                title={t("meds.edit")}
              >
                <Pencil className="w-3 h-3 text-red-500" />
              </button>
            </div>
            {isSectionOpen("medications") && <div className="space-y-1.5">
              {pet.medications.map((med) => (
                <div key={med.id} className="bg-white/60 rounded-lg p-2.5 group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-petra-text">
                      {med.medName}
                    </span>
                    <div className="flex items-center gap-1">
                      {med.dosage && (
                        <span className="text-[10px] text-stone-500 bg-red-50 px-1.5 py-0.5 rounded">
                          {med.dosage}
                        </span>
                      )}
                      <button
                        className={HOVER_ACTION + " hover:bg-brand-50"}
                        onClick={(e) => { e.stopPropagation(); actions.onMedication(pet, med); }}
                        title={t("meds.editOne")}
                      >
                        <Pencil className="w-3 h-3 text-brand-500" />
                      </button>
                      <button
                        className={HOVER_ACTION + " hover:bg-red-100"}
                        onClick={(e) => { e.stopPropagation(); actions.onDeleteMedication(pet, med); }}
                        title={tc("actions.delete")}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500 mt-1">
                    {med.frequency && <span>{t("meds.frequency", { frequency: med.frequency })}</span>}
                    {med.times && <span>{t("meds.times", { times: med.times })}</span>}
                    {med.instructions && (
                      <span className="text-stone-400">{med.instructions}</span>
                    )}
                    {med.startDate && (
                      <span>
                        {t("meds.from", { date: new Date(med.startDate).toLocaleDateString(locale) })}
                      </span>
                    )}
                    {med.endDate && (
                      <span>
                        {t("meds.until", { date: new Date(med.endDate).toLocaleDateString(locale) })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {pet.medications.length > 0 ? (
                <button
                  className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-dashed border-red-200 hover:border-red-300 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); actions.onMedication(pet, null); }}
                >
                  {t("meds.addAnother")}
                </button>
              ) : (
                <button
                  className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-dashed border-red-200 hover:border-red-300 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); actions.onMedication(pet, null); }}
                >
                  {t("meds.addFirst")}
                </button>
              )}
            </div>}
          </div>

          {/* Health */}
          <div>
            <div
              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
              onClick={(e) => { e.stopPropagation(); toggleSection("health"); }}
            >
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs font-bold text-petra-text">{t("health.title")}</span>
                {isSectionOpen("health") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
              </div>
              <button
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-rose-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); actions.onHealth(pet); }}
                title={t("health.edit")}
              >
                <Pencil className="w-3 h-3 text-rose-500" />
              </button>
            </div>
            {isSectionOpen("health") && pet.health && (
              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                {/* Vaccines */}
                {(pet.health.rabiesLastDate || pet.health.rabiesValidUntil ||
                  pet.health.dhppLastDate || pet.health.dhppPuppy1Date || pet.health.dhppPuppy2Date || pet.health.dhppPuppy3Date ||
                  pet.health.bordatellaDate || pet.health.parkWormDate ||
                  pet.health.dewormingLastDate || pet.health.fleaTickDate ||
                  (pet.health.notVaccinatedFlags && Object.values(pet.health.notVaccinatedFlags).some(Boolean))) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    {pet.health.rabiesLastDate && (
                      <div>
                        <span className="text-stone-500">{t("health.rabies")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.rabiesLastDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.rabiesValidUntil && (
                      <div>
                        <span className="text-stone-500">{t("health.rabiesUntil")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.rabiesValidUntil).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.dhppPuppy1Date && (
                      <div>
                        <span className="text-stone-500">{t("health.dhppPuppy1")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.dhppPuppy1Date).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.dhppPuppy2Date && (
                      <div>
                        <span className="text-stone-500">{t("health.dhppPuppy2")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.dhppPuppy2Date).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.dhppPuppy3Date && (
                      <div>
                        <span className="text-stone-500">{t("health.dhppPuppy3")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.dhppPuppy3Date).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.dhppLastDate && (
                      <div>
                        <span className="text-stone-500">{t("health.dhppAdult")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.dhppLastDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.bordatellaDate && (
                      <div>
                        <span className="text-stone-500">{t("health.bordetella")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.bordatellaDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.parkWormDate && (
                      <div>
                        <span className="text-stone-500">{t("health.parkWorm")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.parkWormDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.dewormingLastDate && (
                      <div>
                        <span className="text-stone-500">{t("health.deworming")}</span>
                        <span className="text-stone-700">
                          {new Date(pet.health.dewormingLastDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.fleaTickDate && (
                      <div>
                        <span className="text-stone-500">{t("health.fleaTick")}</span>
                        <span className="text-stone-700">
                          {pet.health.fleaTickType ? `${pet.health.fleaTickType} · ` : ""}
                          {new Date(pet.health.fleaTickDate).toLocaleDateString(locale)}
                        </span>
                      </div>
                    )}
                    {pet.health.notVaccinatedFlags?.rabies && <div><span className="text-orange-600 font-medium">{t("health.notVaccinated.rabies")}</span></div>}
                    {pet.health.notVaccinatedFlags?.dhpp && <div><span className="text-orange-600 font-medium">{t("health.notVaccinated.dhpp")}</span></div>}
                    {pet.health.notVaccinatedFlags?.deworming && <div><span className="text-orange-600 font-medium">{t("health.notVaccinated.deworming")}</span></div>}
                    {pet.health.notVaccinatedFlags?.parkWorm && <div><span className="text-orange-600 font-medium">{t("health.notVaccinated.parkWorm")}</span></div>}
                    {pet.health.notVaccinatedFlags?.fleaTick && <div><span className="text-orange-600 font-medium">{t("health.notVaccinated.fleaTick")}</span></div>}
                    {pet.health.notVaccinatedFlags?.bordetella && <div><span className="text-orange-600 font-medium">{t("health.notVaccinated.bordetella")}</span></div>}
                  </div>
                )}
                {pet.health.allergies && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.allergies")}</span>
                    <span className="text-stone-700">{pet.health.allergies}</span>
                  </div>
                )}
                {pet.health.medicalConditions && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.medicalConditions")}</span>
                    <span className="text-stone-700">{pet.health.medicalConditions}</span>
                  </div>
                )}
                {pet.health.surgeriesHistory && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.surgeries")}</span>
                    <span className="text-stone-700">{pet.health.surgeriesHistory}</span>
                  </div>
                )}
                {pet.health.activityLimitations && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.activityLimitations")}</span>
                    <span className="text-stone-700">{pet.health.activityLimitations}</span>
                  </div>
                )}
                {(pet.health.vetName || pet.health.vetPhone) && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.vet")}</span>
                    <span className="text-stone-700">
                      {pet.health.vetName}
                      {pet.health.vetPhone ? ` · ${pet.health.vetPhone}` : ""}
                    </span>
                  </div>
                )}
                {pet.health.originInfo && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.origin")}</span>
                    <span className="text-stone-700">{pet.health.originInfo}</span>
                  </div>
                )}
                {pet.health.timeWithOwner && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("health.timeWithOwner")}</span>
                    <span className="text-stone-700">{pet.health.timeWithOwner}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Behavior details */}
          <div>
            <div
              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
              onClick={(e) => { e.stopPropagation(); toggleSection("behavior"); }}
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-petra-text">{t("behavior.title")}</span>
                {isSectionOpen("behavior") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
              </div>
              <button
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-amber-100 transition-colors"
                onClick={(e) => { e.stopPropagation(); actions.onBehavior(pet); }}
                title={t("behavior.edit")}
              >
                <Pencil className="w-3 h-3 text-amber-600" />
              </button>
            </div>
            {isSectionOpen("behavior") && (activeBehaviorFlags.length > 0 || (() => { try { return JSON.parse(pet.behavior?.customIssues || "[]"); } catch { return []; } })().length > 0 || pet.behavior?.triggers || pet.behavior?.biteDetails || pet.behavior?.priorTrainingDetails) && (
              <div className="bg-white/60 rounded-lg p-2.5 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {activeBehaviorFlags.map(([key, severity]) => (
                    <span
                      key={key}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                        SEVERITY_COLORS[severity]
                      )}
                    >
                      {constantLabel(tk, "behaviorFlags", key) ?? key}
                    </span>
                  ))}
                  {(() => { try { return JSON.parse(pet.behavior?.customIssues || "[]") as string[]; } catch { return [] as string[]; } })().map((issue: string, idx: number) => (
                    <span
                      key={`custom-${idx}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-purple-50 text-purple-700 border-purple-200"
                    >
                      {issue}
                    </span>
                  ))}
                </div>
                {pet.behavior?.triggers && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("behavior.triggers")}</span>
                    <span className="text-stone-700">{pet.behavior.triggers}</span>
                  </div>
                )}
                {pet.behavior?.biteDetails && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("behavior.biteDetails")}</span>
                    <span className="text-stone-700">{pet.behavior.biteDetails}</span>
                  </div>
                )}
                {pet.behavior?.priorTrainingDetails && (
                  <div className="text-[11px]">
                    <span className="text-stone-500">{t("behavior.priorTraining")}</span>
                    <span className="text-stone-700">{pet.behavior.priorTrainingDetails}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Training Programs — hidden for groomer tier */}
          {!isGroomer && petPrograms.length > 0 && (
            <div>
              <div
                className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                onClick={(e) => { e.stopPropagation(); toggleSection("training"); }}
              >
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-bold text-petra-text">
                    {t("training.title", { count: petPrograms.length })}
                  </span>
                  {isSectionOpen("training") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                </div>
                <a
                  href={`/training?pet=${pet.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-indigo-500 hover:underline"
                >
                  {t("training.open")}
                </a>
              </div>
              {isSectionOpen("training") && (
                <div className="space-y-2">
                  {petPrograms.map((prog) => {
                    const completedSessions = prog.completedSessions ?? 0;
                    const totalSessions = prog.totalSessions;
                    const statusColors: Record<string, string> = {
                      ACTIVE: "bg-green-100 text-green-700 border-green-200",
                      PAUSED: "bg-yellow-100 text-yellow-700 border-yellow-200",
                      COMPLETED: "bg-blue-100 text-blue-700 border-blue-200",
                      CANCELED: "bg-red-100 text-red-700 border-red-200",
                    };
                    const achievedGoals = prog.goals.filter(g => g.status === "ACHIEVED").length;
                    return (
                      <Link
                        key={prog.id}
                        href={`/training?program=${prog.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white/60 rounded-lg p-2.5 space-y-2 block hover:bg-white transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-petra-text">{prog.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusColors[prog.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {t.has(`training.status.${prog.status}`) ? t(`training.status.${prog.status}`) : prog.status}
                          </span>
                        </div>
                        {/* Sessions progress */}
                        {(totalSessions || completedSessions > 0) && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-stone-500">
                              <span>{t("training.sessions")}</span>
                              <span>{completedSessions}{totalSessions ? `/${totalSessions}` : ""}</span>
                            </div>
                            {totalSessions && (
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-400 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (completedSessions / totalSessions) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                        {/* Goals */}
                        {prog.goals.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-stone-500 font-medium">
                              {t("training.goalsAchieved", { achieved: achievedGoals, total: prog.goals.length })}
                            </p>
                            {prog.goals.slice(0, 4).map(goal => (
                              <div key={goal.id} className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  goal.status === "ACHIEVED" ? "bg-green-500" :
                                  goal.status === "IN_PROGRESS" ? "bg-indigo-400" : "bg-slate-300"
                                }`} />
                                <span className={`text-[10px] flex-1 truncate ${goal.status === "ACHIEVED" ? "line-through text-stone-400" : "text-stone-600"}`}>
                                  {goal.title}
                                </span>
                                {goal.progressPercent > 0 && goal.status !== "ACHIEVED" && (
                                  <span className="text-[10px] text-indigo-500 font-medium">{goal.progressPercent}%</span>
                                )}
                              </div>
                            ))}
                            {prog.goals.length > 4 && (
                              <p className="text-[10px] text-stone-400">{t("training.moreGoals", { count: prog.goals.length - 4 })}</p>
                            )}
                          </div>
                        )}
                        {prog.notes && (
                          <p className="text-[10px] text-stone-500 leading-snug">{prog.notes}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="group flex items-start gap-1.5 bg-white/60 rounded-lg p-2.5">
              <div className="flex-1 text-[11px]">
                <span className="text-stone-500 font-medium">{t("notes.medicalLabel")}</span>
                <span className="text-stone-700">{pet.medicalNotes || <span className="italic text-stone-400">{t("notes.notEntered")}</span>}</span>
              </div>
              <button
                className={HOVER_ACTION + " hover:bg-brand-50 flex-shrink-0"}
                onClick={(e) => { e.stopPropagation(); actions.onNote(pet, "medicalNotes", t("notes.medicalTitle"), pet.medicalNotes || ""); }}
              >
                <Pencil className="w-3 h-3 text-brand-500" />
              </button>
            </div>
            <div className="group flex items-start gap-1.5 bg-white/60 rounded-lg p-2.5">
              <div className="flex-1 text-[11px]">
                <span className="text-stone-500 font-medium">{t("notes.behaviorLabel")}</span>
                <span className="text-stone-700">{pet.behaviorNotes || <span className="italic text-stone-400">{t("notes.notEntered")}</span>}</span>
              </div>
              <button
                className={HOVER_ACTION + " hover:bg-brand-50 flex-shrink-0"}
                onClick={(e) => { e.stopPropagation(); actions.onNote(pet, "behaviorNotes", t("notes.behaviorTitle"), pet.behaviorNotes || ""); }}
              >
                <Pencil className="w-3 h-3 text-brand-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          actions.onDocuments(pet);
        }}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium text-stone-500 hover:text-amber-700 hover:bg-amber-100 transition-colors border border-stone-200 hover:border-amber-200"
      >
        <FileText className="w-3.5 h-3.5" />
        {docCount > 0
          ? t("documents.count", { count: docCount })
          : t("documents.empty")}
      </button>
    </div>
  );
}
