export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess } from "@/lib/customer-access";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";
import { validateNoteDescription } from "@/lib/customer-summary";
import { updateCustomerNote, deleteCustomerNote } from "@/services/customer-detail";
import { ServiceError } from "@/services/types";

type Ctx = { params: { id: string; eventId: string } };

function serviceErrorResponse(e: ServiceError) {
  const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
  return NextResponse.json({ error: e.message }, { status });
}

/**
 * PATCH /api/customers/[id]/timeline/[eventId]  body { description }
 * Notes only (type note / MANUAL_NOTE) → the updated event { id, type, description, metadata, createdAt }.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const body = await request.json().catch(() => null);
    const v = validateNoteDescription((body as { description?: unknown } | null)?.description);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { event, customerName } = await updateCustomerNote(businessId, prisma, params.id, params.eventId, v.value);

    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.UPDATE_CUSTOMER, {
      businessId,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: params.id,
      entityLabel: customerName,
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof ServiceError) return serviceErrorResponse(error);
    console.error("PATCH timeline note error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון ההערה" }, { status: 500 });
  }
}

/** DELETE /api/customers/[id]/timeline/[eventId] → { ok: true } (notes only). */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const { customerName } = await deleteCustomerNote(businessId, prisma, params.id, params.eventId);

    await logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.UPDATE_CUSTOMER, {
      businessId,
      entityType: ENTITY_TYPES.CUSTOMER,
      entityId: params.id,
      entityLabel: customerName,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) return serviceErrorResponse(error);
    console.error("DELETE timeline note error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת ההערה" }, { status: 500 });
  }
}
