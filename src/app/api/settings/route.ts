export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { getBusinessSettings, updateBusinessSettings, ServiceError } from "@/services/business";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const settings = await getBusinessSettings(authResult.businessId, prisma);
    // No HTTP caching: settings are mutable (toggles, reminder hours, etc.) and a
    // stale max-age cache caused toggles to "snap back" after a PATCH+refetch.
    return NextResponse.json(
      settings,
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const membership = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    const callerRole = (membership?.role ?? "user") as TenantRole;
    if (callerRole !== "owner") {
      return NextResponse.json({ error: "רק בעלים יכול לשנות הגדרות" }, { status: 403 });
    }

    const body = await request.json();

    let result;
    try {
      result = await updateBusinessSettings(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
      throw e;
    }

    const { updated, wasPhoneEmpty, newPhone } = result;

    if (wasPhoneEmpty && newPhone) {
      const phoneFormatted = toWhatsAppPhone(newPhone);
      if (phoneFormatted) {
        sendWhatsAppMessage({
          to: phoneFormatted,
          body: `שלום מ-Petra! 👋\n\nהודעות ה-WhatsApp שלך פועלות בהצלחה.\nלקוחות יקבלו תזכורות ועדכונים אוטומטית ישירות לנייד. 🐾\n\n— הצוות של Petra`,
        }).catch((err) => console.error("WhatsApp verification message failed:", err));
      }
    }

    logCurrentUserActivity("UPDATE_SETTINGS");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
