export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

/** Staff cannot delete contract requests — customer PII is embedded in the document */
function staffGuard(authResult: { session: { memberships: Array<{ businessId: string; role: string; isActive: boolean }> }; businessId: string }) {
  const m = authResult.session.memberships.find((mb) => mb.businessId === authResult.businessId && mb.isActive);
  if (m && !hasTenantPermission(m.role as TenantRole, TENANT_PERMS.CUSTOMERS_PII)) {
    return NextResponse.json({ error: "אין הרשאה למחוק חוזים" }, { status: 403 });
  }
  return null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;
  const blocked = staffGuard(authResult);
  if (blocked) return blocked;

  try {
    const contract = await prisma.contractRequest.findFirst({
      where: { id: params.id, businessId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    await prisma.contractRequest.delete({ where: { id: params.id, businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE contract request error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
