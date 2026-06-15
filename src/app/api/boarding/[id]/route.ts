export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { cancelBoardingCheckoutReminders, rescheduleBoardingCheckoutReminder, scheduleBoardingThankYou } from "@/lib/reminder-service";
import { syncBoardingToGcal, deleteBoardingFromGcal } from "@/lib/google-calendar";
import { getBoardingStay, updateBoardingStay, deleteBoardingStay, ServiceError } from "@/services/boarding";

const PatchBoardingSchema = z.object({
  checkIn: z.string().datetime().optional(),
  actualCheckinTime: z.string().datetime().optional(),
  checkOut: z.string().datetime().nullable().optional(),
  actualCheckoutTime: z.string().datetime().optional(),
  status: z.enum(["reserved", "checked_in", "checked_out", "canceled"]).optional(),
  roomId: z.string().min(1).nullable().optional(),
  yardId: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  checkinNotes: z.string().max(500).optional(),
  checkoutNotes: z.string().max(500).optional(),
  feedingPlan: z.string().max(2000).nullable().optional(),
  medicalNeeds: z.string().max(2000).nullable().optional(),
  dailyTrainingMinutes: z.number().int().min(0).max(480).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      const stay = await getBoardingStay(authResult.businessId, prisma, params.id);
      return NextResponse.json(stay);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
      throw e;
    }
  } catch (error) {
    console.error("GET boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת שהייה" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const raw = await request.json();
    const parsed = PatchBoardingSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data;

    let stay;
    try {
      stay = await updateBoardingStay(authResult.businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    // Reminder side effects
    if (body.status === "checked_out") {
      await cancelBoardingCheckoutReminders(params.id).catch(console.error);
      if (stay.customerId) {
        await scheduleBoardingThankYou({
          id: stay.id,
          businessId: stay.businessId,
          customerId: stay.customerId,
          checkOut: stay.checkOut,
          pet: { name: stay.pet.name },
          customer: { name: stay.customer?.name ?? stay.pet.name },
        }).catch(console.error);
      }
    } else if (body.checkOut !== undefined && stay.customerId) {
      await rescheduleBoardingCheckoutReminder({
        id: stay.id,
        businessId: stay.businessId,
        customerId: stay.customerId,
        checkOut: stay.checkOut,
        pet: { name: stay.pet.name },
        customer: { name: stay.customer?.name ?? stay.pet.name },
      }).catch(console.error);
    }

    const { session } = authResult;
    const action =
      body.status === "checked_in" ? ACTIVITY_ACTIONS.CHECKIN_BOARDING :
      body.status === "checked_out" ? ACTIVITY_ACTIONS.CHECKOUT_BOARDING :
      undefined;
    if (action) logActivity(session.user.id, session.user.name, action);

    if (body.status === "canceled") {
      await deleteBoardingFromGcal(params.id, authResult.businessId).catch((err) =>
        console.error("Failed to delete boarding from GCal:", err)
      );
    } else {
      await syncBoardingToGcal(params.id, authResult.businessId).catch((err) =>
        console.error("Failed to sync boarding to GCal:", err)
      );
    }

    return NextResponse.json(stay);
  } catch (error) {
    console.error("PATCH boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון שהייה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    await cancelBoardingCheckoutReminders(params.id);

    try {
      await deleteBoardingStay(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
      throw e;
    }

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_BOARDING);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת שהייה" }, { status: 500 });
  }
}
