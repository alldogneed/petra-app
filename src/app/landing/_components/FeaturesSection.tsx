"use client";

import { useState } from "react";
import {
  Users,
  CalendarDays,
  MessageCircle,
  Globe,
  Home,
  BarChart3,
  FileText,
  CalendarCheck,
  Receipt,
  UserCog,
  Layers,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "כל ההיסטוריה של הכלב מול העיניים",
    desc: "תוכניות אילוף, חיסונים ותמונות – הכל בכרטיס לקוח אחד שמלווה אותך בשטח.",
    color: "bg-orange-50 text-orange-500",
  },
  {
    icon: MessageCircle,
    title: "סוף לביטולים ברגע האחרון",
    desc: "תזכורות WhatsApp אוטומטיות ללקוחות — 24/48/72 שעות לפני התור, ישר מה-API",
    color: "bg-emerald-50 text-emerald-500",
  },
  {
    icon: Receipt,
    title: "תשלומים בלי מרדפים",
    desc: "שלח לינק לתשלום בוואטסאפ וקבל חשבונית אוטומטית. בלי לרדוף אחרי לקוחות.",
    color: "bg-rose-50 text-rose-500",
  },
  {
    icon: CalendarDays,
    title: "יומן חכם שמסדר לך את היום",
    desc: "יומן שבועי/יומי, תורים חוזרים, צפייה לפי עובד",
    color: "bg-blue-50 text-blue-500",
  },
  {
    icon: Globe,
    title: "הזמנות אונליין",
    desc: "דף הזמנה ציבורי — לקוחות קובעים תור בעצמם 24/7",
    color: "bg-violet-50 text-violet-500",
  },
  {
    icon: Home,
    title: "ניהול פנסיון",
    desc: "ניהול חדרים, check-in/out, עדכוני סטטוס יומיים",
    color: "bg-sky-50 text-sky-500",
  },
  {
    icon: BookOpen,
    title: "מודול אילוף",
    desc: "תוכניות אילוף, קבוצות, יעדים ומשימות לכל כלב",
    color: "bg-amber-50 text-amber-500",
  },
  {
    icon: CalendarCheck,
    title: "Google Calendar",
    desc: "סנכרון דו-כיווני — כל התורים בגוגל, בזמן אמת",
    color: "bg-indigo-50 text-indigo-500",
  },
  {
    icon: FileText,
    title: "טפסי קליטה דיגיטליים",
    desc: "שלח טפסי קליטה בוואטסאפ, קבל חתימה דיגיטלית",
    color: "bg-teal-50 text-teal-500",
  },
  {
    icon: BarChart3,
    title: "אנליטיקס ודוחות",
    desc: "גרפי הכנסות, לקוחות חדשים, תורים — ייצוא Excel",
    color: "bg-cyan-50 text-cyan-500",
  },
  {
    icon: UserCog,
    title: "ניהול צוות",
    desc: "הוסף עובדים, הגדר הרשאות לפי תפקיד",
    color: "bg-pink-50 text-pink-500",
  },
  {
    icon: Layers,
    title: "כלבי שירות",
    desc: "מעקב שלבי הכשרה, ניהול זכאים, שיבוצים ותעודות",
    color: "bg-lime-50 text-lime-600",
  },
];

// First 3 = prominent hero cards. Always show first 7. Remaining 5 behind "show more".
const HERO_COUNT = 3;
const ALWAYS_VISIBLE = 7;

export function FeaturesSection() {
  const [expanded, setExpanded] = useState(false);

  const heroFeatures = FEATURES.slice(0, HERO_COUNT);
  const alwaysCards = FEATURES.slice(HERO_COUNT, ALWAYS_VISIBLE);
  const hiddenCards = FEATURES.slice(ALWAYS_VISIBLE);

  return (
    <>
      {/* ── Top 3 hero cards — dark, full weight ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
        {heroFeatures.map((f) => {
          const Icon = f.icon;
          const [iconBg, iconColor] = f.color.split(" ");
          return (
            <div
              key={f.title}
              className="relative bg-slate-900 rounded-2xl p-7 overflow-hidden group cursor-default hover:shadow-2xl hover:shadow-black/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Hover glow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 120% 80% at 0% 0%, rgba(249,115,22,0.1) 0%, transparent 60%)",
                }}
              />
              {/* Icon */}
              <div
                aria-hidden="true"
                className={`relative w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center mb-5`}
              >
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <h3 className="relative text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="relative text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>

      {/* ── Always-visible regular cards ── */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
        {alwaysCards.map((f) => {
          const Icon = f.icon;
          const [iconBg, iconColor] = f.color.split(" ");
          return (
            <li key={f.title}>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 h-full">
                <div
                  aria-hidden="true"
                  className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3`}
                >
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Hidden cards — revealed on expand ── */}
      {expanded && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0 mt-4">
          {hiddenCards.map((f) => {
            const Icon = f.icon;
            const [iconBg, iconColor] = f.color.split(" ");
            return (
              <li key={f.title} style={{ animation: "fadeInUp 0.25s ease-out both" }}>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 h-full">
                  <div
                    aria-hidden="true"
                    className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3`}
                  >
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Toggle button ── */}
      <div className="text-center mt-8">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
              הסתר
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
              הצג עוד {hiddenCards.length} מאפיינים
            </>
          )}
        </button>
      </div>
    </>
  );
}
