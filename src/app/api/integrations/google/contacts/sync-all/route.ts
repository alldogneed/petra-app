export const dynamic = "force-dynamic";
/**
 * POST /api/integrations/google/contacts/sync-all
 * Bulk-syncs all leads for the authenticated business to Google Contacts.
 * Requires googleContactsSync = true and owner's Google account connected.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { syncAllLeadsToContacts } from "@/lib/google-contacts";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const result = await syncAllLeadsToContacts(authResult.businessId);

    return NextResponse.json({
      success: true,
      ...result,
      message: `סונכרנו ${result.synced} לידים בהצלחה${result.failed ? `, ${result.failed} נכשלו` : ""}${result.skipped ? `, ${result.skipped} דולגו (ללא פרטי קשר)` : ""}`,
    });
  } catch (error) {
    console.error("Google Contacts sync-all error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון" }, { status: 500 });
  }
}
