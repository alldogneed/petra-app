import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
      include: {
        pets: {
          include: {
            health: true,
            behavior: true,
            medications: { orderBy: { createdAt: "desc" } },
          },
        },
        appointments: {
          include: {
            service: { select: { name: true, color: true } },
            pet: { select: { name: true, species: true } },
          },
          orderBy: { date: "desc" },
          take: 20,
        },
        payments: {
          include: {
            appointment: {
              include: { service: { select: { name: true } } },
            },
            boardingStay: {
              include: {
                pet: { select: { name: true } },
                room: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        trainingPrograms: {
          include: {
            dog: { select: { name: true } },
            goals: { orderBy: { sortOrder: "asc" } },
            sessions: { where: { status: "COMPLETED" }, select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        timelineEvents: {
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Whitelist allowed fields to prevent mass assignment
    const data: Record<string, unknown> = {};
    const allowedFields = ["name", "phone", "phoneNorm", "email", "address", "notes", "tags", "source"];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const customer = await prisma.customer.update({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
      data,
    });
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify customer belongs to this business before deleting
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.customer.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
