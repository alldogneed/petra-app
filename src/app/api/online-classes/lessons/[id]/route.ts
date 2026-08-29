export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { updateLesson, deleteLesson } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
  parsePositiveInt,
} from "../../_lib";

const LESSON_TYPES = ["video", "pdf", "text"];

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

    if (body.type !== undefined) {
      const type =
        typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
      if (!LESSON_TYPES.includes(type)) {
        return badRequest("סוג שיעור לא תקין");
      }
      data.type = type;
    }

    if (body.videoRef !== undefined) {
      const videoRef = optStr(body.videoRef);
      if (videoRef && videoRef.length > 100)
        return badRequest("מזהה וידאו לא תקין");
      data.videoRef = videoRef || null;
    }

    if (body.fileUrl !== undefined) {
      const fileUrl = optStr(body.fileUrl);
      if (fileUrl && fileUrl.length > 500)
        return badRequest("כתובת קובץ ארוכה מדי (מקסימום 500 תווים)");
      data.fileUrl = fileUrl || null;
    }

    if (body.textContent !== undefined) {
      const textContent = optStr(body.textContent);
      if (textContent && textContent.length > 50000)
        return badRequest("תוכן טקסט ארוך מדי (מקסימום 50000 תווים)");
      data.textContent = textContent || null;
    }

    if (body.durationMin !== undefined) {
      if (body.durationMin === null) {
        data.durationMin = null;
      } else {
        const durationMin = parsePositiveInt(body.durationMin, 1440);
        if (durationMin === null)
          return badRequest("משך שיעור לא תקין (1-1440 דקות)");
        data.durationMin = durationMin;
      }
    }

    if (body.isFreePreview !== undefined) {
      data.isFreePreview = body.isFreePreview === true;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("לא נשלחו שדות לעדכון");
    }

    const lesson = await updateLesson(auth.businessId, params.id, data);
    return NextResponse.json(lesson);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/lessons/[id]", error)
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

    await deleteLesson(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/lessons/[id]", error)
    );
  }
}
