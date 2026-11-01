// Shared label/colour constants for the customer card (src/components/customers/detail/*).
//
// i18n: labels are NOT stored here — components render them through `constantLabel(t, group, id)`
// with `t = useTranslations("customers.constants")` (messages under `customers.constants.*`).
// This file keeps only ids, colours and severities.

/** Translator scoped to `customers.constants` (`useTranslations("customers.constants")`). */
export interface ConstantsTranslator {
  (key: string): string;
  has(key: string): boolean;
}

export type ConstantsGroup =
  | "paymentMethods"
  | "paymentStatuses"
  | "behaviorFlags"
  | "programTypes"
  | "programStatuses"
  | "orderStatuses"
  | "orderTypes";

/** Translated label for an id of one of the maps below; `undefined` when unknown (keep the caller's fallback). */
export function constantLabel(
  t: ConstantsTranslator,
  group: ConstantsGroup,
  id: string | null | undefined,
): string | undefined {
  if (!id) return undefined;
  const key = `${group}.${id}`;
  return t.has(key) ? t(key) : undefined;
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "badge-success",
  pending: "badge-warning",
  overdue: "badge-danger",
  canceled: "badge-neutral",
};

/** Behaviour flag id → severity (order = display order). Labels: `behaviorFlags.<id>`. */
export const BEHAVIOR_FLAG_SEVERITY: Record<string, "red" | "orange" | "green"> = {
  dogAggression: "red",
  humanAggression: "red",
  biteHistory: "red",
  badWithKids: "red",
  leashReactivity: "orange",
  leashPulling: "orange",
  jumping: "orange",
  separationAnxiety: "orange",
  excessiveBarking: "orange",
  destruction: "orange",
  resourceGuarding: "orange",
  houseSoiling: "orange",
  priorTraining: "green",
};

export const SEVERITY_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-amber-100 text-amber-700 border-amber-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const PROGRAM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "badge-success",
  PAUSED: "badge-warning",
  COMPLETED: "badge-brand",
  CANCELED: "badge-neutral",
};

/** Order status → badge class. Labels: `orderStatuses.<id>`. */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "badge-neutral",
  confirmed: "badge-brand",
  paid: "badge-success",
  partially_paid: "badge-warning",
  canceled: "badge-danger",
  refunded: "badge-danger",
};
