export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { listLessonQuestions, askQuestion } from "@/services/lesson-qa";
import {
  enforcePortalRateLimit,
  portalRateKey,
  portalErrorResponse,
} from "../../../_shared";

// GET /api/portal/[slug]/lessons/[lessonId]/questions — Q&A under a lesson
export async function GET(
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
      "portal:lesson-questions",
      portalRateKey(request, membership?.id),
      RATE_LIMITS.PUBLIC_READ
    );
    if (limited) return limited;

    const questions = await listLessonQuestions(
      business.id,
      params.lessonId,
      membership!.id
    );
    return NextResponse.json({ questions });
  } catch (error) {
    return portalErrorResponse(error, "portal lesson questions GET");
  }
}

// POST /api/portal/[slug]/lessons/[lessonId]/questions — ask a question
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
      "portal:lesson-question-ask",
      portalRateKey(request, membership?.id),
      RATE_LIMITS.API_WRITE
    );
    if (limited) return limited;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
    }

    const text = typeof body.body === "string" ? body.body : "";
    const isPrivate = body.isPrivate === true;

    const question = await askQuestion(
      business.id,
      membership!.id,
      params.lessonId,
      text,
      isPrivate
    );
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error, "portal lesson questions POST");
  }
}
