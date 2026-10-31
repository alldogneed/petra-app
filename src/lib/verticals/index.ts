/**
 * Verticals — which kind of business a tenant is (docs/verticals/README.md).
 *
 * Pure + client-safe. Two verticals only:
 *   - "dogs"    — every existing business (the default). Nothing is hidden: behaviour is
 *                 exactly what it was before verticals existed.
 *   - "generic" — "עסק אחר": a service business without a subject (no dog / pet). The
 *                 dog-only modules are HIDDEN — not rendered, and their APIs answer 404.
 *
 * Hidden ≠ locked: a hidden module never shows a paywall; a tier-locked module keeps
 * its TierGate. The hidden check runs before the tier check.
 */

export const VERTICALS = ["dogs", "generic"] as const;
export type Vertical = (typeof VERTICALS)[number];
export const DEFAULT_VERTICAL: Vertical = "dogs";

export function isVertical(value: unknown): value is Vertical {
  return typeof value === "string" && (VERTICALS as readonly string[]).includes(value);
}

/** Unknown / missing / legacy values → "dogs" (today's behaviour). */
export function normalizeVertical(value: unknown): Vertical {
  return isVertical(value) ? value : DEFAULT_VERTICAL;
}

/** Modules a vertical can hide. Only dog-domain modules are listed. */
export type VerticalModule = "boarding" | "service_dogs" | "pets" | "groomer_portfolio";

export const HIDDEN_MODULES: Record<Vertical, readonly VerticalModule[]> = {
  dogs: [],
  generic: ["boarding", "service_dogs", "pets", "groomer_portfolio"],
};

export function isModuleHidden(vertical: unknown, module: VerticalModule): boolean {
  return HIDDEN_MODULES[normalizeVertical(vertical)].includes(module);
}

/** Dashboard screens (route prefixes) that belong to a hideable module. */
export const VERTICAL_SCREENS: readonly { prefix: string; module: VerticalModule }[] = [
  { prefix: "/boarding", module: "boarding" },
  { prefix: "/feeding", module: "boarding" },
  { prefix: "/medications", module: "boarding" },
  { prefix: "/service-dogs", module: "service_dogs" },
  { prefix: "/pets", module: "pets" },
  { prefix: "/vaccinations", module: "pets" },
];

/** API route prefixes that belong to a hideable module (answer 404 when hidden). */
export const VERTICAL_API_PREFIXES: readonly { prefix: string; module: VerticalModule }[] = [
  { prefix: "/api/boarding", module: "boarding" },
  { prefix: "/api/feeding", module: "boarding" },
  { prefix: "/api/medications", module: "boarding" },
  { prefix: "/api/service-dogs", module: "service_dogs" },
  { prefix: "/api/service-recipients", module: "service_dogs" },
  { prefix: "/api/service-recipient-stages", module: "service_dogs" },
  { prefix: "/api/service-placements", module: "service_dogs" },
  { prefix: "/api/service-compliance", module: "service_dogs" },
  { prefix: "/api/pets", module: "pets" },
];

/** /api/customers/<id>/pets[/...] — pets of one customer. */
const CUSTOMER_PETS_RE = /^\/api\/customers\/[^/]+\/pets(\/|$)/;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

/** The module a dashboard path belongs to, or null. */
export function screenModule(path: string): VerticalModule | null {
  return VERTICAL_SCREENS.find((s) => matchesPrefix(path, s.prefix))?.module ?? null;
}

/** The module an API path belongs to, or null. Cheap — used to skip the DB lookup. */
export function apiModule(path: string): VerticalModule | null {
  if (CUSTOMER_PETS_RE.test(path)) return "pets";
  return VERTICAL_API_PREFIXES.find((s) => matchesPrefix(path, s.prefix))?.module ?? null;
}

/** True when the screen at `path` is hidden for this vertical. "dogs" → always false. */
export function isScreenHiddenForVertical(vertical: unknown, path: string): boolean {
  const mod = screenModule(path);
  return mod !== null && isModuleHidden(vertical, mod);
}

/** True when the API at `path` is hidden for this vertical. "dogs" → always false. */
export function isApiHiddenForVertical(vertical: unknown, path: string): boolean {
  const mod = apiModule(path);
  return mod !== null && isModuleHidden(vertical, mod);
}
