export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

    // Completed lesson ids for this membership, limited to this course's lessons.
    let myProgress: string[] = [];
    if (membership) {
      const rows = await prisma.lessonProgress.findMany({
        where: {
          membershipId: membership.id,
          lesson: { module: { courseId: params.courseId } },
        },
        select: { lessonId: true },
      });
      myProgress = rows.map((r) => r.lessonId);
    }

    return NextResponse.json({ course, myProgress });
  } catch (error) {
    return portalErrorResponse(error, "portal course GET");
  }
}
