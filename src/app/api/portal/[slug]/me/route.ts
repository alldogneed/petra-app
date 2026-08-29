export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth, isPortalGuardError } from "@/lib/portal-auth";
import { portalErrorResponse } from "../_shared";

// GET /api/portal/[slug]/me — current portal user + membership for this business
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { portalUser, membership } = ctx;

    return NextResponse.json({ portalUser, membership });
  } catch (error) {
    return portalErrorResponse(error, "portal me GET");
  }
}
