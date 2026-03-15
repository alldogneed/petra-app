export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";

export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pet = await prisma.pet.findFirst({
      where: {
        id: params.petId,
        OR: [
          { customer: { businessId: authResult.businessId } },
          { businessId: authResult.businessId },
        ],
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        health: true,
        behavior: true,
        medications: { orderBy: { createdAt: "desc" } },
        appointments: {
          include: { service: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 20,
        },
        boardingStays: {
          include: { room: { select: { name: true } } },
          orderBy: { checkIn: "desc" },
          take: 10,
        },
        trainingPrograms: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    return NextResponse.json(pet);
  } catch (error) {
    console.error("GET pet error:", error);
    return NextResponse.json({ error: "Failed to fetch pet" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify the pet belongs to this business before updating
    const existing = await prisma.pet.findFirst({
      where: {
        id: params.petId,
        OR: [
          { customer: { businessId: authResult.businessId } },
          { businessId: authResult.businessId },
        ],
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    const body = await request.json();
    const { neuteredSpayed, ...petData } = body;

    const pet = await prisma.pet.update({
      where: { id: params.petId },
      data: {
        ...(petData.name !== undefined && { name: petData.name }),
        ...(petData.breed !== undefined && { breed: petData.breed || null }),
        ...(petData.gender !== undefined && { gender: petData.gender || null }),
        ...(petData.weight !== undefined && { weight: petData.weight ? parseFloat(petData.weight) : null }),
        ...(petData.birthDate !== undefined && { birthDate: petData.birthDate ? new Date(petData.birthDate) : null }),
        ...(petData.microchip !== undefined && { microchip: petData.microchip || null }),
        ...(petData.color !== undefined && { color: petData.color || null }),
        ...(petData.tags !== undefined && { tags: petData.tags }),
        ...(petData.attachments !== undefined && { attachments: petData.attachments }),
        ...(petData.medicalNotes !== undefined && { medicalNotes: petData.medicalNotes || null }),
        ...(petData.foodNotes !== undefined && { foodNotes: petData.foodNotes || null }),
        ...(petData.foodBrand !== undefined && { foodBrand: petData.foodBrand || null }),
        ...(petData.foodGramsPerDay !== undefined && { foodGramsPerDay: petData.foodGramsPerDay != null ? parseFloat(petData.foodGramsPerDay) : null }),
        ...(petData.foodFrequency !== undefined && { foodFrequency: petData.foodFrequency || null }),
        ...(petData.behaviorNotes !== undefined && { behaviorNotes: petData.behaviorNotes || null }),
      },
      include: {
        health: true,
        behavior: true,
      },
    });

    // Handle neuteredSpayed via DogHealth
    if (neuteredSpayed !== undefined) {
      await prisma.dogHealth.upsert({
        where: { petId: params.petId },
        create: { petId: params.petId, neuteredSpayed: Boolean(neuteredSpayed) },
        update: { neuteredSpayed: Boolean(neuteredSpayed) },
      });
    }

    return NextResponse.json(pet);
  } catch (error) {
    console.error("PATCH pet error:", error);
    return NextResponse.json({ error: "Failed to update pet" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    // Staff cannot delete at all
    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת חיית מחמד" }, { status: 403 });
    }

    const existing = await prisma.pet.findFirst({
      where: {
        id: params.petId,
        OR: [
          { customer: { businessId } },
          { businessId },
        ],
      },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    // Manager → route to pending approval
    if (callerRole === "manager") {
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_PET",
        description: `מחיקת חיית מחמד: ${existing.name}`,
        payload: { petId: params.petId, petName: existing.name },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Owner → require typed confirmation header
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_PET_${params.petId}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    // Delete related records first (no cascade in schema)
    await prisma.$transaction([
      prisma.dogMedication.deleteMany({ where: { petId: params.petId } }),
      prisma.dogHealth.deleteMany({ where: { petId: params.petId } }),
      prisma.dogBehavior.deleteMany({ where: { petId: params.petId } }),
      prisma.petWeightEntry.deleteMany({ where: { petId: params.petId } }),
      prisma.pet.delete({ where: { id: params.petId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE pet error:", error);
    return NextResponse.json({ error: "Failed to delete pet" }, { status: 500 });
  }
}
