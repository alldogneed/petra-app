export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enqueueSyncJob } from "@/lib/sync-jobs";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Validate status
    const VALID_STATUSES = ["pending", "confirmed", "declined", "cancelled"];
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `סטטוס לא תקין. ערכים אפשריים: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        service: true,
        customer: true,
      },
    });

    // Enqueue Google Calendar sync based on status change
    if (body.status) {
      const action = body.status === "cancelled" ? "delete" : "update";
      enqueueSyncJob(booking.id, booking.businessId, action).catch((err) =>
        console.error("Failed to enqueue sync job:", err)
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("PATCH booking error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הזמנה" }, { status: 500 });
  }
}
