export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      include: {
        _count: {
          select: {
            customers: true,
            appointments: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      business,
      { headers: { "Cache-Control": "private, max-age=600, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Only owner can change settings
    const membership = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    const callerRole = (membership?.role ?? "user") as TenantRole;
    if (callerRole !== "owner") {
      return NextResponse.json({ error: "רק בעלים יכול לשנות הגדרות" }, { status: 403 });
    }

    const body = await request.json();

    const existing = await prisma.business.findUnique({
      where: { id: authResult.businessId },
    });

    const wasPhoneEmpty = !existing?.phone;

    if (!existing) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const {
      name,
      phone,
      email,
      address,
      logo,
      vatNumber,
      businessRegNumber,
      vatEnabled,
      vatRate,
      boardingCalcMode,
      boardingMinNights,
      boardingCheckInTime,
      boardingCheckOutTime,
      boardingPricePerNight,
      customerTags,
      cancellationPolicy,
      bookingWelcomeText,
      depositInstructions,
      sdSettings,
      whatsappRemindersEnabled,
      whatsappReminderLeadHours,
      googleContactsSync,
    } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (address !== undefined) data.address = address;
    if (logo !== undefined) data.logo = logo;
    if (vatNumber !== undefined) data.vatNumber = vatNumber;
    if (businessRegNumber !== undefined) data.businessRegNumber = businessRegNumber;
    if (vatEnabled !== undefined) data.vatEnabled = vatEnabled;
    if (vatRate !== undefined) data.vatRate = vatRate;
    if (boardingCalcMode !== undefined) data.boardingCalcMode = boardingCalcMode;
    if (boardingMinNights !== undefined) data.boardingMinNights = boardingMinNights;
    if (boardingCheckInTime !== undefined) data.boardingCheckInTime = boardingCheckInTime;
    if (boardingCheckOutTime !== undefined) data.boardingCheckOutTime = boardingCheckOutTime;
    if (boardingPricePerNight !== undefined) data.boardingPricePerNight = boardingPricePerNight;
    if (customerTags !== undefined) data.customerTags = customerTags;
    if (cancellationPolicy !== undefined) data.cancellationPolicy = cancellationPolicy;
    if (bookingWelcomeText !== undefined) data.bookingWelcomeText = bookingWelcomeText;
    if (depositInstructions !== undefined) data.depositInstructions = depositInstructions;
    if (sdSettings !== undefined) data.sdSettings = sdSettings;
    if (whatsappRemindersEnabled !== undefined) data.whatsappRemindersEnabled = whatsappRemindersEnabled;
    if (whatsappReminderLeadHours !== undefined) data.whatsappReminderLeadHours = whatsappReminderLeadHours;
    if (googleContactsSync !== undefined) data.googleContactsSync = googleContactsSync;

    const business = await prisma.business.update({
      where: { id: authResult.businessId },
      data,
      include: {
        _count: {
          select: {
            customers: true,
            appointments: true,
          },
        },
      },
    });

    if (wasPhoneEmpty && phone) {
      const phoneFormatted = toWhatsAppPhone(String(phone));
      if (phoneFormatted) {
        sendWhatsAppMessage({
          to: phoneFormatted,
          body: `שלום מ-Petra! 👋\n\nהודעות ה-WhatsApp שלך פועלות בהצלחה.\nלקוחות יקבלו תזכורות ועדכונים אוטומטית ישירות לנייד. 🐾\n\n— הצוות של Petra`,
        }).catch(() => {});
      }
    }

    logCurrentUserActivity("UPDATE_SETTINGS");
    return NextResponse.json(business);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
