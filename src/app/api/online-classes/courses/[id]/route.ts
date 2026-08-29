export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  getCourseTree,
  updateCourse,
  deleteCourse,
} from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
} from "../../_lib";

const COURSE_STATUSES = ["draft", "published"];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const course = await getCourseTree(auth.businessId, params.id);
    return NextResponse.json({ course });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/courses/[id]", error)
    );
  }
}

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
      if (!title) return badRequest("נדרשת כותרת לקורס");
      if (title.length > 200)
        return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");
      data.title = title;
    }

    if (body.description !== undefined) {
      const description = optStr(body.description);
      if (description && description.length > 5000)
        return badRequest("תיאור ארוך מדי (מקסימום 5000 תווים)");
      data.description = description || null;
    }

    if (body.coverUrl !== undefined) {
      const coverUrl = optStr(body.coverUrl);
      if (coverUrl && coverUrl.length > 500)
        return badRequest("כתובת תמונת שער ארוכה מדי (מקסימום 500 תווים)");
      data.coverUrl = coverUrl || null;
    }

    if (body.status !== undefined) {
      const status =
        typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
      if (!COURSE_STATUSES.includes(status)) {
        return badRequest("סטטוס קורס לא תקין");
      }
      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("לא נשלחו שדות לעדכון");
    }

    const course = await updateCourse(auth.businessId, params.id, data);
    return NextResponse.json(course);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/courses/[id]", error)
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

    await deleteCourse(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/courses/[id]", error)
    );
  }
}
