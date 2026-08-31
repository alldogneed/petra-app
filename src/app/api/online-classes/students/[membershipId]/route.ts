export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getStudentDossier } from "@/services/student-dossier";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
} from "../../_lib";

export async function GET(
  request: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const dossier = await getStudentDossier(auth.businessId, params.membershipId);
    return NextResponse.json(dossier);
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/students/[membershipId]", error)
    );
  }
}
