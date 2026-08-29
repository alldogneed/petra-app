export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth, isPortalGuardError } from "@/lib/portal-auth";
import { listPortalClasses } from "@/services/portal";
import { portalErrorResponse } from "../_shared";

// GET /api/portal/[slug]/classes — upcoming live classes
// (session required; membership NOT required to view)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    const classes = await listPortalClasses(business.id, membership?.id ?? null);
    return NextResponse.json({ classes });
  } catch (error) {
    return portalErrorResponse(error, "portal classes GET");
  }
}
