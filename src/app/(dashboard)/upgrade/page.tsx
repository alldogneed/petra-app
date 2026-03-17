"use client";

import { Check, X, MessageCircle, Crown, Zap, Star } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";
import type { TierKey } from "@/lib/feature-flags";

const PLANS: {
  key: TierKey;
  name: string;
  price: number;
  description: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
  notIncluded: string[];
}[] = [
  {
    key: "free",
    name: "חינמי",
    price: 0,
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
    description: "שליטה מלאה — לעסק שגדל",
    highlight: true,
    badge: "הכי פופולרי",
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
    description: "המערכת המתקדמת הראשונה בישראל לניהול כלבי שירות, המפותחת ע״י מומחים מתוך התחום",
    badge: "חדש",
    features: [
      "הכל ב-Pro",
      "ניהול כלבי שירות בתהליך",
      "ניהול תיק זכאים",
      "ניהול כלבייה",
      "ניהול משימות",
      "מבחני הסמכה",
      "דיווח למשרד החקלאות",
      "כרטיסי זיהוי + QR",
      "פרוטוקולים רפואיים",
      "120+ שעות מעקב אילוף",
    ],
    notIncluded: ["תיק עבודות גרומר"],
  },
];

const WHATSAPP_UPGRADE_PHONE = "972504828080";

const TIER_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  groomer: 2,
  pro: 3,
  service_dog: 4,
};

export default function UpgradePage() {
  const { tier } = usePlan();

  function openWhatsApp(planName: string, price: number, isDowngrade: boolean) {
    const action = isDowngrade ? "לשנמך" : "לשדרג";
    const msg = encodeURIComponent(
      `שלום, אני רוצה ${action} את המנוי שלי ב-Petra למסלול ${planName} (₪${price}/חודש). תוכלו לעזור לי?`
    );
    window.open(`https://wa.me/${WHATSAPP_UPGRADE_PHONE}?text=${msg}`, "_blank");
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Crown className="w-4 h-4" />
          שדרג את המנוי שלך
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">בחר את המסלול המתאים לך</h1>
        <p className="text-slate-500 max-w-lg mx-auto">
          כל המסלולים כוללים גישה מלאה לפיצ׳רים הבסיסיים. ניתן לשדרג, להוריד מסלול, או לבטל בכל עת.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
        {PLANS.map((plan) => {
          const isCurrent = tier === plan.key;
          const isHighlight = plan.highlight;
          const isDowngrade = TIER_RANK[plan.key] < TIER_RANK[tier ?? "free"];

          return (
            <div
              key={plan.key}
              className={cn(
                "rounded-2xl border-2 p-6 flex flex-col relative",
                isHighlight
                  ? "border-brand-500 bg-brand-50 shadow-lg shadow-brand-100"
                  : "border-slate-200 bg-white",
                isCurrent && "border-green-400 bg-green-50"
              )}
            >
              {/* Badge */}
              {plan.badge && !isCurrent && (
                <div className={cn(
                  "absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full",
                  isHighlight ? "bg-brand-500 text-white" : "bg-amber-500 text-white"
                )}>
                  {plan.badge}
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full bg-green-500 text-white">
                  המסלול הנוכחי שלך
                </div>
              )}

              {/* Plan info */}
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mt-1 mb-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {plan.price === 0 ? "חינם" : `₪${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-slate-400 text-sm">/חודש</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
                {plan.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-400">
                    <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold bg-green-100 text-green-700">
                  ✓ המסלול שלך
                </div>
              ) : (
                <button
                  onClick={() => openWhatsApp(plan.name, plan.price, isDowngrade)}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
                    isDowngrade
                      ? "bg-slate-200 hover:bg-slate-300 text-slate-700"
                      : isHighlight
                      ? "bg-brand-500 hover:bg-brand-600 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                  {isDowngrade ? `שנמך ל-${plan.name}` : `שדרג ל-${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="card p-6">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          שאלות נפוצות
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { q: "איך משדרגים?", a: "שליחת הודעת WhatsApp לתמיכה — המסלול מתעדכן תוך שעות." },
            { q: "האם ניתן לבטל?", a: "כן, ניתן לבטל בכל עת ללא קנסות." },
            { q: "מה קורה לנתונים בביטול?", a: "הנתונים נשמרים 30 יום לאחר ביטול." },
            { q: "יש ניסיון חינמי?", a: "ניתן ליצור חשבון חינמי ללא כרטיס אשראי ולשדרג בכל עת." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-slate-50 rounded-xl p-4">
              <div className="font-medium text-slate-800 text-sm mb-1">{q}</div>
              <div className="text-slate-500 text-xs leading-relaxed">{a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-400">
          שאלות? פנה אלינו ב-WhatsApp ונשמח לעזור בבחירת המסלול המתאים.
        </p>
        <button
          onClick={() => window.open(`https://wa.me/${WHATSAPP_UPGRADE_PHONE}`, "_blank")}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
        >
          <MessageCircle className="w-4 h-4" />
          צור קשר עכשיו
        </button>
      </div>
    </div>
  );
}
