export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const MEAL_SLOTS = [
  { key: "breakfast", label: "ארוחת בוקר", emoji: "🌅" },
  { key: "lunch",     label: "ארוחת צהריים", emoji: "☀️" },
  { key: "dinner",    label: "ארוחת ערב",  emoji: "🌆" },
  { key: "night",     label: "לילה",       emoji: "🌙" },
];

/**
 * GET /api/feeding
 * Returns all currently boarded pets with their feeding task status for today.
 * Auto-creates FEEDING tasks for today if they don't yet exist.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get all currently checked-in boarding stays
    const stays = await prisma.boardingStay.findMany({
      where: {
        businessId: authResult.businessId,
        status: "checked_in",
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            breed: true,
            species: true,
            foodNotes: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { checkIn: "asc" },
    });

    // For each pet, ensure today's feeding tasks exist and fetch their status
    const result = await Promise.all(
      stays.map(async (stay) => {
        const petId = stay.petId;
        const petName = stay.pet.name;

        const meals = await Promise.all(
          MEAL_SLOTS.map(async (slot) => {
            const taskTitle = `האכלה – ${petName} – ${slot.label}`;

            // Find existing task for today
            let task = await prisma.task.findFirst({
              where: {
                businessId: authResult.businessId,
                category: "FEEDING",
                relatedEntityType: "PET",
                relatedEntityId: petId,
                title: taskTitle,
                dueDate: { gte: today, lt: tomorrow },
              },
            });

            // Auto-create if missing
            if (!task) {
              task = await prisma.task.create({
                data: {
                  businessId: authResult.businessId,
                  title: taskTitle,
                  category: "FEEDING",
                  priority: "MEDIUM",
                  status: "OPEN",
                  dueDate: today,
                  relatedEntityType: "PET",
                  relatedEntityId: petId,
                },
              });
            }

            return {
              slot: slot.key,
              label: slot.label,
              emoji: slot.emoji,
              taskId: task.id,
              done: task.status === "COMPLETED",
              completedAt: task.completedAt ?? null,
            };
          })
        );

        return {
          stayId: stay.id,
          petId,
          petName,
          petBreed: stay.pet.breed,
          customerId: stay.pet.customer?.id ?? "",
          customerName: stay.pet.customer?.name ?? "",
          foodNotes: stay.pet.foodNotes,
          feedingPlan: stay.feedingPlan,
          checkIn: stay.checkIn,
          meals,
        };
      })
    );

    return NextResponse.json({ pets: result, date: today.toISOString() });
  } catch (error) {
    console.error("GET /api/feeding error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת לוח האכלה" }, { status: 500 });
  }
}
