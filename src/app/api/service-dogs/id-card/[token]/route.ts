import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUBLIC route — no auth required (accessed via QR scan)
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const card = await prisma.serviceDogIDCard.findUnique({
      where: { qrToken: params.token },
      include: {
        serviceDog: {
          include: { pet: true },
        },
      },
    });

    if (!card || !card.isActive) {
      return NextResponse.json({ error: "תעודה לא נמצאה או שאינה פעילה" }, { status: 404 });
    }

    // Check expiry
    if (card.expiresAt && new Date() > card.expiresAt) {
      return NextResponse.json({ error: "תעודה פגת תוקף" }, { status: 410 });
    }

    const cardData = JSON.parse(card.cardDataJson || "{}");

    return NextResponse.json({
      valid: true,
      dogName: card.serviceDog.pet.name,
      breed: card.serviceDog.pet.breed,
      phase: card.serviceDog.phase,
      serviceType: card.serviceDog.serviceType,
      registrationNumber: cardData.registrationNumber || null,
      certifyingBody: cardData.certifyingBody || null,
      certificationDate: cardData.certificationDate || null,
      certificationExpiry: cardData.certificationExpiry || null,
      recipientName: cardData.recipientName || null,
      generatedAt: card.generatedAt,
    });
  } catch (error) {
    console.error("GET /api/service-dogs/id-card/[token] error:", error);
    return NextResponse.json({ error: "שגיאה באימות תעודה" }, { status: 500 });
  }
}
