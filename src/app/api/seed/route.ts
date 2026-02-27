import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

// GET /api/seed – info about seeding (dev helper, platform admins only)
// Actual seeding is done via CLI: npx ts-node prisma/seed.ts
export async function GET(req: NextRequest) {
  const guard = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(guard)) return guard;

  return NextResponse.json({
    message: "Use CLI commands to seed data",
    commands: {
      seedDemo: "npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts",
      seedAdmin: "npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed-admin.ts",
      resetDb: "npx prisma db push --force-reset && npx prisma generate",
    },
    note: "This endpoint is for development reference only",
  });
}
