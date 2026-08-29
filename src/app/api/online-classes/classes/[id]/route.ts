export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { updateClass, deleteClass } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
  parseDateField,
  parsePositiveInt,
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

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("נדרשת כותרת לשיעור");
      if (title.length > 200)
        return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");
      data.title = title;
    }

    if (body.startsAt !== undefined) {
      const startsAt = parseDateField(body.startsAt);
      if (!startsAt) return badRequest("תאריך התחלה לא תקין");
      data.startsAt = startsAt;
    }

    if (body.capacity !== undefined) {
      const capacity = parsePositiveInt(body.capacity, 10000);
      if (capacity === null)
        return badRequest("קיבולת לא תקינה — נדרש מספר שלם חיובי");
      data.capacity = capacity;
    }

    if (body.durationMin !== undefined) {
      const durationMin = parsePositiveInt(body.durationMin, 1440);
      if (durationMin === null)
        return badRequest("משך שיעור לא תקין (1-1440 דקות)");
      data.durationMin = durationMin;
    }

    if (body.description !== undefined) {
      const description = optStr(body.description);
      if (description && description.length > 2000)
        return badRequest("תיאור ארוך מדי (מקסימום 2000 תווים)");
      data.description = description || null;
    }

    if (body.instructorName !== undefined) {
      const instructorName = optStr(body.instructorName);
      if (instructorName && instructorName.length > 100)
        return badRequest("שם מדריך ארוך מדי (מקסימום 100 תווים)");
      data.instructorName = instructorName || null;
    }

    if (body.zoomLink !== undefined) {
      const zoomLink = optStr(body.zoomLink);
      if (zoomLink && zoomLink.length > 500)
        return badRequest("קישור זום ארוך מדי (מקסימום 500 תווים)");
      data.zoomLink = zoomLink || null;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("לא נשלחו שדות לעדכון");
    }

    const updated = await updateClass(auth.businessId, params.id, data);
    return NextResponse.json(updated);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/classes/[id]", error)
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

    await deleteClass(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/classes/[id]", error)
    );
  }
}
