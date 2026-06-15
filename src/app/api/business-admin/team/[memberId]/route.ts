export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { updateTeamMember, ServiceError } from "@/services/business";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.businessRole !== "owner" || !currentUser.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    let updated;
    try {
      updated = await updateTeamMember(
        currentUser.businessId,
        prisma,
        params.memberId,
        { role: body.role, isActive: body.isActive },
        currentUser.id
      );
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Business admin PATCH team member error:", error);
    return NextResponse.json({ error: "Failed to update team member" }, { status: 500 });
  }
}
