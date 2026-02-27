/**
 * Shared types and helpers for the onboarding / business-setup flow.
 *
 * The setup checklist lives on the dashboard itself (not a separate page).
 * Steps are tracked via OnboardingProgress in the DB.
 *
 * Steps:
 *   1 = Business profile   (/settings → business tab)
 *   2 = Price list         (/price-lists)
 *   3 = First customer     (/customers)
 *   4 = First appointment  (/calendar)
 */

export const TOTAL_STEPS = 4;

export interface SetupStep {
  step: number;
  title: string;
  description: string;
  href: string;
  /** query string to add when navigating (e.g. ?tab=services) */
  hrefQuery?: string;
  icon: string; // emoji
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
  {
    step: 4,
    title: "תור ראשון",
    description: "קבע פגישה ביומן — ותתחיל לנהל את העסק מסודר",
    href: "/calendar",
    icon: "📅",
  },
];

export function getSetupStep(step: number): SetupStep | null {
  return SETUP_STEPS.find((s) => s.step === step) ?? null;
}

/** Returns the next incomplete step number, or null if all done */
export function getNextStep(progress: {
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4: boolean;
}): number | null {
  if (!progress.stepCompleted1) return 1;
  if (!progress.stepCompleted2) return 2;
  if (!progress.stepCompleted3) return 3;
  if (!progress.stepCompleted4) return 4;
  return null;
}

export function countCompletedSteps(progress: {
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4: boolean;
}): number {
  return [
    progress.stepCompleted1,
    progress.stepCompleted2,
    progress.stepCompleted3,
    progress.stepCompleted4,
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
  {
    step: 4,
    route: () => "/calendar",
    targetSelector: "[data-onboarding='new-appointment-btn']",
    tooltipText: "קבע את התור הראשון ביומן שלך.",
    tooltipPosition: "bottom",
    successMessage: "כל הכבוד! העסק שלך מוכן לפעולה 🚀",
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
