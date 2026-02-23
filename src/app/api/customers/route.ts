import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const businessId = DEMO_BUSINESS_ID;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");

    const where: Record<string, unknown> = { businessId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    const full = searchParams.get("full") === "1";

    const customers = await prisma.customer.findMany({
      where,
      include: full
        ? { pets: { select: { id: true, name: true, species: true } } }
        : { _count: { select: { pets: true, appointments: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Customers GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const businessId = DEMO_BUSINESS_ID;
    const body = await request.json();

    const tags = body.tags
      ? JSON.stringify(body.tags.split(",").map((t: string) => t.trim()).filter(Boolean))
      : "[]";

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        notes: body.notes || null,
        tags,
        source: body.source || "manual",
        businessId,
      },
    });

    await prisma.timelineEvent.create({
      data: {
        type: "customer_created",
        description: `לקוח חדש נוצר: ${customer.name}`,
        customerId: customer.id,
        businessId,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Customers POST error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
