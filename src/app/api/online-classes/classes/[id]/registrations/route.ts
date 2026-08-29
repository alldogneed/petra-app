export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { listRegistrations } from "@/services/online-classes";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
} from "../../../_lib";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const registrations = await listRegistrations(auth.businessId, params.id);
    return NextResponse.json({ registrations });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/classes/[id]/registrations", error)
    );
  }
}
