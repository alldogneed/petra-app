export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { recordLessonProgress } from "@/services/portal";
import {
  enforcePortalRateLimit,
  getClientIp,
  portalErrorResponse,
} from "../../../_shared";

// The player reports every ~10s while playing, plus on pause / lesson switch /
// page hide — so this needs a far higher ceiling than a normal write endpoint.
const PROGRESS_RATE_LIMIT = { max: 240, windowMs: 60_000 };

/**
 * POST /api/portal/[slug]/lessons/[lessonId]/progress
 * Body: { watchedSeconds: number, durationSeconds: number }
 * → { percent, completed, watchedSeconds }
 *
 * watchedSeconds is DISTINCT seconds actually watched (the client counts
 * per-second buckets), so seeking to the end cannot complete a lesson.
 */
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
      "portal:lesson-progress",
      getClientIp(request),
      PROGRESS_RATE_LIMIT
    );
    if (limited) return limited;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
    }

    const watchedSeconds = Number(body.watchedSeconds);
    const durationSeconds = Number(body.durationSeconds);
    if (!Number.isFinite(watchedSeconds) || !Number.isFinite(durationSeconds)) {
      return NextResponse.json({ error: "נתוני צפייה לא תקינים" }, { status: 400 });
    }

    const result = await recordLessonProgress(
      business.id,
      membership!.id,
      params.lessonId,
      { watchedSeconds, durationSeconds }
    );

    return NextResponse.json(result);
  } catch (error) {
    return portalErrorResponse(error, "portal lesson progress POST");
  }
}
