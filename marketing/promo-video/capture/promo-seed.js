// Rich demo data for the promo-video screenshots (local DB only).
const { PrismaClient } = require("/home/user/petra-app/node_modules/@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();
const B = "demo-business-001";
const day = (d, h = 10, m = 0) => { const x = new Date(); x.setHours(h, m, 0, 0); x.setDate(x.getDate() + d); return x; };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function main() {
  await prisma.business.update({
    where: { id: B },
    data: {
      name: "כלב וחבר – אילוף ופנסיון", slug: "kelev-vechaver", tier: "pro",
      subscriptionStatus: "active", subscriptionEndsAt: day(300), status: "active",
      phone: "050-1234567", address: "הדקל 12, כפר סבא",
      whatsappRemindersEnabled: true, whatsappReminderLeadHours: 24,
      bookingWelcomeText: "ברוכים הבאים! בחרו שירות ומועד שנוח לכם 🐾",
      boardingPricePerNight: 160,
    },
  });
  await prisma.businessUser.updateMany({ where: { businessId: B }, data: {} }).catch(() => {});

  // availability Sun–Thu 08–19, Fri 08–13
  for (let d = 0; d < 7; d++) {
    const data = { isOpen: d !== 6, openTime: "08:00", closeTime: d === 5 ? "13:00" : "19:00" };
    await prisma.availabilityRule.upsert({ where: { businessId_dayOfWeek: { businessId: B, dayOfWeek: d } }, update: data, create: { businessId: B, dayOfWeek: d, ...data } });
  }

  // services
  await prisma.service.updateMany({ where: { businessId: B }, data: { isActive: false, isPublicBookable: false } });
  const services = [
    ["svc-p1", "שיעור אילוף פרטי", "training", 60, 350, "#F97316", "אילוף ביתי מותאם אישית לכלב ולמשפחה"],
    ["svc-p2", "טיפוח מלא", "grooming", 90, 280, "#3B82F6", "רחצה, תספורת, גזירת ציפורניים וניקוי אוזניים"],
    ["svc-p3", "פנסיון", "boarding", 1440, 160, "#8B5CF6", "לינה בחדר ממוזג, טיולים ומשחק בחצר"],
    ["svc-p4", "הערכת התנהגות", "training", 45, 250, "#10B981", "פגישת היכרות ואבחון ראשוני"],
    ["svc-p5", "גן כלבים יומי", "daycare", 480, 120, "#EAB308", "יום של משחק, חברה ופעילות"],
  ];
  const svc = {};
  for (const [id, name, type, duration, price, color, description] of services) {
    const data = { name, type, duration, price, color, description, businessId: B, isActive: true, isPublicBookable: true, includesVat: true };
    svc[id] = await prisma.service.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // customers + pets
  const people = [
    ["דנה כהן", "0521234501", "רקס", "רועה גרמני", "זכר", "שחור-חום"],
    ["יוסי לוי", "0521234502", "לונה", "פודל", "נקבה", "לבן"],
    ["מיכל אברהם", "0521234503", "באדי", "גולדן רטריבר", "זכר", "זהוב"],
    ["עומר ביטון", "0521234504", "מקס", "לברדור", "זכר", "שחור"],
    ["נועה שפירא", "0521234505", "בל", "ביגל", "נקבה", "תלת-צבעי"],
    ["איתי גל", "0521234506", "צ'ילי", "שי-טסו", "זכר", "לבן-חום"],
    ["שני דהן", "0521234507", "רוקי", "האסקי סיבירי", "זכר", "אפור-לבן"],
    ["רון אלון", "0521234508", "שוקו", "קוקר ספניאל", "זכר", "חום"],
    ["טל שמעוני", "0521234509", "ג'וני", "בורדר קולי", "זכר", "שחור-לבן"],
    ["גיל קרמר", "0521234510", "נלה", "מלטז", "נקבה", "לבן"],
    ["הילה מזרחי", "0521234511", "טופי", "פומרניאן", "זכר", "כתום"],
    ["אביב מור", "0521234512", "קיירה", "דוברמן", "נקבה", "שחור"],
  ];
  const cust = [], pets = [];
  for (let i = 0; i < people.length; i++) {
    const [name, phone, pname, breed, gender, color] = people[i];
    const cid = `promo-c${i}`, pid = `promo-p${i}`;
    const c = { name, phone, phoneNorm: "972" + phone.slice(1), businessId: B, email: `client${i}@example.com`, address: "כפר סבא", idNumber: "0" + (31234567 + i * 1111), source: "manual", tags: i % 3 === 0 ? '["VIP"]' : '["קבוע"]' };
    cust.push(await prisma.customer.upsert({ where: { id: cid }, update: c, create: { id: cid, ...c } }));
    const p = { name: pname, breed, gender, color, species: "dog", customerId: cid, microchip: "9720000" + (10000000 + i * 137), birthDate: day(-(700 + i * 90)), foodBrand: "Royal Canin", foodGramsPerDay: 250 + i * 20, foodFrequency: "2" };
    pets.push(await prisma.pet.upsert({ where: { id: pid }, update: p, create: { id: pid, ...p } }));
  }

  // rooms + stays
  await prisma.boardingStay.deleteMany({ where: { businessId: B } });
  await prisma.room.updateMany({ where: { businessId: B, id: { notIn: Array.from({ length: 8 }, (_, i) => `promo-r${i}`) } }, data: { isActive: false } });
  const rooms = [["חדר 1 · VIP", "suite", 220], ["חדר 2", "standard", 160], ["חדר 3", "standard", 160], ["חדר 4", "premium", 190], ["חדר 5", "standard", 160], ["חדר 6", "standard", 160], ["חדר 7", "premium", 190], ["חדר 8", "standard", 160]];
  for (let i = 0; i < rooms.length; i++) {
    const [name, type, pricePerNight] = rooms[i];
    const r = { name, type, pricePerNight, capacity: i === 0 ? 2 : 1, status: i === 5 ? "needs_cleaning" : "available", businessId: B, isActive: true, sortOrder: i };
    await prisma.room.upsert({ where: { id: `promo-r${i}` }, update: r, create: { id: `promo-r${i}`, ...r } });
  }
  const stays = [
    [0, 2, -2, 3, "checked_in"], [0, 9, -1, 3, "checked_in"], [1, 1, -3, 2, "checked_in"], [3, 3, -1, 4, "checked_in"],
    [4, 7, -4, 1, "checked_in"], [6, 8, -2, 2, "checked_in"], [7, 4, 0, 4, "reserved"], [2, 10, 1, 5, "reserved"],
  ];
  for (const [room, p, from, to, status] of stays) {
    await prisma.boardingStay.create({ data: { businessId: B, roomId: `promo-r${room}`, petId: pets[p].id, customerId: cust[p].id, checkIn: day(from, 12), checkOut: day(to, 12), status, feedingPlan: "בוקר וערב" } });
  }

  // appointments this week
  await prisma.appointment.deleteMany({ where: { businessId: B, id: { startsWith: "promo-a" } } });
  const appts = [[0, 9, 0, "svc-p1"], [0, 11, 3, "svc-p2"], [0, 14, 5, "svc-p4"], [1, 10, 1, "svc-p2"], [1, 16, 6, "svc-p1"], [2, 9, 8, "svc-p1"], [2, 13, 11, "svc-p2"], [3, 12, 4, "svc-p4"], [3, 17, 9, "svc-p1"]];
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;
  for (let i = 0; i < appts.length; i++) {
    const [d, h, p, s] = appts[i];
    const S = svc[s];
    await prisma.appointment.create({ data: { id: `promo-a${i}`, businessId: B, customerId: cust[p].id, petId: pets[p].id, serviceId: S.id, date: day(d, 0), startTime: hh(h), endTime: hh(h + 1), status: "scheduled" } }).catch((e) => console.log("appt", e.message.split("\n").slice(-2).join(" ")));
  }

  // contracts
  const tpl = { name: "הסכם פנסיון ואילוף", fileUrl: "https://promo.public.blob.vercel-storage.com/contract.pdf", fileName: "הסכם-פנסיון-ואילוף.pdf", fileSize: 184320, businessId: B, signaturePage: 1, signatureX: 0.1, signatureY: 0.8,
    fields: JSON.stringify([{ id: "f1", type: "customerName", page: 1, x: 0.55, y: 0.3, width: 0.3, height: 0.04 }, { id: "f2", type: "petName", page: 1, x: 0.55, y: 0.36, width: 0.3, height: 0.04 }, { id: "f3", type: "signature", page: 1, x: 0.1, y: 0.8, width: 0.35, height: 0.07 }]) };
  await prisma.contractTemplate.upsert({ where: { id: "promo-tpl" }, update: tpl, create: { id: "promo-tpl", ...tpl } });
  const tpl2 = { ...tpl, name: "טופס הצהרת בריאות", fileName: "הצהרת-בריאות.pdf", fileSize: 96256 };
  await prisma.contractTemplate.upsert({ where: { id: "promo-tpl2" }, update: tpl2, create: { id: "promo-tpl2", ...tpl2 } });
  await prisma.contractRequest.deleteMany({ where: { businessId: B } });
  const reqs = [[0, "SIGNED", -3, "promo-tpl"], [0, "SIGNED", -20, "promo-tpl2"], [2, "SIGNED", -1, "promo-tpl"], [1, "PENDING", 0, "promo-tpl"], [3, "VIEWED", -1, "promo-tpl"]];
  for (const [p, status, d, t] of reqs) {
    const tok = `promo-token-${p}-${t}-${status}`;
    await prisma.contractRequest.create({ data: { businessId: B, customerId: cust[p].id, petId: pets[p].id, templateId: t, tokenHash: sha(tok), status: status === "VIEWED" ? "PENDING" : status, expiresAt: day(d + 30), sentAt: day(d, 9, 12), openedAt: status !== "PENDING" ? day(d, 9, 40) : null, signedAt: status === "SIGNED" ? day(d, 9, 44) : null, signedFileUrl: status === "SIGNED" ? "https://promo.public.blob.vercel-storage.com/signed.pdf" : null, signUrl: `http://localhost:3000/sign/${tok}`, ipAddress: status === "SIGNED" ? "79.180.12.44" : null } });
  }
  // a fresh one to open on the public signing page
  await prisma.contractRequest.create({ data: { businessId: B, customerId: cust[4].id, petId: pets[4].id, templateId: "promo-tpl", tokenHash: sha("promo-sign-live"), status: "PENDING", expiresAt: day(30), sentAt: day(0, 8), signUrl: "http://localhost:3000/sign/promo-sign-live" } });

  // MCP connection
  const owner = await prisma.platformUser.findUnique({ where: { email: "owner@petra.local" } });
  await prisma.mcpConnection.deleteMany({ where: { businessId: B } });
  const conn = await prisma.mcpConnection.create({ data: { businessId: B, name: "Claude Desktop של משה", tokenHash: sha("promo-mcp"), profile: "full", scopes: undefined, createdByUserId: owner?.id, createdByRole: "owner", expiresAt: day(170), lastUsedAt: day(0, new Date().getHours(), 0), createdAt: day(-10) } }).catch(async (e) => {
    console.log("mcp", e.message.split("\n").slice(-3).join(" "));
  });
  if (conn) {
    const tools = ["get_morning_briefing", "list_upcoming_appointments", "create_appointment", "get_boarding_daily_board", "send_reminder", "list_leads", "get_outstanding_balances"];
    await prisma.mcpAuditLog.createMany({ data: Array.from({ length: 146 }, (_, i) => ({ connectionId: conn.id, toolName: tools[i % tools.length], status: "success", createdAt: day(-(i % 10), 9 + (i % 8)) })) });
  }
  console.log("promo seed done");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
