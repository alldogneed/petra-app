export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { answerQuestion, deleteQuestion } from "@/services/lesson-qa";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../../_lib";

// PATCH /api/online-classes/questions/[id] — answer (or edit an answer)
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

    const answerBody =
      typeof body.answerBody === "string" ? body.answerBody.trim() : "";
    if (!answerBody) return badRequest("נדרשת תשובה");
    if (answerBody.length > 2000)
      return badRequest("התשובה ארוכה מדי (מקסימום 2000 תווים)");

    const question = await answerQuestion(auth.businessId, params.id, answerBody);
    return NextResponse.json({ question });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PATCH /api/online-classes/questions/[id]", error)
    );
  }
}

// DELETE /api/online-classes/questions/[id] — remove a question
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    await deleteQuestion(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/questions/[id]", error)
    );
  }
}
