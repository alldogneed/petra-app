/**
 * Hebrew names are typed with different apostrophe characters for the geresh:
 * ' (keyboard), ׳ (Hebrew geresh, U+05F3), ’ / ‘ (smart quotes from iPhone / WhatsApp),
 * ` and ´. "פאץ'" typed on a phone often arrives as "פאץ’" and never matched the
 * stored "פאץ'". Same for the gershayim (", ״, “ ”).
 * Client-safe, no imports.
 */
const GERESH_RE = /['׳’‘`´]/g;
const GERSHAYIM_RE = /["״“”]/g;
const GERESH_FORMS = ["'", "׳", "’"];
const GERSHAYIM_FORMS = ['"', "״", "”"];

/** One canonical form: every geresh → ', every gershayim → ", spaces collapsed. */
export function normalizeHebrewPunct(s: string): string {
  return s.replace(GERESH_RE, "'").replace(GERSHAYIM_RE, '"').replace(/\s+/g, " ").trim();
}

/**
 * Every spelling of `q` a stored value may use (for `contains` searches):
 * each geresh form, each gershayim form, and the text without them.
 * Returns just [q] when q has no such character. Max 4 entries.
 */
export function searchVariants(q: string): string[] {
  const hasGeresh = GERESH_RE.test(q);
  GERESH_RE.lastIndex = 0;
  const hasGershayim = GERSHAYIM_RE.test(q);
  GERSHAYIM_RE.lastIndex = 0;
  if (!hasGeresh && !hasGershayim) return [q];
  const out = new Set<string>();
  for (let i = 0; i < 3; i++) {
    out.add(q.replace(GERESH_RE, GERESH_FORMS[i]).replace(GERSHAYIM_RE, GERSHAYIM_FORMS[i]));
  }
  const stripped = q.replace(GERESH_RE, "").replace(GERSHAYIM_RE, "").trim();
  if (stripped.length >= 2) out.add(stripped);
  return Array.from(out);
}

/** Prisma OR fragment: `field contains` any spelling of q. */
export function containsAny(field: string, q: string): Record<string, { contains: string; mode: "insensitive" }>[] {
  return searchVariants(q).map((v) => ({ [field]: { contains: v, mode: "insensitive" as const } }));
}
