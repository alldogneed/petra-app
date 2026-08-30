export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  revokeCertificate,
  restoreCertificate,
  deleteCertificate,
} from "@/services/certificate-admin";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
} from "../../_lib";

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

    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (action === "revoke") {
      const reason = optStr(body.reason);
      if (reason && reason.length > 500)
        return badRequest("סיבת ביטול ארוכה מדי (מקסימום 500 תווים)");
      await revokeCertificate(auth.businessId, params.id, reason || undefined);
      return NextResponse.json({ ok: true });
    }

    if (action === "restore") {
      await restoreCertificate(auth.businessId, params.id);
      return NextResponse.json({ ok: true });
    }

    return badRequest("פעולה לא תקינה");
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/certificates/[id]", error)
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    await deleteCertificate(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/certificates/[id]", error)
    );
  }
}
