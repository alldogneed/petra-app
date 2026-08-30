export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getBranding, updateBranding } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
} from "../_lib";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const branding = await getBranding(auth.businessId);
    return NextResponse.json({ branding });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/branding", error)
    );
  }
}

const BRANDING_FIELDS: Array<{ key: string; maxLen: number; label: string }> = [
  { key: "logoUrl", maxLen: 500, label: "כתובת לוגו" },
  { key: "primaryColor", maxLen: 20, label: "צבע ראשי" },
  { key: "secondaryColor", maxLen: 20, label: "צבע משני" },
  { key: "senderName", maxLen: 100, label: "שם שולח" },
  { key: "paymentLinkUrl", maxLen: 500, label: "קישור תשלום" },
  { key: "aboutText", maxLen: 5000, label: "טקסט אודות" },
  { key: "certificateSignatureUrl", maxLen: 500, label: "קישור לחתימה" },
  { key: "certificateSignerName", maxLen: 100, label: "שם החותם" },
  { key: "certificateFooterText", maxLen: 300, label: "שורת תחתית לתעודה" },
];

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest("גוף בקשה לא תקין");
    }

    const data: Record<string, unknown> = {};

    // Course-security fields are typed, not free text — validated in the service.
    if (body.maxDevicesPerStudent !== undefined) {
      const n = Number(body.maxDevicesPerStudent);
      if (!Number.isInteger(n) || n < 0 || n > 10) {
        return badRequest("מספר מכשירים חייב להיות בין 0 ל-10");
      }
      data.maxDevicesPerStudent = n;
    }
    if (body.ipRestrictionEnabled !== undefined) {
      if (typeof body.ipRestrictionEnabled !== "boolean") {
        return badRequest("ערך לא תקין עבור הגבלת IP");
      }
      data.ipRestrictionEnabled = body.ipRestrictionEnabled;
    }
    if (body.allowedIps !== undefined) {
      if (!Array.isArray(body.allowedIps)) return badRequest("רשימת כתובות IP לא תקינה");
      data.allowedIps = body.allowedIps;
    }
    for (const field of BRANDING_FIELDS) {
      const raw = optStr(body[field.key]);
      if (raw === undefined) continue;
      const value = raw ?? ""; // null → clear
      if (value.length > field.maxLen) {
        return badRequest(
          `${field.label} ארוך מדי (מקסימום ${field.maxLen} תווים)`
        );
      }
      data[field.key] = value;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("לא נשלחו שדות לעדכון");
    }

    const branding = await updateBranding(
      auth.businessId,
      data as Parameters<typeof updateBranding>[1]
    );
    return NextResponse.json({ branding });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/branding", error)
    );
  }
}
