export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { convertParticipantToProgram, ServiceError, type OrderAction } from "@/services/training";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; participantId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json().catch(() => ({}));
    const orderAction = (["keep", "cancel", "delete"] as const).includes(body.orderAction)
      ? (body.orderAction as OrderAction)
      : "keep";
    const programType = typeof body.programType === "string" ? body.programType : undefined;

    let result;
    try {
      result = await convertParticipantToProgram(authResult.businessId, prisma, params.participantId, {
        programType,
        orderAction,
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : 400 }
        );
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      programId: result.program.id,
      orderDowngraded: result.orderDowngraded,
    });
  } catch (error) {
    console.error("convert participant to program error:", error);
    return NextResponse.json({ error: "שגיאה בהמרה לפרטני" }, { status: 500 });
  }
}
