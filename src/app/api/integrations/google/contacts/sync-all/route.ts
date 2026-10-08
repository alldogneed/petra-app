export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { syncPendingLeadsToGoogleContacts } from "@/lib/google-contacts";

/**
 * POST /api/integrations/google/contacts/sync-all
 * Creates Google contacts for the next chunk of existing leads that have none yet.
 * The client calls it repeatedly until `remaining` reaches 0. Owner only, and only
 * while the sync toggle is on — same rules as the toggle itself.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const isOwner =
      !session.impersonatedBusinessId &&
      session.memberships.some((m) => m.businessId === businessId && m.isActive && m.role === "owner");
    if (!isOwner) {
      return NextResponse.json({ error: "רק בעל העסק יכול לסנכרן לידים ל-Google Contacts" }, { status: 403 });
    }

    const result = await syncPendingLeadsToGoogleContacts(businessId);
    if (!result.ok) {
      const error =
        result.reason === "disabled"
          ? "יש להפעיל קודם את הסנכרון ל-Google Contacts"
          : result.reason === "not_connected"
            ? "חשבון Google אינו מחובר"
            : "Google דחתה את הבקשה. נסה לכבות ולהפעיל מחדש את הסנכרון.";
      return NextResponse.json({ error }, { status: result.reason === "google_error" ? 502 : 409 });
    }

    return NextResponse.json({ synced: result.synced, failed: result.failed, remaining: result.remaining });
  } catch (error) {
    console.error("POST google contacts sync-all error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון הלידים" }, { status: 500 });
  }
}
