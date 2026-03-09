export const dynamic = "force-dynamic";
/**
 * GET /api/admin/migration/template
 * Returns the XLSX import template for customer/pet migration.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-guards";
import { PLATFORM_ROLES } from "@/lib/permissions";
import { generateCustomerTemplate } from "@/lib/import-utils";

async function requireMasterAccess(req: NextRequest) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!session.user.isActive) return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  const isLegacyMaster = (session.user as { role?: string }).role === "MASTER";
  const isSuperAdmin = session.user.platformRole === PLATFORM_ROLES.SUPER_ADMIN;
  if (!isLegacyMaster && !isSuperAdmin) return NextResponse.json({ error: "Master admin access required" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const deny = await requireMasterAccess(req);
  if (deny) return deny;

  const buffer = generateCustomerTemplate();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="petra-import-template.xlsx"',
    },
  });
}
