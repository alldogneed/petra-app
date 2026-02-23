import { NextResponse } from "next/server";

// GET /api/seed – info about seeding (dev helper)
// Actual seeding is done via CLI: npx ts-node prisma/seed.ts
export async function GET() {
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
