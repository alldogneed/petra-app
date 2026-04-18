"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ChevronDown, ChevronUp, MessageCircle, Star, Zap, CreditCard, Sparkles, Shield } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

const CARDCOM_TIERS = new Set(["basic", "pro"]);

type FeatureEntry = string | { text: string; star: true };

const PLANS: {
  key: string;
  name: string;
  subtitle?: string;
  price: number;
  badge: string | null;
  highlight: boolean;
  description: string;
  features: FeatureEntry[];
  notIncluded: string[];
}[] = [
  {
    key: "free",
    name: "חינמי",
    price: 0,
    badge: null,
    highlight: false,
    description: "התחל לנהל את העסק שלך בחינם — ללא כרטיס אשראי",
    features: [
      "עד 30 לקוחות",
      "עד 20 תורים (סה\"כ)",
      "עד 15 הזמנות (סה\"כ)",
      "CRM / לידים (עד 15)",
      "ניהול תהליכי אילוף (עד 10 תוכניות)",
      "מחירון שירותים (עד 8 פריטים)",
      "ניהול משימות",
    ],
    notIncluded: [
      "תזכורות WhatsApp ללקוחות",
      "Google Calendar סנכרון",
      "אנליטיקס ודוחות",
      "לינקי תשלום ללקוחות",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    subtitle: "מושלם לגרומרים ומאלפים עצמאיים",
    price: 99,
    badge: null,
    highlight: false,
    description: "ניהול מקצועי יומיומי — יומן, תורים, תשלומים ותזכורות",
    features: [
      { text: "לקוחות ותורים ללא הגבלה", star: true },
      { text: "יומן תורים ופגישות + Google Calendar", star: true },
      { text: "תזכורות WhatsApp אוטומטיות", star: true },
      { text: "בקשת תשלום + טפסי קליטה דיגיטליים", star: true },
      { text: "תיק עבודות לפני/אחרי", star: true },
      "משתמש יחיד (ללא ניהול צוות)",
      "דוחות ואנליטיקס",
      "תמיכה אישית בוואטסאפ",
    ],
    notIncluded: [
      "אוטומציות WhatsApp מתקדמות",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    subtitle: "מושלם לפנסיונים ומרכזי אילוף",
    price: 199,
    badge: "מומלץ · הכי משתלם",
    highlight: true,
    description: "שליטה מלאה לעסק שגדל — צוות, פנסיון ואוטומציה",
    features: [
      "הכל ב-Basic",
      { text: "ניהול צוות והרשאות מתקדמות", star: true },
      { text: "ניהול פנסיון וחדרים", star: true },
      { text: "מודול אילוף מתקדם", star: true },
      { text: "הזמנות אונליין — לקוחות קובעים לבד 24/7", star: true },
      { text: "אוטומציות WhatsApp מתקדמות", star: true },
      { text: "דוחות כספיים + ייצוא Excel", star: true },
      { text: "תמיכה אישית מועדפת בוואטסאפ", star: true },
    ],
    notIncluded: [],
  },
];

// ─── Comparison table (3 tiers only) ──────────────────────────────────────────
type FVal = boolean | string;
interface FRow { name: string; free: FVal; basic: FVal; pro: FVal }

const FEATURE_GROUPS: { category: string; features: FRow[] }[] = [
  {
    category: "לקוחות וחיות מחמד",
    features: [
      { name: "לקוחות", free: "עד 30", basic: "ללא הגבלה", pro: "ללא הגבלה" },
      { name: "CRM / לידים", free: "עד 15", basic: "ללא הגבלה", pro: "ללא הגבלה" },
      { name: "כרטיס בריאות לחיית מחמד", free: true, basic: true, pro: true },
      { name: "טפסי קליטה דיגיטליים", free: false, basic: true, pro: true },
      { name: "ניהול משימות", free: "עד 20", basic: "ללא הגבלה", pro: "ללא הגבלה" },
      { name: "מחירון שירותים", free: true, basic: true, pro: true },
    ],
  },
  {
    category: "יומן ותורים",
    features: [
      { name: "יומן תורים ופגישות", free: "עד 20 תורים", basic: true, pro: true },
      { name: "מערכת ניהול תורים", free: "עד 20 תורים", basic: true, pro: true },
      { name: "הזמנות אונליין (לקוח קובע לבד)", free: false, basic: false, pro: true },
      { name: "סנכרון Google Calendar", free: false, basic: true, pro: true },
    ],
  },
  {
    category: "WhatsApp ותקשורת",
    features: [
      { name: "תזכורות WhatsApp", free: false, basic: true, pro: true },
      { name: "בקשת תשלום WhatsApp", free: false, basic: true, pro: true },
      { name: "אוטומציות WhatsApp מתקדמות", free: false, basic: false, pro: true },
      { name: "הודעות מותאמות אישית", free: false, basic: false, pro: true },
    ],
  },
  {
    category: "מקצוע ותוכן",
    features: [
      { name: "ניהול תהליכי אילוף", free: "עד 10", basic: "ללא הגבלה", pro: "ללא הגבלה" },
      { name: "מודול אילוף מתקדם", free: false, basic: false, pro: true },
      { name: "ניהול קבוצות וסדנאות", free: false, basic: false, pro: true },
      { name: "ניהול פנסיון + חדרים", free: false, basic: false, pro: true },
      { name: "תיק עבודות גרומר לפני/אחרי", free: false, basic: true, pro: true },
    ],
  },
  {
    category: "פיננסים ודוחות",
    features: [
      { name: "שליחת בקשת תשלום", free: false, basic: true, pro: true },
      { name: "ניהול הזמנות", free: "עד 15", basic: true, pro: true },
      { name: "דוחות כספיים + ייצוא Excel", free: false, basic: false, pro: true },
      { name: "דוחות ואנליטיקס", free: false, basic: true, pro: true },
      { name: "ייצוא Excel", free: false, basic: false, pro: true },
    ],
  },
  {
    category: "ניהול צוות",
    features: [
      { name: "ניהול צוות ומשתמשים", free: false, basic: false, pro: true },
      { name: "הרשאות לפי תפקיד", free: false, basic: false, pro: true },
    ],
  },
];

const PLAN_KEYS = ["free", "basic", "pro"] as const;

function FeatureCell({ value }: { value: FVal }) {
  if (typeof value === "string") {
    return <span className="text-xs text-slate-600 font-medium">{value}</span>;
  }
  return value
    ? <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-label="כלול" />
    : <X className="w-4 h-4 text-red-300 mx-auto" aria-label="לא כלול" />;
}

const FAQ = [
  {
    q: "מה ניתן לנהל עם פטרה?",
    a: "פטרה בנויה במיוחד לעסקי חיות מחמד ומכסה: לקוחות וחיות מחמד, יומן תורים, תזכורות WhatsApp אוטומטיות, קביעת תורים אונליין, ניהול פנסיון וחדרים, תהליכי אילוף, קבוצות וסדנאות, בקשות תשלום, CRM ולידים, ניהול משימות ואנליטיקס — הכל במקום אחד.",
  },
  {
    q: "מה ההבדל בין Basic ל-Pro?",
    a: "Basic מיועד לגרומרים ומאלפים עצמאיים — משתמש יחיד עם יומן, WhatsApp, טפסי קליטה ותיק עבודות לפני/אחרי. Pro מיועד לפנסיונים ומרכזי אילוף — כולל ניהול פנסיון וחדרים, הזמנות אונליין 24/7, ניהול צוות עם הרשאות, מודול אילוף מתקדם ואוטומציות WhatsApp מתקדמות.",
  },
  {
    q: "האם פטרה עובדת בנייד?",
    a: "כן — פטרה מותאמת במלואה לנייד ועובדת בדפדפן מכל מכשיר. ניתן גם להוסיף אותה למסך הבית כ-PWA לגישה מהירה בדיוק כמו אפליקציה רגילה, ללא הורדה מהחנות.",
  },
  {
    q: "איך עובדות תזכורות WhatsApp אוטומטיות?",
    a: "פטרה שולחת תזכורות WhatsApp ללקוחות אוטומטית לפני תורים, אישורי כניסה/יציאה מפנסיון ועוד — דרך ה-API הרשמי של Meta. ניתן לקבוע כמה שעות מראש לשלוח (24/48/72/96 שעות) ולהתאים את נוסח ההודעה. הפיצ'ר זמין במסלול Basic ומעלה.",
  },
  {
    q: "האם לקוחות יכולים לקבוע תורים לבד?",
    a: "כן — עם מסלול Pro תקבל לינק אישי לדף הזמנות אונליין. הלקוח בוחר שירות, תאריך ושעה פנויה ומאשר — הכל נכנס אוטומטית ליומן שלך. 24/7, ללא שיחות טלפון.",
  },
  {
    q: "האם יש סנכרון עם Google Calendar?",
    a: "כן — מסלול Basic ומעלה כולל סנכרון דו-כיווני עם Google Calendar. כל תור שנוצר בפטרה מופיע ביומן גוגל שלך אוטומטית.",
  },
  {
    q: "איך עובדים התשלומים?",
    a: "מסלול Basic ומעלה כולל שליחת בקשת תשלום בוואטסאפ עם לינק ישיר ללקוח. במסלול Pro ניתן ליצור הזמנות מלאות עם פירוט שירותים ולייצא את כל הנתונים הפיננסיים לאקסל. פטרה אינה מפיקה חשבוניות מס — לצורך זה ניתן להשתמש בתוכנת הנהלת חשבונות נפרדת.",
  },
  {
    q: "האם יש ניהול פנסיון?",
    a: "כן — מסלול Pro כולל ניהול פנסיון מלא: חדרים, check-in/out, מניעת כפל הזמנות, ועדכוני WhatsApp אוטומטיים לבעלים. מסלול Free ו-Basic אינם כוללים מודול פנסיון.",
  },
  {
    q: "האם יש ניהול צוות?",
    a: "כן — מסלול Pro כולל ניהול צוות עם הרשאות לפי תפקיד: בעלים, מנהל וצוות. כל עובד נכנס עם אישורי הגישה שלו ורואה רק את מה שרלוונטי לתפקידו. מסלול Basic מיועד למשתמש יחיד בלבד.",
  },
  {
    q: "מה קורה אם יש לי כבר נתונים בטלפון או במערכת אחרת?",
    a: "מעבר קל ובטוח — הצוות שלנו מלווה אותך בייבוא הנתונים. לא תאבד שום מידע.",
  },
  {
    q: "האם ניתן לבטל? מה קורה לנתונים?",
    a: "ניתן לבטל בכל עת ללא קנסות ממסך ההגדרות. הנתונים שלך נשמרים 30 יום לאחר הביטול ואפשר לייצא הכל לאקסל לפני עזיבה.",
  },
  {
    q: "איך משדרגים מסלול?",
    a: "מתוך לוח הבקרה → הגדרות → שדרוג מסלול. בוחרים מסלול, מזינים כרטיס אשראי, ותוך שניות כל הפיצ'רים נפתחים.",
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-12 bg-slate-50 rounded-2xl p-6">
      <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-base">
        <Star className="w-4 h-4 text-amber-500 fill-amber-400" aria-hidden="true" />
        שאלות נפוצות
      </h3>
      <div className="space-y-2">
        {FAQ.map(({ q, a }) => {
          const isOpen = open === q;
          return (
            <div key={q} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : q)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-right hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800 text-sm">{q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-3">
                  {a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PricingSection() {
  const [showComparison, setShowComparison] = useState(false);
  const { user } = useAuth();

  return (
    <section aria-labelledby="pricing-heading" className="py-20 bg-white" id="pricing">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="w-4 h-4" aria-hidden="true" />
            3 מסלולים פשוטים — בחר את שמתאים לך
          </p>
          <h2 id="pricing-heading" className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            מחיר ששווה לכל עסק, בלי הפתעות
          </h2>
          <p className="text-slate-500 text-lg">מסלול חינמי ללא כרטיס אשראי · חיוב מיידי בתשלום · ביטול בכל עת ללא קנסות</p>
        </div>

        {/* 3 Plan cards */}
        <ul
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 list-none p-0 m-0 pt-6"
          aria-label="מסלולי מנוי"
        >
          {PLANS.map((plan) => (
            <li key={plan.key} className="flex flex-col">
              <div
                className={`relative rounded-2xl border-2 flex flex-col h-full transition-all ${
                  plan.highlight
                    ? "border-brand-500 bg-gradient-to-b from-brand-50 to-white shadow-2xl shadow-brand-400/40 ring-4 ring-brand-400/30 scale-[1.02] sm:scale-105 p-5 pt-9 hover:shadow-brand-400/50"
                    : "border-slate-200 bg-white p-5 hover:shadow-md hover:border-slate-300"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  plan.highlight ? (
                    <div
                      aria-hidden="true"
                      className="absolute -top-5 right-1/2 translate-x-1/2 flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-full bg-gradient-to-l from-brand-600 to-brand-500 text-white shadow-xl shadow-brand-400/60 whitespace-nowrap border border-brand-400/30"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {plan.badge}
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full bg-amber-500 text-white"
                    >
                      {plan.badge}
                    </div>
                  )
                )}

                {/* Plan header */}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 mb-0.5">
                    {plan.name}
                    {plan.badge && <span className="sr-only"> — {plan.badge}</span>}
                  </h3>
                  {plan.subtitle && (
                    <p className="text-xs font-medium text-brand-600 mb-1 leading-snug">{plan.subtitle}</p>
                  )}
                  <p className="text-[11px] text-slate-400 leading-snug mb-3">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {plan.price === 0 ? "חינמי" : `₪${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-400 text-xs" aria-label="לחודש">/חודש</span>
                    )}
                  </div>
                </div>

                {/* Included */}
                <ul className="space-y-1.5 mb-3 flex-1 list-none p-0 m-0">
                  {plan.features.map((f) => {
                    const isHighlighted = typeof f === "object" && f.star;
                    const label = typeof f === "object" ? f.text : f;
                    return (
                      <li
                        key={label}
                        className={`flex items-start gap-1.5 text-xs ${isHighlighted ? "text-brand-700 font-semibold" : "text-slate-700"}`}
                      >
                        <Check
                          aria-hidden="true"
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isHighlighted ? "text-brand-500" : "text-emerald-500"}`}
                        />
                        {isHighlighted ? (
                          <span>
                            {label}
                            <span className="mr-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-brand-100 text-brand-600 align-middle">
                              חדש
                            </span>
                          </span>
                        ) : (
                          label
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* Not included */}
                {plan.notIncluded.length > 0 && (
                  <ul className="space-y-1 mb-4 list-none p-0 m-0 border-t border-slate-100 pt-2 mt-1">
                    {plan.notIncluded.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <X aria-hidden="true" className="w-3.5 h-3.5 text-red-300 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA */}
                {CARDCOM_TIERS.has(plan.key) ? (
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href={user ? `/checkout?tier=${plan.key}` : `/checkout?tier=${plan.key}`}
                      aria-label={`רכוש עכשיו — מסלול ${plan.name}`}
                      className={`text-sm py-2.5 rounded-xl text-center font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        plan.highlight
                          ? "bg-brand-500 hover:bg-brand-600 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                      {user ? "שדרג עכשיו" : "רכוש עכשיו"}
                    </Link>
                    <p className="text-[10px] text-center text-slate-400 leading-snug px-1">
                      חיוב מיידי · ביטול בכל עת · קבלה במייל
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href="/register"
                      aria-label={`התחל בחינם — מסלול ${plan.name}`}
                      className="text-sm py-2.5 rounded-xl text-center font-semibold transition-colors bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      נסה עכשיו
                    </Link>
                    {!user && (
                      <p className="text-[10px] text-center text-emerald-600 font-medium leading-snug px-1">
                        ללא הגבלת זמן, ללא צורך בכרטיס אשראי
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* ── Service Dog Enterprise Banner ─────────────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Icon */}
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-sm">
            <Shield className="w-7 h-7 text-emerald-600" aria-hidden="true" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-1">ייחודי בישראל</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1 leading-snug">
              ארגון כלבי שירות? יש לנו פתרון ייעודי עבורך
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              פלטפורמה מלאה לניהול זכאים, הכשרות ועמידה בדרישות משרד החקלאות.
            </p>
          </div>

          {/* CTA */}
          <a
            href="https://wa.me/972542560964"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            דבר איתנו להתאמת מסלול
          </a>
        </div>

        {/* Toggle comparison table */}
        <div className="text-center mt-8">
          <button
            onClick={() => setShowComparison((v) => !v)}
            aria-expanded={showComparison}
            aria-controls="comparison-table"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
          >
            {showComparison
              ? <><ChevronUp className="w-4 h-4" aria-hidden="true" />הסתר השוואה מלאה</>
              : <><ChevronDown className="w-4 h-4" aria-hidden="true" />השוואה מלאה של כל הפיצ'רים</>
            }
          </button>
        </div>

        {/* Comparison table — 3 plans */}
        {showComparison && (
          <div
            id="comparison-table"
            className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm"
            role="region"
            aria-label="טבלת השוואת מסלולים"
          >
            <table className="w-full min-w-[480px] text-sm border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="text-right px-4 py-3 font-semibold text-slate-700 w-52">פיצ'ר</th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      scope="col"
                      className={`text-center px-3 py-3 font-semibold text-xs ${
                        p.highlight ? "text-brand-600 bg-brand-50/50" : "text-slate-700"
                      }`}
                    >
                      {p.name}
                      {p.badge && (
                        <span className={`block text-[10px] font-bold mt-0.5 ${p.highlight ? "text-brand-500" : "text-amber-500"}`}>
                          {p.badge}
                        </span>
                      )}
                      <span className="block font-normal text-slate-400 mt-0.5 text-[11px]">
                        {p.price === 0 ? "חינמי" : `₪${p.price}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map((group) => (
                  <>
                    <tr key={`cat-${group.category}`} className="bg-slate-50/80">
                      <td colSpan={4} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {group.category}
                      </td>
                    </tr>
                    {group.features.map((feat, i) => (
                      <tr
                        key={feat.name}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                      >
                        <td className="px-4 py-2.5 text-slate-700 text-xs">{feat.name}</td>
                        {PLAN_KEYS.map((pk) => (
                          <td key={pk} className={`text-center px-3 py-2.5 ${PLANS.find(p => p.key === pk)?.highlight ? "bg-brand-50/20" : ""}`}>
                            <FeatureCell value={feat[pk as keyof typeof feat] as FVal} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FAQ */}
        <FaqAccordion />

        {/* WhatsApp contact */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400 mb-3">שאלות? נשמח לעזור בבחירת המסלול המתאים</p>
          <a
            href="https://wa.me/972542560964"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="צור קשר בוואטסאפ — נפתח בחלון חדש"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            צור קשר עכשיו
          </a>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          כל המסלולים כוללים תמיכה בעברית, RTL מלא ואבטחת מידע · ניתן לשדרג, להוריד מסלול, או לבטל בכל עת
        </p>
      </div>
    </section>
  );
}
