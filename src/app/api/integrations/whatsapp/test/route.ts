export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// POST /api/integrations/whatsapp/test
// Sends a test WhatsApp message to a given phone number.
// Body: { phone } — Israeli phone number
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "נדרש מספר טלפון" }, { status: 400 });
    }

    // Normalize: strip non-digits, handle Israeli prefix
    const digits = String(phone).replace(/\D/g, "");
    const normalized = digits.startsWith("0")
      ? "972" + digits.slice(1)
      : digits.startsWith("972")
      ? digits
      : "972" + digits;

    const result = await sendWhatsAppMessage({
      to: normalized,
      body: "✅ הודעת בדיקה מ-Petra — WhatsApp מחובר בהצלחה!",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "שליחה נכשלה" },
        { status: 500 }
      );
    }

    const isStub = result.messageSid?.startsWith("STUB_");

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      stub: isStub,
      message: isStub
        ? "הודעה נרשמה בלוג (מצב Stub — הגדר META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID כדי לשלוח בפועל)"
        : "הודעה נשלחה בהצלחה!",
    });
  } catch (error) {
    console.error("WhatsApp test error:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הודעת בדיקה" }, { status: 500 });
  }
}
