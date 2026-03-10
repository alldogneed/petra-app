export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  const currentUser = await getCurrentUser();
  // Only the business owner (not just admin) can change roles/status
  if (!currentUser || currentUser.businessRole !== "owner" || !currentUser.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bizId = currentUser.businessId;

  // Verify the member belongs to THIS business (not another business)
  const existing = await prisma.businessUser.findFirst({
    where: { id: params.memberId, businessId: bizId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot modify your own account
  if (existing.userId === currentUser.id) {
    return NextResponse.json(
      { error: "Cannot modify your own account" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.role !== undefined && ["owner", "manager", "user"].includes(body.role)) {
    data.role = body.role;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const updated = await prisma.businessUser.update({
    where: { id: params.memberId },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // When deactivating a user, immediately invalidate all their sessions
  if (data.isActive === false) {
    await prisma.adminSession.deleteMany({
      where: { userId: existing.userId },
    });
  }

  return NextResponse.json(updated);
  } catch (error) {
    console.error("Business admin PATCH team member error:", error);
    return NextResponse.json({ error: "Failed to update team member" }, { status: 500 });
  }
}
