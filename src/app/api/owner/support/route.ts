import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.read");
  if (isGuardError(authResult)) return authResult;

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // "open" | "in_progress" | "resolved" | null (all)

  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      pageUrl: true,
      status: true,
      createdAt: true,
      business: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({ tickets });
}
