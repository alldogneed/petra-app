export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  getQuizForBusiness,
  upsertQuiz,
  deleteQuiz,
} from "@/services/quizzes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../../../_lib";

// GET /api/online-classes/modules/[id]/quiz — full quiz tree (with isCorrect)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const quiz = await getQuizForBusiness(auth.businessId, params.id);
    return NextResponse.json({ quiz });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/modules/[id]/quiz", error)
    );
  }
}

// PUT /api/online-classes/modules/[id]/quiz — upsert the WHOLE quiz
export async function PUT(
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
    if (!title) return badRequest("נדרשת כותרת לבוחן");

    const rawPass = body.passScore;
    const passScore =
      typeof rawPass === "number"
        ? rawPass
        : typeof rawPass === "string"
          ? parseInt(rawPass, 10)
          : NaN;
    if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
      return badRequest("ציון עובר חייב להיות מספר שלם בין 0 ל-100");
    }

    if (!Array.isArray(body.questions)) {
      return badRequest("נדרשת רשימת שאלות");
    }

    const questions = (body.questions as unknown[]).map((raw) => {
      const q = (raw ?? {}) as Record<string, unknown>;
      const options = Array.isArray(q.options) ? (q.options as unknown[]) : [];
      return {
        text: typeof q.text === "string" ? q.text : "",
        options: options.map((rawOpt) => {
          const o = (rawOpt ?? {}) as Record<string, unknown>;
          return {
            text: typeof o.text === "string" ? o.text : "",
            isCorrect: o.isCorrect === true,
          };
        }),
      };
    });

    const quiz = await upsertQuiz(auth.businessId, params.id, {
      title,
      passScore,
      questions,
    });

    return NextResponse.json({ quiz });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("PUT /api/online-classes/modules/[id]/quiz", error)
    );
  }
}

// DELETE /api/online-classes/modules/[id]/quiz — remove the quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    await deleteQuiz(auth.businessId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("DELETE /api/online-classes/modules/[id]/quiz", error)
    );
  }
}
