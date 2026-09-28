// Feeding plans, medications and today's care logs for the dogs boarding today (local DB only).
// Run after promo-seed-boarding.js.
//   node promo-seed-care.js daily    -> care-log titles as /boarding/daily writes them ("האכלה 08:00")
//   node promo-seed-care.js feeding  -> care-log titles as /feeding writes them ("breakfast"/"dinner")
// (the two screens use different log titles, so the capture script switches mode between shots)
process.env.TZ = "Asia/Jerusalem";
const { PrismaClient } = require("/home/user/petra-app/node_modules/@prisma/client");
const prisma = new PrismaClient();
const B = "demo-business-001";
const MODE = process.argv[2] || "daily";
const at = (d, h = 12, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x; };

// pet index -> [foodBrand, grams/day, frequency(twice|three), foodNotes, feedingPlan notes]
const FOOD = {
  0: ["Royal Canin Maxi", 380, "twice", "אוכל יבש בלבד", "להוסיף מעט מים חמים"],
  26: ["Royal Canin Maxi", 340, "twice", null, "אוכלת לאט — להגיש בנפרד מרקס"],
  2: ["Acana Adult Large", 400, "twice", null, "תוסף מפרקים עם ארוחת הבוקר"],
  9: ["Hill's Small Paws", 110, "three", "רגישות לעוף", "ארוחות קטנות, בלי חטיפים"],
  3: ["Royal Canin Labrador", 350, "twice", null, "נוטה להשמנה — לא להוסיף"],
  20: ["Orijen Original", 360, "twice", "אוכל של הבית בשקית מסומנת", "להאכיל בחדר, לא ליד כלבים אחרים"],
  7: ["Brit Care Adult", 280, "twice", null, "אוהב שמוסיפים יוגורט"],
  6: ["Acana Sport & Agility", 420, "twice", null, "לתת אנטיביוטיקה עם האוכל"],
  13: ["Royal Canin Cavalier", 150, "twice", null, "פרוביוטיקה בארוחת הערב"],
  15: ["Pro Plan Small", 120, "three", null, "ארוחה שלישית בצהריים"],
  14: ["Orijen Six Fish", 450, "twice", "שומר על הקערה — להניח ולהתרחק", "להאכיל לבד בחדר"],
  11: ["Royal Canin Doberman", 470, "twice", null, "יוצאת היום — ארוחת בוקר בלבד"],
  16: ["Royal Canin French Bulldog", 190, "twice", null, "קערה מוגבהת"],
};

// medications (id = name, so the daily board's "נתן" check can match the log title)
const MEDS = [
  { pet: 2, medName: "תוסף מפרקים", dosage: "טבליה אחת", frequency: "פעם ביום", times: null, instructions: "עם ארוחת הבוקר", done: true },
  { pet: 20, medName: "אפוקוול 16 מ״ג", dosage: "חצי טבליה", frequency: "פעם ביום", times: null, instructions: "אלרגיה עונתית — בבוקר", done: true },
  { pet: 9, medName: "טיפות עיניים", dosage: "2 טיפות בכל עין", frequency: "פעמיים ביום", times: '["08:00","20:00"]', instructions: "לנגב את העין לפני" },
  { pet: 6, medName: "סינולוקס 250 מ״ג", dosage: "טבליה אחת", frequency: "פעמיים ביום", times: '["08:00","20:00"]', instructions: "אנטיביוטיקה — עד סוף השבוע", end: 4 },
  { pet: 3, medName: "אומגה 3", dosage: "כמוסה אחת", frequency: "פעם ביום", times: null, instructions: "בתוך האוכל של הבוקר", done: true },
  { pet: 13, medName: "פרוביוטיקה", dosage: "שקית אחת", frequency: "פעם ביום", times: null, instructions: "לערבב באוכל של הערב" },
];

// feedings already done this morning (pet -> minutes after 07:00)
const FED_MORNING = { 11: 25, 0: 32, 26: 33, 2: 36, 9: 41, 3: 44, 7: 48, 20: 55 };

async function main() {
  const petIds = Object.keys(FOOD).map((p) => `promo-p${p}`);
  for (const [p, [foodBrand, foodGramsPerDay, foodFrequency, foodNotes]] of Object.entries(FOOD)) {
    await prisma.pet.update({ where: { id: `promo-p${p}` }, data: { foodBrand, foodGramsPerDay, foodFrequency, foodNotes } });
  }
  const stays = await prisma.boardingStay.findMany({
    where: { businessId: B, petId: { in: petIds }, status: { in: ["checked_in", "reserved"] }, checkIn: { lte: at(0, 23, 59) }, checkOut: { gte: at(0, 0, 0) } },
  });
  for (const s of stays) {
    const p = s.petId.replace("promo-p", "");
    const [foodType, amount, freq, , notes] = FOOD[p];
    const timesPerDay = freq === "three" ? 3 : 2;
    const plan = { foodType, amountGrams: Math.round(amount / timesPerDay), timesPerDay, notes, frequency: freq };
    await prisma.boardingStay.update({ where: { id: s.id }, data: { feedingPlan: JSON.stringify(plan) } });
  }
  const stayOf = Object.fromEntries(stays.map((s) => [s.petId.replace("promo-p", ""), s]));

  await prisma.dogMedication.deleteMany({ where: { petId: { startsWith: "promo-p" } } });
  for (const m of MEDS) {
    await prisma.dogMedication.create({ data: { id: m.medName, petId: `promo-p${m.pet}`, medName: m.medName, dosage: m.dosage, frequency: m.frequency, times: m.times, instructions: m.instructions, startDate: at(-3, 0), endDate: m.end ? at(m.end, 23) : null } });
  }

  await prisma.boardingCareLog.deleteMany({ where: { businessId: B } });
  const logs = [];
  for (const [p, min] of Object.entries(FED_MORNING)) {
    const s = stayOf[p]; if (!s) continue;
    const [brand, grams] = FOOD[p];
    logs.push({ boardingStayId: s.id, petId: s.petId, businessId: B, type: "FEEDING", title: MODE === "feeding" ? "breakfast" : "האכלה 08:00", notes: `מנת בוקר ${Math.round(grams / (FOOD[p][2] === "three" ? 3 : 2))} ג׳`, doneAt: at(0, 7, min) });
  }
  for (const m of MEDS.filter((m) => m.done)) {
    const s = stayOf[m.pet]; if (!s) continue;
    logs.push({ boardingStayId: s.id, petId: s.petId, businessId: B, type: "MEDICATION", title: m.medName, notes: [m.dosage, m.instructions].join(" • "), doneAt: at(0, 7, 50 + m.pet % 7) });
  }
  if (MODE === "daily" && stayOf[11]) logs.push({ boardingStayId: stayOf[11].id, petId: stayOf[11].petId, businessId: B, type: "WALK", title: "טיול", notes: "טיול אחרון לפני האיסוף", doneAt: at(0, 7, 5) });
  if (MODE === "daily" && stayOf[2]) logs.push({ boardingStayId: stayOf[2].id, petId: stayOf[2].petId, businessId: B, type: "WALK", title: "טיול", notes: "סיבוב בוקר 20 דק׳ — רגוע ושמח", doneAt: at(0, 7, 15) });
  await prisma.boardingCareLog.createMany({ data: logs });
  console.log(`care seed (${MODE}): stays ${stays.length}, logs ${logs.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
