import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const priceList = await prisma.priceList.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!priceList) {
      return NextResponse.json({ error: "Price list not found" }, { status: 404 });
    }

    return NextResponse.json(priceList);
  } catch (error) {
    console.error("Error fetching price list:", error);
    return NextResponse.json({ error: "Failed to fetch price list" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const priceList = await prisma.priceList.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(priceList);
  } catch (error) {
    console.error("Error updating price list:", error);
    return NextResponse.json({ error: "Failed to update price list" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    await prisma.priceList.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting price list:", error);
    return NextResponse.json({ error: "Failed to delete price list" }, { status: 500 });
  }
}
