import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, duration, price, color, isActive } = body;

    if (!name || !type || !duration || price === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, duration, price" },
        { status: 400 }
      );
    }

    const service = await prisma.service.create({
      data: {
        name,
        type,
        duration,
        price,
        color: color || "#3B82F6",
        isActive: isActive !== undefined ? isActive : true,
        businessId: DEMO_BUSINESS_ID,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Failed to create service:", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}
