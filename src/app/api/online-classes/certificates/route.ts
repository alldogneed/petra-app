export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import {
  listCertificates,
  issueCertificateManually,
} from "@/services/certificate-admin";
import {
  requireOnlineClassesAuth,
  isRouteGuardError,
  serviceErrorToResponse,
  serverError,
  badRequest,
} from "../_lib";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId")?.trim() || undefined;
    const includeRevoked = searchParams.get("includeRevoked") === "true";

    const certificates = await listCertificates(auth.businessId, {
      courseId,
      includeRevoked,
    });
    return NextResponse.json({ certificates });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("GET /api/online-classes/certificates", error)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOnlineClassesAuth(request);
    if (isRouteGuardError(auth)) return auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return badRequest("גוף בקשה לא תקין");
    }

    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId.trim() : "";
    if (!membershipId) return badRequest("נדרש מנוי");

    const courseId =
      typeof body.courseId === "string" ? body.courseId.trim() : "";
    if (!courseId) return badRequest("נדרש קורס");

    const certificate = await issueCertificateManually(
      auth.businessId,
      membershipId,
      courseId
    );

    return NextResponse.json({ certificate }, { status: 201 });
  } catch (error) {
    return (
      serviceErrorToResponse(error) ??
      serverError("POST /api/online-classes/certificates", error)
    );
  }
}
