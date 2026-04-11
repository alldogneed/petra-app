export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/training-groups/[id]/participants – add a participant to the group
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { customerId, dogId } = body;

    if (!customerId || !dogId) {
      return NextResponse.json({ error: "customerId and dogId are required" }, { status: 400 });
    }

    // Check if already enrolled
    const existing = await prisma.trainingGroupParticipant.findUnique({
      where: {
        trainingGroupId_dogId: {
          trainingGroupId: params.id,
          dogId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Dog is already enrolled in this group" }, { status: 409 });
    }

    // Check group belongs to business and check max participants
    const group = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      select: { maxParticipants: true, _count: { select: { participants: true } } },
    });

    if (!group) {
      return NextResponse.json({ error: "Training group not found" }, { status: 404 });
    }
    if (group.maxParticipants && group._count.participants >= group.maxParticipants) {
      return NextResponse.json({ error: "Group is full" }, { status: 400 });
    }

    // Verify customer and dog belong to this business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId: authResult.businessId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }
    const dog = await prisma.pet.findFirst({
      where: { id: dogId, customer: { businessId: authResult.businessId } },
      select: { id: true },
    });
    if (!dog) {
      return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });
    }

    const participant = await prisma.trainingGroupParticipant.create({
      data: {
        trainingGroupId: params.id,
        customerId,
        dogId,
      },
      include: {
        dog: { select: { id: true, name: true, species: true, breed: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-groups/[id]/participants error:", error);
    return NextResponse.json({ error: "Failed to add participant" }, { status: 500 });
  }
}

// DELETE /api/training-groups/[id]/participants – remove participant (pass participantId in body)
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    // Verify participant belongs to a group owned by this business
    const participant = await prisma.trainingGroupParticipant.findUnique({
      where: { id: participantId },
      select: { trainingGroup: { select: { businessId: true } } },
    });
    if (!participant || participant.trainingGroup.businessId !== authResult.businessId) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    await prisma.trainingGroupParticipant.delete({
      where: { id: participantId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-groups/[id]/participants error:", error);
    return NextResponse.json({ error: "Failed to remove participant" }, { status: 500 });
  }
}
