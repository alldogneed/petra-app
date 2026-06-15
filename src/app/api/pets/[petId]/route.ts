export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { getPet, updatePet, deletePet, ServiceError, type UpdatePetInput } from "@/services/pets";

export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pet = await getPet(authResult.businessId, prisma, params.petId);
    if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 });

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

    const body = await request.json();
    let pet;
    try {
      pet = await updatePet(authResult.businessId, prisma, params.petId, body as UpdatePetInput);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
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

    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת חיית מחמד" }, { status: 403 });
    }

    if (callerRole === "manager") {
      const existing = await prisma.pet.findFirst({
        where: { id: params.petId, OR: [{ customer: { businessId } }, { businessId }] },
        select: { id: true, name: true },
      });
      if (!existing) return NextResponse.json({ error: "Pet not found" }, { status: 404 });
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

    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_PET_${params.petId}`) {
      return NextResponse.json({ error: "נדרש אישור מפורש למחיקה", requireConfirmation: true }, { status: 428 });
    }

    try {
      await deletePet(businessId, prisma, params.petId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Pet not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE pet error:", error);
    return NextResponse.json({ error: "Failed to delete pet" }, { status: 500 });
  }
}
