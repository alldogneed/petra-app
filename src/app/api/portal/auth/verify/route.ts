export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import prisma from "@/lib/prisma";
import {
  getAccessSettings,
  effectiveDeviceCap,
  enforceDeviceLimit,
  deviceLabelFromUserAgent,
  clientIpOf,
} from "@/lib/portal-access";
import {
  verifyPortalOtp,
  createPortalUser,
  createPortalSession,
  setPortalSessionCookie,
} from "@/lib/portal-auth";

/** OTP verification: 10 attempts per 15 minutes per IP */
const VERIFY_RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

const OTP_ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  invalid: { message: "קוד שגוי", status: 401 },
  expired: { message: "פג תוקף הקוד — בקשו קוד חדש", status: 401 },
  too_many_attempts: { message: "יותר מדי ניסיונות — בקשו קוד חדש", status: 429 },
};

/**
 * POST /api/portal/auth/verify  {email, code, name?, phone?}
 * → {user} + session cookie
 * → {needsProfile:true} when the code is valid but no PortalUser exists yet
 *   (the code is NOT consumed — it is redeemed only on final success)
 * → 400/401/429 on failure
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimitAsync("portal:verify-otp:ip", ip, VERIFY_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000) || 60) },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "קוד לא תקין — 6 ספרות" }, { status: 400 });
    }

    // Peek first (consume:false) — the code is redeemed only on final success,
    // so a needsProfile round-trip or a failed profile save doesn't burn it.
    const peek = await verifyPortalOtp(email, code, { consume: false });
    if (!peek.ok) {
      const e = OTP_ERROR_MESSAGES[peek.error];
      return NextResponse.json({ error: e.message }, { status: e.status });
    }

    if ("needsProfile" in peek && peek.needsProfile) {
      // Code valid but no PortalUser yet — need name + phone to create one
      if (!name || !phone) {
        return NextResponse.json({ needsProfile: true });
      }
      try {
        await createPortalUser({ email, phone, name });
      } catch (err) {
        const message = err instanceof Error ? err.message : "שגיאה ביצירת החשבון";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Final atomic consume + user resolution
    const result = await verifyPortalOtp(email, code);
    if (!result.ok || !("portalUser" in result)) {
      return NextResponse.json({ error: "קוד שגוי" }, { status: 401 });
    }

    // Bind the session to this device and apply the business's device cap.
    // The cap lives on the business whose portal the student logged in from;
    // without a slug we simply skip enforcement (login still works).
    const deviceId =
      typeof body?.deviceId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.deviceId)
        ? body.deviceId
        : null;
    const token = await createPortalSession(result.portalUser.id, {
      deviceId,
      deviceLabel: deviceLabelFromUserAgent(request.headers.get("user-agent")),
      ipAddress: clientIpOf(request),
    });
    setPortalSessionCookie(token);

    // Device cap. The slug only tells us WHICH portal this login came from; the
    // cap itself must not depend on a client-supplied field, or dropping `slug`
    // would disable enforcement. Fall back to the strictest cap across every
    // business this student belongs to.
    let signedOutDevices = 0;
    try {
      const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
      let cap: number | null = null;
      if (slug) {
        // The slug must resolve to a business this student actually belongs to —
        // otherwise a client could substitute any business's slug and inherit its
        // (possibly unlimited) cap, bypassing the real portal's device limit.
        const business = await prisma.business.findFirst({
          where: {
            slug: { in: slugCandidates(slug) },
            memberships: { some: { portalUserId: result.portalUser.id } },
          },
          select: { id: true },
        });
        if (business) cap = (await getAccessSettings(business.id)).maxDevicesPerStudent;
      }
      if (cap === null) cap = await effectiveDeviceCap(result.portalUser.id);
      signedOutDevices = await enforceDeviceLimit(result.portalUser.id, deviceId, cap);
    } catch (err) {
      // Never block a legitimate login because the cap check failed.
      console.error("portal device-limit error:", err);
    }

    return NextResponse.json({ user: result.portalUser, signedOutDevices });
  } catch (error) {
    console.error("portal verify error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

/** The slug can arrive raw, encoded, or double-encoded depending on the client. */
function slugCandidates(rawSlug: string): string[] {
  const out = new Set<string>([rawSlug]);
  let cur = rawSlug;
  for (let i = 0; i < 2; i++) {
    try {
      const dec = decodeURIComponent(cur);
      if (dec === cur) break;
      out.add(dec);
      cur = dec;
    } catch {
      break;
    }
  }
  return [...out];
}
