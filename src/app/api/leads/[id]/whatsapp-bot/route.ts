export const dynamic = "force-dynamic";
/**
 * AllDog only — the lead's WhatsApp conversation with the bot (src/lib/alldog-bot/rep.ts).
 * GET  /api/leads/[id]/whatsapp-bot → { conversation } (404 when there is none / not AllDog)
 * POST /api/leads/[id]/whatsapp-bot { action: "send", text } → rep reply through the bot number (MESSAGES_SEND)
 *                                   { action: "resume" }       → "החזר לבוט"
 * Auth: VIEW_LEADS (like the rest of /api/leads/**); businessId from the session only.
 */
import { NextRequest, NextResponse } from "next/server";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS, sessionHasTenantPermission } from "@/lib/permissions";
import { ServiceError } from "@/services/types";
import { getBotConversationForLead, resumeBot, sendRepMessage } from "@/lib/alldog-bot/rep";
import { serviceErrorResponse } from "../meetings/errors";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  try {
    const conversation = await getBotConversationForLead(auth.businessId, params.id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (e) {
    console.error("GET /api/leads/[id]/whatsapp-bot error:", e);
    return NextResponse.json({ error: "שגיאה בטעינת השיחה" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : null;
  try {
    if (action === "send") {
      if (!sessionHasTenantPermission(auth.session, auth.businessId, TENANT_PERMS.MESSAGES_SEND)) {
        return NextResponse.json({ error: "אין לך הרשאה לשלוח הודעות ללקוחות" }, { status: 403 });
      }
      const text = typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : "";
      await sendRepMessage(auth.businessId, params.id, text);
    } else if (action === "resume") {
      await resumeBot(auth.businessId, params.id);
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const conversation = await getBotConversationForLead(auth.businessId, params.id);
    return NextResponse.json({ conversation });
  } catch (e) {
    if (e instanceof ServiceError) return serviceErrorResponse(e);
    console.error("POST /api/leads/[id]/whatsapp-bot error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
