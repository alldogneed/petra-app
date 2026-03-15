export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    // Staff cannot access recipients at all
    const callerMembership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (callerMembership && !hasTenantPermission(callerMembership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בזכאים" }, { status: 403 });
    }

    const recipient = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        placements: {
          include: {
            serviceDog: {
              include: { pet: { select: { name: true, breed: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!recipient) {
      return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
    }

    // Mask sensitive fields for staff
    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeeSensitive = hasTenantPermission(callerRole, TENANT_PERMS.RECIPIENTS_SENSITIVE);

    const data = canSeeSensitive
      ? recipient
      : {
          ...recipient,
          idNumber:        null,
          address:         null,
          disabilityType:  null,
          disabilityNotes: null,
          fundingSource:   null,
        };

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זכאי" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    // Staff cannot manage recipients
    const patchMembership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    if (patchMembership && !hasTenantPermission(patchMembership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
      return NextResponse.json({ error: "אין הרשאה לנהל זכאים" }, { status: 403 });
    }

    const existing = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
    }

    const body = await request.json();

    const updated = await prisma.serviceDogRecipient.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.idNumber !== undefined && { idNumber: body.idNumber || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.disabilityType !== undefined && { disabilityType: body.disabilityType || null }),
        ...(body.disabilityNotes !== undefined && { disabilityNotes: body.disabilityNotes || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.waitlistDate !== undefined && { waitlistDate: body.waitlistDate ? new Date(body.waitlistDate) : null }),
        ...(body.fundingSource !== undefined && { fundingSource: body.fundingSource || null }),
        ...(body.intakeDate !== undefined && { intakeDate: body.intakeDate ? new Date(body.intakeDate) : null }),
        ...(body.approvedAt !== undefined && { approvedAt: body.approvedAt ? new Date(body.approvedAt) : null }),
        ...(body.mobile !== undefined && { mobile: body.mobile || null }),
        ...(body.handoverDate !== undefined && { handoverDate: body.handoverDate ? new Date(body.handoverDate) : null }),
        ...(body.attachments !== undefined && { attachments: body.attachments }),
        ...(body.meetings !== undefined && { meetings: body.meetings }),
        ...(body.contactPersons !== undefined && { contactPersons: body.contactPersons }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון זכאי" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const existing = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
    }

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקה" }, { status: 403 });
    }

    if (callerRole === "manager") {
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_CUSTOMER",
        description: `מחיקת זכאי: ${existing.name}`,
        payload: { recipientId: params.id, recipientName: existing.name },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Owner — require confirmation header
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_RECIPIENT_${params.id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    await prisma.serviceDogRecipient.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת זכאי" }, { status: 500 });
  }
}
