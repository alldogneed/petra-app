export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.write");
  if (isGuardError(authResult)) return authResult;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowedStatuses = ["open", "in_progress", "resolved"];
  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const updated = await prisma.supportTicket.update({
    where: { id: params.id },
    data: { status: body.status },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
}
