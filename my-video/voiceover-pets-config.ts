// voiceover-pets-config.ts
export const PETS_SCENES = [
  {
    id: "pets-intro",
    text: "חיות המחמד של פטרה — פרופיל מקצועי לכל בעל חיים, לכל עסק.",
    defaultDurationSec: 10,
  },
  {
    id: "pets-species",
    text: "פטרה תומכת בִּכְלָבִים, חתולים, ציפורים, ארנבים ועוד — בִּחֲרוּ את הסוג בעת הוספה.",
    defaultDurationSec: 12,
  },
  {
    id: "pets-add",
    text: "הוספת חיה לוקחת שניות — שם, גזע, מין, תאריך לידה, ומיקרוצ'יפ.",
    defaultDurationSec: 11,
  },
  {
    id: "pets-profile",
    text: "כל חיה מקבלת פרופיל עצמאי עם הערות רפואיות, חיסונים, וכל ההיסטוריה שלה.",
    defaultDurationSec: 12,
  },
  {
    id: "pets-family",
    text: "ללקוח עם כמה חיות? כולן מקושרות לאותו פרופיל — עם גישה בלחיצה אחת.",
    defaultDurationSec: 11,
  },
  {
    id: "pets-outro",
    text: "חיות המחמד של פטרה — כל בעל חיים, כל מידע, תמיד נגיש.",
    defaultDurationSec: 10,
  },
] as const;
