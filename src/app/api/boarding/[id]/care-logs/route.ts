import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  const { businessId } = auth;

  // Verify stay belongs to business
  const stay = await prisma.boardingStay.findFirst({
    where: { id: params.id, businessId },
  });
  if (!stay) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.boardingCareLog.findMany({
    where: { boardingStayId: params.id, businessId },
    orderBy: { doneAt: "desc" },
  });

  return NextResponse.json({ logs });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  const { businessId } = auth;

  // Verify stay belongs to business
  const stay = await prisma.boardingStay.findFirst({
    where: { id: params.id, businessId },
  });
  if (!stay) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { type, title, notes } = body;

  if (!type || !title?.trim()) {
    return NextResponse.json({ error: "type ו-title חובה" }, { status: 400 });
  }

  const VALID_TYPES = ["FEEDING", "MEDICATION", "WALK", "NOTE"];
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "סוג לא תקין" }, { status: 400 });
  }

  const log = await prisma.boardingCareLog.create({
    data: {
      boardingStayId: params.id,
      petId: stay.petId,
      businessId,
      type,
      title: title.trim(),
      notes: notes?.trim() ?? null,
    },
  });

  return NextResponse.json(log);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  const { businessId } = auth;

  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("logId");
  if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

  await prisma.boardingCareLog.deleteMany({
    where: { id: logId, boardingStayId: params.id, businessId },
  });

  return NextResponse.json({ ok: true });
}
