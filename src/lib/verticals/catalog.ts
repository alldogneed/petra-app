/**
 * Price-list categories per vertical. Categories are stored as Hebrew strings
 * (PriceListItem.category) — they are KEYS and are never rewritten; only what a
 * "generic" business is offered / sees changes. Pure + client-safe.
 */
import { normalizeVertical } from "./index";
import { vocab } from "./vocab";

/** Categories that only exist in the dog domain (boarding stays, grooming). */
export const DOG_ONLY_PRICE_CATEGORIES: readonly string[] = ["פנסיון", "טיפוח"];

/** The category key that opens a program / session package ("אילוף"). */
export const PROGRAM_PRICE_CATEGORY = "אילוף";

export function isPriceCategoryOffered(vertical: unknown, category: string): boolean {
  return normalizeVertical(vertical) === "dogs" || !DOG_ONLY_PRICE_CATEGORIES.includes(category);
}

/** Filter a category list for the vertical (dogs → unchanged, same order). */
export function offeredPriceCategories<T extends string>(vertical: unknown, categories: readonly T[]): T[] {
  return categories.filter((c) => isPriceCategoryOffered(vertical, c));
}

/** Display label of a stored category. dogs → the category itself. */
export function priceCategoryLabel(vertical: unknown, category: string): string {
  if (category === PROGRAM_PRICE_CATEGORY) return vocab("pricing.category_program", { vertical: normalizeVertical(vertical) });
  return category;
}

/**
 * Stored enum values (task categories, order types, appointment categories…) that only
 * exist in the dog domain. They are never rewritten — "generic" just isn't offered them
 * in pickers / filters.
 */
export const DOG_ONLY_VALUES: readonly string[] = [
  // Task.category
  "BOARDING", "HEALTH", "MEDICATION", "FEEDING",
  // Order.orderType / service categories
  "boarding", "grooming", "service_dog", "daycare",
];

/** Values that mean "program / training" and read differently for "generic". */
const PROGRAM_VALUES: readonly string[] = ["TRAINING", "training", PROGRAM_PRICE_CATEGORY];

export function isValueOffered(vertical: unknown, value: string): boolean {
  return normalizeVertical(vertical) === "dogs" || !DOG_ONLY_VALUES.includes(value);
}

/** Display label of a stored enum value. dogs → `dogsLabel` unchanged. */
export function valueLabel(vertical: unknown, value: string, dogsLabel: string): string {
  if (normalizeVertical(vertical) === "dogs") return dogsLabel;
  if (PROGRAM_VALUES.includes(value)) return vocab("pricing.category_program", { vertical: "generic" });
  return dogsLabel;
}

/**
 * Free text written for the dog domain can carry pet emoji ("נתראה! 🐾"). For a "generic"
 * business they are dropped; dogs → the text unchanged.
 */
export function neutralizeForVertical(text: string, vertical: unknown): string {
  if (normalizeVertical(vertical) === "dogs") return text;
  return text.replace(/ ?(🐾|🐕|🐶|🦴)/gu, "");
}
