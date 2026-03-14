export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { generateRecipientTemplate } from "@/lib/import-utils";

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId, session } = authResult;

  const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
  if (membership && !hasTenantPermission(membership.role as TenantRole, TENANT_PERMS.RECIPIENTS_SENSITIVE)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const buffer = generateRecipientTemplate();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="recipients-template.xlsx"',
    },
  });
}
