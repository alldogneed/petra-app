export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  approveMembership,
  updateMembership,
} from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
  parseDateField,
} from "../../_lib";

const MEMBERSHIP_STATUSES = ["pending", "active", "expired", "suspended"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest("גוף בקשה לא תקין");
    }

    // paymentNote validation shared by both branches
    const paymentNote = optStr(body.paymentNote);
    if (paymentNote && paymentNote.length > 1000) {
      return badRequest("הערת תשלום ארוכה מדי (מקסימום 1000 תווים)");
    }

    // validUntil: undefined = absent, null = clear (open-ended), string = date
    let validUntil: Date | null | undefined;
    if (body.validUntil !== undefined) {
      if (body.validUntil === null) {
        validUntil = null;
      } else {
        const parsed = parseDateField(body.validUntil);
        if (!parsed) return badRequest("תאריך תוקף לא תקין");
        validUntil = parsed;
      }
    }

    // Approve action
    if (body.action === "approve") {
      const membership = await approveMembership(auth.businessId, params.id, {
        validUntil,
        paymentNote: paymentNote || undefined,
      });
      return NextResponse.json(membership);
    }
    if (body.action !== undefined) {
      return badRequest("פעולה לא מוכרת");
    }

    // Regular update
    const data: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const status =
        typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
      if (!MEMBERSHIP_STATUSES.includes(status)) {
        return badRequest("סטטוס מנוי לא תקין");
      }
      data.status = status;
    }

    if (validUntil !== undefined) data.validUntil = validUntil;
    if (body.paymentNote !== undefined) data.paymentNote = paymentNote || null;

    if (Object.keys(data).length === 0) {
      return badRequest("לא נשלחו שדות לעדכון");
    }

    const membership = await updateMembership(auth.businessId, params.id, data);
    return NextResponse.json(membership);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/memberships/[id]", error)
    );
  }
}
