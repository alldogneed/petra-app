"use client";
import React from "react";
import { Star, Zap, Crown } from "lucide-react";

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

export const SD_VACCINE_TREATMENTS = [
  { key: "RABIES_BOOSTER" as const, label: "כלבת", doses: 1 },
  { key: "DHPP_BOOSTER"   as const, label: "משושה", doses: 1 },
  { key: "DEWORMING"      as const, label: "תילוע", doses: 2 },
  { key: "PARK_WORM"      as const, label: "תולעת הפארק", doses: 4 },
  { key: "FLEA_TICK"      as const, label: "קרציות ופרעושים", doses: 4 },
];
export const SD_PUPPY_TREATMENTS = [
  { key: "RABIES_PRIMARY" as const, label: "כלבת", doses: 2 },
  { key: "DHPP_PRIMARY"   as const, label: "משושה גורים", doses: 3 },
  { key: "DEWORMING"      as const, label: "תילוע", doses: 4 },
  { key: "PARK_WORM"      as const, label: "תולעת הפארק", doses: 4 },
  { key: "FLEA_TICK"      as const, label: "קרציות ופרעושים", doses: 4 },
];
export const HE_MONTHS_SETTINGS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
export const PUPPY_WEEKS_OPTIONS = [4,6,8,10,12,14,16,18,20,22,24,28,32,36,40,48];

export interface Business {
  id: string;
  name: string;
  phone: string | null;
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
  vatNumber?: string;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

export function validatePhone(phone: string): string | undefined {
  if (!phone) return undefined; // optional
  const digits = phone.replace(/[\s\-().]/g, "");
  // Israeli phone: 0X-XXXXXXX (9-10 digits starting with 0) or +972...
  if (digits.startsWith("+972") && digits.length >= 12 && digits.length <= 13) return undefined;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) return undefined;
  return "מספר טלפון לא תקין (פורמט ישראלי)";
}

export function validateVatNumber(vat: string): string | undefined {
  if (!vat) return undefined; // optional
  const digits = vat.replace(/\D/g, "");
  if (digits.length === 9) return undefined;
  return "מספר עוסק מורשה חייב להכיל 9 ספרות";
}

// ─── Tier Icons ──────────────────────────────────────────────────────────────

export const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = { basic: Star, pro: Zap, groomer: Crown, service_dog: Crown };
