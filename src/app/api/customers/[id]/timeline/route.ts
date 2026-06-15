export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const VALID_TIMELINE_EVENT_TYPES = new Set([
  "note",
  "MANUAL_NOTE",
  "customer_created",
  "CUSTOMER_CREATED",
  "lead_converted",
  "APPOINTMENT_CREATED",
  "APPOINTMENT_COMPLETED",
  "APPOINTMENT_CANCELLED",
  "appointment_scheduled",
  "appointment_completed",
  "appointment_canceled",
  "whatsapp_sent",
  "pet_added",
  "payment_received",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { description, type = "note" } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (description.trim().length > 2000) {
      return NextResponse.json({ error: "תיאור ארוך מדי (עד 2000 תווים)" }, { status: 400 });
    }
    if (!VALID_TIMELINE_EVENT_TYPES.has(type)) {
      return NextResponse.json({ error: "סוג אירוע לא תקין" }, { status: 400 });
    }

    // Verify customer belongs to this business
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const event = await prisma.timelineEvent.create({
      data: {
        type,
        description: description.trim(),
        customerId: params.id,
        businessId: authResult.businessId,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST timeline error:", error);
    return NextResponse.json({ error: "Failed to create timeline event" }, { status: 500 });
  }
}
