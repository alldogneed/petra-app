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

    // Strip sensitive fields before returning to client
    const { webhookApiKey, cardcomToken, cardcomTokenExpiry, cardcomPendingCode, cardcomRecurringId, cardcomDealId, ...safeBusiness } = business as any;

    return NextResponse.json(
      safeBusiness,
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
      legalEntityType,
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

    // ── Input validation ──────────────────────────────────────────────────
    // Block javascript:/data: URIs in logo to prevent stored XSS
    if (logo !== undefined) {
      if (typeof logo !== "string" || logo.length > 2000) {
        return NextResponse.json({ error: "כתובת לוגו לא תקינה" }, { status: 400 });
      }
      const lower = logo.toLowerCase().trim();
      if (lower.startsWith("javascript:") || lower.startsWith("data:text")) {
        return NextResponse.json({ error: "כתובת לוגו לא תקינה" }, { status: 400 });
      }
    }

    // Validate numeric fields to prevent NaN/Infinity/negative values
    if (vatRate !== undefined) {
      const n = Number(vatRate);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: "שיעור מע\"מ לא תקין (0-100)" }, { status: 400 });
      }
    }
    if (boardingPricePerNight !== undefined) {
      const n = Number(boardingPricePerNight);
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return NextResponse.json({ error: "מחיר ללילה לא תקין" }, { status: 400 });
      }
    }
    if (boardingMinNights !== undefined) {
      const n = Number(boardingMinNights);
      if (!Number.isFinite(n) || n < 0 || n > 365 || !Number.isInteger(n)) {
        return NextResponse.json({ error: "מינימום לילות לא תקין" }, { status: 400 });
      }
    }
    if (whatsappReminderLeadHours !== undefined) {
      const n = Number(whatsappReminderLeadHours);
      if (!Number.isFinite(n) || n < 0 || n > 168) {
        return NextResponse.json({ error: "שעות תזכורת לא תקינות (0-168)" }, { status: 400 });
      }
    }

    // Validate string length for text fields
    if (name !== undefined && (typeof name !== "string" || name.length > 200)) {
      return NextResponse.json({ error: "שם עסק ארוך מדי (עד 200 תווים)" }, { status: 400 });
    }
    if (cancellationPolicy !== undefined && typeof cancellationPolicy === "string" && cancellationPolicy.length > 5000) {
      return NextResponse.json({ error: "מדיניות ביטול ארוכה מדי" }, { status: 400 });
    }
    if (bookingWelcomeText !== undefined && typeof bookingWelcomeText === "string" && bookingWelcomeText.length > 2000) {
      return NextResponse.json({ error: "טקסט ברוכים הבאים ארוך מדי" }, { status: 400 });
    }
    if (depositInstructions !== undefined && typeof depositInstructions === "string" && depositInstructions.length > 2000) {
      return NextResponse.json({ error: "הנחיות מקדמה ארוכות מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }
    if (sdSettings !== undefined && typeof sdSettings === "string" && sdSettings.length > 10000) {
      return NextResponse.json({ error: "הגדרות כלבי שירות גדולות מדי" }, { status: 400 });
    }
    if (sdSettings !== undefined && typeof sdSettings === "object" && JSON.stringify(sdSettings).length > 10000) {
      return NextResponse.json({ error: "הגדרות כלבי שירות גדולות מדי" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (address !== undefined) data.address = address;
    if (logo !== undefined) data.logo = logo;
    if (vatNumber !== undefined) data.vatNumber = vatNumber;
    if (businessRegNumber !== undefined) data.businessRegNumber = businessRegNumber;
    const VALID_LEGAL_ENTITY_TYPES = ["עוסק פטור", "עוסק מורשה", "חברה"];
    if (legalEntityType !== undefined) {
      if (legalEntityType !== null && !VALID_LEGAL_ENTITY_TYPES.includes(legalEntityType)) {
        return NextResponse.json({ error: "סוג ישות משפטית לא תקין" }, { status: 400 });
      }
      data.legalEntityType = legalEntityType || null;
      // עוסק פטור is exempt from VAT — disable VAT automatically
      if (legalEntityType === "עוסק פטור") data.vatEnabled = false;
      else if (legalEntityType && vatEnabled === undefined) data.vatEnabled = true;
    }
    if (vatEnabled !== undefined) data.vatEnabled = vatEnabled;
    if (vatRate !== undefined) data.vatRate = Number(vatRate);
    if (boardingCalcMode !== undefined) data.boardingCalcMode = boardingCalcMode;
    if (boardingMinNights !== undefined) data.boardingMinNights = Number(boardingMinNights);
    if (boardingCheckInTime !== undefined) data.boardingCheckInTime = boardingCheckInTime;
    if (boardingCheckOutTime !== undefined) data.boardingCheckOutTime = boardingCheckOutTime;
    if (boardingPricePerNight !== undefined) data.boardingPricePerNight = Number(boardingPricePerNight);
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
        await sendWhatsAppMessage({
          to: phoneFormatted,
          body: `שלום מ-Petra! 👋\n\nהודעות ה-WhatsApp שלך פועלות בהצלחה.\nלקוחות יקבלו תזכורות ועדכונים אוטומטית ישירות לנייד. 🐾\n\n— הצוות של Petra`,
        }).catch((err) => console.error("WhatsApp verification message failed:", err));
      }
    }

    // Strip sensitive fields before returning to client
    const { webhookApiKey: _wk, cardcomToken: _ct, cardcomTokenExpiry: _ce, cardcomPendingCode: _cp, cardcomRecurringId: _cr, cardcomDealId: _cd, ...safeUpdated } = business as any;

    logCurrentUserActivity("UPDATE_SETTINGS");
    return NextResponse.json(safeUpdated);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
