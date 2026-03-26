"use client";

import {
  MessageCircle,
  CalendarDays,
  Globe,
  Home,
  BookOpen,
  Receipt,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "אוטומציות WhatsApp",
    desc: "תזכורות אוטומטיות נשלחות 24/48/72 שעות לפני כל תור ישירות מה-API הרשמי של Meta. שיעור ביטול מינימלי, פחות מרדפים.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    border: "border-emerald-100 hover:border-emerald-200 hover:shadow-emerald-50/60",
  },
  {
    icon: CalendarDays,
    title: "יומן חכם",
    desc: "יומן שבועי ויומי עם סנכרון Google Calendar דו-כיווני, תורים חוזרים וצפייה לפי עובד — הכל בזמן אמת.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    border: "border-blue-100 hover:border-blue-200 hover:shadow-blue-50/60",
  },
  {
    icon: Globe,
    title: "הזמנות אונליין 24/7",
    desc: "לקוחות קובעים תור בעצמם דרך דף הזמנה אישי, ללא שיחות טלפון וגם מחוץ לשעות הפעילות.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    border: "border-violet-100 hover:border-violet-200 hover:shadow-violet-50/60",
  },
  {
    icon: Home,
    title: "ניהול פנסיון",
    desc: "ניהול חדרים, check-in/out ועדכוני WhatsApp אוטומטיים לבעלים — ללא כפל הזמנות ובלי טעויות.",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    border: "border-sky-100 hover:border-sky-200 hover:shadow-sky-50/60",
  },
  {
    icon: BookOpen,
    title: "מודול אילוף מתקדם",
    desc: "תוכניות אילוף אישיות, קבוצות, יעדים ומעקב התקדמות — כל כלב, כל שלב, מהשטח או מהמשרד.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    border: "border-amber-100 hover:border-amber-200 hover:shadow-amber-50/60",
  },
  {
    icon: Receipt,
    title: "תשלומים וחשבוניות",
    desc: "שלח לינק תשלום בוואטסאפ, קבל חשבונית אוטומטית וייצא דוחות כספיים לאקסל — בלי לרדוף אחרי כסף.",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    border: "border-rose-100 hover:border-rose-200 hover:shadow-rose-50/60",
  },
];

export function FeaturesSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <div
            key={f.title}
            className={`bg-white rounded-2xl border-2 p-7 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-default ${f.border}`}
          >
            <div
              aria-hidden="true"
              className={`w-12 h-12 rounded-2xl ${f.iconBg} flex items-center justify-center mb-5`}
            >
              <Icon className={`w-6 h-6 ${f.iconColor}`} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
