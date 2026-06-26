export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { convertProgramToGroup, ServiceError, type OrderAction } from "@/services/training";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json().catch(() => ({}));
    const trainingGroupId = typeof body.trainingGroupId === "string" ? body.trainingGroupId : "";
    if (!trainingGroupId) {
      return NextResponse.json({ error: "יש לבחור קבוצת יעד" }, { status: 400 });
    }
    const orderAction = (["keep", "cancel", "delete"] as const).includes(body.orderAction)
      ? (body.orderAction as OrderAction)
      : "keep";

    let result;
    try {
      result = await convertProgramToGroup(authResult.businessId, prisma, params.id, {
        trainingGroupId,
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
      groupId: result.groupId,
      orderDowngraded: result.orderDowngraded,
    });
  } catch (error) {
    console.error("convert program to group error:", error);
    return NextResponse.json({ error: "שגיאה בהמרה לקבוצה" }, { status: 500 });
  }
}
