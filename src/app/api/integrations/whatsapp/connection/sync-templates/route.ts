export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { syncWhatsAppTemplates } from "@/lib/whatsapp-connections";

// POST /api/integrations/whatsapp/connection/sync-templates
// Re-copies the platform's approved templates onto the business WABA + refreshes status.
// Owner/manager (or platform admin) only; 3 per 10 minutes per business.
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const membershipRole = session.memberships.find((m) => m.businessId === businessId)?.role;
    const isPlatformAdmin = ["super_admin", "admin"].includes(session.user.platformRole ?? "");
    if (!isPlatformAdmin && membershipRole !== "owner" && membershipRole !== "manager") {
      return NextResponse.json({ error: "אין לך הרשאה לסנכרן תבניות WhatsApp" }, { status: 403 });
    }

    const rl = rateLimit(`wa-sync-templates:${businessId}`, businessId, { max: 3, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות סנכרון. נסה שוב בעוד מספר דקות." }, { status: 429 });
    }

    let status;
    try {
      status = await syncWhatsAppTemplates(businessId);
    } catch (err) {
      console.error("[whatsapp-connection] sync-templates failed:", err instanceof Error ? err.message : err);
      const message = err instanceof Error ? err.message : "";
      if (message && /[֐-׿]/.test(message)) {
        return NextResponse.json({ error: message }, { status: message.includes("כבר מחובר") ? 409 : 400 });
      }
      return NextResponse.json({ error: "סנכרון תבניות נכשל. נסה שוב מאוחר יותר." }, { status: 500 });
    }

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.SYNC_WHATSAPP_TEMPLATES);

    return NextResponse.json(status);
  } catch (error) {
    console.error("[whatsapp-connection] sync-templates error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון תבניות WhatsApp" }, { status: 500 });
  }
}
