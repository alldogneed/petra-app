/**
 * seed-service-dogs.ts
 * Demo data for the Service Dogs module.
 * Run: PATH="/Users/or-rabinovich/local/node/bin:$PATH" node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed-service-dogs.ts')"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Change this to the target business ID ────────────────────────────────────
const BUSINESS_ID = "6c51668f-00e9-46b1-9ba2-ff113831a172";

// ─── Fixed IDs (stable so upsert is idempotent) ───────────────────────────────
const IDS = {
  // Customers (handlers)
  customerAmit:  "sd-cust-amit-0001",
  customerRachel:"sd-cust-rachel-002",
  customerSapir: "sd-cust-sapir-0003",

  // Pets (dogs)
  petRex:   "sd-pet-rex-00001",
  petMaya:  "sd-pet-maya-0002",
  petBruno: "sd-pet-bruno-003",
  petLuna:  "sd-pet-luna-0004",
  petKochav:"sd-pet-kochav-05",

  // Service dog profiles
  sdRex:   "sd-prof-rex-0001",
  sdMaya:  "sd-prof-maya-002",
  sdBruno: "sd-prof-bruno-03",
  sdLuna:  "sd-prof-luna-004",
  sdKochav:"sd-prof-kochav-5",

  // Recipients
  recDani:  "sd-rec-dani-0001",
  recYosi:  "sd-rec-yosi-0002",
  recMichal:"sd-rec-michal-03",
  recNoa:   "sd-rec-noa-00004",

  // Placements
  placeRexDani:  "sd-place-rex-dani",
  placeBrunoYosi:"sd-place-bruno-yo",
};

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

async function main() {
  console.log("🐕 Seeding Service Dogs demo data...\n");

  // ─── 1. Handler customers ───────────────────────────────────────────────────
  await prisma.customer.upsert({
    where: { id: IDS.customerAmit },
    update: {},
    create: { id: IDS.customerAmit, businessId: BUSINESS_ID, name: "עמית כהן", phone: "052-1111111", email: "amit@petra-sd.com", notes: "מאמן ראשי — אחראי על רקס וברונו" },
  });
  await prisma.customer.upsert({
    where: { id: IDS.customerRachel },
    update: {},
    create: { id: IDS.customerRachel, businessId: BUSINESS_ID, name: "רחל גולד", phone: "054-2222222", email: "rachel@petra-sd.com", notes: "מאמנת — אחראית על מאיה" },
  });
  await prisma.customer.upsert({
    where: { id: IDS.customerSapir },
    update: {},
    create: { id: IDS.customerSapir, businessId: BUSINESS_ID, name: "ספיר מזרחי", phone: "050-3333333", email: "sapir@petra-sd.com", notes: "מתמחה — אחראית על לונה וכוכב" },
  });
  console.log("✓ Customers (handlers) created");

  // ─── 2. Pets ────────────────────────────────────────────────────────────────
  await prisma.pet.upsert({
    where: { id: IDS.petRex },
    update: {},
    create: { id: IDS.petRex, customerId: IDS.customerAmit, name: "רקס", species: "dog", breed: "גולדן רטריבר", gender: "male", birthDate: new Date("2020-03-15"), microchip: "972000001111111", weight: 32 },
  });
  await prisma.pet.upsert({
    where: { id: IDS.petMaya },
    update: {},
    create: { id: IDS.petMaya, customerId: IDS.customerRachel, name: "מאיה", species: "dog", breed: "לברדור", gender: "female", birthDate: new Date("2022-07-20"), microchip: "972000002222222", weight: 28 },
  });
  await prisma.pet.upsert({
    where: { id: IDS.petBruno },
    update: {},
    create: { id: IDS.petBruno, customerId: IDS.customerAmit, name: "ברונו", species: "dog", breed: "רועה גרמני", gender: "male", birthDate: new Date("2021-11-05"), microchip: "972000003333333", weight: 35 },
  });
  await prisma.pet.upsert({
    where: { id: IDS.petLuna },
    update: {},
    create: { id: IDS.petLuna, customerId: IDS.customerSapir, name: "לונה", species: "dog", breed: "לברדור", gender: "female", birthDate: new Date("2023-02-10"), microchip: "972000004444444", weight: 25 },
  });
  await prisma.pet.upsert({
    where: { id: IDS.petKochav },
    update: {},
    create: { id: IDS.petKochav, customerId: IDS.customerSapir, name: "כוכב", species: "dog", breed: "בורדר קולי", gender: "male", birthDate: new Date("2024-01-18"), microchip: "972000005555555", weight: 18 },
  });
  console.log("✓ Pets created");

  // ─── 3. Service Dog Profiles ─────────────────────────────────────────────────
  // Rex — CERTIFIED
  await prisma.serviceDogProfile.upsert({
    where: { id: IDS.sdRex },
    update: {},
    create: {
      id: IDS.sdRex,
      petId: IDS.petRex,
      businessId: BUSINESS_ID,
      registrationNumber: "SD-2023-001",
      certifyingBody: "ADI Israel",
      certificationDate: daysAgo(180),
      certificationExpiry: daysFromNow(185),
      phase: "CERTIFIED",
      phaseChangedAt: daysAgo(180),
      serviceType: "PSYCHIATRIC",
      trainingStartDate: daysAgo(365),
      trainingTotalHours: 145,
      trainingTargetHours: 120,
      trainingTargetMonths: 6,
      trainingStatus: "CERTIFIED",
      isGovReportPending: false,
      idCardIsActive: true,
      idCardQrToken: "rex-qr-demo-token-001",
      notes: "כלב שירות פסיכיאטרי מוסמך. מצוין בתפקיד, ממש מחובר למטופל שלו.",
    },
  });

  // Maya — IN_TRAINING
  await prisma.serviceDogProfile.upsert({
    where: { id: IDS.sdMaya },
    update: {},
    create: {
      id: IDS.sdMaya,
      petId: IDS.petMaya,
      businessId: BUSINESS_ID,
      phase: "IN_TRAINING",
      phaseChangedAt: daysAgo(90),
      serviceType: "MOBILITY",
      trainingStartDate: daysAgo(120),
      trainingTotalHours: 68,
      trainingTargetHours: 120,
      trainingTargetMonths: 8,
      trainingStatus: "IN_PROGRESS",
      isGovReportPending: false,
      idCardIsActive: false,
      notes: "מאיה בעלת פוטנציאל גבוה מאוד. צפי להסמכה עוד כ-4 חודשים.",
    },
  });

  // Bruno — ADVANCED_TRAINING
  await prisma.serviceDogProfile.upsert({
    where: { id: IDS.sdBruno },
    update: {},
    create: {
      id: IDS.sdBruno,
      petId: IDS.petBruno,
      businessId: BUSINESS_ID,
      phase: "ADVANCED_TRAINING",
      phaseChangedAt: daysAgo(14),
      serviceType: "MOBILITY",
      trainingStartDate: daysAgo(240),
      trainingTotalHours: 98,
      trainingTargetHours: 120,
      trainingTargetMonths: 8,
      trainingStatus: "IN_PROGRESS",
      isGovReportPending: true,   // ⚠️ יש דיווח ממשלתי ממתין!
      govReportDue: daysFromNow(1),
      notes: "ברונו עלה לשלב אימון מתקדם לפני שבועיים. נמצא בתקופת ניסיון עם יוסי.",
    },
  });

  // Luna — SELECTION
  await prisma.serviceDogProfile.upsert({
    where: { id: IDS.sdLuna },
    update: {},
    create: {
      id: IDS.sdLuna,
      petId: IDS.petLuna,
      businessId: BUSINESS_ID,
      phase: "SELECTION",
      phaseChangedAt: daysAgo(30),
      serviceType: "GUIDE",
      trainingTotalHours: 0,
      trainingTargetHours: 120,
      trainingTargetMonths: 10,
      trainingStatus: "NOT_STARTED",
      isGovReportPending: false,
      notes: "לונה עברה את מבחני הבחירה הראשוניים בהצלחה. ממתינה לתחילת אימון.",
    },
  });

  // Kochav — PUPPY
  await prisma.serviceDogProfile.upsert({
    where: { id: IDS.sdKochav },
    update: {},
    create: {
      id: IDS.sdKochav,
      petId: IDS.petKochav,
      businessId: BUSINESS_ID,
      phase: "PUPPY",
      phaseChangedAt: daysAgo(5),
      serviceType: "ALERT",
      trainingTotalHours: 0,
      trainingTargetHours: 150,
      trainingTargetMonths: 12,
      trainingStatus: "NOT_STARTED",
      isGovReportPending: false,
      notes: "גור צעיר עם אינסטינקטים מצוינים. פוטנציאל לכלב התרעה לאפילפסיה.",
    },
  });
  console.log("✓ Service Dog Profiles created");

  // ─── 4. Medical Protocols ────────────────────────────────────────────────────
  const protocols: any[] = [
    // Rex (CERTIFIED) — רובם הושלמו
    { id: "sdmed-rex-01", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "RABIES_BOOSTER",  protocolLabel: "חיסון כלבת מחזורי",     category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(30),  expiryDate: daysFromNow(335) },
    { id: "sdmed-rex-02", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "DHPP_BOOSTER",    protocolLabel: "חיסון משושה מחזורי",    category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(30),  expiryDate: daysFromNow(335) },
    { id: "sdmed-rex-03", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "DEWORMING",       protocolLabel: "תילוע",                 category: "PARASITE",      status: "COMPLETED", completedDate: daysAgo(45),  expiryDate: daysFromNow(45) },
    { id: "sdmed-rex-04", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "FLEA_TICK",       protocolLabel: "טיפול פרעושים וקרציות", category: "PARASITE",      status: "COMPLETED", completedDate: daysAgo(20),  expiryDate: daysFromNow(40) },
    { id: "sdmed-rex-05", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "VET_EXAM",        protocolLabel: "בדיקה וטרינרית",        category: "HEALTH_CHECK",  status: "COMPLETED", completedDate: daysAgo(60),  expiryDate: daysFromNow(305) },
    { id: "sdmed-rex-06", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "HEALTH_CERT",     protocolLabel: "תעודת בריאות",          category: "VET_CLEARANCE", status: "COMPLETED", completedDate: daysAgo(180), expiryDate: daysFromNow(185) },
    { id: "sdmed-rex-07", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, phase: "CERTIFIED", protocolKey: "ANNUAL_RECERT",   protocolLabel: "הסמכה מחדש שנתית",      category: "VET_CLEARANCE", status: "PENDING",   dueDate: daysFromNow(185) },

    // Maya (IN_TRAINING) — חלקי
    { id: "sdmed-maya-01", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "RABIES_BOOSTER", protocolLabel: "חיסון כלבת מחזורי",   category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(60), expiryDate: daysFromNow(305) },
    { id: "sdmed-maya-02", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "DHPP_BOOSTER",   protocolLabel: "חיסון משושה מחזורי",  category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(60), expiryDate: daysFromNow(305) },
    { id: "sdmed-maya-03", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "LEPTOSPIROSIS",  protocolLabel: "לפטוספירוזיס",        category: "VACCINATION",   status: "PENDING",   dueDate: daysFromNow(14) },
    { id: "sdmed-maya-04", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "BORDETELLA",     protocolLabel: "בורדטלה",              category: "VACCINATION",   status: "PENDING",   dueDate: daysFromNow(14) },
    { id: "sdmed-maya-05", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "DEWORMING",      protocolLabel: "תילוע",               category: "PARASITE",      status: "COMPLETED", completedDate: daysAgo(30), expiryDate: daysFromNow(60) },
    { id: "sdmed-maya-06", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "FLEA_TICK",      protocolLabel: "טיפול פרעושים וקרציות",category: "PARASITE",     status: "OVERDUE",   dueDate: daysAgo(5) },
    { id: "sdmed-maya-07", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "VET_EXAM",       protocolLabel: "בדיקה וטרינרית",       category: "HEALTH_CHECK",  status: "COMPLETED", completedDate: daysAgo(50), expiryDate: daysFromNow(315) },
    { id: "sdmed-maya-08", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, phase: "IN_TRAINING", protocolKey: "VET_CLEARANCE",  protocolLabel: "אישור וטרינרי להמשך",  category: "VET_CLEARANCE", status: "PENDING",   dueDate: daysFromNow(30) },

    // Bruno (ADVANCED_TRAINING) — כמעט מלא
    { id: "sdmed-bruno-01", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, phase: "ADVANCED_TRAINING", protocolKey: "RABIES_BOOSTER", protocolLabel: "חיסון כלבת מחזורי",   category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(30), expiryDate: daysFromNow(335) },
    { id: "sdmed-bruno-02", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, phase: "ADVANCED_TRAINING", protocolKey: "DHPP_BOOSTER",   protocolLabel: "חיסון משושה מחזורי",  category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(30), expiryDate: daysFromNow(335) },
    { id: "sdmed-bruno-03", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, phase: "ADVANCED_TRAINING", protocolKey: "DEWORMING",      protocolLabel: "תילוע",               category: "PARASITE",      status: "COMPLETED", completedDate: daysAgo(20), expiryDate: daysFromNow(70) },
    { id: "sdmed-bruno-04", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, phase: "ADVANCED_TRAINING", protocolKey: "FLEA_TICK",      protocolLabel: "טיפול פרעושים וקרציות",category: "PARASITE",     status: "COMPLETED", completedDate: daysAgo(15), expiryDate: daysFromNow(45) },
    { id: "sdmed-bruno-05", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, phase: "ADVANCED_TRAINING", protocolKey: "VET_CLEARANCE",  protocolLabel: "אישור וטרינרי להמשך",  category: "VET_CLEARANCE", status: "COMPLETED", completedDate: daysAgo(14), expiryDate: daysFromNow(351) },
    { id: "sdmed-bruno-06", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, phase: "ADVANCED_TRAINING", protocolKey: "HEALTH_CERT",    protocolLabel: "תעודת בריאות",          category: "VET_CLEARANCE", status: "PENDING",   dueDate: daysFromNow(30) },

    // Luna (SELECTION) — מרבית ממתינות
    { id: "sdmed-luna-01", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "RABIES_PRIMARY",   protocolLabel: "חיסון כלבת ראשוני",    category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(25), expiryDate: daysFromNow(340) },
    { id: "sdmed-luna-02", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "DHPP",             protocolLabel: "חיסון משושה",           category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(25), expiryDate: daysFromNow(340) },
    { id: "sdmed-luna-03", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "DEWORMING",        protocolLabel: "תילוע",                 category: "PARASITE",      status: "PENDING",   dueDate: daysFromNow(7) },
    { id: "sdmed-luna-04", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "FLEA_TICK",        protocolLabel: "טיפול פרעושים וקרציות", category: "PARASITE",      status: "PENDING",   dueDate: daysFromNow(7) },
    { id: "sdmed-luna-05", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "VET_EXAM",         protocolLabel: "בדיקה וטרינרית",        category: "HEALTH_CHECK",  status: "PENDING",   dueDate: daysFromNow(10) },
    { id: "sdmed-luna-06", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "TEMPERAMENT_EVAL", protocolLabel: "הערכת מזג",             category: "BEHAVIOR_EVAL", status: "COMPLETED", completedDate: daysAgo(20) },
    { id: "sdmed-luna-07", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "HIP_XRAY",         protocolLabel: "צילום אגן",             category: "HEALTH_CHECK",  status: "PENDING",   dueDate: daysFromNow(21) },
    { id: "sdmed-luna-08", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "EYE_EXAM",         protocolLabel: "בדיקת עיניים",          category: "HEALTH_CHECK",  status: "PENDING",   dueDate: daysFromNow(21) },
    { id: "sdmed-luna-09", serviceDogId: IDS.sdLuna, businessId: BUSINESS_ID, phase: "SELECTION", protocolKey: "VET_CLEARANCE",    protocolLabel: "אישור וטרינרי להמשך",   category: "VET_CLEARANCE", status: "PENDING",   dueDate: daysFromNow(30) },

    // Kochav (PUPPY) — רק 1-2
    { id: "sdmed-kochav-01", serviceDogId: IDS.sdKochav, businessId: BUSINESS_ID, phase: "PUPPY", protocolKey: "DHPP_PRIMARY",    protocolLabel: "חיסון משושה ראשוני", category: "VACCINATION",   status: "COMPLETED", completedDate: daysAgo(5),  expiryDate: daysFromNow(25) },
    { id: "sdmed-kochav-02", serviceDogId: IDS.sdKochav, businessId: BUSINESS_ID, phase: "PUPPY", protocolKey: "DEWORMING",       protocolLabel: "תילוע",               category: "PARASITE",      status: "PENDING",   dueDate: daysFromNow(10) },
    { id: "sdmed-kochav-03", serviceDogId: IDS.sdKochav, businessId: BUSINESS_ID, phase: "PUPPY", protocolKey: "FLEA_TICK",       protocolLabel: "טיפול פרעושים וקרציות",category: "PARASITE",     status: "PENDING",   dueDate: daysFromNow(14) },
    { id: "sdmed-kochav-04", serviceDogId: IDS.sdKochav, businessId: BUSINESS_ID, phase: "PUPPY", protocolKey: "VET_EXAM",        protocolLabel: "בדיקה וטרינרית",       category: "HEALTH_CHECK",  status: "PENDING",   dueDate: daysFromNow(14) },
    { id: "sdmed-kochav-05", serviceDogId: IDS.sdKochav, businessId: BUSINESS_ID, phase: "PUPPY", protocolKey: "TEMPERAMENT_EVAL",protocolLabel: "הערכת מזג",            category: "BEHAVIOR_EVAL", status: "PENDING",   dueDate: daysFromNow(30) },
  ];

  for (const p of protocols) {
    await prisma.serviceDogMedicalProtocol.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }
  console.log("✓ Medical protocols created");

  // ─── 5. Training Logs ────────────────────────────────────────────────────────
  const trainingLogs: any[] = [
    // Rex — 8 sessions, 145 total hours (CERTIFIED)
    { id: "sdtrain-rex-01", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(350), durationMinutes: 90,  trainerName: "עמית כהן",  location: "גן לאומי",    skillCategories: JSON.stringify(["BASIC_OBEDIENCE","SOCIALIZATION"]),   status: "COMPLETED", rating: 5, notes: "התחלנו עם משמעת בסיסית — מצוין",              cumulativeHours: 1.5 },
    { id: "sdtrain-rex-02", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(320), durationMinutes: 120, trainerName: "עמית כהן",  location: "מרכז קניות",  skillCategories: JSON.stringify(["PUBLIC_ACCESS","DISTRACTION"]),       status: "COMPLETED", rating: 4, notes: "הסחות בציבור — קשה אבל התקדם",                 cumulativeHours: 3.5 },
    { id: "sdtrain-rex-03", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(290), durationMinutes: 150, trainerName: "עמית כהן",  location: "בית חולים",   skillCategories: JSON.stringify(["PUBLIC_ACCESS","TASK_TRAINING"]),     status: "COMPLETED", rating: 5, notes: "ביקור בית חולים — התנהג מצוין",                cumulativeHours: 6 },
    { id: "sdtrain-rex-04", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(260), durationMinutes: 180, trainerName: "עמית כהן",  location: "תחנת רכבת",   skillCategories: JSON.stringify(["TASK_TRAINING","HANDLER_SKILLS"]),    status: "COMPLETED", rating: 5, notes: "אימון משימה פסיכיאטרית — מרשים",               cumulativeHours: 9 },
    { id: "sdtrain-rex-05", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(230), durationMinutes: 210, trainerName: "עמית כהן",  location: "קמפוס אוניב", skillCategories: JSON.stringify(["SOCIALIZATION","DISTRACTION","TASK_TRAINING"]), status: "COMPLETED", rating: 5, notes: "סביבה עמוסה — עמד בכל האתגרים",      cumulativeHours: 12.5 },
    { id: "sdtrain-rex-06", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(200), durationMinutes: 240, trainerName: "עמית כהן",  location: "אזור מגורים", skillCategories: JSON.stringify(["RECALL","POSITIONING","HANDLER_SKILLS"]), status: "COMPLETED", rating: 5, notes: "קריאה וזימון — מושלם",                        cumulativeHours: 16.5 },
    { id: "sdtrain-rex-07", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(195), durationMinutes: 480, trainerName: "עמית כהן",  location: "מרכז ADI",    skillCategories: JSON.stringify(["PUBLIC_ACCESS","TASK_TRAINING","HANDLER_SKILLS","DISTRACTION"]), status: "COMPLETED", rating: 5, notes: "בחינת ביניים ADI — עבר בהצלחה", cumulativeHours: 24.5 },
    { id: "sdtrain-rex-08", serviceDogId: IDS.sdRex, businessId: BUSINESS_ID, sessionDate: daysAgo(185), durationMinutes: 7230, trainerName: "ועדת ADI", location: "מרכז הסמכה",  skillCategories: JSON.stringify(["PUBLIC_ACCESS","TASK_TRAINING","SOCIALIZATION","DISTRACTION","RECALL","POSITIONING","HANDLER_SKILLS","BASIC_OBEDIENCE"]), status: "COMPLETED", rating: 5, notes: "בחינת הסמכה ADI סופית — עבר! מוסמך רשמית", cumulativeHours: 145 },

    // Maya — 6 sessions, 68 total hours (IN_TRAINING)
    { id: "sdtrain-maya-01", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, sessionDate: daysAgo(110), durationMinutes: 90,  trainerName: "רחל גולד", location: "פארק",         skillCategories: JSON.stringify(["BASIC_OBEDIENCE"]),              status: "COMPLETED", rating: 4, notes: "מאיה חיובית מאוד — ספגה הכל מהר",    cumulativeHours: 1.5 },
    { id: "sdtrain-maya-02", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, sessionDate: daysAgo(95),  durationMinutes: 120, trainerName: "רחל גולד", location: "מרכז מסחרי",   skillCategories: JSON.stringify(["PUBLIC_ACCESS","SOCIALIZATION"]),status: "COMPLETED", rating: 4, notes: "גישה לציבור — קצת נסערת מרעש",         cumulativeHours: 3.5 },
    { id: "sdtrain-maya-03", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, sessionDate: daysAgo(80),  durationMinutes: 180, trainerName: "רחל גולד", location: "בית חולים",    skillCategories: JSON.stringify(["PUBLIC_ACCESS","TASK_TRAINING"]),status: "COMPLETED", rating: 3, notes: "בית חולים — קשה לה עם הריחות. נחזור",  cumulativeHours: 6.5 },
    { id: "sdtrain-maya-04", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, sessionDate: daysAgo(60),  durationMinutes: 210, trainerName: "רחל גולד", location: "בית חולים",    skillCategories: JSON.stringify(["PUBLIC_ACCESS","TASK_TRAINING"]),status: "COMPLETED", rating: 4, notes: "חזרנו לבית חולים — שיפור ניכר!",       cumulativeHours: 10 },
    { id: "sdtrain-maya-05", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, sessionDate: daysAgo(40),  durationMinutes: 240, trainerName: "רחל גולד", location: "רכבת קלה",     skillCategories: JSON.stringify(["DISTRACTION","RECALL","POSITIONING"]),status: "COMPLETED", rating: 5, notes: "תחבורה ציבורית — בלטה לטובה",       cumulativeHours: 14 },
    { id: "sdtrain-maya-06", serviceDogId: IDS.sdMaya, businessId: BUSINESS_ID, sessionDate: daysAgo(15),  durationMinutes: 3240,trainerName: "רחל גולד", location: "מרכז ADI",     skillCategories: JSON.stringify(["TASK_TRAINING","HANDLER_SKILLS","PUBLIC_ACCESS"]),status: "COMPLETED", rating: 4, notes: "סימולציית בחינת ADI — 54 שעות בשבוע אימון מרוכז", cumulativeHours: 68 },

    // Bruno — 7 sessions, 98 total hours (ADVANCED_TRAINING)
    { id: "sdtrain-bruno-01", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(220), durationMinutes: 120, trainerName: "עמית כהן", location: "פארק",       skillCategories: JSON.stringify(["BASIC_OBEDIENCE","SOCIALIZATION"]),   status: "COMPLETED", rating: 4, notes: "ברונו ממוקד אבל קצת נוקשה — נעבוד על זה", cumulativeHours: 2 },
    { id: "sdtrain-bruno-02", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(200), durationMinutes: 180, trainerName: "עמית כהן", location: "מרכז מסחרי",skillCategories: JSON.stringify(["PUBLIC_ACCESS","DISTRACTION"]),       status: "COMPLETED", rating: 4, notes: "ביצועים טובים בציבור",                        cumulativeHours: 5 },
    { id: "sdtrain-bruno-03", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(170), durationMinutes: 240, trainerName: "עמית כהן", location: "בית חולים",  skillCategories: JSON.stringify(["TASK_TRAINING","PUBLIC_ACCESS"]),     status: "COMPLETED", rating: 5, notes: "מצוין בבית חולים! טבעי לגמרי",              cumulativeHours: 9 },
    { id: "sdtrain-bruno-04", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(140), durationMinutes: 480, trainerName: "עמית כהן", location: "שטח פתוח",   skillCategories: JSON.stringify(["HANDLER_SKILLS","RECALL","POSITIONING"]),status: "COMPLETED", rating: 5, notes: "כישורי מטפל — עם יוסי. חיבור מדהים",    cumulativeHours: 17 },
    { id: "sdtrain-bruno-05", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(90),  durationMinutes: 600, trainerName: "עמית כהן", location: "מרכז ADI",   skillCategories: JSON.stringify(["TASK_TRAINING","HANDLER_SKILLS"]),    status: "COMPLETED", rating: 5, notes: "אבן דרך — 40 שעות! מוכן לשלב מתקדם",      cumulativeHours: 27 },
    { id: "sdtrain-bruno-06", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(45),  durationMinutes: 1200,trainerName: "עמית כהן", location: "דירת יוסי",  skillCategories: JSON.stringify(["TASK_TRAINING","HANDLER_SKILLS","POSITIONING"]),status: "COMPLETED", rating: 5, notes: "יום אימון בבית יוסי — כימיה מושלמת!",  cumulativeHours: 47 },
    { id: "sdtrain-bruno-07", serviceDogId: IDS.sdBruno, businessId: BUSINESS_ID, sessionDate: daysAgo(20),  durationMinutes: 3060,trainerName: "עמית כהן", location: "מרכז ADI",   skillCategories: JSON.stringify(["PUBLIC_ACCESS","TASK_TRAINING","HANDLER_SKILLS","DISTRACTION","RECALL"]),status: "COMPLETED", rating: 5, notes: "51 שעות אימון מרוכז — מוכן כמעט להסמכה", cumulativeHours: 98 },
  ];

  for (const log of trainingLogs) {
    await prisma.serviceDogTrainingLog.upsert({
      where: { id: log.id },
      update: {},
      create: log,
    });
  }
  console.log("✓ Training logs created");

  // ─── 6. Recipients ───────────────────────────────────────────────────────────
  await prisma.serviceDogRecipient.upsert({
    where: { id: IDS.recDani },
    update: {},
    create: { id: IDS.recDani, businessId: BUSINESS_ID, name: "דני לוי", phone: "050-7654321", email: "dani@email.com", idNumber: "123456789", address: "תל אביב, רחוב הרצל 12", disabilityType: "PTSD", disabilityNotes: "PTSD חמור עקב שירות קרבי. זקוק לכלב פסיכיאטרי.", waitlistDate: daysAgo(400), status: "ACTIVE", notes: "דני מרוצה מאוד מרקס. שיפור דרמטי בתפקוד היומיומי." },
  });
  await prisma.serviceDogRecipient.upsert({
    where: { id: IDS.recYosi },
    update: {},
    create: { id: IDS.recYosi, businessId: BUSINESS_ID, name: "יוסי אברהם", phone: "053-9876543", email: "yosi@email.com", idNumber: "987654321", address: "חיפה, שדרות הנשיא 45", disabilityType: "AUTISM", disabilityNotes: "אוטיזם רמה 2. כלב שירות לניהול חרדה חברתית.", waitlistDate: daysAgo(300), status: "MATCHED", notes: "יוסי וברונו בתקופת ניסיון. שבועיים ראשונים מעולים." },
  });
  await prisma.serviceDogRecipient.upsert({
    where: { id: IDS.recMichal },
    update: {},
    create: { id: IDS.recMichal, businessId: BUSINESS_ID, name: "מיכל שמש", phone: "052-1122334", email: "michal@email.com", idNumber: "456789123", address: "ירושלים, רחוב יפו 88", disabilityType: "MOBILITY", disabilityNotes: "פגיעה בעמוד שדרה. זקוקה לכלב ניידות.", waitlistDate: daysAgo(120), status: "WAITLIST", notes: "מיכל ממתינה לכלב ניידות. לונה מועמדת טובה לעתיד." },
  });
  await prisma.serviceDogRecipient.upsert({
    where: { id: IDS.recNoa },
    update: {},
    create: { id: IDS.recNoa, businessId: BUSINESS_ID, name: "נועה ברק", phone: "054-4455667", email: "noa@email.com", idNumber: "789123456", address: "באר שבע, רחוב הגפן 3", disabilityType: "VISUAL", disabilityNotes: "עיוורון מלא. זקוקה לכלב נחייה.", waitlistDate: daysAgo(60), status: "WAITLIST", notes: "נועה הוסיפה לרשימת ההמתנה לאחרונה. נשאיר לה את לונה כשתוסמך." },
  });
  console.log("✓ Recipients created");

  // ─── 7. Placements ───────────────────────────────────────────────────────────
  // Rex + Dani — ACTIVE
  await prisma.serviceDogPlacement.upsert({
    where: { id: IDS.placeRexDani },
    update: {},
    create: {
      id: IDS.placeRexDani,
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdRex,
      recipientId: IDS.recDani,
      status: "ACTIVE",
      placementDate: daysAgo(170),
      trialStartDate: daysAgo(170),
      trialEndDate: daysAgo(140),
      lastCheckInAt: daysAgo(14),
      nextCheckInAt: daysFromNow(16),
      checkInNotes: "מפגש מעקב מצוין. רקס ודני מתפקדים כצוות. דני דיווח על ירידה משמעותית בפלאשבקים.",
      notes: "שיבוץ מוצלח ביותר. רקס הוכיח עצמו ככלב שירות מצוין עבור דני.",
    },
  });

  // Bruno + Yosi — TRIAL
  await prisma.serviceDogPlacement.upsert({
    where: { id: IDS.placeBrunoYosi },
    update: {},
    create: {
      id: IDS.placeBrunoYosi,
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdBruno,
      recipientId: IDS.recYosi,
      status: "TRIAL",
      placementDate: daysAgo(14),
      trialStartDate: daysAgo(14),
      trialEndDate: daysFromNow(16),
      lastCheckInAt: daysAgo(7),
      nextCheckInAt: daysFromNow(7),
      checkInNotes: "שבוע ראשון: יוסי מרוצה מאוד. ברונו מרגיע אותו בסיטואציות חברתיות.",
      notes: "תחילת תקופת ניסיון — 30 יום. עד כה תוצאות מצוינות.",
    },
  });
  console.log("✓ Placements created");

  // ─── 8. Compliance Events ────────────────────────────────────────────────────
  const complianceEvents: any[] = [
    // Rex — CERTIFIED (sent)
    {
      id: "sdcomp-rex-cert",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdRex,
      placementId: null,
      eventType: "CERTIFIED",
      eventAt: daysAgo(180),
      eventDescription: "רקס עבר הסמכת ADI רשמית ומוסמך לשירות פסיכיאטרי.",
      notificationRequired: true,
      notificationStatus: "SENT",
      notificationSentAt: daysAgo(179),
      notificationDue: daysAgo(178),
    },
    // Rex — PLACEMENT_STARTED (sent)
    {
      id: "sdcomp-rex-place",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdRex,
      placementId: IDS.placeRexDani,
      eventType: "PLACEMENT_STARTED",
      eventAt: daysAgo(170),
      eventDescription: "רקס שובץ לדני לוי — שיבוץ פעיל.",
      notificationRequired: true,
      notificationStatus: "SENT",
      notificationSentAt: daysAgo(169),
      notificationDue: daysAgo(168),
    },
    // Bruno — PHASE_CHANGED to ADVANCED_TRAINING (⚠️ PENDING — דחוף!)
    {
      id: "sdcomp-bruno-phase",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdBruno,
      placementId: null,
      eventType: "PHASE_CHANGED",
      eventAt: daysAgo(14),
      eventDescription: "ברונו עלה לשלב אימון מתקדם. נדרש דיווח ממשלתי תוך 48 שעות.",
      notificationRequired: true,
      notificationStatus: "PENDING",
      notificationDue: daysAgo(12), // כבר עבר המועד! OVERDUE
    },
    // Bruno — PLACEMENT_STARTED (TRIAL — PENDING)
    {
      id: "sdcomp-bruno-trial",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdBruno,
      placementId: IDS.placeBrunoYosi,
      eventType: "PLACEMENT_STARTED",
      eventAt: daysAgo(14),
      eventDescription: "ברונו ויוסי אברהם נכנסו לתקופת ניסיון.",
      notificationRequired: true,
      notificationStatus: "PENDING",
      notificationDue: daysAgo(12), // OVERDUE
    },
    // Rex — Training milestone (NOT_REQUIRED)
    {
      id: "sdcomp-rex-miles",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdRex,
      placementId: null,
      eventType: "TRAINING_MILESTONE",
      eventAt: daysAgo(195),
      eventDescription: "רקס השלים 120 שעות אימון — עמד ביעד ADI.",
      notificationRequired: false,
      notificationStatus: "NOT_REQUIRED",
    },
    // Maya — MEDICAL_ALERT (NOT_REQUIRED)
    {
      id: "sdcomp-maya-med",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdMaya,
      placementId: null,
      eventType: "MEDICAL_ALERT",
      eventAt: daysAgo(5),
      eventDescription: "טיפול פרעושים וקרציות פג תוקף — יש לטפל תוך שבוע.",
      notificationRequired: false,
      notificationStatus: "NOT_REQUIRED",
    },
  ];

  for (const e of complianceEvents) {
    await prisma.serviceDogComplianceEvent.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }
  console.log("✓ Compliance events created");

  // ─── 9. ID Card for Rex ──────────────────────────────────────────────────────
  await prisma.serviceDogIDCard.upsert({
    where: { id: "sdcard-rex-001" },
    update: {},
    create: {
      id: "sdcard-rex-001",
      businessId: BUSINESS_ID,
      serviceDogId: IDS.sdRex,
      qrToken: "rex-qr-demo-token-001",
      qrPayload: JSON.stringify({ token: "rex-qr-demo-token-001", dogName: "רקס", regNum: "SD-2023-001" }),
      cardDataJson: JSON.stringify({
        dogName: "רקס",
        registrationNumber: "SD-2023-001",
        breed: "גולדן רטריבר",
        serviceType: "פסיכיאטרי",
        certifyingBody: "ADI Israel",
        certificationDate: daysAgo(180).toISOString(),
        certificationExpiry: daysFromNow(185).toISOString(),
        handlerName: "עמית כהן",
        recipientName: "דני לוי",
        issuedAt: daysAgo(178).toISOString(),
      }),
      isActive: true,
      generatedAt: daysAgo(178),
      expiresAt: daysFromNow(187),
    },
  });
  console.log("✓ ID card created for Rex");

  console.log("\n✅ Service Dogs demo seed complete!\n");
  console.log("📊 Summary:");
  console.log("   🐕 5 dogs: רקס (מוסמך), מאיה (באימון), ברונו (אימון מתקדם), לונה (בחירה), כוכב (גור)");
  console.log("   👥 4 recipients: דני (פעיל), יוסי (שובץ/ניסיון), מיכל (רשימת המתנה), נועה (רשימת המתנה)");
  console.log("   🤝 2 placements: רקס+דני (ACTIVE), ברונו+יוסי (TRIAL)");
  console.log("   🏋️  21 training logs");
  console.log("   💊 35 medical protocols");
  console.log("   📋 6 compliance events (2 OVERDUE — צריך דיווח ממשלתי!)");
  console.log("   🪪  1 ID card (רקס)");
  console.log("\n⚠️  שים לב:");
  console.log("   - ברונו יש 2 אירועי ציות באיחור (OVERDUE) — נדרש דיווח ממשלתי");
  console.log("   - מאיה יש פרוטוקול רפואי פג תוקף (FLEA_TICK)");
  console.log("   - לונה חסרות בדיקות לפני תחילת אימון");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
