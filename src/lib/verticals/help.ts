/**
 * Help content per vertical (docs/verticals). The help center FAQ + "מה חדש" are written
 * for dog businesses. A "generic" business sees only the entries without dog-domain
 * wording; whole dog-only categories go. Dogs → everything, unchanged. Pure.
 */
import { normalizeVertical } from "./index";

/** Dog-domain wording a generic business must not be shown. */
// Short words ("חיה", "גור") only as whole words — "גורם" / "חייה" must not match.
export const DOG_TEXT_RE = /כלב|חיות|חיית|(?:^|[^\u05D0-\u05EA])[הלבו]?(?:חיה|גור|גורים)(?=[^\u05D0-\u05EA]|$)|פנסיון|אילוף|מאלף|גזע|וטרינר|חיסון|🐾|🐕|🐶|🦴/;

/** FAQ categories that only exist for dog businesses. */
export const DOG_ONLY_HELP_CATEGORIES: readonly string[] = ["pets", "boarding", "training", "service-dogs"];

export function hasDogText(text: string): boolean {
  return DOG_TEXT_RE.test(text);
}

export function helpCategoriesForVertical<C extends { id: string; items: { question: string; answer: string }[] }>(
  categories: readonly C[],
  vertical: unknown,
): C[] {
  if (normalizeVertical(vertical) === "dogs") return [...categories];
  return categories
    .filter((c) => !DOG_ONLY_HELP_CATEGORIES.includes(c.id))
    .map((c) => ({ ...c, items: c.items.filter((i) => !hasDogText(i.question) && !hasDogText(i.answer)) }))
    .filter((c) => c.items.length > 0);
}

export function changelogForVertical<R extends { title: string; items: string[] }>(releases: readonly R[], vertical: unknown): R[] {
  if (normalizeVertical(vertical) === "dogs") return [...releases];
  return releases
    .map((r) => ({ ...r, items: r.items.filter((i) => !hasDogText(i)) }))
    .filter((r) => !hasDogText(r.title) && r.items.length > 0);
}
