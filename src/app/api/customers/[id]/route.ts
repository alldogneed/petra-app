export const dynamic = 'force-dynamic';
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import {
  getCustomer, updateCustomer, deleteCustomer, ServiceError,
  type UpdateCustomerInput,
} from "@/services/clients";
import { resyncCustomerAppointmentsToGcal } from "@/lib/google-calendar";

const PatchCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  // phoneNorm removed — always derived server-side from phone to prevent duplicate-detection bypass
  email: z.string().email().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  idNumber: z.string().max(20).nullable().optional(),
  secondContactName: z.string().max(100).nullable().optional(),
  secondContactPhone: z.string().max(20).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  tags: z.string().max(1000).nullable().optional(),
  source: z.string().max(50).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const callerMembership = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    if (callerMembership && !hasTenantPermission(callerMembership.role, TENANT_PERMS.CUSTOMERS_PII)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בלקוחות" }, { status: 403 });
    }

    const customer = await getCustomer(authResult.businessId, prisma, params.id);
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const membership = authResult.session.memberships.find((m) => m.businessId === authResult.businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeePii = hasTenantPermission(callerRole, TENANT_PERMS.CUSTOMERS_PII);
    const responseData = canSeePii ? customer : { ...customer, address: null };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Customer GET error:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const raw = await request.json();
    const parsed = PatchCustomerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    // Capture the old address so we can re-sync gcal events only on a real change.
    const before = parsed.data.address !== undefined
      ? await prisma.customer.findFirst({
          where: { id: params.id, businessId: authResult.businessId },
          select: { address: true },
        })
      : null;

    let customer;
    try {
      customer = await updateCustomer(
        authResult.businessId, prisma, params.id,
        parsed.data as UpdateCustomerInput
      );
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "CONFLICT" ? 409 : e.code === "VALIDATION" ? 400 : 400;
        return NextResponse.json({ error: e.message, ...(e.details as object | null ?? {}) }, { status });
      }
      throw e;
    }

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.UPDATE_CUSTOMER);

    // Address changed → re-sync upcoming appointments so gcal reflects the new address.
    if (before && before.address !== customer.address) {
      await resyncCustomerAppointmentsToGcal(params.id, authResult.businessId).catch((err) =>
        console.error("resyncCustomerAppointmentsToGcal failed (non-critical):", err)
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customer PATCH error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הלקוח" }, { status: 500 });
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

    if (
      !hasTenantPermission(callerRole, TENANT_PERMS.CONTENT_WRITE) ||
      callerRole === "user" ||
      callerRole === "volunteer"
    ) {
      return NextResponse.json({ error: "אין הרשאה למחיקת לקוח" }, { status: 403 });
    }

    if (callerRole === "manager") {
      const customer = await prisma.customer.findFirst({
        where: { id: params.id, businessId },
        select: { id: true, name: true },
      });
      if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_CUSTOMER",
        description: `מחיקת לקוח: ${customer.name}`,
        payload: { customerId: params.id, customerName: customer.name },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_CUSTOMER_${params.id}`) {
      return NextResponse.json({ error: "נדרש אישור מפורש למחיקה", requireConfirmation: true }, { status: 428 });
    }

    try {
      await deleteCustomer(businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      throw e;
    }

    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_CUSTOMER);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
