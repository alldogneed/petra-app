/**
 * Tenant sub-domains — `{slug}.petra.app` (docs/verticals phase 4).
 *
 * Pure and Edge-safe (used by middleware.ts). Everything is OFF unless the env var
 * TENANT_ROOT_DOMAIN is set, and petra-app.com is never affected:
 *   - `{slug}.{root}/`  → the business's booking page (/book/{slug});
 *   - every other path on that host works as on the main domain (login, dashboard…);
 *   - the session cookie gets `Domain=SESSION_COOKIE_DOMAIN` only on hosts under it.
 *
 * Only DNS-safe slugs (a-z 0-9 -) can be sub-domains. Hebrew slugs (generateBusinessSlug
 * keeps Hebrew letters) keep working at /book/{slug} on the main domain only.
 */

/** Sub-domains that are never a business. */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  "www", "app", "api", "admin", "owner", "mail", "email", "static", "cdn", "assets", "status", "docs", "help", "blog",
];

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeRoot(root: string | null | undefined): string | null {
  const r = (root ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return r && r.includes(".") ? r : null;
}

function hostname(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Is `slug` usable as a sub-domain label? */
export function isDnsSafeSlug(slug: string | null | undefined): slug is string {
  return !!slug && DNS_LABEL.test(slug) && !RESERVED_SUBDOMAINS.includes(slug);
}

/** `noa-1a2b.petra.app` + root `petra.app` → "noa-1a2b". Anything else → null. */
export function tenantSlugFromHost(host: string | null | undefined, root: string | null | undefined): string | null {
  const r = normalizeRoot(root);
  if (!r) return null;
  const h = hostname(host);
  if (!h.endsWith("." + r)) return null;
  const sub = h.slice(0, -(r.length + 1));
  if (!sub || sub.includes(".")) return null; // apex or a deeper sub-domain
  return isDnsSafeSlug(sub) ? sub : null;
}

/**
 * The cookie Domain for this request: the configured domain (e.g. ".petra.app") only when
 * the host is that domain or under it; otherwise undefined = host-only cookie (today).
 */
export function sessionCookieDomain(host: string | null | undefined, configured: string | null | undefined): string | undefined {
  const d = (configured ?? "").trim().toLowerCase().replace(/^\.+/, "");
  if (!d || !d.includes(".")) return undefined;
  const h = hostname(host);
  return h === d || h.endsWith("." + d) ? "." + d : undefined;
}

/** Public address of a business's sub-domain, or null when off / slug not DNS-safe. */
export function tenantUrl(slug: string | null | undefined, root: string | null | undefined): string | null {
  const r = normalizeRoot(root);
  if (!r || !isDnsSafeSlug(slug)) return null;
  return `https://${slug}.${r}`;
}
