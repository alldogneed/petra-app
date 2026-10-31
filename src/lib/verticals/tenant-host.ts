/**
 * Tenant sub-domains — `{slug}.petra.app` (docs/verticals phase 4).
 *
 * Pure and Edge-safe (used by middleware.ts). Everything is OFF unless the env var
 * TENANT_ROOT_DOMAIN is set, and petra-app.com is never affected:
 *   - `{slug}.{root}/`  → the business's booking page (/book/{slug});
 *   - every other path on that host works as on the main domain (login, dashboard…);
 *   - the session cookie gets `Domain=SESSION_COOKIE_DOMAIN` only on hosts under it.
 *
 * Hebrew slugs (generateBusinessSlug keeps Hebrew letters) work too: the browser sends the
 * label as punycode ("xn--…", RFC 3492) — decoded here without any dependency (Edge).
 */

/** Sub-domains that are never a business. */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  "www", "app", "api", "admin", "owner", "mail", "email", "static", "cdn", "assets", "status", "docs", "help", "blog",
];

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** A business slug as generateBusinessSlug builds it: a-z 0-9 Hebrew and "-". */
const SLUG_RE = /^[a-z0-9\u0590-\u05FF](?:[a-z0-9\u0590-\u05FF-]*[a-z0-9\u0590-\u05FF])?$/;

// ─── Punycode (RFC 3492) — label level only ──────────────────────────────────
const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((BASE - TMIN) * TMAX) >> 1) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}
const digitOf = (cp: number) => (cp - 48 < 10 ? cp - 22 : cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ? cp - 97 : BASE);
const charOf = (d: number) => String.fromCharCode(d + 22 + 75 * (d < 26 ? 1 : 0));

/** "xn--…" label → Unicode, or null when invalid. */
export function punycodeDecodeLabel(label: string): string | null {
  if (!label.startsWith("xn--")) return label;
  const input = label.slice(4);
  const output: number[] = [];
  let n = INITIAL_N, bias = INITIAL_BIAS, i = 0;
  const basic = input.lastIndexOf("-");
  for (let j = 0; j < (basic > 0 ? basic : 0); j++) {
    const cp = input.charCodeAt(j);
    if (cp >= 0x80) return null;
    output.push(cp);
  }
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (idx >= input.length) return null;
      const digit = digitOf(input.charCodeAt(idx++));
      if (digit >= BASE) return null;
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
      if (w > 1e12) return null;
    }
    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff) return null;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/** Unicode label → "xn--…" (ASCII labels unchanged). */
export function punycodeEncodeLabel(label: string): string {
  const cps = Array.from(label).map((c) => c.codePointAt(0)!);
  if (cps.every((c) => c < 0x80)) return label;
  let n = INITIAL_N, delta = 0, bias = INITIAL_BIAS;
  let out = cps.filter((c) => c < 0x80).map((c) => String.fromCharCode(c)).join("");
  const b = out.length;
  let h = b;
  if (b > 0) out += "-";
  while (h < cps.length) {
    const m = Math.min(...cps.filter((c) => c >= n));
    delta += (m - n) * (h + 1);
    n = m;
    for (const c of cps) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          out += charOf(t + ((q - t) % (BASE - t)));
          q = Math.floor((q - t) / (BASE - t));
        }
        out += charOf(q);
        bias = adapt(delta, h + 1, h === b);
        delta = 0;
        h++;
      }
    }
    delta++;
    n++;
  }
  return "xn--" + out;
}

function normalizeRoot(root: string | null | undefined): string | null {
  const r = (root ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return r && r.includes(".") ? r : null;
}

function hostname(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Is `slug` usable as a sub-domain label (directly, or as punycode for a Hebrew slug)? */
export function isDnsSafeSlug(slug: string | null | undefined): slug is string {
  if (!slug || !SLUG_RE.test(slug) || RESERVED_SUBDOMAINS.includes(slug)) return false;
  // IDNA BIDI rule (RFC 5893): a label with Hebrew letters may not contain Latin letters —
  // browsers refuse such a host. "סטודיו-12" is fine; "סטודיו-1a2b" is not.
  if (/[\u0590-\u05FF]/.test(slug) && /[a-z]/.test(slug)) return false;
  return DNS_LABEL.test(punycodeEncodeLabel(slug));
}

/** A Latin sub-domain a business may pick for itself (Settings → מיתוג). */
export function isValidCustomSubdomain(value: string | null | undefined): value is string {
  return !!value && value.length >= 3 && DNS_LABEL.test(value) && !RESERVED_SUBDOMAINS.includes(value);
}

/** `noa-1a2b.petra.app` + root `petra.app` → "noa-1a2b". Anything else → null. */
export function tenantSlugFromHost(host: string | null | undefined, root: string | null | undefined): string | null {
  const r = normalizeRoot(root);
  if (!r) return null;
  const h = hostname(host);
  if (!h.endsWith("." + r)) return null;
  const sub = h.slice(0, -(r.length + 1));
  if (!sub || sub.includes(".")) return null; // apex or a deeper sub-domain
  const slug = punycodeDecodeLabel(sub); // Hebrew slugs arrive as "xn--…"
  return slug && isDnsSafeSlug(slug) ? slug : null;
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
  return `https://${punycodeEncodeLabel(slug)}.${r}`;
}
