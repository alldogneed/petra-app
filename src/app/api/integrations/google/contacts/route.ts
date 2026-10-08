export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { userHasContactsScope, countLeadsPendingContactSync } from "@/lib/google-contacts";

/**
 * Lead → Google Contacts sync toggle (Settings → אינטגרציות, inside the Google card).
 * The sync writes to the business OWNER's Google Contacts, so only the owner manages it,
 * and never while impersonating (the Google connection is the session user's own).
 */

// GET /api/integrations/google/contacts — current toggle state
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { googleContactsSync: true },
    });

    const canManage =
      !session.impersonatedBusinessId &&
      session.memberships.some((m) => m.businessId === businessId && m.isActive && m.role === "owner");

    const enabled = business?.googleContactsSync ?? false;
    // Existing leads not yet in Google Contacts — feeds the "סנכרן לידים קיימים" button.
    const pendingLeads = enabled && canManage ? await countLeadsPendingContactSync(businessId) : 0;

    return NextResponse.json({ enabled, canManage, pendingLeads });
  } catch (error) {
    console.error("GET google contacts sync error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הגדרות הסנכרון" }, { status: 500 });
  }
}

// POST /api/integrations/google/contacts — { enabled: boolean }
// Turning on without the contacts scope returns { needsConsent, consentUrl } instead of
// enabling: the client sends the owner to Google's consent screen, and the OAuth callback
// flips the flag once the scope is really granted.
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const isOwner =
      !session.impersonatedBusinessId &&
      session.memberships.some((m) => m.businessId === businessId && m.isActive && m.role === "owner");
    if (!isOwner) {
      return NextResponse.json({ error: "רק בעל העסק יכול לנהל את הסנכרון ל-Google Contacts" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!body.enabled) {
      await prisma.business.update({ where: { id: businessId }, data: { googleContactsSync: false } });
      return NextResponse.json({ enabled: false });
    }

    const user = await prisma.platformUser.findUnique({
      where: { id: session.user.id },
      select: { gcalConnected: true },
    });
    if (!user?.gcalConnected) {
      return NextResponse.json({ error: "יש לחבר קודם חשבון Google" }, { status: 409 });
    }

    if (!(await userHasContactsScope(session.user.id))) {
      return NextResponse.json({
        enabled: false,
        needsConsent: true,
        consentUrl: "/api/integrations/google/connect?scope=contacts",
      });
    }

    await prisma.business.update({ where: { id: businessId }, data: { googleContactsSync: true } });
    return NextResponse.json({ enabled: true });
  } catch (error) {
    console.error("POST google contacts sync error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הסנכרון" }, { status: 500 });
  }
}
