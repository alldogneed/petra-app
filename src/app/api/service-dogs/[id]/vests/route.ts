export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!dog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const vests = await prisma.serviceDogVest.findMany({
      where: { serviceDogId: params.id, businessId: auth.businessId },
      orderBy: [{ isActive: "desc" }, { assignedAt: "desc" }],
    });

    return NextResponse.json(vests);
  } catch (e) {
    console.error("GET vests error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: auth.businessId },
      select: { id: true },
    });
    if (!dog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    const vest = await prisma.serviceDogVest.create({
      data: {
        serviceDogId: params.id,
        businessId: auth.businessId,
        size: body.size || null,
        color: body.color || null,
        vestType: body.vestType || null,
        serialNumber: body.serialNumber || null,
        condition: body.condition || "GOOD",
        notes: body.notes || null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json(vest, { status: 201 });
  } catch (e) {
    console.error("POST vest error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
