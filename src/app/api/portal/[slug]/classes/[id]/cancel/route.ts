export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { cancelRegistration } from "@/services/portal";
import {
  enforcePortalRateLimit,
  getClientIp,
  portalErrorResponse,
} from "../../../_shared";

// POST /api/portal/[slug]/classes/[id]/cancel — cancel my registration
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    if (!isActiveMembership(membership)) {
      return NextResponse.json({ error: "נדרש מנוי פעיל" }, { status: 403 });
    }

    const limited = await enforcePortalRateLimit(
      "portal:class-cancel",
      getClientIp(request),
      RATE_LIMITS.API_WRITE
    );
    if (limited) return limited;

    await cancelRegistration(business.id, membership!.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return portalErrorResponse(error, "portal class cancel POST");
  }
}
