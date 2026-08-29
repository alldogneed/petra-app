export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  listMemberships,
  createManualMembership,
} from "@/services/online-classes";
import {
  validateIsraeliPhone,
  isValidEmail,
  sanitizeName,
} from "@/lib/validation";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
  parseDateField,
} from "../_lib";

const MEMBERSHIP_STATUSES = ["pending", "active", "expired", "suspended"];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    let status: string | undefined;
    if (statusParam) {
      const normalized = statusParam.trim().toLowerCase();
      if (!MEMBERSHIP_STATUSES.includes(normalized)) {
        return badRequest("סטטוס מנוי לא תקין");
      }
      status = normalized;
    }

    const memberships = await listMemberships(auth.businessId, { status });
    return NextResponse.json({ memberships });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/memberships", error)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest("גוף בקשה לא תקין");
    }

    const name =
      typeof body.name === "string" ? sanitizeName(body.name) : "";
    if (!name || name.length < 2) return badRequest("נדרש שם תקין (לפחות 2 תווים)");
    if (name.length > 100) return badRequest("שם ארוך מדי (מקסימום 100 תווים)");

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phoneError = validateIsraeliPhone(phone);
    if (phoneError) return badRequest(phoneError);

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !isValidEmail(email)) {
      return badRequest("נדרשת כתובת אימייל תקינה");
    }

    let validUntil: Date | undefined;
    if (body.validUntil !== undefined && body.validUntil !== null) {
      const parsed = parseDateField(body.validUntil);
      if (!parsed) return badRequest("תאריך תוקף לא תקין");
      validUntil = parsed;
    }

    const paymentNote = optStr(body.paymentNote);
    if (paymentNote && paymentNote.length > 1000) {
      return badRequest("הערת תשלום ארוכה מדי (מקסימום 1000 תווים)");
    }

    const membership = await createManualMembership(auth.businessId, {
      name,
      phone,
      email,
      validUntil,
      paymentNote: paymentNote || undefined,
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/memberships", error)
    );
  }
}
