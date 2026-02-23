import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const existing = await prisma.service.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    const { name, type, duration, price, color, isActive } = body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (duration !== undefined) data.duration = duration;
    if (price !== undefined) data.price = price;
    if (color !== undefined) data.color = color;
    if (isActive !== undefined) data.isActive = isActive;

    const service = await prisma.service.update({
      where: { id },
      data,
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 }
    );
  }
}
