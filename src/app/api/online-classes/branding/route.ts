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

    const data: Record<string, string> = {};
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

    const branding = await updateBranding(auth.businessId, data);
    return NextResponse.json({ branding });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/branding", error)
    );
  }
}
