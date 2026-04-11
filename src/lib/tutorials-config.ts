// src/lib/tutorials-config.ts
// Static config for tutorial videos hosted on Vercel Blob.
// Add new videos here after uploading via scripts/upload-tutorials.mjs

export type TutorialVideo = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  durationLabel: string; // e.g. "4:32"
  isNew?: boolean;
};

export type TutorialCategory = {
  id: string;
  label: string;
  icon: string;
};

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  { id: "crm", label: "לקוחות ומכירות", icon: "Users" },
  { id: "orders", label: "הזמנות ופיננסים", icon: "ShoppingBag" },
];

export const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: "customers",
    title: "מערכת לקוחות",
    description: "ניהול פרופילי לקוחות, חיות מחמד, היסטוריית טיפולים ותיעוד",
    url: "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9C%D7%A7%D7%95%D7%97%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    category: "crm",
    durationLabel: "~5 דק׳",
    isNew: true,
  },
  {
    id: "sales",
    title: "מערכת מכירות",
    description: "ניהול לידים, קנבן מכירות, מעקב אחר לקוחות פוטנציאליים",
    url: "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9E%D7%9B%D7%99%D7%A8%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    category: "crm",
    durationLabel: "~4 דק׳",
    isNew: true,
  },
  {
    id: "orders",
    title: "מערכת הזמנות",
    description: "יצירה וניהול הזמנות, רשימת מחירים, תשלומים ומסמכים",
    url: "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%94%D7%96%D7%9E%D7%A0%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    category: "orders",
    durationLabel: "~5 דק׳",
    isNew: true,
  },
  {
    id: "finances",
    title: "מערכת פיננסים",
    description: "מעקב הכנסות, חשבוניות, דוחות כספיים וניהול תשלומים",
    url: "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99%D7%9D%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    category: "orders",
    durationLabel: "~6 דק׳",
    isNew: true,
  },
];
