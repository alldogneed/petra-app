import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEMO_BUSINESS_ID = "demo-business-001"

async function main() {
  // Create demo business
  const business = await prisma.business.upsert({
    where: { id: DEMO_BUSINESS_ID },
    update: {},
    create: {
      id: DEMO_BUSINESS_ID,
      name: "פטרה - ניהול חיות מחמד",
      phone: "03-1234567",
      email: "demo@petra.app",
      tier: "pro",
    },
  })
  console.log("✓ Business:", business.name)

  // Create default lead stages
  await prisma.leadStage.createMany({
    data: [
      { id: "new", businessId: DEMO_BUSINESS_ID, name: "חדש", color: "#8B5CF6", sortOrder: 0 },
      { id: "contacted", businessId: DEMO_BUSINESS_ID, name: "נוצר קשר", color: "#3B82F6", sortOrder: 1 },
      { id: "qualified", businessId: DEMO_BUSINESS_ID, name: "מתאים", color: "#6366F1", sortOrder: 2 },
      { id: "won", businessId: DEMO_BUSINESS_ID, name: "נסגר", color: "#22C55E", sortOrder: 3, isWon: true },
      { id: "lost", businessId: DEMO_BUSINESS_ID, name: "אבוד", color: "#EF4444", sortOrder: 4, isLost: true },
    ],
    skipDuplicates: true,
  })
  console.log("✓ Lead Stages: 5")

  // Create demo services
  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: "svc-training-001" },
      update: {},
      create: {
        id: "svc-training-001",
        businessId: DEMO_BUSINESS_ID,
        name: "אילוף בסיסי",
        type: "training",
        duration: 60,
        price: 250,
        color: "#F97316",
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-grooming-001" },
      update: {},
      create: {
        id: "svc-grooming-001",
        businessId: DEMO_BUSINESS_ID,
        name: "טיפוח מלא",
        type: "grooming",
        duration: 90,
        price: 180,
        color: "#8B5CF6",
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-consultation-001" },
      update: {},
      create: {
        id: "svc-consultation-001",
        businessId: DEMO_BUSINESS_ID,
        name: "ייעוץ התנהגותי",
        type: "consultation",
        duration: 45,
        price: 200,
        color: "#06B6D4",
      },
    }),
  ])
  console.log("✓ Services:", services.length)

  // Create demo customers
  const customer1 = await prisma.customer.upsert({
    where: { id: "cust-001" },
    update: {},
    create: {
      id: "cust-001",
      businessId: DEMO_BUSINESS_ID,
      name: "ישראל ישראלי",
      phone: "050-1234567",
      email: "israel@example.com",
      address: "רחוב הרצל 1, תל אביב",
      tags: JSON.stringify(["כלב", "לקוח קבוע"]),
      source: "referral",
      notes: "לקוח מצוין, מגיע בזמן",
    },
  })

  const customer2 = await prisma.customer.upsert({
    where: { id: "cust-002" },
    update: {},
    create: {
      id: "cust-002",
      businessId: DEMO_BUSINESS_ID,
      name: "רחל כהן",
      phone: "052-9876543",
      email: "rachel@example.com",
      tags: JSON.stringify(["חתול", "חדש"]),
      source: "instagram",
    },
  })
  console.log("✓ Customers: 2")

  // Timeline events for customer creation
  await prisma.timelineEvent.upsert({
    where: { id: "tl-cust-001-created" },
    update: {},
    create: {
      id: "tl-cust-001-created",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      type: "customer_created",
      description: "לקוח נוצר במערכת",
    },
  })

  await prisma.timelineEvent.upsert({
    where: { id: "tl-cust-002-created" },
    update: {},
    create: {
      id: "tl-cust-002-created",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-002",
      type: "customer_created",
      description: "לקוח נוצר במערכת",
    },
  })

  // Create demo pets
  const pet1 = await prisma.pet.upsert({
    where: { id: "pet-001" },
    update: {},
    create: {
      id: "pet-001",
      customerId: "cust-001",
      name: "רקס",
      species: "dog",
      breed: "גולדן רטריבר",
      gender: "male",
      weight: 32.5,
      medicalNotes: "מחוסן, מסורס",
      behaviorNotes: "ידידותי מאוד, אוהב ילדים",
    },
  })

  const pet2 = await prisma.pet.upsert({
    where: { id: "pet-002" },
    update: {},
    create: {
      id: "pet-002",
      customerId: "cust-001",
      name: "בלה",
      species: "dog",
      breed: "לברדור",
      gender: "female",
      weight: 28.0,
      foodNotes: "אוכל רק Royal Canin",
    },
  })

  const pet3 = await prisma.pet.upsert({
    where: { id: "pet-003" },
    update: {},
    create: {
      id: "pet-003",
      customerId: "cust-002",
      name: "נינה",
      species: "cat",
      breed: "פרסי",
      gender: "female",
      weight: 4.2,
      medicalNotes: "אלרגית לדגים",
    },
  })
  console.log("✓ Pets: 3")

  // Timeline for pets added
  await prisma.timelineEvent.upsert({
    where: { id: "tl-pet-001-added" },
    update: {},
    create: {
      id: "tl-pet-001-added",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      type: "pet_added",
      description: "חיית מחמד חדשה נוספה: רקס (כלב)",
    },
  })

  await prisma.timelineEvent.upsert({
    where: { id: "tl-pet-002-added" },
    update: {},
    create: {
      id: "tl-pet-002-added",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      type: "pet_added",
      description: "חיית מחמד חדשה נוספה: בלה (כלב)",
    },
  })

  // Create demo appointments
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 3)

  await prisma.appointment.upsert({
    where: { id: "apt-001" },
    update: {},
    create: {
      id: "apt-001",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      petId: "pet-001",
      serviceId: "svc-training-001",
      date: tomorrow,
      startTime: "10:00",
      endTime: "11:00",
      status: "scheduled",
      notes: "המשך שיעור 5",
    },
  })

  await prisma.appointment.upsert({
    where: { id: "apt-002" },
    update: {},
    create: {
      id: "apt-002",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      petId: "pet-002",
      serviceId: "svc-grooming-001",
      date: yesterday,
      startTime: "14:00",
      endTime: "15:30",
      status: "completed",
    },
  })

  await prisma.appointment.upsert({
    where: { id: "apt-003" },
    update: {},
    create: {
      id: "apt-003",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-002",
      petId: "pet-003",
      serviceId: "svc-consultation-001",
      date: tomorrow,
      startTime: "16:00",
      endTime: "16:45",
      status: "scheduled",
    },
  })
  console.log("✓ Appointments: 3")

  // ─── Operational Tasks ───────────────────────────────────────────────────

  // Clear old tasks first (schema changed)
  await prisma.taskAuditLog.deleteMany({})
  await prisma.task.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } })

  const todayStr = now.toISOString().split("T")[0]
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split("T")[0]
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const taskSeeds = [
    // Today - boarding
    { id: "task-001", title: "הגעת מקס לפנסיון - צ'ק-אין", category: "BOARDING", priority: "HIGH", dueDate: todayStr, relatedEntityType: "DOG", relatedEntityId: "pet-001" },
    { id: "task-002", title: "הכנת חדר 3 לאורח חדש", category: "BOARDING", priority: "MEDIUM", dueDate: todayStr },
    // Today - feeding
    { id: "task-003", title: "האכלת בוקר - כל כלבי הפנסיון", category: "FEEDING", priority: "HIGH", dueDate: todayStr },
    { id: "task-004", title: "האכלת ערב - כל כלבי הפנסיון", category: "FEEDING", priority: "HIGH", dueDate: todayStr },
    // Today - medication
    { id: "task-005", title: "תרופת קרציות לרקסי", category: "MEDICATION", priority: "HIGH", dueDate: todayStr, relatedEntityType: "DOG", relatedEntityId: "pet-001", description: "Nexgard - טבליה אחת" },
    // Today - training
    { id: "task-006", title: "שיעורי בית - תרגול ישיבה עם מילו", category: "TRAINING", priority: "MEDIUM", dueDate: todayStr, relatedEntityType: "DOG", relatedEntityId: "pet-002" },
    // Today - leads
    { id: "task-007", title: "להתקשר לליד חדש - דנה כהן", category: "LEADS", priority: "HIGH", dueDate: todayStr },
    { id: "task-008", title: "לשלוח הצעת מחיר לאילוף", category: "LEADS", priority: "MEDIUM", dueDate: todayStr },
    // Today - health
    { id: "task-009", title: "בדיקת חיסונים - רקסי", category: "HEALTH", priority: "HIGH", dueDate: todayStr, relatedEntityType: "DOG", relatedEntityId: "pet-001" },
    // Today - general
    { id: "task-010", title: "להזמין מזון לפנסיון", category: "GENERAL", priority: "MEDIUM", dueDate: todayStr },
    // Overdue (yesterday)
    { id: "task-011", title: "לעדכן לקוח על סטטוס אילוף", category: "TRAINING", priority: "HIGH", dueDate: yesterdayStr, relatedEntityType: "CUSTOMER", relatedEntityId: "cust-001" },
    { id: "task-012", title: "לסדר ציוד אילוף", category: "GENERAL", priority: "LOW", dueDate: yesterdayStr },
    // Tomorrow
    { id: "task-013", title: "שחרור מקס מהפנסיון", category: "BOARDING", priority: "HIGH", dueDate: tomorrowStr, relatedEntityType: "DOG", relatedEntityId: "pet-001" },
    { id: "task-014", title: "שיעור אילוף קבוצתי - גורים", category: "TRAINING", priority: "MEDIUM", dueDate: tomorrowStr },
    // Completed
    { id: "task-015", title: "חיסון כלבת - מילו", category: "HEALTH", priority: "HIGH", dueDate: yesterdayStr, status: "COMPLETED", relatedEntityType: "DOG", relatedEntityId: "pet-002" },
  ]

  for (const seed of taskSeeds) {
    await prisma.task.upsert({
      where: { id: seed.id },
      update: {},
      create: {
        id: seed.id,
        businessId: DEMO_BUSINESS_ID,
        title: seed.title,
        description: seed.description || null,
        category: seed.category,
        priority: seed.priority,
        status: seed.status || "OPEN",
        dueDate: seed.dueDate ? new Date(seed.dueDate + "T00:00:00") : null,
        relatedEntityType: seed.relatedEntityType || null,
        relatedEntityId: seed.relatedEntityId || null,
        completedAt: seed.status === "COMPLETED" ? new Date() : null,
      },
    })
  }
  console.log("✓ Operational Tasks:", taskSeeds.length)

  // ─── Task Templates ─────────────────────────────────────────────────────

  await prisma.taskTemplate.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } })

  const templateSeeds = [
    { id: "tpl-001", name: "האכלת בוקר", defaultCategory: "FEEDING", defaultPriority: "HIGH", defaultTitleTemplate: "האכלת בוקר - כל כלבי הפנסיון" },
    { id: "tpl-002", name: "האכלת ערב", defaultCategory: "FEEDING", defaultPriority: "HIGH", defaultTitleTemplate: "האכלת ערב - כל כלבי הפנסיון" },
    { id: "tpl-003", name: "תרופת קרציות", defaultCategory: "MEDICATION", defaultPriority: "HIGH", defaultTitleTemplate: "תרופת קרציות", relatedEntityType: "DOG" },
    { id: "tpl-004", name: "חיסון שנתי", defaultCategory: "HEALTH", defaultPriority: "HIGH", defaultTitleTemplate: "חיסון שנתי", relatedEntityType: "DOG" },
    { id: "tpl-005", name: "מעקב ליד", defaultCategory: "LEADS", defaultPriority: "MEDIUM", defaultTitleTemplate: "מעקב ליד", relatedEntityType: "LEAD" },
  ]

  for (const tpl of templateSeeds) {
    await prisma.taskTemplate.upsert({
      where: { id: tpl.id },
      update: {},
      create: {
        id: tpl.id,
        businessId: DEMO_BUSINESS_ID,
        name: tpl.name,
        defaultCategory: tpl.defaultCategory,
        defaultPriority: tpl.defaultPriority,
        defaultTitleTemplate: tpl.defaultTitleTemplate,
        relatedEntityType: tpl.relatedEntityType || null,
      },
    })
  }
  console.log("✓ Task Templates:", templateSeeds.length)

  // ─── Recurrence Rule (daily feeding) ──────────────────────────────────

  await prisma.taskRecurrenceRule.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } })

  await prisma.taskRecurrenceRule.upsert({
    where: { id: "rec-001" },
    update: {},
    create: {
      id: "rec-001",
      businessId: DEMO_BUSINESS_ID,
      templateId: "tpl-001",
      rrule: "FREQ=DAILY;INTERVAL=1",
      startAt: new Date(todayStr + "T06:00:00"),
      isActive: true,
    },
  })

  await prisma.taskRecurrenceRule.upsert({
    where: { id: "rec-002" },
    update: {},
    create: {
      id: "rec-002",
      businessId: DEMO_BUSINESS_ID,
      templateId: "tpl-002",
      rrule: "FREQ=DAILY;INTERVAL=1",
      startAt: new Date(todayStr + "T17:00:00"),
      isActive: true,
    },
  })
  console.log("✓ Recurrence Rules: 2")

  // Create demo payment (pending)
  await prisma.payment.upsert({
    where: { id: "pay-001" },
    update: {},
    create: {
      id: "pay-001",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      appointmentId: "apt-002",
      amount: 180,
      method: "bit",
      status: "pending",
    },
  })

  await prisma.payment.upsert({
    where: { id: "pay-002" },
    update: {},
    create: {
      id: "pay-002",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      amount: 250,
      method: "cash",
      status: "paid",
      paidAt: yesterday,
    },
  })
  console.log("✓ Payments: 2")

  // ─── Training Group demo data ───
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const twoWeeks = new Date(now)
  twoWeeks.setDate(twoWeeks.getDate() + 14)
  const threeWeeks = new Date(now)
  threeWeeks.setDate(threeWeeks.getDate() + 21)

  // Create a training group
  const group1 = await prisma.trainingGroup.upsert({
    where: { id: "tg-001" },
    update: {},
    create: {
      id: "tg-001",
      businessId: DEMO_BUSINESS_ID,
      name: "כיתת גורים - מחזור 3",
      groupType: "PUPPY_CLASS",
      location: "פארק הירקון, תל אביב",
      defaultDayOfWeek: 2, // Tuesday
      defaultTime: "10:00",
      reminderEnabled: true,
      reminderLeadHours: 48,
      reminderSameDay: true,
      maxParticipants: 6,
      notes: "מחזור שלישי, מתחילים מציות בסיסי",
    },
  })

  const group2 = await prisma.trainingGroup.upsert({
    where: { id: "tg-002" },
    update: {},
    create: {
      id: "tg-002",
      businessId: DEMO_BUSINESS_ID,
      name: "קבוצת תגובתיות",
      groupType: "REACTIVITY",
      location: "מרכז אילוף פטרה",
      defaultDayOfWeek: 4, // Thursday
      defaultTime: "18:00",
      reminderEnabled: true,
      reminderLeadHours: 24,
      reminderSameDay: false,
      maxParticipants: 4,
    },
  })
  console.log("✓ Training Groups: 2")

  // Create sessions for group 1
  const session1Time = new Date(nextWeek)
  session1Time.setHours(10, 0, 0, 0)
  const session2Time = new Date(twoWeeks)
  session2Time.setHours(10, 0, 0, 0)
  const session3Time = new Date(threeWeeks)
  session3Time.setHours(10, 0, 0, 0)

  await prisma.trainingGroupSession.upsert({
    where: { id: "tgs-001" },
    update: {},
    create: {
      id: "tgs-001",
      trainingGroupId: "tg-001",
      sessionDatetime: session1Time,
      sessionNumber: 1,
      status: "SCHEDULED",
      notes: "מפגש היכרות, ציות בסיסי",
    },
  })

  await prisma.trainingGroupSession.upsert({
    where: { id: "tgs-002" },
    update: {},
    create: {
      id: "tgs-002",
      trainingGroupId: "tg-001",
      sessionDatetime: session2Time,
      sessionNumber: 2,
      status: "SCHEDULED",
      notes: "הליכה ברצועה, שב ושכב",
    },
  })

  await prisma.trainingGroupSession.upsert({
    where: { id: "tgs-003" },
    update: {},
    create: {
      id: "tgs-003",
      trainingGroupId: "tg-001",
      sessionDatetime: session3Time,
      sessionNumber: 3,
      status: "SCHEDULED",
    },
  })

  // Session for group 2
  const session4Time = new Date(nextWeek)
  session4Time.setDate(session4Time.getDate() + 2) // +2 days
  session4Time.setHours(18, 0, 0, 0)

  await prisma.trainingGroupSession.upsert({
    where: { id: "tgs-004" },
    update: {},
    create: {
      id: "tgs-004",
      trainingGroupId: "tg-002",
      sessionDatetime: session4Time,
      sessionNumber: 1,
      status: "SCHEDULED",
    },
  })
  console.log("✓ Training Group Sessions: 4")

  // Add participants
  await prisma.trainingGroupParticipant.upsert({
    where: { id: "tgp-001" },
    update: {},
    create: {
      id: "tgp-001",
      trainingGroupId: "tg-001",
      dogId: "pet-001",
      customerId: "cust-001",
      status: "ACTIVE",
    },
  })

  await prisma.trainingGroupParticipant.upsert({
    where: { id: "tgp-002" },
    update: {},
    create: {
      id: "tgp-002",
      trainingGroupId: "tg-001",
      dogId: "pet-002",
      customerId: "cust-001",
      status: "ACTIVE",
    },
  })

  await prisma.trainingGroupParticipant.upsert({
    where: { id: "tgp-003" },
    update: {},
    create: {
      id: "tgp-003",
      trainingGroupId: "tg-002",
      dogId: "pet-001",
      customerId: "cust-001",
      status: "ACTIVE",
    },
  })
  console.log("✓ Training Group Participants: 3")

  // Create a scheduled message template reminder
  await prisma.scheduledMessage.upsert({
    where: { id: "sm-001" },
    update: {},
    create: {
      id: "sm-001",
      businessId: DEMO_BUSINESS_ID,
      customerId: "cust-001",
      channel: "whatsapp",
      templateKey: "GROUP_SESSION_REMINDER_48H",
      payloadJson: JSON.stringify({
        customer_name: "ישראל ישראלי",
        dog_name: "רקס",
        group_name: "כיתת גורים - מחזור 3",
        session_datetime: session1Time.toLocaleString("he-IL"),
        location: "פארק הירקון, תל אביב",
      }),
      sendAt: new Date(session1Time.getTime() - 48 * 60 * 60 * 1000),
      status: "PENDING",
      relatedEntityType: "GROUP_SESSION",
      relatedEntityId: "tgs-001",
    },
  })
  console.log("✓ Scheduled Messages: 1")

  // ─── Individual Training Program demo data ───
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // Training program for Rex (pet-001)
  await prisma.trainingProgram.upsert({
    where: { id: "tp-001" },
    update: {},
    create: {
      id: "tp-001",
      businessId: DEMO_BUSINESS_ID,
      dogId: "pet-001",
      customerId: "cust-001",
      name: "ציות בסיסי - רקס",
      programType: "BASIC_OBEDIENCE",
      status: "ACTIVE",
      startDate: twoWeeksAgo,
      totalSessions: 10,
      notes: "רקס מאוד נלהב, צריך לעבוד על ריכוז",
    },
  })

  // Training program for Bella (pet-002)
  await prisma.trainingProgram.upsert({
    where: { id: "tp-002" },
    update: {},
    create: {
      id: "tp-002",
      businessId: DEMO_BUSINESS_ID,
      dogId: "pet-002",
      customerId: "cust-001",
      name: "תגובתיות - בלה",
      programType: "REACTIVITY",
      status: "ACTIVE",
      startDate: oneWeekAgo,
      totalSessions: 8,
      notes: "בלה תגובתית לכלבים אחרים, נדרשת עבודה הדרגתית",
    },
  })
  console.log("✓ Training Programs: 2")

  // Goals for Rex's program
  await prisma.trainingGoal.upsert({
    where: { id: "tg-goal-001" },
    update: {},
    create: {
      id: "tg-goal-001",
      trainingProgramId: "tp-001",
      title: "שב - ציות מיידי",
      description: "רקס צריך לשבת מיד כשמצווים, בכל סביבה",
      status: "IN_PROGRESS",
      progressPercent: 60,
      sortOrder: 0,
    },
  })

  await prisma.trainingGoal.upsert({
    where: { id: "tg-goal-002" },
    update: {},
    create: {
      id: "tg-goal-002",
      trainingProgramId: "tp-001",
      title: "הליכה ברצועה רפויה",
      description: "הליכה ללא משיכה, 15 דקות ברצף",
      status: "IN_PROGRESS",
      progressPercent: 30,
      sortOrder: 1,
    },
  })

  await prisma.trainingGoal.upsert({
    where: { id: "tg-goal-003" },
    update: {},
    create: {
      id: "tg-goal-003",
      trainingProgramId: "tp-001",
      title: "שכב והישאר",
      description: "שכב במקום לפחות 30 שניות",
      status: "NOT_STARTED",
      progressPercent: 0,
      sortOrder: 2,
    },
  })

  // Goals for Bella's program
  await prisma.trainingGoal.upsert({
    where: { id: "tg-goal-004" },
    update: {},
    create: {
      id: "tg-goal-004",
      trainingProgramId: "tp-002",
      title: "התעלמות מכלבים חולפים",
      description: "בלה תתעלם מכלבים שעוברים ברחוב במרחק 10 מטר",
      status: "IN_PROGRESS",
      progressPercent: 20,
      sortOrder: 0,
    },
  })

  await prisma.trainingGoal.upsert({
    where: { id: "tg-goal-005" },
    update: {},
    create: {
      id: "tg-goal-005",
      trainingProgramId: "tp-002",
      title: "קשר עין על פקודה",
      description: "בלה תשמור קשר עין עם המאלף 5 שניות",
      status: "IN_PROGRESS",
      progressPercent: 50,
      sortOrder: 1,
    },
  })
  console.log("✓ Training Goals: 5")

  // Sessions for Rex's program
  await prisma.trainingProgramSession.upsert({
    where: { id: "tps-001" },
    update: {},
    create: {
      id: "tps-001",
      trainingProgramId: "tp-001",
      sessionNumber: 1,
      sessionDate: twoWeeksAgo,
      durationMinutes: 60,
      status: "COMPLETED",
      summary: "מפגש ראשון, עבודה על שב בסיסי וקשר עין",
      rating: 4,
    },
  })

  await prisma.trainingProgramSession.upsert({
    where: { id: "tps-002" },
    update: {},
    create: {
      id: "tps-002",
      trainingProgramId: "tp-001",
      sessionNumber: 2,
      sessionDate: oneWeekAgo,
      durationMinutes: 60,
      status: "COMPLETED",
      summary: "התקדמות יפה בשב, התחלת הליכה ברצועה",
      rating: 3,
    },
  })

  await prisma.trainingProgramSession.upsert({
    where: { id: "tps-003" },
    update: {},
    create: {
      id: "tps-003",
      trainingProgramId: "tp-001",
      sessionNumber: 3,
      sessionDate: tomorrow,
      durationMinutes: 60,
      status: "SCHEDULED",
    },
  })

  // Session for Bella's program
  await prisma.trainingProgramSession.upsert({
    where: { id: "tps-004" },
    update: {},
    create: {
      id: "tps-004",
      trainingProgramId: "tp-002",
      sessionNumber: 1,
      sessionDate: threeDaysAgo,
      durationMinutes: 45,
      status: "COMPLETED",
      summary: "אבחון ראשוני, בלה תגובתית מ-20 מטר, עבודה על קשר עין",
      rating: 3,
    },
  })

  await prisma.trainingProgramSession.upsert({
    where: { id: "tps-005" },
    update: {},
    create: {
      id: "tps-005",
      trainingProgramId: "tp-002",
      sessionNumber: 2,
      sessionDate: nextWeek,
      durationMinutes: 45,
      status: "SCHEDULED",
    },
  })
  console.log("✓ Training Program Sessions: 5")

  // Homework for Rex
  await prisma.trainingHomework.upsert({
    where: { id: "th-001" },
    update: {},
    create: {
      id: "th-001",
      trainingProgramId: "tp-001",
      title: "תרגול שב 3 פעמים ביום",
      description: "לתרגל פקודת שב 10 חזרות, 3 פעמים ביום, עם חטיף כתגמול",
      assignedDate: twoWeeksAgo,
      dueDate: oneWeekAgo,
      isCompleted: true,
      completedAt: oneWeekAgo,
      customerNotes: "עובד מצוין! רקס מגיב ב-80% מהמקרים",
    },
  })

  await prisma.trainingHomework.upsert({
    where: { id: "th-002" },
    update: {},
    create: {
      id: "th-002",
      trainingProgramId: "tp-001",
      title: "הליכה ברצועה - 10 דקות ביום",
      description: "הליכה קצרה עם רצועה רפויה, לעצור כשמושך ולהמתין",
      assignedDate: oneWeekAgo,
      dueDate: tomorrow,
      isCompleted: false,
    },
  })

  // Homework for Bella
  await prisma.trainingHomework.upsert({
    where: { id: "th-003" },
    update: {},
    create: {
      id: "th-003",
      trainingProgramId: "tp-002",
      title: "תרגול קשר עין - 5 דקות ביום",
      description: "לשבת מול בלה ולתרגל קשר עין עם חטיף, להגדיל בהדרגה ל-5 שניות",
      assignedDate: threeDaysAgo,
      dueDate: nextWeek,
      isCompleted: false,
    },
  })
  console.log("✓ Training Homework: 3")

  console.log("\n🎉 Seed completed successfully!")
  console.log(`   Business ID: ${DEMO_BUSINESS_ID}`)
  console.log(`   Customers: ישראל ישראלי (cust-001), רחל כהן (cust-002)`)
  console.log(`   Pets: רקס, בלה (cust-001), נינה (cust-002)`)
  console.log(`   Training Groups: כיתת גורים (tg-001), תגובתיות (tg-002)`)
  console.log(`   Training Programs: ציות בסיסי - רקס (tp-001), תגובתיות - בלה (tp-002)`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
