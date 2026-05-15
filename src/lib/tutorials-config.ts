// src/lib/tutorials-config.ts
// Static config for tutorial videos hosted on Vercel Blob.
// To add a new video: upload via scripts/upload-tutorials.mjs, then add entry here.

export type TutorialVideo = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  durationLabel: string;
  isNew?: boolean;
};

export type TutorialCategory = {
  id: string;
  label: string;
  icon: string;
};

const BASE = "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials";

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  { id: "start",      label: "התחלה מהירה",        icon: "LayoutDashboard" },
  { id: "clients",    label: "לקוחות ובעלי חיים",   icon: "Users" },
  { id: "sales",      label: "מכירות ומשימות",      icon: "Target" },
  { id: "bookings",   label: "הזמנות ופיננסים",     icon: "ShoppingBag" },
  { id: "boarding",   label: "פנסיון",               icon: "Hotel" },
  { id: "management", label: "ניהול עסק",            icon: "Settings" },
];

export const TUTORIAL_VIDEOS: TutorialVideo[] = [
  // ── התחלה מהירה ──────────────────────────────────────────────────────────
  {
    id: "dashboard",
    title: "דשבורד",
    description: "סקירת לוח הבקרה הראשי — נתוני תקופה, תורים קרובים ופעולות מהירות",
    url: `${BASE}/%D7%93%D7%A9%D7%91%D7%95%D7%A8%D7%93%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "start",
    durationLabel: "1:09",
    isNew: true,
  },
  {
    id: "calendar",
    title: "יומן",
    description: "ניהול יומן תורים, פגישות, תצוגות שונות וסנכרון Google Calendar",
    url: `${BASE}/%D7%99%D7%95%D7%9E%D7%9F%20%D7%A4%D7%98%D7%A8%D7%94%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "start",
    durationLabel: "0:48",
    isNew: true,
  },

  // ── לקוחות ובעלי חיים ─────────────────────────────────────────────────────
  {
    id: "customers",
    title: "מערכת לקוחות",
    description: "ניהול פרופילי לקוחות, היסטוריית טיפולים ותיעוד",
    url: `${BASE}/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9C%D7%A7%D7%95%D7%97%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4`,
    category: "clients",
    durationLabel: "1:47",
    isNew: true,
  },
  {
    id: "pets",
    title: "חיות מחמד",
    description: "ניהול פרופיל חיית המחמד, חיסונים, מסמכים ונתוני בריאות",
    url: `${BASE}/%D7%97%D7%99%D7%95%D7%AA%20%D7%9E%D7%97%D7%9E%D7%93%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "clients",
    durationLabel: "0:40",
    isNew: true,
  },

  // ── מכירות ומשימות ────────────────────────────────────────────────────────
  {
    id: "sales",
    title: "מערכת מכירות",
    description: "ניהול לידים, קנבן מכירות ומעקב אחר לקוחות פוטנציאליים",
    url: `${BASE}/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9E%D7%9B%D7%99%D7%A8%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4`,
    category: "sales",
    durationLabel: "1:18",
    isNew: true,
  },
  {
    id: "tasks",
    title: "מערכת משימות",
    description: "יצירת משימות, תיוג לפי קטגוריה, מעקב ותזכורות",
    url: `${BASE}/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9E%D7%A9%D7%99%D7%9E%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4`,
    category: "sales",
    durationLabel: "1:31",
    isNew: true,
  },

  // ── הזמנות ופיננסים ───────────────────────────────────────────────────────
  {
    id: "booking-online",
    title: "הזמנות אונליין",
    description: "הגדרת עמוד הזמנה ציבורי — לקוחות קובעים לבד 24/7",
    url: `${BASE}/%D7%94%D7%96%D7%9E%D7%A0%D7%95%D7%AA%20%D7%90%D7%95%D7%A0%D7%9C%D7%99%D7%99%D7%9F%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "bookings",
    durationLabel: "1:18",
    isNew: true,
  },
  {
    id: "orders",
    title: "מערכת הזמנות",
    description: "יצירה וניהול הזמנות, רשימת מחירים, תשלומים ומסמכים",
    url: `${BASE}/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%94%D7%96%D7%9E%D7%A0%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4`,
    category: "bookings",
    durationLabel: "1:33",
    isNew: true,
  },
  {
    id: "finances",
    title: "מערכת פיננסים",
    description: "מעקב הכנסות, חשבוניות, דוחות כספיים וניהול תשלומים",
    url: `${BASE}/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99%D7%9D%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4`,
    category: "bookings",
    durationLabel: "2:09",
    isNew: true,
  },

  // ── פנסיון ────────────────────────────────────────────────────────────────
  {
    id: "boarding",
    title: "מערכת הפנסיון",
    description: "ניהול צ׳ק-אין ואאוט, חדרים, לוח יומי והזנה לכלבים בפנסיון",
    url: `${BASE}/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%94%D7%A4%D7%A0%D7%A1%D7%99%D7%95%D7%9F%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "boarding",
    durationLabel: "2:08",
    isNew: true,
  },

  // ── ניהול עסק ─────────────────────────────────────────────────────────────
  {
    id: "admin",
    title: "לוח ובקרה",
    description: "ניהול עובדים, הרשאות, יומן צוות ודוחות מנהל",
    url: `${BASE}/%D7%9C%D7%95%D7%97%20%D7%95%D7%94%D7%A7%D7%A8%D7%94%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "management",
    durationLabel: "1:01",
    isNew: true,
  },
  {
    id: "training",
    title: "ניהול תהליכי אילוף",
    description: "תוכניות אילוף, מעקב התקדמות, שיעורים ויומן אימונים",
    url: `${BASE}/%D7%A0%D7%99%D7%94%D7%95%D7%9C%20%D7%AA%D7%94%D7%9C%D7%99%D7%9B%D7%99%20%D7%90%D7%99%D7%9C%D7%95%D7%A3%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4`,
    category: "management",
    durationLabel: "1:38",
    isNew: true,
  },
  {
    id: "settings",
    title: "הגדרות",
    description: "הגדרות עסק, שירותים, תשלומים, צוות ואינטגרציות",
    url: `${BASE}/%D7%94%D7%92%D7%93%D7%A8%D7%95%D7%AA%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4`,
    category: "management",
    durationLabel: "2:22",
    isNew: true,
  },
];
