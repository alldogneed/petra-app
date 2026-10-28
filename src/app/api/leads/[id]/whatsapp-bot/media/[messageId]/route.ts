export const dynamic = "force-dynamic";
/**
 * AllDog only (item 39) — a photo / video / file the customer sent the bot, for the rep.
 * GET /api/leads/[id]/whatsapp-bot/media/[messageId] → the file, downloaded from Meta on demand.
 * Auth: VIEW_LEADS like the rest of /api/leads/**; businessId from the session, the message must
 * belong to this lead's conversation. Nothing is cached publicly.
 */
import { NextRequest, NextResponse } from "next/server";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { getBotMediaForLead } from "@/lib/alldog-bot/rep";

const INLINE_TYPES = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|3gpp|quicktime)|application\/pdf)$/;

export async function GET(request: NextRequest, { params }: { params: { id: string; messageId: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  try {
    const file = await getBotMediaForLead(auth.businessId, params.id, params.messageId);
    if (!file) return NextResponse.json({ error: "הקובץ לא נמצא (ייתכן שעברו 30 יום מאז שנשלח)" }, { status: 404 });
    const type = file.contentType.toLowerCase();
    return new NextResponse(file.data, {
      headers: {
        "Content-Type": INLINE_TYPES.test(type) ? type : "application/octet-stream",
        "Content-Disposition": INLINE_TYPES.test(type) ? "inline" : "attachment",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("GET /api/leads/[id]/whatsapp-bot/media error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "שגיאה בטעינת הקובץ" }, { status: 500 });
  }
}
