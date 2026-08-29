export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { updateModule, deleteModule } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
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

    const data: { title?: string } = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("נדרשת כותרת לפרק");
      if (title.length > 200)
        return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");
      data.title = title;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("לא נשלחו שדות לעדכון");
    }

    const courseModule = await updateModule(auth.businessId, params.id, data);
    return NextResponse.json(courseModule);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/modules/[id]", error)
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

    await deleteModule(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/modules/[id]", error)
    );
  }
}
