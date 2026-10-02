export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess } from "@/lib/customer-access";
import { clampTake, parseCursor } from "@/lib/customer-summary";
import { listCustomerTimeline } from "@/services/customer-detail";
import { ServiceError } from "@/services/types";

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

/**
 * GET /api/customers/[id]/timeline?cursor=<eventId>&take=30
 * → { events: [{ id, type, description, metadata, createdAt }], nextCursor } (newest first, take ≤ 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;

    const sp = request.nextUrl.searchParams;
    const rawCursor = sp.get("cursor");
    const cursor = parseCursor(rawCursor);
    if (rawCursor && !cursor) return NextResponse.json({ error: "cursor לא תקין" }, { status: 400 });
    const take = clampTake(sp.get("take"), 30, 100);

    const page = await listCustomerTimeline(authResult.businessId, prisma, params.id, { cursor, take });
    return NextResponse.json({ events: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("GET timeline error:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;

    const body = await request.json().catch(() => null);
    const { description, type = "note" } = (body ?? {}) as { description?: unknown; type?: unknown };

    if (typeof description !== "string" || typeof type !== "string" || !description.trim()) {
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
