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
