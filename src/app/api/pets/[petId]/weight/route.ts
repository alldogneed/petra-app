export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;
    const { businessId } = auth;

    // Verify pet belongs to this business
    const pet = await prisma.pet.findFirst({
      where: {
        id: params.petId,
        OR: [
          { customer: { businessId } },
          { businessId },
        ],
      },
    });
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const entries = await prisma.petWeightEntry.findMany({
      where: { petId: params.petId, businessId },
      orderBy: { recordedAt: "desc" },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET pet weight error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתונים" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;
    const { businessId } = auth;

    // Verify pet belongs to this business
    const pet = await prisma.pet.findFirst({
      where: {
        id: params.petId,
        OR: [
          { customer: { businessId } },
          { businessId },
        ],
      },
    });
    if (!pet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const weight = parseFloat(body.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return NextResponse.json({ error: "משקל לא תקין" }, { status: 400 });
    }

    const entry = await prisma.petWeightEntry.create({
      data: {
        petId: params.petId,
        businessId,
        weight,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("POST pet weight error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת משקל" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;
    const { businessId } = auth;

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");
    if (!entryId) return NextResponse.json({ error: "entryId required" }, { status: 400 });

    await prisma.petWeightEntry.deleteMany({
      where: { id: entryId, petId: params.petId, businessId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE pet weight error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת רשומה" }, { status: 500 });
  }
}
