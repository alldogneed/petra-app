import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        pets: true,
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
    const body = await request.json();
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: body,
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
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
