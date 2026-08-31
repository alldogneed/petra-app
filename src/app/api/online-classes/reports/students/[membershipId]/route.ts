export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getStudentDetail } from "@/services/online-classes-reports";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
} from "../../../_lib";

export async function GET(
  request: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const detail = await getStudentDetail(auth.businessId, params.membershipId);
    return NextResponse.json(detail);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError(
        "GET /api/online-classes/reports/students/[membershipId]",
        error
      )
    );
  }
}
