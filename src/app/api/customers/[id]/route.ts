export const dynamic = 'force-dynamic';
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

const PatchCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  phoneNorm: z.string().max(20).nullable().optional(),
  email: z.string().email().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
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
          take: 20,
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
            id: true, status: true, total: true, createdAt: true,
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
            id: true, status: true, startDate: true, createdAt: true,
            dog: { select: { name: true } },
            goals: {
              select: { id: true, title: true, status: true, progressPercent: true, sortOrder: true },
              orderBy: { sortOrder: "asc" },
              take: 30,
            },
            sessions: { where: { status: "COMPLETED" }, select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        timelineEvents: {
          select: { id: true, type: true, description: true, metadata: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(customer);
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

    // Verify customer belongs to this business before deleting
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.customer.delete({ where: { id: params.id, businessId: authResult.businessId } });

    const { session } = authResult;
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
