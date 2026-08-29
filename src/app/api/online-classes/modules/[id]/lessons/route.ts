export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createLesson } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
  optStr,
  parsePositiveInt,
} from "../../../_lib";

const LESSON_TYPES = ["video", "pdf", "text"];

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
    if (!title) return badRequest("נדרשת כותרת לשיעור");
    if (title.length > 200) return badRequest("כותרת ארוכה מדי (מקסימום 200 תווים)");

    let type: string | undefined;
    if (body.type !== undefined) {
      const normalized =
        typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
      if (!LESSON_TYPES.includes(normalized)) {
        return badRequest("סוג שיעור לא תקין");
      }
      type = normalized;
    }

    const videoRef = optStr(body.videoRef);
    if (videoRef && videoRef.length > 100)
      return badRequest("מזהה וידאו לא תקין");
    const fileUrl = optStr(body.fileUrl);
    if (fileUrl && fileUrl.length > 500)
      return badRequest("כתובת קובץ ארוכה מדי (מקסימום 500 תווים)");
    const textContent = optStr(body.textContent);
    if (textContent && textContent.length > 50000)
      return badRequest("תוכן טקסט ארוך מדי (מקסימום 50000 תווים)");

    let durationMin: number | undefined;
    if (body.durationMin !== undefined && body.durationMin !== null) {
      const parsed = parsePositiveInt(body.durationMin, 1440);
      if (parsed === null) return badRequest("משך שיעור לא תקין (1-1440 דקות)");
      durationMin = parsed;
    }

    const isFreePreview =
      body.isFreePreview === undefined ? undefined : body.isFreePreview === true;

    const lesson = await createLesson(auth.businessId, params.id, {
      title,
      type,
      videoRef: videoRef || undefined,
      fileUrl: fileUrl || undefined,
      textContent: textContent || undefined,
      durationMin,
      isFreePreview,
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/modules/[id]/lessons", error)
    );
  }
}
