export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS, sessionHasTenantPermission } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { getServiceDog, updateServiceDog, deleteServiceDog, ServiceError } from "@/services/service-dogs";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS, ENTITY_TYPES } from "@/lib/activity-actions";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let dog;
    try {
      dog = await getServiceDog(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(dog);
  } catch (error) {
    console.error("GET /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת כלב שירות" }, { status: 500 });
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

    let updated;
    try {
      updated = await updateServiceDog(authResult.businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון כלב שירות" }, { status: 500 });
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

    // Same rule as pets: CRITICAL_DELETE (role default + owner overrides) deletes
    // directly; a manager without it goes through owner approval; others are blocked.
    const canDeleteDirectly = sessionHasTenantPermission(session, businessId, TENANT_PERMS.CRITICAL_DELETE);
    if (!canDeleteDirectly) {
      const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
      if (membership?.role !== "manager") {
        return NextResponse.json({ error: "אין הרשאה למחיקת כלב שירות" }, { status: 403 });
      }
      const existing = await prisma.serviceDogProfile.findFirst({
        where: { id: params.id, businessId },
        select: { id: true, petId: true, pet: { select: { name: true } } },
      });
      if (!existing) return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      const dogName = existing.pet?.name ?? "";
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_SERVICE_DOG",
        description: `מחיקת כלב שירות: ${dogName}`,
        // petId → activity-log entity when the owner approves (the Pet row survives)
        payload: { serviceDogId: params.id, petId: existing.petId, dogName },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Read the label before deleting. Service dogs are Pet rows + a ServiceDogProfile;
    // only the profile is removed, so the log entity is the (surviving) Pet.
    const toDelete = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId },
      select: { petId: true, pet: { select: { name: true } } },
    });

    try {
      await deleteServiceDog(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_SERVICE_DOG, {
      businessId,
      entityType: ENTITY_TYPES.PET,
      entityId: toDelete?.petId ?? null,
      entityLabel: toDelete?.pet?.name ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-dogs/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת כלב שירות" }, { status: 500 });
  }
}
