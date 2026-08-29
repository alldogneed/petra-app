export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { requestPortalOtp } from "@/lib/portal-auth";

/** OTP requests: 3 per 15 minutes — enforced per IP AND per email */
const OTP_RATE_LIMIT = { max: 3, windowMs: 15 * 60 * 1000 };

/**
 * POST /api/portal/auth/request-otp  {email}
 * Always returns {ok:true} for a valid-looking email (anti-enumeration) —
 * the code is created and emailed regardless of whether a PortalUser exists.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    }

    const rlIp = await rateLimitAsync("portal:request-otp:ip", ip, OTP_RATE_LIMIT);
    const rlEmail = await rateLimitAsync("portal:request-otp:email", email, OTP_RATE_LIMIT);
    if (!rlIp.allowed || !rlEmail.allowed) {
      const retryAfterMs = Math.max(rlIp.retryAfterMs, rlEmail.retryAfterMs);
      return NextResponse.json(
        { error: "יותר מדי בקשות. נסו שוב בעוד כמה דקות." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000) || 60) },
        }
      );
    }

    // Fire-and-forget style error handling — never expose email delivery
    // failures to the caller (anti-enumeration + graceful degradation).
    try {
      await requestPortalOtp(email);
    } catch (err) {
      console.error("portal request-otp send error:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("portal request-otp error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
