export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError, type FullSession } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { isInternalTestEmail } from "@/lib/mcp-allowlist";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import {
  getWhatsAppConnectionStatus,
  connectWhatsAppBusiness,
  disconnectWhatsAppBusiness,
  isWhatsAppEmbeddedSignupConfigured,
  isWaConnectBetaEmail,
  WhatsAppConnectError,
} from "@/lib/whatsapp-connections";

// /api/integrations/whatsapp/connection — per-business WhatsApp (Meta Embedded Signup)
//   GET    → connection status (any active member)
//   POST   → connect { code, phoneNumberId, wabaId, coexistence? } (owner/manager/admin, PRO+)
//   DELETE → disconnect (owner/manager/admin)

const DIGITS_ID = /^[0-9]{5,24}$/; // Meta ids are ~15-17 digits

/** Owner/manager of THIS business, or a platform admin. */
function canManageConnection(session: FullSession, businessId: string): boolean {
  const membershipRole = session.memberships.find((m) => m.businessId === businessId)?.role;
  const isPlatformAdmin = ["super_admin", "admin"].includes(session.user.platformRole ?? "");
  return isPlatformAdmin || membershipRole === "owner" || membershipRole === "manager";
}

/** Map lib errors (Hebrew messages) to HTTP — never leak stacks/tokens. */
function libErrorResponse(err: unknown, fallback: string): NextResponse {
  if (err instanceof WhatsAppConnectError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "";
  if (message && /[֐-׿]/.test(message)) {
    const status = message.includes("כבר מחובר") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const status = await getWhatsAppConnectionStatus(authResult.businessId);
    const isPlatformAdmin = ["super_admin", "admin"].includes(authResult.session.user.platformRole ?? "");
    status.betaAccess = isPlatformAdmin || isWaConnectBetaEmail(authResult.session.user.email);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[whatsapp-connection] GET error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מצב חיבור WhatsApp" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    if (!canManageConnection(session, businessId)) {
      return NextResponse.json({ error: "אין לך הרשאה לחבר WhatsApp לעסק" }, { status: 403 });
    }

    if (!isWhatsAppEmbeddedSignupConfigured()) {
      return NextResponse.json({ error: "חיבור WhatsApp עסקי אינו זמין בסביבה זו" }, { status: 400 });
    }

    // Private beta: only allowlisted users may connect (alldog / QA / WA_CONNECT_ALLOWED_EMAILS).
    const isBetaAdmin = ["super_admin", "admin"].includes(session.user.platformRole ?? "");
    if (!isBetaAdmin && !isWaConnectBetaEmail(session.user.email)) {
      return NextResponse.json({ error: "חיבור מספר עצמאי נמצא בבטא סגורה" }, { status: 403 });
    }

    // Server-side paywall: per-business WhatsApp needs the whatsapp_reminders feature (PRO+).
    // Platform admins and internal @petra.local QA accounts are exempt.
    const isPlatformAdmin = ["super_admin", "admin"].includes(session.user.platformRole ?? "");
    const isInternalQa = isInternalTestEmail(session.user.email);
    if (!isPlatformAdmin && !isInternalQa) {
      const biz = await prisma.business.findUnique({
        where: { id: businessId },
        select: { tier: true, featureOverrides: true },
      });
      const overrides = (biz?.featureOverrides as Record<string, boolean> | null) ?? null;
      if (!hasFeatureWithOverrides(biz?.tier ?? "free", "whatsapp_reminders", overrides)) {
        return NextResponse.json(
          { error: "חיבור WhatsApp עסקי זמין במנוי PRO ומעלה" },
          { status: 403 }
        );
      }
    }

    // Rate limit: 5 connect attempts per 10 minutes per business
    const rl = rateLimit(`wa-connect:${businessId}`, businessId, { max: 5, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות חיבור. נסה שוב בעוד מספר דקות." }, { status: 429 });
    }

    let body: { code?: unknown; phoneNumberId?: unknown; wabaId?: unknown; coexistence?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
    }
    const { code, phoneNumberId, wabaId, coexistence } = body ?? {};

    if (typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json({ error: "חסר קוד אימות מ-Meta" }, { status: 400 });
    }
    if (code.length > 2000) {
      return NextResponse.json({ error: "קוד אימות לא תקין" }, { status: 400 });
    }
    if (typeof phoneNumberId !== "string" || !DIGITS_ID.test(phoneNumberId)) {
      return NextResponse.json({ error: "מזהה מספר טלפון (phoneNumberId) לא תקין" }, { status: 400 });
    }
    if (typeof wabaId !== "string" || !DIGITS_ID.test(wabaId)) {
      return NextResponse.json({ error: "מזהה חשבון WhatsApp Business (wabaId) לא תקין" }, { status: 400 });
    }
    if (coexistence !== undefined && typeof coexistence !== "boolean") {
      return NextResponse.json({ error: "ערך לא תקין עבור coexistence" }, { status: 400 });
    }

    let status;
    try {
      status = await connectWhatsAppBusiness({
        businessId,
        userId: session.user.id,
        code: code.trim(),
        phoneNumberId,
        wabaId,
        coexistence: coexistence === true,
      });
    } catch (err) {
      console.error("[whatsapp-connection] connect failed:", err instanceof Error ? err.message : err);
      return libErrorResponse(err, "חיבור WhatsApp נכשל. נסה שוב מאוחר יותר.");
    }

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.CONNECT_WHATSAPP);

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error("[whatsapp-connection] POST error:", error);
    return NextResponse.json({ error: "שגיאה בחיבור WhatsApp" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    if (!canManageConnection(session, businessId)) {
      return NextResponse.json({ error: "אין לך הרשאה לנתק את WhatsApp מהעסק" }, { status: 403 });
    }

    try {
      await disconnectWhatsAppBusiness(businessId, session.user.id);
    } catch (err) {
      console.error("[whatsapp-connection] disconnect failed:", err instanceof Error ? err.message : err);
      return libErrorResponse(err, "ניתוק WhatsApp נכשל. נסה שוב מאוחר יותר.");
    }

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DISCONNECT_WHATSAPP);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[whatsapp-connection] DELETE error:", error);
    return NextResponse.json({ error: "שגיאה בניתוק WhatsApp" }, { status: 500 });
  }
}
