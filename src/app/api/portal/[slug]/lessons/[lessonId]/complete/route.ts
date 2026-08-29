export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { markLessonComplete } from "@/services/portal";
import {
  enforcePortalRateLimit,
  getClientIp,
  portalErrorResponse,
} from "../../../_shared";

// POST /api/portal/[slug]/lessons/[lessonId]/complete — mark lesson done
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; lessonId: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    if (!isActiveMembership(membership)) {
      return NextResponse.json({ error: "נדרש מנוי פעיל" }, { status: 403 });
    }

    const limited = await enforcePortalRateLimit(
      "portal:lesson-complete",
      getClientIp(request),
      RATE_LIMITS.API_WRITE
    );
    if (limited) return limited;

    await markLessonComplete(business.id, membership!.id, params.lessonId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return portalErrorResponse(error, "portal lesson complete POST");
  }
}
