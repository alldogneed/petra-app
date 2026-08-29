export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { issueCertificateIfEarned } from "@/services/certificates";
import {
  enforcePortalRateLimit,
  portalRateKey,
  portalErrorResponse,
} from "../../../_shared";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";

// GET /api/portal/[slug]/courses/[courseId]/certificate
// Issues the completion certificate when every lesson of the course is done
// (idempotent — returns the already-issued one otherwise).
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; courseId: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    if (!isActiveMembership(membership)) {
      return NextResponse.json({ error: "נדרש מנוי פעיל" }, { status: 403 });
    }

    const limited = await enforcePortalRateLimit(
      "portal:certificate",
      portalRateKey(request, membership?.id),
      RATE_LIMITS.API_WRITE
    );
    if (limited) return limited;

    const certificate = await issueCertificateIfEarned(
      business.id,
      membership!.id,
      params.courseId
    );

    if (!certificate) {
      return NextResponse.json({
        certificate: null,
        reason: "לא הושלמו כל השיעורים",
      });
    }

    return NextResponse.json({
      certificate: {
        id: certificate.id,
        courseId: certificate.courseId,
        serial: certificate.serial,
        studentName: certificate.studentName,
        courseTitle: certificate.courseTitle,
        issuedAt: certificate.issuedAt,
        verifyUrl: `${APP_URL}/verify/${certificate.serial}`,
      },
    });
  } catch (error) {
    return portalErrorResponse(error, "portal course certificate GET");
  }
}
