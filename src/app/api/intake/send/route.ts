import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/intake/send
 * Mark an intake form as SENT (called after WhatsApp deeplink was opened or API sent)
 */
export async function POST(request: NextRequest) {
  try {
    const { intakeFormId, deliveryChannel } = await request.json();

    const form = await prisma.intakeForm.update({
      where: { id: intakeFormId },
      data: {
        status: "SENT",
        deliveryChannel: deliveryChannel || "WHATSAPP_DEEPLINK",
      },
    });

    return NextResponse.json({ success: true, status: form.status });
  } catch (error) {
    console.error("IntakeForm send error:", error);
    return NextResponse.json({ error: "Failed to update intake form" }, { status: 500 });
  }
}
