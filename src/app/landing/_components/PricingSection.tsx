"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ChevronDown, ChevronUp, MessageCircle, Star, Zap } from "lucide-react";

// ─── Exact data from /upgrade page ────────────────────────────────────────────
const PLANS = [
  {
    key: "free",
    name: "חינמי",
    price: 0,
    badge: null,
    highlight: false,
    description: "התחל לנהל את העסק שלך — בחינם, עד 50 לקוחות",
    features: [
      "עד 50 לקוחות",
      "CRM / לידים (עד 20)",
      "מערכת ניהול תהליכי אילוף (עד 50 תוכניות)",
      "ניהול משימות (עד 20 פתוחות)",
      "מחירון שירותים",
    ],
    notIncluded: [
      "מערכת קביעת תורים",
      "תזכורות WhatsApp ללקוחות",
      "ניהול פנסיון",
      "שליחת טפסי קליטה ללקוח",
      "ניהול צוות",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    price: 99,
    badge: null,
    highlight: false,
    description: "לעסקים שרוצים את הכלים הבסיסיים לניהול מסודר",
    features: [
      "לקוחות ללא הגבלה",
      "יומן תורים ופגישות",
      "מערכת ניהול תורים",
      "CRM / לידים ללא הגבלה",
      "ניהול תהליכי אילוף ללא הגבלה",
      "שליחת בקשת תשלום",
      "בקשת תשלום WhatsApp",
      "תזכורות WhatsApp",
      "דוחות ואנליטיקס",
      "טפסי קליטה",
      "סנכרון Google Calendar",
    ],
    notIncluded: [
      "פנסיון",
      "אוטומציות WhatsApp מתקדמות",
      "ניהול צוות",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 199,
    badge: "הכי פופולרי",
    highlight: true,
    description: "שליטה מלאה — לעסק שגדל",
    features: [
      "הכל ב-Basic",
      "הזמנות אונליין",
      "פנסיון + ניהול חדרים",
      "ניהול קבוצות וסדנאות אילוף",
      "אוטומציות WhatsApp מתקדמות",
      "ניהול צוות ומשתמשים",
      "ייצוא Excel",
      "הודעות מותאמות אישית",
    ],
    notIncluded: ["מודול כלבי שירות", "תיק עבודות גרומר"],
  },
  {
    key: "groomer",
    name: "Groomer+",
    price: 169,
    badge: null,
    highlight: false,
    description: "מסלול ייעודי לגרומרים",
    features: [
      "לקוחות ללא הגבלה",
      "יומן תורים ופגישות",
      "מערכת ניהול תורים",
      "CRM / לידים ללא הגבלה",
      "שליחת בקשת תשלום",
      "בקשת תשלום WhatsApp",
      "תזכורות WhatsApp",
      "דוחות ואנליטיקס",
      "טפסי קליטה",
      "סנכרון Google Calendar",
      "הזמנות אונליין",
      "אוטומציות WhatsApp מתקדמות",
      "ניהול צוות ומשתמשים",
      "ייצוא Excel",
      "הודעות מותאמות אישית",
      "תיק עבודות לפני/אחרי",
    ],
    notIncluded: ["פנסיון", "אילוף", "כלבי שירות"],
  },
  {
    key: "service_dog",
    name: "Service Dog",
    price: 229,
    badge: "חדש",
    highlight: false,
    description: "המערכת המתקדמת הראשונה בישראל לניהול כלבי שירות",
    features: [
      "הכל ב-Pro",
      "ניהול כלבי שירות בתהליך",
      "ניהול תיק זכאים",
      "ניהול כלבייה",
      "מבחני הסמכה",
      "דיווח למשרד החקלאות",
      "כרטיסי זיהוי + QR",
      "פרוטוקולים רפואיים",
      "120+ שעות מעקב אילוף",
    ],
    notIncluded: ["תיק עבודות גרומר"],
  },
] as const;

// ─── Full feature comparison (for toggle table) ────────────────────────────────
type FVal = boolean | string;
interface FRow { name: string; free: FVal; basic: FVal; pro: FVal; groomer: FVal; service_dog: FVal }

const FEATURE_GROUPS: { category: string; features: FRow[] }[] = [
  {
    category: "לקוחות וחיות מחמד",
    features: [
      { name: "לקוחות", free: "עד 50", basic: "ללא הגבלה", pro: "ללא הגבלה", groomer: "ללא הגבלה", service_dog: "ללא הגבלה" },
      { name: "CRM / לידים", free: "עד 20", basic: "ללא הגבלה", pro: "ללא הגבלה", groomer: "ללא הגבלה", service_dog: "ללא הגבלה" },
      { name: "כרטיס בריאות לחיית מחמד", free: true, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "טפסי קליטה דיגיטליים", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "ניהול משימות", free: "עד 20", basic: "ללא הגבלה", pro: "ללא הגבלה", groomer: "ללא הגבלה", service_dog: "ללא הגבלה" },
      { name: "מחירון שירותים", free: true, basic: true, pro: true, groomer: true, service_dog: true },
    ],
  },
  {
    category: "יומן ותורים",
    features: [
      { name: "יומן תורים ופגישות", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "מערכת ניהול תורים", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "הזמנות אונליין (לקוח קובע לבד)", free: false, basic: false, pro: true, groomer: true, service_dog: true },
      { name: "סנכרון Google Calendar", free: false, basic: true, pro: true, groomer: true, service_dog: true },
    ],
  },
  {
    category: "WhatsApp ותקשורת",
    features: [
      { name: "תזכורות WhatsApp", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "בקשת תשלום WhatsApp", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "אוטומציות WhatsApp מתקדמות", free: false, basic: false, pro: true, groomer: true, service_dog: true },
      { name: "הודעות מותאמות אישית", free: false, basic: false, pro: true, groomer: true, service_dog: true },
    ],
  },
  {
    category: "אילוף ומקצוע",
    features: [
      { name: "ניהול תהליכי אילוף", free: "עד 50", basic: "ללא הגבלה", pro: "ללא הגבלה", groomer: false, service_dog: "ללא הגבלה" },
      { name: "ניהול קבוצות וסדנאות", free: false, basic: false, pro: true, groomer: false, service_dog: true },
      { name: "ניהול פנסיון + חדרים", free: false, basic: false, pro: true, groomer: false, service_dog: true },
      { name: "תיק עבודות גרומר לפני/אחרי", free: false, basic: false, pro: false, groomer: true, service_dog: false },
    ],
  },
  {
    category: "כלבי שירות",
    features: [
      { name: "ניהול כלבי שירות בתהליך", free: false, basic: false, pro: false, groomer: false, service_dog: true },
      { name: "ניהול תיק זכאים", free: false, basic: false, pro: false, groomer: false, service_dog: true },
      { name: "מבחני הסמכה", free: false, basic: false, pro: false, groomer: false, service_dog: true },
      { name: "פרוטוקולים רפואיים", free: false, basic: false, pro: false, groomer: false, service_dog: true },
      { name: "כרטיסי זיהוי + QR", free: false, basic: false, pro: false, groomer: false, service_dog: true },
      { name: "דיווח למשרד החקלאות", free: false, basic: false, pro: false, groomer: false, service_dog: true },
      { name: "120+ שעות מעקב אילוף", free: false, basic: false, pro: false, groomer: false, service_dog: true },
    ],
  },
  {
    category: "פיננסים ודוחות",
    features: [
      { name: "שליחת בקשת תשלום", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "ניהול הזמנות", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "חשבוניות דיגיטליות", free: false, basic: false, pro: true, groomer: true, service_dog: true },
      { name: "דוחות ואנליטיקס", free: false, basic: true, pro: true, groomer: true, service_dog: true },
      { name: "ייצוא Excel", free: false, basic: false, pro: true, groomer: true, service_dog: true },
    ],
  },
  {
    category: "ניהול צוות",
    features: [
      { name: "ניהול צוות ומשתמשים", free: false, basic: false, pro: true, groomer: true, service_dog: true },
      { name: "הרשאות לפי תפקיד", free: false, basic: false, pro: true, groomer: true, service_dog: true },
    ],
  },
];

const PLAN_KEYS = ["free", "basic", "pro", "groomer", "service_dog"] as const;

function FeatureCell({ value }: { value: FVal }) {
  if (typeof value === "string") {
    return <span className="text-xs text-slate-600 font-medium">{value}</span>;
  }
  return value
    ? <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-label="כלול" />
    : <X className="w-4 h-4 text-red-300 mx-auto" aria-label="לא כלול" />;
}

const FAQ = [
  { q: "איך משדרגים?", a: "שליחת הודעת WhatsApp לתמיכה — המסלול מתעדכן תוך שעות." },
  { q: "האם ניתן לבטל?", a: "כן, ניתן לבטל בכל עת ללא קנסות." },
  { q: "מה קורה לנתונים בביטול?", a: "הנתונים נשמרים 30 יום לאחר ביטול." },
  { q: "יש ניסיון חינמי?", a: "ניתן ליצור חשבון חינמי ללא כרטיס אשראי ולשדרג בכל עת." },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function PricingSection() {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <section aria-labelledby="pricing-heading" className="py-20 bg-white" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="w-4 h-4" aria-hidden="true" />
            5 מסלולים — מחינמי עד כלבי שירות
          </p>
          <h2 id="pricing-heading" className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            מחירים שקופים, ללא הפתעות
          </h2>
          <p className="text-slate-500 text-lg">התחל בחינם — שדרג רק כשאתה מוכן</p>
        </div>

        {/* Plan cards — horizontal scroll on mobile */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <ul
            className="flex gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-5 list-none p-0 m-0"
            aria-label="מסלולי מנוי"
          >
            {PLANS.map((plan) => (
              <li key={plan.key} className="w-60 lg:w-auto flex flex-col">
                <div
                  className={`relative rounded-2xl border-2 p-5 flex flex-col h-full transition-shadow hover:shadow-md ${
                    plan.highlight
                      ? "border-brand-500 bg-brand-50 shadow-lg shadow-brand-100"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div
                      aria-hidden="true"
                      className={`absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full ${
                        plan.highlight ? "bg-brand-500 text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {plan.badge}
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 mb-0.5">
                      {plan.name}
                      {plan.badge && <span className="sr-only"> — {plan.badge}</span>}
                    </h3>
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
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-slate-700">
                        <Check aria-hidden="true" className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
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
                  <Link
                    href="/register"
                    aria-label={`${plan.price === 0 ? "התחל בחינם" : "התחל בחינם"} — מסלול ${plan.name}`}
                    className={`text-sm py-2.5 rounded-xl text-center font-semibold transition-colors ${
                      plan.highlight
                        ? "bg-brand-500 hover:bg-brand-600 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    {plan.price === 0 ? "התחל בחינם" : "התחל בחינם"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
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

        {/* Comparison table */}
        {showComparison && (
          <div
            id="comparison-table"
            className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm"
            role="region"
            aria-label="טבלת השוואת מסלולים"
          >
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
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
                      <td colSpan={6} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
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
        <div className="mt-12 bg-slate-50 rounded-2xl p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-base">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" aria-hidden="true" />
            שאלות נפוצות
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="font-medium text-slate-800 text-sm mb-1">{q}</div>
                <div className="text-slate-500 text-xs leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp contact */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400 mb-3">שאלות? נשמח לעזור בבחירת המסלול המתאים</p>
          <a
            href="https://wa.me/972504828080"
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
