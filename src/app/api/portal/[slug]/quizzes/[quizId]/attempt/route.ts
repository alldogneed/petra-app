export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { submitAttempt } from "@/services/quizzes";
import {
  enforcePortalRateLimit,
  portalRateKey,
  portalErrorResponse,
} from "../../../_shared";

/** Quiz submissions: 20 per minute per IP. */
const QUIZ_ATTEMPT_RATE_LIMIT = { max: 20, windowMs: 60 * 1000 };

// POST /api/portal/[slug]/quizzes/[quizId]/attempt — submit answers, graded server-side
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; quizId: string } }
) {
  try {
    const ctx = await requirePortalAuth(request, params.slug);
    if (isPortalGuardError(ctx)) return ctx;
    const { business, membership } = ctx;

    if (!isActiveMembership(membership)) {
      return NextResponse.json({ error: "נדרש מנוי פעיל" }, { status: 403 });
    }

    const limited = await enforcePortalRateLimit(
      "portal:quiz-attempt",
      portalRateKey(request, membership?.id),
      QUIZ_ATTEMPT_RATE_LIMIT
    );
    if (limited) return limited;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
    }

    if (!Array.isArray(body.answers)) {
      return NextResponse.json({ error: "נדרשות תשובות" }, { status: 400 });
    }
    if (body.answers.length > 200) {
      return NextResponse.json({ error: "יותר מדי תשובות" }, { status: 400 });
    }

    const answers = (body.answers as unknown[]).map((raw) => {
      const a = (raw ?? {}) as Record<string, unknown>;
      return {
        questionId: typeof a.questionId === "string" ? a.questionId : "",
        optionId: typeof a.optionId === "string" ? a.optionId : "",
      };
    });

    const result = await submitAttempt(
      business.id,
      membership!.id,
      params.quizId,
      answers
    );
    return NextResponse.json(result);
  } catch (error) {
    return portalErrorResponse(error, "portal quiz attempt POST");
  }
}
