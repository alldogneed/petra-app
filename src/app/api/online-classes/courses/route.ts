export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { listCourses, createCourse } from "@/services/online-classes";
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

    const courses = await listCourses(auth.businessId);
    return NextResponse.json({ courses });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/courses", error)
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
    if (!title) return badRequest("נדרשת כותרת לקורס");
    if (title.length > 200) return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");

    const description = optStr(body.description);
    if (description && description.length > 5000)
      return badRequest("תיאור ארוך מדי (מקסימום 5000 תווים)");

    const coverUrl = optStr(body.coverUrl);
    if (coverUrl && coverUrl.length > 500)
      return badRequest("כתובת תמונת שער ארוכה מדי (מקסימום 500 תווים)");

    const course = await createCourse(auth.businessId, {
      title,
      description: description || undefined,
      coverUrl: coverUrl || undefined,
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/courses", error)
    );
  }
}
