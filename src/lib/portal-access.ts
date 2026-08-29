/**
 * Course access security for the members portal.
 *
 * Two independent controls, both configured per business on BrandingSettings:
 *
 *  1. Device cap (maxDevicesPerStudent) — anti password-sharing. Each portal
 *     login is bound to a stable client-minted deviceId. When a student signs in
 *     on more devices than allowed, the OLDEST device is signed out (Netflix
 *     style): the student is never locked out of the device in front of them,
 *     but a password passed around keeps evicting the people using it.
 *     0 = unlimited.
 *
 *  2. IP allowlist (ipRestrictionEnabled + allowedIps) — for businesses that
 *     only want the portal reachable from known networks (a classroom, an
 *     office). Entries are plain IPv4/IPv6 addresses or CIDR ranges. Off by
 *     default; when on with an EMPTY list nothing is blocked (a non-empty list
 *     is what makes it restrictive — an empty one would lock everyone out).
 */

import prisma from "@/lib/prisma";

export interface AccessSettings {
  maxDevicesPerStudent: number;
  ipRestrictionEnabled: boolean;
  allowedIps: string[];
}

export async function getAccessSettings(businessId: string): Promise<AccessSettings> {
  const b = await prisma.brandingSettings.findUnique({
    where: { businessId },
    select: {
      maxDevicesPerStudent: true,
      ipRestrictionEnabled: true,
      allowedIps: true,
    },
  });
  return {
    maxDevicesPerStudent: b?.maxDevicesPerStudent ?? 2,
    ipRestrictionEnabled: b?.ipRestrictionEnabled ?? false,
    allowedIps: b?.allowedIps ?? [],
  };
}

// ─── IP allowlist ──────────────────────────────────────────────────────────

/** First hop of x-forwarded-for, falling back to the platform headers. */
export function clientIpOf(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const xff = request.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

/** Normalize ::ffff:1.2.3.4 and drop a zone/port suffix. */
function normalizeIp(ip: string): string {
  const t = ip.trim().toLowerCase();
  const mapped = t.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? mapped[1] : t;
}

/** Does `ip` match `rule` (a bare address or a CIDR range)? */
export function ipMatches(ip: string, rule: string): boolean {
  const addr = normalizeIp(ip);
  const r = normalizeIp(rule);
  if (!r) return false;

  if (!r.includes("/")) return addr === r;

  const [base, bitsRaw] = r.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0) return false;

  const a = ipv4ToInt(addr);
  const b = ipv4ToInt(base);
  if (a !== null && b !== null) {
    if (bits > 32) return false;
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  }

  // IPv6 CIDR: compare the expanded bit prefix.
  const expand = (v6: string): string | null => {
    const halves = v6.split("::");
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    const fill = 8 - head.length - tail.length;
    if (halves.length === 2 ? fill < 0 : head.length !== 8) return null;
    const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
    return groups
      .map((g) => (parseInt(g || "0", 16) || 0).toString(2).padStart(16, "0"))
      .join("");
  };
  const abits = expand(addr);
  const bbits = expand(base);
  if (!abits || !bbits || bits > 128) return false;
  return abits.slice(0, bits) === bbits.slice(0, bits);
}

/** true when the request IP is allowed (also true when the control is off). */
export function isIpAllowed(ip: string | null, settings: AccessSettings): boolean {
  if (!settings.ipRestrictionEnabled) return true;
  if (settings.allowedIps.length === 0) return true; // empty list is not a lockout
  if (!ip) return false;
  return settings.allowedIps.some((rule) => ipMatches(ip, rule));
}

// ─── Device cap ────────────────────────────────────────────────────────────

/** Short, readable device hint from the UA — never stored raw for tracking. */
export function deviceLabelFromUserAgent(ua: string | null): string {
  if (!ua) return "מכשיר לא מזוהה";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "דפדפן";
  const os = /iphone/i.test(ua)
    ? "iPhone"
    : /ipad/i.test(ua)
      ? "iPad"
      : /android/i.test(ua)
        ? "Android"
        : /mac os/i.test(ua)
          ? "Mac"
          : /windows/i.test(ua)
            ? "Windows"
            : "מחשב";
  return `${browser} · ${os}`;
}

/**
 * Enforce the device cap for a student, counting DISTINCT devices with a live
 * session. The device that just signed in is always kept; the oldest devices
 * beyond the cap have their sessions deleted.
 *
 * Returns how many devices were signed out, so the caller can tell the student.
 */
export async function enforceDeviceLimit(
  portalUserId: string,
  currentDeviceId: string | null,
  maxDevices: number
): Promise<number> {
  if (!Number.isInteger(maxDevices) || maxDevices <= 0) return 0; // unlimited

  const sessions = await prisma.portalSession.findMany({
    where: { portalUserId, expiresAt: { gt: new Date() } },
    select: { id: true, deviceId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Group by device. Sessions without a deviceId (legacy / no JS) each count
  // as their own device so the cap can never be bypassed by omitting the id.
  const order: string[] = [];
  const byDevice = new Map<string, string[]>();
  for (const s of sessions) {
    const key = s.deviceId ?? `session:${s.id}`;
    if (!byDevice.has(key)) {
      byDevice.set(key, []);
      order.push(key);
    }
    byDevice.get(key)!.push(s.id);
  }

  // Newest first, but the device in use right now is always first in line.
  const ranked = currentDeviceId
    ? [currentDeviceId, ...order.filter((d) => d !== currentDeviceId)]
    : order;
  const evict = ranked.slice(maxDevices);
  if (evict.length === 0) return 0;

  const sessionIds = evict.flatMap((d) => byDevice.get(d) ?? []);
  if (sessionIds.length === 0) return 0;

  await prisma.portalSession.deleteMany({ where: { id: { in: sessionIds } } });
  return evict.length;
}
