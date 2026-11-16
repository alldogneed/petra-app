export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { rateLimit } from "@/lib/rate-limit";
import { manualSendFailureText, waitForDeliveryOutcome } from "@/lib/whatsapp-failure";

// POST /api/integrations/whatsapp/test
// Sends a test WhatsApp message to a given phone number. Body: { phone }.
// Free text only reaches a number that wrote to us in the last 24h (Meta 131047) — so the
// test goes as an approved template: petra_connection_test (catalog, he) → Meta's built-in
// hello_world (en_US) → free text. Then waits ≤ 7s for Meta's verdict and reports it honestly.
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  // Owner/manager of this business (or platform admin) only — this endpoint sends
  // real WhatsApp messages to arbitrary phones from the shared platform number.
  const { session, businessId } = authResult;
  const membershipRole = session.memberships.find((m) => m.businessId === businessId)?.role;
  const isPlatformAdmin = ["super_admin", "admin"].includes(session.user.platformRole ?? "");
  if (!isPlatformAdmin && membershipRole !== "owner" && membershipRole !== "manager") {
    return NextResponse.json({ error: "אין הרשאה לשלוח הודעת בדיקה" }, { status: 403 });
  }

  // Rate limit: 3 test messages per 5 minutes per business
  const rl = await rateLimit(`wa-test:${businessId}`, businessId, { max: 3, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { phone } = body;
    if (!phone) return NextResponse.json({ error: "נדרש מספר טלפון" }, { status: 400 });

    // Normalize: strip non-digits, handle Israeli prefix
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) {
      return NextResponse.json({ error: "מספר טלפון לא תקין" }, { status: 400 });
    }
    const normalized = digits.startsWith("0") ? "972" + digits.slice(1) : digits.startsWith("972") ? digits : "972" + digits;

    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    const bizName = (biz?.name ?? "העסק").slice(0, 60);

    let result = await sendWhatsAppTemplate({
      to: normalized, templateName: "petra_connection_test", bodyParams: [bizName], businessId, context: "test",
    });
    let via = "petra_connection_test";
    if (!result.success) {
      result = await sendWhatsAppTemplate({
        to: normalized, templateName: "hello_world", bodyParams: [], languageCode: "en_US", businessId, context: "test",
      });
      via = "hello_world";
    }
    if (!result.success) {
      result = await sendWhatsAppMessage({
        to: normalized, body: "✅ הודעת בדיקה מ-Petra — WhatsApp מחובר בהצלחה!", businessId, context: "test",
      });
      via = "text";
    }
    if (!result.success) {
      return NextResponse.json({ error: result.error || "שליחה נכשלה" }, { status: 500 });
    }

    const wamid = result.messageSid ?? "";
    if (wamid.startsWith("STUB_")) {
      return NextResponse.json({
        success: true, stub: true, messageSid: wamid,
        message: "הודעה נרשמה בלוג (מצב Stub — הגדר META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID כדי לשלוח בפועל)",
      });
    }

    const outcome = wamid.startsWith("wamid.")
      ? await waitForDeliveryOutcome(() =>
          prisma.whatsAppMessageLog.findFirst({ where: { wamid }, select: { status: true, errorCode: true, errorMessage: true } })
        )
      : ({ state: "unknown" } as const);

    if (outcome.state === "failed") {
      const why = via === "text"
        ? "התבנית המאושרת עדיין לא זמינה, ונשלחה הודעה חופשית. " + manualSendFailureText(outcome.errorCode)
        : manualSendFailureText(outcome.errorCode);
      return NextResponse.json({ error: why, failed: true, via }, { status: 422 });
    }

    const note = via === "hello_world" ? " (נשלחה תבנית הבדיקה של Meta באנגלית — התבנית בעברית עוד ממתינה לאישור)" : "";
    return NextResponse.json({
      success: true,
      messageSid: wamid,
      via,
      delivery: outcome.state === "accepted" ? outcome.status : "unknown",
      message: (outcome.state === "accepted" ? "ההודעה נשלחה ונמסרה לוואטסאפ" : "ההודעה נשלחה, עדיין אין אישור מסירה מוואטסאפ") + note,
    });
  } catch (error) {
    console.error("WhatsApp test error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הודעת בדיקה" }, { status: 500 });
  }
}
