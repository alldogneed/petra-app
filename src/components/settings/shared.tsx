"use client";
import React from "react";
import { Star, Zap, Crown } from "lucide-react";
import type { useTranslations } from "next-intl";

/** Translator for the `settings.shared` namespace (validation messages, labels). */
export type SettingsSharedT = ReturnType<typeof useTranslations<"settings.shared">>;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VaccineSchedule {
  RABIES_BOOSTER?: number[];
  DHPP_BOOSTER?: number[];
  DEWORMING?: number[];
  PARK_WORM?: number[];
  FLEA_TICK?: number[];
}

export interface SdSettings {
  trackHours: boolean;
  defaultTargetHours: number;
  allowManualCert: boolean;
  vaccinationScheduleEnabled?: boolean;
  vaccinationSchedule?: VaccineSchedule;
  puppyVaccinationSchedule?: Record<string, number[]>; // weeks after birth per dose
}

export const DEFAULT_SD_SETTINGS: SdSettings = {
  trackHours: true,
  defaultTargetHours: 120,
  allowManualCert: true,
  vaccinationScheduleEnabled: false,
};

// Labels are message keys under `settings.shared` (render with
// `useTranslations("settings.shared")` → `t(item.labelKey)`).
export const SD_VACCINE_TREATMENTS = [
  { key: "RABIES_BOOSTER" as const, labelKey: "treatments.rabies" as const, doses: 1 },
  { key: "DHPP_BOOSTER"   as const, labelKey: "treatments.dhpp" as const, doses: 1 },
  { key: "DEWORMING"      as const, labelKey: "treatments.deworming" as const, doses: 2 },
  { key: "PARK_WORM"      as const, labelKey: "treatments.parkWorm" as const, doses: 4 },
  { key: "FLEA_TICK"      as const, labelKey: "treatments.fleaTick" as const, doses: 4 },
];
export const SD_PUPPY_TREATMENTS = [
  { key: "RABIES_PRIMARY" as const, labelKey: "treatments.rabies" as const, doses: 2 },
  { key: "DHPP_PRIMARY"   as const, labelKey: "treatments.dhppPuppy" as const, doses: 3 },
  { key: "DEWORMING"      as const, labelKey: "treatments.deworming" as const, doses: 4 },
  { key: "PARK_WORM"      as const, labelKey: "treatments.parkWorm" as const, doses: 4 },
  { key: "FLEA_TICK"      as const, labelKey: "treatments.fleaTick" as const, doses: 4 },
];
/** Month names (index 0 = January) as message keys under `settings.shared`. */
export const MONTH_KEYS_SETTINGS = [
  "months.jan", "months.feb", "months.mar", "months.apr", "months.may", "months.jun",
  "months.jul", "months.aug", "months.sep", "months.oct", "months.nov", "months.dec",
] as const;
export const PUPPY_WEEKS_OPTIONS = [4,6,8,10,12,14,16,18,20,22,24,28,32,36,40,48];

export interface Business {
  id: string;
  name: string;
  phone: string | null;
  customerContactPhone?: string | null;
  email: string | null;
  address: string | null;
  tier: string;
  vatNumber: string | null;
  legalEntityType: string | null;
  slug: string | null;
  logo: string | null;
  boardingCheckInTime: string | null;
  boardingCheckOutTime: string | null;
  boardingCalcMode: string | null;
  boardingMinNights: number | null;
  cancellationPolicy: string | null;
  bookingWelcomeText: string | null;
  bookingRequiresApproval: boolean;
  depositInstructions: string | null;
  sdSettings: SdSettings | null;
  whatsappRemindersEnabled: boolean;
  whatsappReminderLeadHours: number;
  _count: { customers: number; appointments: number };
}

export interface ValidationErrors {
  name?: string;
  phone?: string;
  customerContactPhone?: string;
  vatNumber?: string;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

export function validatePhone(phone: string, t: SettingsSharedT): string | undefined {
  if (!phone) return undefined; // optional
  const digits = phone.replace(/[\s\-().]/g, "");
  // Israeli phone: 0X-XXXXXXX (9-10 digits starting with 0) or +972...
  if (digits.startsWith("+972") && digits.length >= 12 && digits.length <= 13) return undefined;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) return undefined;
  return t("errors.phoneInvalid");
}

export function validateVatNumber(vat: string, t: SettingsSharedT): string | undefined {
  if (!vat) return undefined; // optional
  const digits = vat.replace(/\D/g, "");
  if (digits.length === 9) return undefined;
  return t("errors.vatInvalid");
}

// ─── Tier Icons ──────────────────────────────────────────────────────────────

export const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = { basic: Star, pro: Zap, groomer: Crown, service_dog: Crown };
