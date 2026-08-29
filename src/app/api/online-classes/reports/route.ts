export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  getCourseReports,
  getStudentProgress,
} from "@/services/online-classes-reports";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
} from "../_lib";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const courseIdParam = searchParams.get("courseId");
    const courseId = courseIdParam ? courseIdParam.trim() : "";

    const [courses, students] = await Promise.all([
      getCourseReports(auth.businessId),
      getStudentProgress(auth.businessId, {
        courseId: courseId || undefined,
      }),
    ]);

    return NextResponse.json({ courses, students });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/reports", error)
    );
  }
}
