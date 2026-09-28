// Demo BOARDING operation for the boarding reel screenshots (local DB only).
// Run after promo-seed.js (reuses its customers promo-c0..c11 / pets promo-p0..p11).
// Replaces all rooms/yards/boarding stays of demo-business-001 and adds 2 staff users.
process.env.TZ = "Asia/Jerusalem";
const { PrismaClient } = require("/home/user/petra-app/node_modules/@prisma/client");
const bcrypt = require("/home/user/petra-app/node_modules/bcryptjs");
const prisma = new PrismaClient();
const B = "demo-business-001";
const at = (d, h = 12, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x; };

// deterministic PRNG
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

async function main() {
  // ── extra customers + dogs ──────────────────────────────────────────────
  const more = [
    ["אורית נחום", "0521234513", "סימבה", "גולדן רטריבר", "זכר", "זהוב"],
    ["עידו פרץ", "0521234514", "לולה", "קבליר קינג צ'ארלס", "נקבה", "חום-לבן"],
    ["מאיה רוזן", "0521234515", "זאוס", "מלינואה", "זכר", "חום-שחור"],
    ["אלון בר", "0521234516", "פיצי", "ג'ק ראסל", "נקבה", "לבן-חום"],
    ["ליאת כץ", "0521234517", "באבל", "בולדוג צרפתי", "זכר", "קרם"],
    ["דוד חדד", "0521234518", "מיה", "רועה אוסטרלי", "נקבה", "מרל כחול"],
    ["רותם גולן", "0521234519", "אוסקר", "שנאוצר ננסי", "זכר", "אפור"],
    ["ענבל פישר", "0521234520", "הני", "לברדור", "נקבה", "בז'"],
    ["ניר עמר", "0521234521", "טייסון", "אמסטף", "זכר", "אפור-כחול"],
    ["שירה ויס", "0521234522", "קוקו", "פודל טוי", "נקבה", "משמש"],
    ["יובל סגל", "0521234523", "ארצ'י", "קורגי", "זכר", "ג'ינג'י-לבן"],
    ["קרן אזולאי", "0521234524", "נובה", "האסקי סיבירי", "נקבה", "שחור-לבן"],
    ["תומר רז", "0521234525", "בונו", "מעורב", "זכר", "שחור"],
    ["הדס לנדאו", "0521234526", "ריו", "ויזסלה", "זכר", "חלודה"],
  ];
  for (let k = 0; k < more.length; k++) {
    const i = 12 + k;
    const [name, phone, pname, breed, gender, color] = more[k];
    const cid = `promo-c${i}`, pid = `promo-p${i}`;
    const c = { name, phone, phoneNorm: "972" + phone.slice(1), businessId: B, email: `client${i}@example.com`, address: "כפר סבא", source: "manual", tags: '["קבוע"]' };
    await prisma.customer.upsert({ where: { id: cid }, update: c, create: { id: cid, ...c } });
    const p = { name: pname, breed, gender, color, species: "dog", customerId: cid, birthDate: at(-(600 + k * 110)), foodBrand: k % 2 ? "Acana" : "Royal Canin", foodGramsPerDay: 200 + k * 15, foodFrequency: "2" };
    await prisma.pet.upsert({ where: { id: pid }, update: p, create: { id: pid, ...p } });
  }
  // second dog of customer 0 (shares the family suite)
  const sib = { name: "ג'ינג'ר", breed: "רועה גרמני", gender: "נקבה", color: "שחור-חום", species: "dog", customerId: "promo-c0", birthDate: at(-900), foodBrand: "Royal Canin", foodGramsPerDay: 300, foodFrequency: "2" };
  await prisma.pet.upsert({ where: { id: "promo-p26" }, update: sib, create: { id: "promo-p26", ...sib } });
  const cOf = (p) => (p === 26 ? "promo-c0" : `promo-c${p}`);

  // ── behaviour profiles ────────────────────────────────────────────────
  await prisma.dogBehavior.deleteMany({ where: { petId: { startsWith: "promo-p" } } });
  const beh = {
    14: { dogAggression: true, resourceGuarding: true, biteHistory: true, biteDetails: "נשיכה לכלב אחר בגינה (2025)", triggers: "כלבים זכרים, קערת אוכל" }, // זאוס — arrives today
    20: { dogAggression: true, leashReactivity: true, triggers: "כלבים גדולים ברצועה" }, // טייסון — in house
    6: { separationAnxiety: true, leashReactivity: true }, // רוקי
  };
  for (const [p, data] of Object.entries(beh)) await prisma.dogBehavior.create({ data: { petId: `promo-p${p}`, ...data } });

  // ── rooms ──────────────────────────────────────────────────────────────
  await prisma.boardingStay.deleteMany({ where: { businessId: B } });
  await prisma.yard.deleteMany({ where: { businessId: B } });
  const rooms = [
    ["חדר א1", "suite", 2, 260], ["חדר א2", "suite", 2, 240],
    ["חדר א3", "premium", 1, 190], ["חדר א4", "premium", 1, 190], ["חדר א5", "premium", 1, 190],
    ["חדר א6", "standard", 1, 160], ["חדר ב1", "standard", 1, 160], ["חדר ב2", "standard", 1, 160],
    ["חדר ב3", "standard", 1, 160], ["חדר ב4", "standard", 1, 160], ["חדר ב5", "standard", 1, 160], ["חדר ב6", "standard", 1, 160],
  ];
  const ids = rooms.map((_, i) => `promo-r${i}`);
  await prisma.room.updateMany({ where: { businessId: B, id: { notIn: ids } }, data: { isActive: false } });
  for (let i = 0; i < rooms.length; i++) {
    const [name, type, capacity, pricePerNight] = rooms[i];
    const r = { name, type, capacity, pricePerNight, status: i === 8 ? "needs_cleaning" : "available", businessId: B, isActive: true, sortOrder: i, notes: null };
    await prisma.room.upsert({ where: { id: ids[i] }, update: r, create: { id: ids[i], ...r } });
  }

  // ── yards ──────────────────────────────────────────────────────────────
  const yards = [["חצר גדולה", "large", 6, 40], ["חצר קטנים", "standard", 4, 35], ["חצר משחקים", "group", 5, 40], ["חצר שקטה", "standard", 2, 45]];
  for (let i = 0; i < yards.length; i++) {
    const [name, type, capacity, pricePerSession] = yards[i];
    await prisma.yard.create({ data: { id: `promo-y${i}`, name, type, capacity, pricePerSession, businessId: B, sortOrder: i } });
  }

  // ── stays: today ───────────────────────────────────────────────────────
  // [room, pet, inDay, outDay, status, yard|null, notes]
  const busy = {}; // pet -> [[from,to]]
  const mark = (p, a, b) => (busy[p] = busy[p] || []).push([a, b]);
  const free = (p, a, b) => !(busy[p] || []).some(([x, y]) => a < y + 1 && b > x - 1);
  const feeding = ["בוקר וערב · אוכל של הבית", "3 ארוחות קטנות", "בוקר וערב · לא לתת חטיפים", "בוקר וערב"];
  const today = [
    [0, 0, -3, 3, "checked_in", 0], [0, 26, -3, 3, "checked_in", 0],
    [1, 2, -2, 4, "checked_in", 0],
    [2, 9, -4, 2, "checked_in", 1],
    [3, 3, -5, 0, "checked_in", null], // checkout today
    [5, 20, -1, 5, "checked_in", 3], // טייסון — quiet yard
    [6, 7, -2, 3, "checked_in", 1],
    [7, 11, -6, 0, "checked_in", null], // checkout today
    [9, 6, -1, 6, "checked_in", 2],
    [11, 13, -3, 1, "checked_in", 2],
    [1, 15, 0, 5, "reserved", null], // arrives today (suite 2 second dog)
    [4, 14, 0, 4, "reserved", null], // זאוס — arrives today, warnings
    [10, 16, 0, 3, "reserved", null], // arrives today
  ];
  const lastOut = {};
  for (const [room, p, a, b, status, yard] of today) {
    const checkIn = status === "reserved" ? at(a, 14, 0) : at(a, [9, 10, 14, 16][p % 4], 30);
    await prisma.boardingStay.create({ data: { businessId: B, roomId: ids[room], petId: `promo-p${p}`, customerId: cOf(p), checkIn, checkOut: at(b, 11, 0), status, yardId: yard == null ? null : `promo-y${yard}`, feedingPlan: feeding[p % 4] } });
    mark(p, a, b); lastOut[room] = Math.max(lastOut[room] ?? -99, b);
  }
  // free today: room 8 (needs cleaning — last guest left this morning), room 10/4 arrivals
  await prisma.boardingStay.create({ data: { businessId: B, roomId: ids[8], petId: "promo-p18", customerId: cOf(18), checkIn: at(-4, 15), checkOut: at(0, 9, 30), status: "checked_out", feedingPlan: "בוקר וערב" } });
  mark(18, -4, 0); lastOut[8] = 0;

  // ── past history (checked_out) + future reservations ───────────────────
  const pets = Array.from({ length: 27 }, (_, i) => i);
  let cursor = 0;
  const pickPet = (a, b) => {
    for (let t = 0; t < pets.length; t++) { const p = pets[(cursor + t) % pets.length]; if (free(p, a, b)) { cursor = (cursor + t + 1) % pets.length; return p; } }
    return null;
  };
  for (let room = 0; room < rooms.length; room++) {
    // past
    const todayStart = today.filter((t) => t[0] === room).reduce((m, t) => Math.min(m, t[2]), room === 8 ? -4 : 0);
    let end = todayStart - ri(0, 2);
    while (end > -24) {
      const len = ri(3, 8), start = end - len;
      const p = pickPet(start, end);
      if (p != null) { await prisma.boardingStay.create({ data: { businessId: B, roomId: ids[room], petId: `promo-p${p}`, customerId: cOf(p), checkIn: at(start, 14), checkOut: at(end, 11), status: "checked_out", feedingPlan: feeding[p % 4] } }); mark(p, start, end); }
      end = start - ri(0, 3);
    }
    // future
    let s = (lastOut[room] ?? 0) + ri(1, 2);
    if (room === 10 || room === 4) s = lastOut[room] + ri(1, 2);
    while (s < 38) {
      const len = ri(4, 10), e = s + len;
      const p = pickPet(s, e);
      if (p != null) { await prisma.boardingStay.create({ data: { businessId: B, roomId: ids[room], petId: `promo-p${p}`, customerId: cOf(p), checkIn: at(s, 14), checkOut: at(e, 11), status: "reserved", feedingPlan: feeding[p % 4] } }); mark(p, s, e); }
      s = e + ri(0, 2);
    }
  }

  // ── team: 2 staff users ────────────────────────────────────────────────
  const others = await prisma.platformUser.findMany({ where: { email: { in: ["superadmin@petra.local", "admin@petra.local", "master@petra.local"] } } });
  await prisma.businessUser.deleteMany({ where: { businessId: B, userId: { in: others.map((u) => u.id) } } });
  const hash = await bcrypt.hash("Staff1234!", 12);
  const overrides = {
    "tenant.finance.summary": false, "tenant.pricing.write": false, "tenant.critical.delete": false,
    "tenant.orders.cancel": false, "tenant.payments.write": false, "tenant.messages.send": false,
    "tenant.users.write": false, "tenant.settings.critical": false, "tenant.data.export": false,
    "tenant.ai.assistant": false, "tenant.boarding.manage": true,
  };
  for (const [email, name] of [["dana@petra.local", "דנה לוי"], ["yossi@petra.local", "יוסי אברהם"]]) {
    const u = await prisma.platformUser.upsert({ where: { email }, update: { name, passwordHash: hash, isActive: true }, create: { email, name, passwordHash: hash, authProvider: "local" } });
    await prisma.businessUser.upsert({ where: { businessId_userId: { businessId: B, userId: u.id } }, update: { role: "user", isActive: true, permissionOverrides: overrides }, create: { businessId: B, userId: u.id, role: "user", permissionOverrides: overrides } });
    await prisma.onboardingProgress.upsert({ where: { userId: u.id }, update: { completedAt: new Date() }, create: { userId: u.id, completedAt: new Date() } });
  }
  const n = await prisma.boardingStay.count({ where: { businessId: B } });
  console.log("boarding seed done, stays:", n);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
