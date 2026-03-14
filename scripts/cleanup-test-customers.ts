/**
 * Cleanup script: remove known test/QA customer records.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-customers.ts
 *
 * Deletes customers matching:
 *   - Name contains <script> (XSS test)
 *   - Name "בדיקת אימייל" with invalid email "not-an-email"
 *   - Name "בדיקת טלפון" with phone "123"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_CUSTOMERS = [
  { name: { contains: "<script>" } },
  { AND: [{ name: "בדיקת אימייל" }, { email: "not-an-email" }] },
  { AND: [{ name: "בדיקת טלפון" }, { phone: "123" }] },
];

async function main() {
  console.log("🧹 Searching for test customers to clean up...\n");

  for (const where of TEST_CUSTOMERS) {
    const found = await prisma.customer.findMany({
      where,
      select: { id: true, name: true, phone: true, email: true, businessId: true },
    });

    if (found.length === 0) {
      console.log(`  ✓ No match for: ${JSON.stringify(where)}`);
      continue;
    }

    for (const c of found) {
      console.log(`  🗑  Deleting: "${c.name}" (phone: ${c.phone}, email: ${c.email}, business: ${c.businessId})`);

      // Delete related records that have FK constraints
      await prisma.timelineEvent.deleteMany({ where: { customerId: c.id } });
      await prisma.appointment.deleteMany({ where: { customerId: c.id } });
      await prisma.payment.deleteMany({ where: { customerId: c.id } });
      await prisma.order.deleteMany({ where: { customerId: c.id } });
      await prisma.pet.deleteMany({ where: { customerId: c.id } });
      await prisma.customer.delete({ where: { id: c.id } });

      console.log(`     ✓ Deleted`);
    }
  }

  console.log("\n✅ Cleanup complete.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
