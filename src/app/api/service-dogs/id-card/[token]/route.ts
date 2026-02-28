export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// PUBLIC route — no auth required (accessed via QR scan)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Rate limit by IP to prevent QR token enumeration
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit("service-dog:qr", ip, RATE_LIMITS.STRICT_TOKEN);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

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
      // recipientName intentionally omitted — PII not exposed on public QR endpoint
      generatedAt: card.generatedAt,
    });
  } catch (error) {
    console.error("GET /api/service-dogs/id-card/[token] error:", error);
    return NextResponse.json({ error: "שגיאה באימות תעודה" }, { status: 500 });
  }
}
