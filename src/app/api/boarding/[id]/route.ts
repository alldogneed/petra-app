export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { cancelBoardingCheckoutReminders, rescheduleBoardingCheckoutReminder, scheduleBoardingThankYou } from "@/lib/reminder-service";

const PatchBoardingSchema = z.object({
  checkIn: z.string().datetime().optional(),
  actualCheckinTime: z.string().datetime().optional(),
  checkOut: z.string().datetime().nullable().optional(),
  actualCheckoutTime: z.string().datetime().optional(),
  status: z.enum(["reserved", "checked_in", "checked_out", "canceled"]).optional(),
  roomId: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  checkinNotes: z.string().max(500).optional(),
  checkoutNotes: z.string().max(500).optional(),
  feedingPlan: z.string().max(2000).nullable().optional(),
});

// GET /api/boarding/[id] – get a single boarding stay
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const stay = await prisma.boardingStay.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        room: true,
        pet: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!stay) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(stay);
  } catch (error) {
    console.error("GET boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת שהייה" }, { status: 500 });
  }
}

// PATCH /api/boarding/[id] – update boarding stay
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify stay belongs to this business (minimal select — only fields used below)
    const existing = await prisma.boardingStay.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { id: true, notes: true, status: true, roomId: true, businessId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

    const raw = await request.json();
    const parsed = PatchBoardingSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    // Build notes: append check-in/out notes if provided
    let notesUpdate: string | null | undefined;
    if (body.notes !== undefined) {
      notesUpdate = body.notes;
    }
    if (body.checkinNotes) {
      const prefix = `[צ׳ק-אין ${new Date().toLocaleString("he-IL")}] `;
      const prev = notesUpdate ?? existing.notes ?? "";
      notesUpdate = prev ? `${prev}\n${prefix}${body.checkinNotes}` : `${prefix}${body.checkinNotes}`;
    }
    if (body.checkoutNotes) {
      const prefix = `[צ׳ק-אאוט ${new Date().toLocaleString("he-IL")}] `;
      const prev = notesUpdate ?? existing.notes ?? "";
      notesUpdate = prev ? `${prev}\n${prefix}${body.checkoutNotes}` : `${prefix}${body.checkoutNotes}`;
    }

    // If actualCheckinTime provided, use it as checkIn
    // If actualCheckoutTime provided, use it for actual checkout
    const stay = await prisma.boardingStay.update({
      where: { id: params.id },
      data: {
        ...(body.checkIn !== undefined && { checkIn: new Date(body.checkIn) }),
        ...(body.actualCheckinTime && { checkIn: new Date(body.actualCheckinTime) }),
        ...(body.checkOut !== undefined && { checkOut: body.checkOut ? new Date(body.checkOut) : null }),
        ...(body.actualCheckoutTime && { checkOut: new Date(body.actualCheckoutTime) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.roomId !== undefined && { roomId: body.roomId }),
        ...(notesUpdate !== undefined && { notes: notesUpdate }),
        ...(body.feedingPlan !== undefined && { feedingPlan: body.feedingPlan }),
      },
      select: {
        id: true, checkIn: true, checkOut: true, status: true, notes: true,
        businessId: true, customerId: true, petId: true, roomId: true,
        room: { select: { id: true, name: true } },
        pet: {
          select: {
            id: true, name: true, species: true, breed: true,
            foodNotes: true, medicalNotes: true,
            health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
            behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
            medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    // Handle checkout reminders and thank-you message
    if (body.status === "checked_out") {
      // Stay is over — cancel any pending reminders and send thank-you
      cancelBoardingCheckoutReminders(params.id).catch(console.error);
      scheduleBoardingThankYou({
        id: stay.id,
        businessId: stay.businessId,
        customerId: stay.customerId,
        checkOut: stay.checkOut,
        pet: { name: stay.pet.name },
        customer: { name: stay.customer.name },
      }).catch(console.error);
    } else if (body.checkOut !== undefined) {
      // Checkout date changed — reschedule
      rescheduleBoardingCheckoutReminder({
        id: stay.id,
        businessId: stay.businessId,
        customerId: stay.customerId,
        checkOut: stay.checkOut,
        pet: { name: stay.pet.name },
        customer: { name: stay.customer.name },
      }).catch(console.error);
    }

    // Auto-update room status atomically to avoid race conditions
    if (existing.roomId) {
      if (body.status === "checked_out") {
        // Check + update inside a transaction so concurrent checkouts don't corrupt room status
        await prisma.$transaction(async (tx) => {
          const otherActive = await tx.boardingStay.count({
            where: {
              roomId: existing.roomId!,
              id: { not: params.id },
              status: { in: ["reserved", "checked_in"] },
            },
          });
          if (otherActive === 0) {
            await tx.room.update({
              where: { id: existing.roomId! },
              data: { status: "needs_cleaning" },
            });
          }
        });
      } else if (body.status === "checked_in") {
        const room = await prisma.room.findUnique({ where: { id: existing.roomId } });
        if (room && room.status === "needs_cleaning") {
          await prisma.room.update({
            where: { id: existing.roomId },
            data: { status: "available" },
          });
        }
      }
    }

    const { session } = authResult;
    const action =
      body.status === "checked_in" ? ACTIVITY_ACTIONS.CHECKIN_BOARDING :
      body.status === "checked_out" ? ACTIVITY_ACTIONS.CHECKOUT_BOARDING :
      undefined;
    if (action) logActivity(session.user.id, session.user.name, action);

    return NextResponse.json(stay);
  } catch (error) {
    console.error("PATCH boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון שהייה" }, { status: 500 });
  }
}

// DELETE /api/boarding/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.boardingStay.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

    // Cancel any pending reminders before deleting
    await cancelBoardingCheckoutReminders(params.id);

    await prisma.boardingStay.delete({ where: { id: params.id } });

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_BOARDING);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת שהייה" }, { status: 500 });
  }
}
