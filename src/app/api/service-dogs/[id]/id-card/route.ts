import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const card = await prisma.serviceDogIDCard.findFirst({
      where: {
        serviceDogId: params.id,
        businessId: DEMO_BUSINESS_ID,
        isActive: true,
      },
      include: {
        serviceDog: { include: { pet: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "אין תעודה פעילה" }, { status: 404 });
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/id-card error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תעודה" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
      include: {
        pet: true,
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { recipient: true },
          take: 1,
        },
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    // Revoke existing active cards
    await prisma.serviceDogIDCard.updateMany({
      where: { serviceDogId: params.id, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokedReason: "הונפקה תעודה חדשה" },
    });

    // Generate QR token
    const qrToken = randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const qrUrl = `${appUrl}/api/service-dogs/id-card/${qrToken}`;

    // Generate QR code as data URL
    const qrPayload = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });

    // Build card data snapshot
    const cardData = {
      dogName: dog.pet.name,
      breed: dog.pet.breed,
      species: dog.pet.species,
      phase: dog.phase,
      serviceType: dog.serviceType,
      registrationNumber: dog.registrationNumber,
      certifyingBody: dog.certifyingBody,
      certificationDate: dog.certificationDate,
      certificationExpiry: dog.certificationExpiry,
      recipientName: dog.placements[0]?.recipient.name || null,
      recipientId: dog.placements[0]?.recipientId || null,
      generatedAt: new Date().toISOString(),
    };

    const card = await prisma.serviceDogIDCard.create({
      data: {
        serviceDogId: params.id,
        businessId: DEMO_BUSINESS_ID,
        qrToken,
        qrPayload,
        cardDataJson: JSON.stringify(cardData),
        isActive: true,
        expiresAt: dog.certificationExpiry || null,
      },
    });

    // Update profile
    await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: { idCardIsActive: true, idCardQrToken: qrToken },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs/[id]/id-card error:", error);
    return NextResponse.json({ error: "שגיאה בהנפקת תעודה" }, { status: 500 });
  }
}
