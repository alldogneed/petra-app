export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createModule } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../../../_lib";

export async function POST(
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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("נדרשת כותרת לפרק");
    if (title.length > 200) return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");

    const courseModule = await createModule(auth.businessId, params.id, {
      title,
    });

    return NextResponse.json(courseModule, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/courses/[id]/modules", error)
    );
  }
}
