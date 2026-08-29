export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { listBusinessQuestions } from "@/services/lesson-qa";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../_lib";

// GET /api/online-classes/questions?answered=false — business Q&A inbox
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const answeredParam = searchParams.get("answered");

    let answered: boolean | undefined;
    if (answeredParam !== null && answeredParam !== "") {
      if (answeredParam === "true") answered = true;
      else if (answeredParam === "false") answered = false;
      else return badRequest("ערך לא תקין לפילטר answered");
    }

    const questions = await listBusinessQuestions(auth.businessId, { answered });
    return NextResponse.json({ questions });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/questions", error)
    );
  }
}
