export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { listPortalCourses } from "@/services/portal";
import { portalErrorResponse } from "../_shared";

// GET /api/portal/[slug]/courses — published courses catalog
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    const courses = await listPortalCourses(
      business.id,
      isActiveMembership(membership)
    );
    return NextResponse.json({ courses });
  } catch (error) {
    return portalErrorResponse(error, "portal courses GET");
  }
}
