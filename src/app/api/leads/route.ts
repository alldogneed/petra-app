import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: {
        customer: true,
        callLogs: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, source, stage, notes, customerId } = body;

    const lead = await prisma.lead.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        name,
        phone,
        email,
        source,
        stage: stage || "NEW",
        notes,
        customerId: customerId || undefined,
      },
      include: {
        customer: true,
        callLogs: true,
      },
    });

    logCurrentUserActivity("CREATE_LEAD");
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
