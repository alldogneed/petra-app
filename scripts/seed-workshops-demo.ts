/**
 * Seed script for the "workshops operational management" feature review.
 *
 * Creates an ISOLATED demo business ("Design Test Business") owned by
 * design-test@petra.local / designTest123 with two WORKSHOP training groups,
 * participants (incl. waitlist), sessions, attendance, orders and payments —
 * per docs/superpowers/specs/2026-07-15-workshops-ops-design.md ("Demo data").
 *
 * Idempotent: wipes ONLY data belonging to the design-test business
 * (matched by business email = design-test@petra.local, or name =
 * "Design Test Business" AND membership of the design-test user) and recreates it.
 * Never touches any other business.
 *
 * Run (transpile-only avoids a multi-minute ts-node type-check hang on the Hebrew path;
 * moduleResolution override needed because tsconfig uses "bundler"):
 *   PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seed-workshops-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "design-test@petra.local";
const PASSWORD = "designTest123";
const USER_NAME = "Design Test";
const BUSINESS_NAME = "Design Test Business";
const TOS_VERSION = "1.0"; // matches CURRENT_TOS_VERSION in src/lib/tos.ts

const WORKSHOP_A_NAME = "סדנת גן גורים — יולי";
const WORKSHOP_B_NAME = "סדנה חד־פעמית — כלבים ריאקטיביים";

// ── helpers ──────────────────────────────────────────────────────────────────

/** A date `days` from now at HH:mm local time. */
function dayAt(days: number, hours: number, minutes = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ── wipe (scoped ONLY to the design-test business) ───────────────────────────

async function wipeDesignTestData(businessIds: string[]) {
  if (businessIds.length === 0) return;
  const inBiz = { businessId: { in: businessIds } };

  // FK-safe sequential order (NO $transaction — PgBouncer; see rule 17)
  await prisma.invoiceDocument.updateMany({ where: inBiz, data: { originalInvoiceId: null } });
  await prisma.invoiceDocument.deleteMany({ where: inBiz });
  await prisma.invoiceJob.deleteMany({ where: inBiz });
  await prisma.payment.deleteMany({ where: inBiz });
  await prisma.appointment.deleteMany({ where: inBiz });
  await prisma.trainingGroup.deleteMany({ where: inBiz }); // cascades sessions/participants/attendance
  await prisma.trainingProgram.deleteMany({ where: inBiz }); // cascades goals/sessions/homework
  await prisma.orderLine.deleteMany({ where: inBiz });
  await prisma.order.deleteMany({ where: inBiz });
  await prisma.boardingCareLog.deleteMany({ where: inBiz });
  await prisma.boardingStay.deleteMany({ where: inBiz });
  await prisma.lead.deleteMany({ where: inBiz });
  await prisma.booking.deleteMany({ where: inBiz }); // cascades BookingDog
  await prisma.scheduledMessage.deleteMany({ where: inBiz });
  await prisma.contractRequest.deleteMany({ where: inBiz });
  await prisma.intakeForm.deleteMany({ where: inBiz });
  await prisma.timelineEvent.deleteMany({ where: inBiz });
  await prisma.task.deleteMany({ where: inBiz });
  await prisma.serviceDogRecipient.deleteMany({ where: inBiz });
  await prisma.pet.deleteMany({
    where: { OR: [inBiz, { customer: { businessId: { in: businessIds } } }] },
  });
  await prisma.customer.deleteMany({ where: inBiz });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (expected via .env)");
  }
  console.log("🌱 Seeding workshops-ops demo data...");

  // 1) User — hashed exactly like /api/auth/register (bcrypt, cost 12)
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.platformUser.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      name: USER_NAME,
      passwordHash,
      authProvider: "local",
      platformRole: null,
      isActive: true,
      tosAcceptedVersion: TOS_VERSION,
      tosAcceptedAt: new Date(),
    },
    update: {
      name: USER_NAME,
      passwordHash,
      platformRole: null,
      isActive: true,
      tosAcceptedVersion: TOS_VERSION,
      tosAcceptedAt: new Date(),
    },
  });
  console.log(`✅ user: ${user.email}`);

  // ToS consent record (register creates this too)
  await prisma.userConsent.upsert({
    where: { id: `${user.id}:${TOS_VERSION}` },
    create: { id: `${user.id}:${TOS_VERSION}`, userId: user.id, termsVersion: TOS_VERSION },
    update: {},
  });

  // Mark onboarding complete so the wizard/guard doesn't hijack the review session
  await prisma.onboardingProgress.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      currentStep: 4,
      stepCompleted1: true,
      stepCompleted2: true,
      stepCompleted3: true,
      stepCompleted4: true,
      startedAt: new Date(),
      completedAt: new Date(),
    },
    update: { completedAt: new Date(), skipped: false },
  });

  // 2) Business — find any prior design-test businesses (scoped!) and wipe them
  const priorBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        { email: EMAIL },
        { name: BUSINESS_NAME, members: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });
  const priorIds = priorBusinesses.map((b) => b.id);
  if (priorIds.length > 0) {
    console.log(`🧹 wiping prior design-test data (${priorIds.length} business(es): ${priorIds.join(", ")})`);
    await wipeDesignTestData(priorIds);
  }

  const businessData = {
    name: BUSINESS_NAME,
    email: EMAIL,
    phone: "0500000000",
    tier: "pro",
    status: "active",
    subscriptionStatus: "active",
    subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    whatsappRemindersEnabled: false, // never send real WhatsApp from demo data
  };
  const business = priorIds.length
    ? await prisma.business.update({ where: { id: priorIds[0] }, data: businessData })
    : await prisma.business.create({ data: businessData });
  console.log(`✅ business: ${business.name} (${business.id})`);

  // Ensure OWNER membership; drop any other memberships of this test user
  await prisma.businessUser.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    create: { businessId: business.id, userId: user.id, role: "owner", isActive: true },
    update: { role: "owner", isActive: true },
  });
  await prisma.businessUser.deleteMany({
    where: { userId: user.id, businessId: { not: business.id } },
  });

  // 3) 8 customers, one dog each
  const people: Array<{ name: string; dog: string; breed: string }> = [
    { name: "דנה לוי", dog: "לונה", breed: "בורדר קולי" },
    { name: "יוסי כהן", dog: "רקסי", breed: "לברדור" },
    { name: "מיכל אברהם", dog: "בל", breed: "גולדן רטריבר" },
    { name: "אבי מזרחי", dog: "צ'רלי", breed: "מלינואה בלגי" },
    { name: "נועה פרידמן", dog: "מוקה", breed: "פודל" },
    { name: "איתי שפירא", dog: "טוסט", breed: "מעורב" },
    { name: "שירה בן־דוד", dog: "קאיה", breed: "רועה גרמני" },
    { name: "עומר גולן", dog: "ג'ינג'י", breed: "קוקר ספניאל" },
  ];
  const customers: Array<{ id: string; name: string; petId: string }> = [];
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const phone = `050000000${i + 1}`;
    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: p.name,
        phone,
        phoneNorm: `+97250000000${i + 1}`,
        source: "workshops-demo-seed",
      },
    });
    const pet = await prisma.pet.create({
      data: { name: p.dog, species: "dog", breed: p.breed, customerId: customer.id },
    });
    customers.push({ id: customer.id, name: p.name, petId: pet.id });
  }
  console.log(`✅ customers: ${customers.length} (one dog each)`);

  // ── 4) Workshop A: סדנת גן גורים — יולי ────────────────────────────────────
  // 4 weekly sessions: 2 past (COMPLETED), 2 future (SCHEDULED, next in 3 days at 18:00)
  const aDates: Array<{ date: Date; status: string }> = [
    { date: dayAt(-11, 18), status: "COMPLETED" },
    { date: dayAt(-4, 18), status: "COMPLETED" },
    { date: dayAt(3, 18), status: "SCHEDULED" },
    { date: dayAt(10, 18), status: "SCHEDULED" },
  ];
  const groupA = await prisma.trainingGroup.create({
    data: {
      businessId: business.id,
      name: WORKSHOP_A_NAME,
      groupType: "WORKSHOP",
      price: 450,
      maxParticipants: 6,
      location: "מגרש האימונים, רעננה",
      defaultDayOfWeek: aDates[2].date.getDay(),
      defaultTime: "18:00",
      startDate: aDates[0].date,
      endDate: aDates[3].date,
      reminderEnabled: false,
      isActive: true,
    },
  });
  const aSessions = [];
  for (let i = 0; i < aDates.length; i++) {
    aSessions.push(
      await prisma.trainingGroupSession.create({
        data: {
          trainingGroupId: groupA.id,
          sessionDatetime: aDates[i].date,
          sessionNumber: i + 1,
          status: aDates[i].status,
        },
      })
    );
  }

  // Participants: customers 0-5 ACTIVE, 6-7 WAITLIST
  const aParticipants = [];
  for (let i = 0; i < 8; i++) {
    const c = customers[i];
    aParticipants.push(
      await prisma.trainingGroupParticipant.create({
        data: {
          trainingGroupId: groupA.id,
          dogId: c.petId,
          customerId: c.id,
          status: i < 6 ? "ACTIVE" : "WAITLIST",
          joinedAt: dayAt(-14, 12),
        },
      })
    );
  }

  // Attendance — past sessions: ALL participants, realistic mix (mostly PRESENT)
  // NO_SHOW map: session 1 → participants 2 & 6; session 2 → participants 4 & 7
  const noShow: Record<number, number[]> = { 0: [2, 6], 1: [4, 7] };
  let aAttendanceCount = 0;
  for (let s = 0; s < 2; s++) {
    for (let p = 0; p < aParticipants.length; p++) {
      await prisma.trainingGroupAttendance.create({
        data: {
          trainingGroupSessionId: aSessions[s].id,
          participantId: aParticipants[p].id,
          dogId: aParticipants[p].dogId,
          customerId: aParticipants[p].customerId,
          attendanceStatus: noShow[s].includes(p) ? "NO_SHOW" : "PRESENT",
          completed: true,
          markedAt: aDates[s].date,
        },
      });
      aAttendanceCount++;
    }
  }
  // Future sessions: seed NO_SHOW placeholder rows for ACTIVE participants only
  for (let s = 2; s < 4; s++) {
    for (let p = 0; p < 6; p++) {
      await prisma.trainingGroupAttendance.create({
        data: {
          trainingGroupSessionId: aSessions[s].id,
          participantId: aParticipants[p].id,
          dogId: aParticipants[p].dogId,
          customerId: aParticipants[p].customerId,
          attendanceStatus: "NO_SHOW",
          completed: false,
        },
      });
      aAttendanceCount++;
    }
  }

  // Orders for active participants 0-4 (participant 5 has NO order).
  // Participants 0-2 fully paid; 3-4 unpaid.
  async function createWorkshopOrder(opts: {
    customerId: string;
    participantId: string;
    groupId: string;
    groupName: string;
    price: number;
    paid: boolean;
  }) {
    const order = await prisma.order.create({
      data: {
        businessId: business.id,
        customerId: opts.customerId,
        status: "confirmed",
        orderType: "training",
        relatedEntityType: "TrainingGroup",
        relatedEntityId: opts.groupId,
        subtotal: opts.price,
        taxTotal: 0,
        total: opts.price,
        lines: {
          create: {
            businessId: business.id,
            name: `סדנה: ${opts.groupName}`,
            unit: "יח'",
            quantity: 1,
            unitPrice: opts.price,
            lineSubtotal: opts.price,
            lineTax: 0,
            lineTotal: opts.price,
          },
        },
      },
    });
    await prisma.trainingGroupParticipant.update({
      where: { id: opts.participantId },
      data: { orderId: order.id },
    });
    if (opts.paid) {
      await prisma.payment.create({
        data: {
          businessId: business.id,
          customerId: opts.customerId,
          orderId: order.id,
          amount: opts.price,
          method: "cash",
          status: "paid",
          paidAt: dayAt(-6, 11),
        },
      });
    }
    return order;
  }

  let aOrders = 0;
  let aPaid = 0;
  for (let p = 0; p < 5; p++) {
    await createWorkshopOrder({
      customerId: aParticipants[p].customerId,
      participantId: aParticipants[p].id,
      groupId: groupA.id,
      groupName: WORKSHOP_A_NAME,
      price: 450,
      paid: p < 3,
    });
    aOrders++;
    if (p < 3) aPaid++;
  }
  console.log(
    `✅ Workshop A "${WORKSHOP_A_NAME}": 4 sessions (2 past/2 future), 6 ACTIVE + 2 WAITLIST, ` +
      `${aAttendanceCount} attendance rows, ${aOrders} orders (${aPaid} paid)`
  );

  // ── 5) Workshop B: סדנה חד־פעמית — כלבים ריאקטיביים ───────────────────────
  const bDate = dayAt(5, 10);
  const groupB = await prisma.trainingGroup.create({
    data: {
      businessId: business.id,
      name: WORKSHOP_B_NAME,
      groupType: "WORKSHOP",
      price: 180,
      maxParticipants: 8,
      location: "מגרש האימונים, רעננה",
      defaultDayOfWeek: bDate.getDay(),
      defaultTime: "10:00",
      startDate: bDate,
      endDate: bDate,
      reminderEnabled: false,
      isActive: true,
    },
  });
  const bSession = await prisma.trainingGroupSession.create({
    data: {
      trainingGroupId: groupB.id,
      sessionDatetime: bDate,
      sessionNumber: 1,
      status: "SCHEDULED",
    },
  });
  // 4 ACTIVE participants (customers 2-5), exactly 1 (the first) fully paid
  const bParticipants = [];
  for (let i = 2; i <= 5; i++) {
    const c = customers[i];
    bParticipants.push(
      await prisma.trainingGroupParticipant.create({
        data: {
          trainingGroupId: groupB.id,
          dogId: c.petId,
          customerId: c.id,
          status: "ACTIVE",
          joinedAt: dayAt(-2, 9),
        },
      })
    );
  }
  // Future-session placeholder attendance for ACTIVE participants
  for (const p of bParticipants) {
    await prisma.trainingGroupAttendance.create({
      data: {
        trainingGroupSessionId: bSession.id,
        participantId: p.id,
        dogId: p.dogId,
        customerId: p.customerId,
        attendanceStatus: "NO_SHOW",
        completed: false,
      },
    });
  }
  await createWorkshopOrder({
    customerId: bParticipants[0].customerId,
    participantId: bParticipants[0].id,
    groupId: groupB.id,
    groupName: WORKSHOP_B_NAME,
    price: 180,
    paid: true,
  });
  console.log(
    `✅ Workshop B "${WORKSHOP_B_NAME}": 1 future session, 4 ACTIVE, 1 paid order`
  );

  // ── 6) Summary ───────────────────────────────────────────────────────────
  const [customerCount, groupCount, sessionCount, participantCount, attendanceCount, orderCount, paymentCount] =
    await Promise.all([
      prisma.customer.count({ where: { businessId: business.id } }),
      prisma.trainingGroup.count({ where: { businessId: business.id } }),
      prisma.trainingGroupSession.count({ where: { trainingGroup: { businessId: business.id } } }),
      prisma.trainingGroupParticipant.count({ where: { trainingGroup: { businessId: business.id } } }),
      prisma.trainingGroupAttendance.count({
        where: { session: { trainingGroup: { businessId: business.id } } },
      }),
      prisma.order.count({ where: { businessId: business.id } }),
      prisma.payment.count({ where: { businessId: business.id } }),
    ]);

  console.log("\n🎉 Done! Workshops-ops demo data seeded.");
  console.log("──────────────────────────────────────────");
  console.log(`   business id : ${business.id}`);
  console.log(`   login       : ${EMAIL} / ${PASSWORD}`);
  console.log(`   customers   : ${customerCount} (each with one dog)`);
  console.log(`   workshops   : ${groupCount}`);
  console.log(`   sessions    : ${sessionCount} (A: 2 past + 2 future, B: 1 future)`);
  console.log(`   participants: ${participantCount} (A: 6 ACTIVE + 2 WAITLIST, B: 4 ACTIVE)`);
  console.log(`   attendance  : ${attendanceCount}`);
  console.log(`   orders      : ${orderCount} (A: 3 paid + 2 unpaid, B: 1 paid)`);
  console.log(`   payments    : ${paymentCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
