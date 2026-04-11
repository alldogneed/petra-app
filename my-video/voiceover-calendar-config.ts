// voiceover-calendar-config.ts
export const CALENDAR_SCENES = [
  {
    id: "calendar-intro",
    text: "יומן פטרה — כל התורים שלכם, בתצוגה ברורה, עם ניהול זמן מלא.",
    defaultDurationSec: 10,
  },
  {
    id: "calendar-week",
    text: "בתצוגה השבועית תראו את כל התורים — לפי שירות, לקוח ושעה. עוברים בין יום, שבוע וחודש בלחיצה.",
    defaultDurationSec: 12,
  },
  {
    id: "calendar-add",
    text: "הוספת תור לוקחת שניות — בּוֹחֲרִים לקוח, שירות, ותאריך. הוא מופיע מיד ביומן.",
    defaultDurationSec: 11,
  },
  {
    id: "calendar-recurring",
    text: "תורים חוזרים? מַפְעִילִים את האפשרות וּבוֹחֲרִים תדירות — השאר קורה אוטומטית.",
    defaultDurationSec: 11,
  },
  {
    id: "calendar-availability",
    text: "בהגדרות הזמינות קוֹבְעִים שעות פעילות לכל יום — ואפשר לחסום ימי חופשה בקלות.",
    defaultDurationSec: 12,
  },
  {
    id: "calendar-gcal",
    text: "מְחַבְּרִים את פטרה לגוגל קלנדר — תורים מסתנכרנים אוטומטית, ואירועים מגוגל חוסמים זמינות ללקוחות בהזמנה העצמית.",
    defaultDurationSec: 12,
  },
  {
    id: "calendar-outro",
    text: "יומן פטרה — הזמן שלכם, בשליטה שלכם.",
    defaultDurationSec: 10,
  },
] as const;
