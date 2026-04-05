/**
 * Shared types and helpers for the onboarding / business-setup flow.
 *
 * 3 core steps — all tracked in OnboardingProgress DB record.
 * Advanced steps (4-7) are no longer shown in the checklist.
 *
 * Steps:
 *   1 = Business profile   (/settings → business tab)  — stepCompleted1
 *   2 = Price list         (/settings → services tab)  — stepCompleted2
 *   3 = First customer     (/customers)                — stepCompleted3
 */

export const TOTAL_STEPS = 3;
export const CORE_STEPS = 3;

export interface SetupStep {
  step: number;
  title: string;
  description: string;
  href: string;
  /** query string to add when navigating (e.g. ?tab=services) */
  hrefQuery?: string;
  icon: string; // emoji
  advanced?: boolean;
}

export const SETUP_STEPS: SetupStep[] = [
  {
    step: 1,
    title: "פרטי העסק",
    description: "שם, טלפון, כתובת — הבסיס של כל הדוחות והחשבוניות",
    href: "/settings",
    hrefQuery: "tab=business",
    icon: "🏢",
  },
  {
    step: 2,
    title: "הקמת מחירון",
    description: "הגדר את השירותים שלך עם מחיר ומשך — זה הלב של המערכת",
    href: "/settings",
    hrefQuery: "tab=services",
    icon: "💰",
  },
  {
    step: 3,
    title: "לקוח ראשון",
    description: "הוסף את הלקוח הראשון שלך עם הפרטים ובעל החיים",
    href: "/customers",
    icon: "👤",
  },
];

export function getSetupStep(step: number): SetupStep | null {
  return SETUP_STEPS.find((s) => s.step === step) ?? null;
}

export interface OnboardingProgressState {
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4?: boolean;
  stepCompleted5?: boolean;
  stepCompleted6?: boolean;
  stepCompleted7?: boolean;
}

/** Returns the next incomplete step number (1-3), or null if all done */
export function getNextStep(progress: OnboardingProgressState): number | null {
  if (!progress.stepCompleted1) return 1;
  if (!progress.stepCompleted2) return 2;
  if (!progress.stepCompleted3) return 3;
  return null;
}

export function countCompletedSteps(progress: OnboardingProgressState): number {
  return [
    progress.stepCompleted1,
    progress.stepCompleted2,
    progress.stepCompleted3,
  ].filter(Boolean).length;
}

// ─── Legacy URL helpers (kept for backward-compat with OnboardingGuard) ───────

export interface OnboardingStepConfig {
  step: number;
  route: (customerId?: string) => string;
  targetSelector: string;
  tooltipText: string;
  tooltipPosition: "top" | "bottom" | "left" | "right";
  successMessage: string;
}

export const STEP_CONFIGS: OnboardingStepConfig[] = [
  {
    step: 1,
    route: () => "/settings?tab=business",
    targetSelector: "[data-onboarding='save-business-btn']",
    tooltipText: "מלא את פרטי העסק ולחץ שמור.",
    tooltipPosition: "bottom",
    successMessage: "פרטי העסק נשמרו ✓",
  },
  {
    step: 2,
    route: () => "/price-lists",
    targetSelector: "[data-onboarding='add-service-btn']",
    tooltipText: "הוסף את המחירון הראשון שלך — שם, מחיר, משך זמן.",
    tooltipPosition: "bottom",
    successMessage: "מעולה! המחירון נוסף בהצלחה 🎉",
  },
  {
    step: 3,
    route: () => "/customers",
    targetSelector: "[data-onboarding='add-customer-btn']",
    tooltipText: "הוסף לקוח ראשון. תוכל גם לייבא רשימה בהמשך.",
    tooltipPosition: "bottom",
    successMessage: "לקוח ראשון נוסף! עוד שלב אחד.",
  },
];

export function getStepConfig(step: number): OnboardingStepConfig | null {
  return STEP_CONFIGS.find((s) => s.step === step) ?? null;
}

export function buildOnboardingUrl(step: number, customerId?: string): string {
  const config = getStepConfig(step);
  if (!config) return "/dashboard";
  const base = config.route(customerId);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}onboarding=1&step=${step}${customerId ? `&cid=${customerId}` : ""}`;
}
