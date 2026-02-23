/**
 * Seed script for platform admin users.
 *
 * Run:
 *   PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-admin.ts
 *
 * This creates:
 *   - super_admin: superadmin@petra.local / Admin1234!
 *   - admin: admin@petra.local / Admin1234!
 *   - A BusinessUser linking admin to the demo business (role=owner)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_BUSINESS_ID = "demo-business-001";
const DEFAULT_PASSWORD = "Admin1234!";

async function main() {
  console.log("🌱 Seeding platform admin users...");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // Ensure demo business exists
  await prisma.business.upsert({
    where: { id: DEMO_BUSINESS_ID },
    create: {
      id: DEMO_BUSINESS_ID,
      name: "Demo Pet Business",
      email: "demo@petra.local",
      status: "active",
      tier: "pro",
    },
    update: {},
  });

  // Create super_admin
  const superAdmin = await prisma.platformUser.upsert({
    where: { email: "superadmin@petra.local" },
    create: {
      email: "superadmin@petra.local",
      name: "Super Admin",
      passwordHash,
      platformRole: "super_admin",
      isActive: true,
    },
    update: { passwordHash, isActive: true },
  });
  console.log(`✅ super_admin: ${superAdmin.email}`);

  // Create admin
  const admin = await prisma.platformUser.upsert({
    where: { email: "admin@petra.local" },
    create: {
      email: "admin@petra.local",
      name: "Platform Admin",
      passwordHash,
      platformRole: "admin",
      isActive: true,
    },
    update: { passwordHash, isActive: true },
  });
  console.log(`✅ admin: ${admin.email}`);

  // Create a regular tenant owner (no platform role)
  const owner = await prisma.platformUser.upsert({
    where: { email: "owner@petra.local" },
    create: {
      email: "owner@petra.local",
      name: "משה כהן",
      passwordHash,
      platformRole: null,
      isActive: true,
    },
    update: { passwordHash, isActive: true },
  });
  console.log(`✅ tenant owner: ${owner.email}`);

  // Link owner to demo business as owner
  await prisma.businessUser.upsert({
    where: { businessId_userId: { businessId: DEMO_BUSINESS_ID, userId: owner.id } },
    create: {
      businessId: DEMO_BUSINESS_ID,
      userId: owner.id,
      role: "owner",
      isActive: true,
    },
    update: { role: "owner", isActive: true },
  });

  // Link super_admin to demo business as owner (for cross-testing)
  await prisma.businessUser.upsert({
    where: { businessId_userId: { businessId: DEMO_BUSINESS_ID, userId: superAdmin.id } },
    create: {
      businessId: DEMO_BUSINESS_ID,
      userId: superAdmin.id,
      role: "owner",
      isActive: true,
    },
    update: {},
  });

  // Seed initial feature flags
  const flags = [
    { key: "boarding.enabled", value: "true", description: "Enable boarding module" },
    { key: "billing.enabled", value: "false", description: "Enable billing/payments" },
    { key: "ai_assistant.enabled", value: "false", description: "Enable AI assistant" },
  ];
  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: {},
    });
  }
  console.log(`✅ Seeded ${flags.length} feature flags`);

  console.log("\n🎉 Done! Credentials:");
  console.log(`   super_admin: superadmin@petra.local / ${DEFAULT_PASSWORD}`);
  console.log(`   admin:       admin@petra.local / ${DEFAULT_PASSWORD}`);
  console.log(`   tenant owner: owner@petra.local / ${DEFAULT_PASSWORD}`);
  console.log("\n⚠️  Change all passwords before using in production!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
