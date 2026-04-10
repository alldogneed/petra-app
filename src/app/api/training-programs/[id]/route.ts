export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const program = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        dog: true,
        customer: true,
        goals: {
          orderBy: { sortOrder: "asc" },
        },
        sessions: {
          orderBy: { sessionDate: "desc" },
        },
        homework: {
          orderBy: { assignedDate: "desc" },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error) {
    console.error("GET training program error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תוכנית" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify program belongs to this business
    const existing = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    const program = await prisma.trainingProgram.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.programType !== undefined && { programType: body.programType }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : undefined }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.totalSessions !== undefined && { totalSessions: body.totalSessions }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.frequency !== undefined && { frequency: body.frequency }),
        ...(body.workPlan !== undefined && { workPlan: body.workPlan || null }),
        ...(body.behaviorBaseline !== undefined && { behaviorBaseline: body.behaviorBaseline || null }),
        ...(body.customerExpectations !== undefined && { customerExpectations: body.customerExpectations || null }),
        ...(body.boardingStayId !== undefined && { boardingStayId: body.boardingStayId || null }),
        ...(body.trainingType !== undefined && { trainingType: body.trainingType }),
      },
      include: {
        dog: true,
        customer: true,
        goals: { orderBy: { sortOrder: "asc" } },
        sessions: { orderBy: { sessionDate: "desc" } },
        homework: { orderBy: { assignedDate: "desc" } },
      },
    });

    return NextResponse.json(program);
  } catch (error) {
    console.error("PATCH training program error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תוכנית" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    // Staff cannot delete at all
    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת תוכנית אימון" }, { status: 403 });
    }

    const existing = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId },
      select: { id: true, name: true, dogId: true, dog: { select: { name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
    }

    const programLabel = existing.name ?? (existing.dog ? `אימון: ${existing.dog.name}` : "תוכנית אימון");

    // Manager → route to pending approval
    if (callerRole === "manager") {
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_TRAINING",
        description: `מחיקת תוכנית אימון: ${programLabel}`,
        payload: { trainingProgramId: params.id, programName: programLabel },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Owner → require typed confirmation header
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_TRAINING_${params.id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    // Delete child records then the program — sequential, NO $transaction
    // (Supabase PgBouncer transaction pooling is incompatible with Prisma interactive transactions)
    await prisma.trainingGoal.deleteMany({ where: { trainingProgramId: params.id } });
    await prisma.trainingProgramSession.deleteMany({ where: { trainingProgramId: params.id } });
    await prisma.trainingHomework.deleteMany({ where: { trainingProgramId: params.id } });
    await prisma.trainingProgram.delete({ where: { id: params.id, businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE training program error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תוכנית" }, { status: 500 });
  }
}
