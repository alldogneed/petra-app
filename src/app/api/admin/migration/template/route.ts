export const dynamic = "force-dynamic";
/**
 * GET /api/admin/migration/template
 * Returns the XLSX import template for customer/pet migration.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { generateCustomerTemplate } from "@/lib/import-utils";

export async function GET(req: NextRequest) {
  const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(authResult)) return authResult;

  const buffer = generateCustomerTemplate();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="petra-import-template.xlsx"',
    },
  });
}
