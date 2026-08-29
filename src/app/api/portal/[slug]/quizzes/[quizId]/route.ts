export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  requirePortalAuth,
  isPortalGuardError,
  isActiveMembership,
} from "@/lib/portal-auth";
import { getQuizForStudent } from "@/services/quizzes";
import { portalErrorResponse } from "../../_shared";

// GET /api/portal/[slug]/quizzes/[quizId] — the quiz WITHOUT the answers
export async function GET(
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

    const quiz = await getQuizForStudent(
      business.id,
      membership!.id,
      params.quizId
    );
    return NextResponse.json({ quiz });
  } catch (error) {
    return portalErrorResponse(error, "portal quiz GET");
  }
}
