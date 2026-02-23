import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { description, type = "note" } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const event = await prisma.timelineEvent.create({
      data: {
        type,
        description: description.trim(),
        customerId: params.id,
        businessId: DEMO_BUSINESS_ID,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST timeline error:", error);
    return NextResponse.json({ error: "Failed to create timeline event" }, { status: 500 });
  }
}
