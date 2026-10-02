// Demo LEADS for the promo-video "Sales Pipeline" screenshots (local DB only).
// Run after promo-seed.js. Replaces all leads + lead stages of demo-business-001.
process.env.TZ = "Asia/Jerusalem";
const { PrismaClient } = require("/home/user/petra-app/node_modules/@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();
const B = "demo-business-001";

// d = day offset from today, h/m = local (Israel) time
const at = (d, h = 10, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x; };

// Same as DEFAULT_LEAD_STAGES in src/lib/lead-stages.ts
const STAGES = [
  { key: "new",      name: "ליד חדש",       color: "#94A3B8", sortOrder: 0, isWon: false, isLost: false },
  { key: "contact",  name: "יצירת קשר",     color: "#6366F1", sortOrder: 1, isWon: false, isLost: false },
  { key: "consult",  name: "ייעוץ ראשוני",  color: "#F59E0B", sortOrder: 2, isWon: false, isLost: false },
  { key: "quote",    name: "הצעת מחיר",     color: "#3B82F6", sortOrder: 3, isWon: false, isLost: false },
  { key: "decide",   name: "ממתין להחלטה", color: "#8B5CF6", sortOrder: 4, isWon: false, isLost: false },
  { key: "won",      name: "לקוח",          color: "#10B981", sortOrder: 5, isWon: true,  isLost: false },
  { key: "lost",     name: "אבד",           color: "#EF4444", sortOrder: 6, isWon: false, isLost: true  },
];

const paid = (campaign, landingPage, pageType = "service") => ({
  trafficSource: "paid", medium: "cpc", campaign, landingPage, pageType,
  gclid: "Cj0KCQjw" + crypto.randomBytes(9).toString("hex"), referrer: "https://www.google.com/",
});
const organic = (landingPage, pageType = "guide") => ({ trafficSource: "organic", landingPage, pageType, referrer: "https://www.google.com/", firstPage: landingPage });
const social = (campaign, landingPage) => ({ trafficSource: "social", medium: "paid_social", campaign, landingPage, pageType: "service", referrer: "https://l.instagram.com/" });

// [stage, name, phone, city, service, source, attribution, dealValue, createdDaysAgo, followUp(d,h,m)|null, calls[]]
const LEADS = [
  // ── ליד חדש
  ["new", "שירה בן דוד", "054-7721983", "רעננה", "אילוף גורים", "google", paid("אילוף גורים – גוגל", "/puppy-training"), 2400, 0, [0, 17, 30], []],
  ["new", "אלון פרידמן", "052-3318470", "כפר סבא", "פנסיון", "website", organic("/boarding/kfar-saba", "area"), 1280, 0, [1, 10, 0], []],
  ["new", "מאיה רוזנברג", "050-6624135", "הוד השרון", "טיפוח", "instagram", social("טיפוח – אינסטגרם", "/grooming"), 1200, 1, [0, 19, 0], []],
  ["new", "עידו חדד", "053-9147206", "רמת השרון", "אילוף פרטי", "google", paid("אילוף פרטי – גוגל", "/private-training"), 3200, 1, [2, 11, 0], []],
  // ── יצירת קשר
  ["contact", "ליאור אזולאי", "058-4402917", "כפר סבא", "אילוף פרטי", "google", paid("אילוף פרטי – גוגל", "/private-training"), 3600, 3, [-1, 12, 0],
    [[2, "לא ענה, נשלחה הודעת וואטסאפ עם פרטים על התוכנית", "לחזור מחר בצהריים"]]],
  ["contact", "רותם גולן", "052-8830164", "הרצליה", "פנסיון", "facebook", social("פנסיון חגים – פייסבוק", "/boarding"), 1760, 2, [0, 18, 0],
    [[1, "מחפשים פנסיון ל-11 לילות בחגים לקוקר ספניאל, מבקשים לראות את החדרים", "לתאם סיור במקום"]]],
  ["contact", "נטע לוינסון", "054-2269381", "רעננה", "אילוף גורים", "instagram", social("אילוף גורים – אינסטגרם", "/puppy-training"), 2400, 4, [1, 16, 0],
    [[3, "גורה מלינואה בת 3 חודשים, נושכת ומושכת ברצועה", "לשלוח סרטון הסבר על קורס הגורים"]]],
  // ── ייעוץ ראשוני
  ["consult", "אורי שטרן", "050-7715390", "כפר סבא", "אילוף פרטי", "google", paid("אילוף פרטי – גוגל", "/private-training"), 4200, 6, [0, 17, 30],
    [[5, "שיחת היכרות מצוינת. רועה אוסטרלי בן שנה עם תגובתיות לכלבים אחרים", "נקבעה פגישת אבחון בבית"],
     [2, "אחרי האבחון: מעוניינים בתוכנית של 8 מפגשים", "לשלוח הצעת מחיר"]]],
  ["consult", "הדס כרמי", "052-6048827", "הוד השרון", "טיפוח", "website", organic("/grooming/poodle", "guide"), 1400, 5, [1, 10, 30],
    [[4, "פודל טוי, מבקשת טיפוח קבוע פעם בחודש", "להציע מנוי טיפוח"]]],
  ["consult", "יונתן ברק", "054-9913274", "ראש העין", "פנסיון", "referral", { trafficSource: "referral", referrer: "https://www.dogs-israel.co.il/", landingPage: "/boarding", pageType: "service" }, 1920, 7, [3, 12, 0],
    [[6, "הגיע בהמלצה של דנה כהן. שני כלבים, 6 לילות באוקטובר", "לבדוק זמינות חדר זוגי"]]],
  // ── הצעת מחיר
  ["quote", "מיכאל אדלר", "053-3386140", "כפר סבא", "אילוף פרטי", "google", paid("אילוף פרטי – גוגל", "/private-training"), 4800, 8, [-2, 11, 0],
    [[7, "ייעוץ ראשוני, לברדור בן שנתיים קופץ על אורחים", ""], [4, "נשלחה הצעה: 10 מפגשים + ליווי בוואטסאפ", "לחזור לשמוע תשובה"]]],
  ["quote", "קרן אוחיון", "050-2257418", "רמת השרון", "אילוף גורים", "google", paid("אילוף גורים – גוגל", "/puppy-training"), 2400, 6, [0, 13, 0],
    [[3, "נשלחה הצעת מחיר לקורס גורים (6 מפגשים)", "לוודא שקיבלה ולענות על שאלות"]]],
  ["quote", "דניאל סויסה", "058-7704352", "הרצליה", "פנסיון", "facebook", social("פנסיון חגים – פייסבוק", "/boarding"), 2240, 5, [2, 18, 0],
    [[2, "הצעה ל-14 לילות כולל טיולים ורחצה ביציאה", "לחזור אחרי שיתייעץ עם אשתו"]]],
  // ── ממתין להחלטה
  ["decide", "תמר פרץ", "054-1187736", "כפר סבא", "אילוף פרטי", "google", paid("אילוף פרטי – גוגל", "/private-training"), 3600, 9, [0, 20, 0],
    [[8, "פגישת אבחון בבית, בורדר קולי עם חרדת נטישה", ""], [5, "קיבלה הצעת מחיר, משווה מול מאלף נוסף", ""], [1, "ביקשה פריסת תשלומים, אישרנו 3 תשלומים", "סגירה צפויה השבוע"]]],
  ["decide", "גלעד נחום", "052-4491628", "רעננה", "אילוף גורים", "instagram", social("אילוף גורים – אינסטגרם", "/puppy-training"), 2400, 8, [1, 11, 30],
    [[4, "מעוניין מאוד, מחכה לאישור מבן הזוג", "לחזור מחר בבוקר"]]],
  ["decide", "ענבל שגיא", "050-8836205", "הוד השרון", "פנסיון", "google", paid("פנסיון – גוגל", "/boarding"), 1600, 7, [4, 10, 0],
    [[3, "סיור בפנסיון עבר מעולה, בוחרת תאריכים", ""]]],
];

// already won (archive tab) — show conversions in reports
const WON = [
  ["עדי מלכה", "054-6617203", "כפר סבא", "אילוף גורים", "google", paid("אילוף גורים – גוגל", "/puppy-training"), 2400, 9, 2],
  ["אסף רביבו", "052-7729018", "רעננה", "פנסיון", "facebook", social("פנסיון חגים – פייסבוק", "/boarding"), 1920, 10, 4],
];

async function main() {
  await prisma.lead.deleteMany({ where: { businessId: B } });
  await prisma.leadStage.deleteMany({ where: { businessId: B } });
  const stage = {};
  for (const s of STAGES) {
    const { key, ...data } = s;
    stage[key] = await prisma.leadStage.create({ data: { ...data, businessId: B } });
  }

  const owner = await prisma.platformUser.findUnique({ where: { email: "owner@petra.local" } });

  for (const [st, name, phone, city, requestedService, source, attr, dealValue, ago, fu, calls] of LEADS) {
    const createdAt = at(-ago, 9 + (name.length % 8), (name.length * 7) % 60);
    const lastCall = calls.length ? Math.min(...calls.map((c) => c[0])) : null;
    await prisma.lead.create({
      data: {
        businessId: B, name, phone, city, requestedService, source, stage: stage[st].id, dealValue,
        ...attr, createdAt,
        nextFollowUpAt: fu ? at(fu[0], fu[1], fu[2]) : null,
        lastContactedAt: lastCall != null ? at(-lastCall, 12, 15) : null,
        callLogs: { create: calls.map(([d, summary, treatment], i) => ({ type: "call", summary, treatment, createdAt: at(-d, 11 + i, 20) })) },
      },
    });
  }

  for (const [name, phone, city, requestedService, source, attr, dealValue, ago, wonAgo] of WON) {
    await prisma.lead.create({
      data: {
        businessId: B, name, phone, city, requestedService, source, stage: stage.won.id, dealValue, ...attr,
        createdAt: at(-ago, 10), wonAt: at(-wonAgo, 16), wonByUserId: owner?.id ?? null,
        previousStageId: stage.decide.id, followUpStatus: "completed", lastContactedAt: at(-wonAgo, 16),
        callLogs: { create: [{ type: "call", summary: "סגרנו! נשלח קישור לתשלום מקדמה", treatment: "", createdAt: at(-wonAgo, 16) }] },
      },
    });
  }
  console.log("leads seeded:", await prisma.lead.count({ where: { businessId: B } }));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
