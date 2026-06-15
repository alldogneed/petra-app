export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import {
  getTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram,
  ServiceError,
} from "@/services/training";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      const program = await getTrainingProgram(authResult.businessId, prisma, params.id);
      return NextResponse.json(program);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
      }
      throw e;
    }
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

    const body = await request.json();

    let program;
    try {
      program = await updateTrainingProgram(authResult.businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : 400 }
        );
      }
      throw e;
    }

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

    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת תוכנית אימון" }, { status: 403 });
    }

    // Fetch label info for approval description before attempting delete
    const existing = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId },
      select: { id: true, name: true, dog: { select: { name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
    }

    const programLabel = existing.name ?? (existing.dog ? `אימון: ${existing.dog.name}` : "תוכנית אימון");

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

    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_TRAINING_${params.id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    try {
      await deleteTrainingProgram(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE training program error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תוכנית" }, { status: 500 });
  }
}
