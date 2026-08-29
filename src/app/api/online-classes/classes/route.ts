export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { listClasses, createClass } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
  parseDateField,
  parsePositiveInt,
} from "../_lib";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const includePast = searchParams.get("includePast") === "true";

    let from: Date | undefined;
    if (fromParam) {
      const parsed = parseDateField(fromParam);
      if (!parsed) return badRequest("תאריך התחלה לא תקין");
      from = parsed;
    }

    const classes = await listClasses(auth.businessId, { from, includePast });
    return NextResponse.json({ classes });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/classes", error)
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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("נדרשת כותרת לשיעור");
    if (title.length > 200) return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");

    const startsAt = parseDateField(body.startsAt);
    if (!startsAt) return badRequest("תאריך התחלה לא תקין");

    const capacity = parsePositiveInt(body.capacity, 10000);
    if (capacity === null) return badRequest("קיבולת לא תקינה — נדרש מספר שלם חיובי");

    let durationMin: number | undefined;
    if (body.durationMin !== undefined && body.durationMin !== null) {
      const parsed = parsePositiveInt(body.durationMin, 1440);
      if (parsed === null) return badRequest("משך שיעור לא תקין (1-1440 דקות)");
      durationMin = parsed;
    }

    const description = optStr(body.description);
    const instructorName = optStr(body.instructorName);
    const zoomLink = optStr(body.zoomLink);
    if (description && description.length > 2000)
      return badRequest("תיאור ארוך מדי (מקסימום 2000 תווים)");
    if (instructorName && instructorName.length > 100)
      return badRequest("שם מדריך ארוך מדי (מקסימום 100 תווים)");
    if (zoomLink && zoomLink.length > 500)
      return badRequest("קישור זום ארוך מדי (מקסימום 500 תווים)");

    const created = await createClass(auth.businessId, {
      title,
      description: description || undefined,
      instructorName: instructorName || undefined,
      startsAt,
      durationMin,
      capacity,
      zoomLink: zoomLink || undefined,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/classes", error)
    );
  }
}
