export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth, isPortalGuardError } from "@/lib/portal-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { requestMembership } from "@/services/portal";
import {
  enforcePortalRateLimit,
  getClientIp,
  portalErrorResponse,
} from "../../_shared";

// POST /api/portal/[slug]/membership/request — ask to join (idempotent upsert)
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, portalUser } = ctx;

    const limited = await enforcePortalRateLimit(
      "portal:membership-request",
      getClientIp(request),
      RATE_LIMITS.API_WRITE
    );
    if (limited) return limited;

    const membership = await requestMembership(business.id, portalUser.id);
    return NextResponse.json({ membership });
  } catch (error) {
    return portalErrorResponse(error, "portal membership request POST");
  }
}
