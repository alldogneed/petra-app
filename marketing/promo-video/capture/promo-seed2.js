const { PrismaClient } = require("/home/user/petra-app/node_modules/@prisma/client");
const prisma = new PrismaClient(); const B = "demo-business-001";
(async () => {
  let pl = await prisma.priceList.findFirst({ where: { businessId: B } });
  if (!pl) pl = await prisma.priceList.create({ data: { businessId: B } });
  await prisma.priceListItem.updateMany({ where: { businessId: B }, data: { isBookableOnline: false } });
  const items = [
    ["pli-1", "שיעור אילוף פרטי", "training", 60, 350, "אילוף ביתי מותאם אישית לכלב ולמשפחה"],
    ["pli-2", "טיפוח מלא", "grooming", 90, 280, "רחצה, תספורת, ציפורניים וניקוי אוזניים"],
    ["pli-3", "הערכת התנהגות", "training", 45, 250, "פגישת היכרות ואבחון ראשוני"],
    ["pli-4", "גן כלבים יומי", "daycare", 480, 120, "יום של משחק, חברה ופעילות"],
  ];
  for (const [id, name, category, durationMinutes, basePrice, description] of items) {
    const d = { businessId: B, priceListId: pl.id, name, category, durationMinutes, basePrice, description, isActive: true, isBookableOnline: true };
    await prisma.priceListItem.upsert({ where: { id }, update: d, create: { id, ...d } });
  }
  console.log("ok");
})().finally(() => prisma.$disconnect());
