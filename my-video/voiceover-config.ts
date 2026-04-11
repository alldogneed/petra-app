// Voiceover texts for each scene.
// Run `node --strip-types generate-voiceover.ts` to generate the MP3 files.
// Requires: ELEVENLABS_API_KEY env var

export const SCENES = [
  {
    id: "intro",
    text: "ברוכים הבאים לדשבורד פטרה — מרכז הניהול של העסק שלכם.",
    defaultDurationSec: 4,
  },
  {
    id: "stats",
    text: "בדשבורד תמצאו את כל הנתונים החשובים — הכנסות החודש, תורים להיום, לקוחות פעילים, ותשלומים ממתינים. הכל מתעדכן בזמן אמת.",
    defaultDurationSec: 9,
  },
  {
    id: "appointments",
    text: "כאן רואים את התורים של מחר. לחצו על כפתור הוואטסאפ לשליחת תזכורת ישירה ללקוח. פטרה יכולה גם לשלוח תזכורות אוטומטיות לפני כל תור.",
    defaultDurationSec: 8,
  },
  {
    id: "orders",
    text: "בסעיף ההזמנות האחרונות אפשר לעקוב אחרי כל תשלום, לראות מה שולם ומה ממתין, ולשלוח דרישת תשלום בוואטסאפ בלחיצה אחת.",
    defaultDurationSec: 8,
  },
  {
    id: "checklist",
    text: "הצ'קליסט מוביל אתכם שלב אחרי שלב בהקמת העסק — מהגדרת שירותים, הוספת לקוחות ותורים, ועד להפעלת תזכורות אוטומטיות.",
    defaultDurationSec: 7,
  },
  {
    id: "outro",
    text: "פטרה — כל הכלים לניהול עסק חיות מחמד, במקום אחד. הירשמו עכשיו בחינם בפטרה אפ.",
    defaultDurationSec: 5,
  },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];
