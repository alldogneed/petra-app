export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess } from "@/lib/customer-access";
import { clampTake, parseCursor, parseAppointmentScope } from "@/lib/customer-summary";
import { listCustomerAppointments } from "@/services/customer-detail";
import { ServiceError } from "@/services/types";

/**
 * GET /api/customers/[id]/appointments?scope=upcoming|past&cursor=<appointmentId>&take=20
 * → { appointments: [customer.appointments item shape], nextCursor: string|null, total: number }
 * upcoming = date ≥ Israel today and not canceled (ascending); past = everything else (descending).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;

    const sp = request.nextUrl.searchParams;
    const scope = parseAppointmentScope(sp.get("scope"));
    if (!scope) return NextResponse.json({ error: "scope לא תקין" }, { status: 400 });
    const rawCursor = sp.get("cursor");
    const cursor = parseCursor(rawCursor);
    if (rawCursor && !cursor) return NextResponse.json({ error: "cursor לא תקין" }, { status: 400 });
    const take = clampTake(sp.get("take"), 20, 50);

    const page = await listCustomerAppointments(authResult.businessId, prisma, params.id, { scope, cursor, take });
    return NextResponse.json({ appointments: page.items, nextCursor: page.nextCursor, total: page.total });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    console.error("Customer appointments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}
