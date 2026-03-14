export const dynamic = 'force-dynamic';
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { normalizeIsraeliPhone } from "@/lib/validation";

const PatchCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  phoneNorm: z.string().max(20).nullable().optional(),
  email: z.string().email().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  idNumber: z.string().max(20).nullable().optional(),
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

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        pets: {
          include: {
            health: true,
            behavior: true,
            medications: { orderBy: { createdAt: "desc" }, take: 50 },
          },
        },
        appointments: {
          select: {
            id: true, date: true, startTime: true, endTime: true,
            status: true, notes: true, cancellationNote: true,
            service: { select: { id: true, name: true, color: true } },
            pet: { select: { id: true, name: true, species: true } },
          },
          orderBy: { date: "desc" },
          take: 100,
        },
        payments: {
          select: {
            id: true, amount: true, status: true, method: true,
            paidAt: true, createdAt: true, notes: true, isDeposit: true,
            appointment: {
              select: { id: true, date: true, service: { select: { name: true } } },
            },
            boardingStay: {
              select: {
                id: true,
                pet: { select: { name: true } },
                room: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        orders: {
          select: {
            id: true, orderType: true, status: true, subtotal: true,
            discountAmount: true, taxTotal: true, total: true,
            notes: true, createdAt: true,
            lines: {
              select: {
                id: true, name: true, quantity: true,
                unitPrice: true, lineTotal: true,
              },
            },
            payments: { select: { id: true, amount: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        trainingPrograms: {
          select: {
            id: true, dogId: true, name: true, programType: true,
            status: true, startDate: true, totalSessions: true,
            frequency: true, notes: true, createdAt: true,
            dog: { select: { name: true } },
            goals: {
              select: { id: true, title: true, status: true, progressPercent: true, sortOrder: true },
              orderBy: { sortOrder: "asc" },
              take: 30,
            },
            sessions: { where: { status: "COMPLETED" }, select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        timelineEvents: {
          select: { id: true, type: true, description: true, metadata: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── PII masking: staff cannot see address ──────────────────────────────
    const membership = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId
    );
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeePii = hasTenantPermission(callerRole, TENANT_PERMS.CUSTOMERS_PII);

    const responseData = canSeePii
      ? customer
      : { ...customer, address: null };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Customer GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
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

    // Build update payload from validated fields only
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) data[k] = v;
    }
    // Auto-normalize phone and compute phoneNorm when phone is updated
    if (parsed.data.phone) {
      const normalized = normalizeIsraeliPhone(parsed.data.phone);
      data.phone = normalized;
      const digits = normalized.replace(/\D/g, "");
      data.phoneNorm = digits.startsWith("0") && digits.length >= 9
        ? "972" + digits.slice(1)
        : digits || null;
    }

    const customer = await prisma.customer.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
    });

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.UPDATE_CUSTOMER);

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customer PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
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
    if (!hasTenantPermission(callerRole, TENANT_PERMS.CONTENT_WRITE) ||
        callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת לקוח" }, { status: 403 });
    }

    // Verify customer belongs to this business
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId },
      select: { id: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Manager → route to pending approval instead of deleting
    if (callerRole === "manager") {
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

    // Owner → require typed confirmation header to prevent human error
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_CUSTOMER_${params.id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    await prisma.customer.delete({ where: { id: params.id, businessId } });
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_CUSTOMER);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
