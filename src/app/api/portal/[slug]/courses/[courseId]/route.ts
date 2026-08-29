export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { getPortalCourse } from "@/services/portal";
import { portalErrorResponse } from "../../_shared";

// GET /api/portal/[slug]/courses/[courseId] — course tree + my progress
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; courseId: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    const course = await getPortalCourse(
      business.id,
      params.courseId,
      membership?.id ?? null,
      isActiveMembership(membership)
    );
    if (!course) {
      return NextResponse.json({ error: "הקורס לא נמצא" }, { status: 404 });
    }

    // Completion is decided by the service (completedAt only). Re-deriving it
    // here from every progress row marked half-watched lessons as done.
    const myProgress = course.myProgress;
    const progressDetail = course.progressDetail;

    return NextResponse.json({ course, myProgress, progressDetail });
  } catch (error) {
    return portalErrorResponse(error, "portal course GET");
  }
}
