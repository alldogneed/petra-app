import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  MessageCircle,
  Dog,
  Scissors,
  Home,
  Shield,
  Check,
  ChevronLeft,
  Zap,
  Users,
  TrendingUp,
  Play,
  Calendar,
  FileSignature,
  CreditCard,
  BarChart3,
  Smartphone,
} from "lucide-react";
import { PricingSection } from "./_components/PricingSection";
import { WhatsAppFAB } from "./_components/WhatsAppFAB";
import { AccessibilityButton } from "./_components/AccessibilityButton";
import { ClientsMarquee } from "./_components/ClientsMarquee";
import { LandingNav } from "./_components/LandingNav";
import { DashboardMockup } from "./_components/DashboardMockup";

export const metadata: Metadata = {
  title: "Petra — מערכת ניהול לעסקי חיות מחמד | אילוף, פנסיון, גרומינג",
  description:
    "מערכת ניהול חכמה לאלפי כלבים, גרומרים ופנסיונים בישראל. ניהול לקוחות, תורים, תזכורות WhatsApp אוטומטיות, יומן דיגיטלי ועוד — במקום אחד. מסלול חינמי ללא כרטיס אשראי.",
  keywords: [
    "מערכת ניהול אלוף כלבים",
    "תוכנה לאילוף כלבים",
    "ניהול פנסיון כלבים",
    "תוכנה לגרומרים",
    "CRM לאלפים",
    "ניהול תורים לאלפים",
    "תזכורות WhatsApp אוטומטיות",
    "אילוף כלבים תוכנה ישראל",
    "ניהול לקוחות לעסקי כלבים",
    "פטרה",
  ],
  alternates: {
    canonical: "https://petra-app.com/landing",
  },
  openGraph: {
    title: "Petra — מערכת ניהול לעסקי חיות מחמד",
    description:
      "ניהול לקוחות, תורים, WhatsApp ופנסיון — כל הכלים לעסק שלך במקום אחד. התחל בחינם.",
    url: "https://petra-app.com/landing",
    images: [
      {
        url: "/hero-image.png",
        width: 1200,
        height: 630,
        alt: "Petra — מערכת ניהול לעסקי חיות מחמד",
      },
    ],
  },
};

const WHATSAPP_SUPPORT = "https://wa.me/972542560964";

// ─── Data ─────────────────────────────────────────────────────────────────────

const TRUST_STATS = [
  { num: "117+", label: "עסקים פעילים" },
  { num: "15", label: "שנים בשטח" },
  { num: "4.9★", label: "דירוג ממוצע" },
  { num: "99.9%", label: "זמינות" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: Users,
    title: "מייצרים חשבון בשניות",
    desc: "בלי כרטיס אשראי ובלי שאלות מיותרות. בתוך 30 שניות אתה כבר בתוך המערכת החדשה שלך.",
  },
  {
    n: "02",
    icon: Zap,
    title: "מנקים את השולחן",
    desc: "שלחו לנו את רשימת הלקוחות ונייבא הכל בשבילכם תוך 24 שעות. ממחברת ישנה, מאקסל, גוגל קונטקטס או כל קובץ CSV.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "העסק עובד בשבילך",
    desc: "תזכורות הוואטסאפ נשלחות לבד, היומן מתמלא ואתה חוזר למקום שאתה הכי אוהב לעבוד עם בעלי החיים.",
  },
];

const AUDIENCES = [
  {
    icon: Dog,
    accentColor: "#F97316",
    accentBg: "#FFF7ED",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    accentBorder: "border-t-[3px]",
    accentStyle: { borderTopColor: "#F97316" },
    checkColor: "text-orange-500",
    title: "מאלפי כלבים",
    features: [
      "כל תוכנית האילוף בכיס שלך עם מעקב התקדמות בזמן אמת מהשטח",
      "יעדים, משימות וסדר לכל חיית מחמד בלחיצת כפתור",
      "תזכורות WhatsApp נשלחות לבד, אפס הברזות",
    ],
    mockupBg: "from-orange-50 to-orange-100",
    mockupContent: (
      <div className="p-3 space-y-2">
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">פל</div>
            <div>
              <div className="text-[11px] font-semibold text-slate-800">פלאפי · אילוף</div>
              <div className="text-[9px] text-slate-400">שיעור 8 / 12</div>
            </div>
          </div>
          <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: "67%" }} /></div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-orange-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">לו</div>
            <div>
              <div className="text-[11px] font-semibold text-slate-800">לונה · ציות בסיסי</div>
              <div className="text-[9px] text-slate-400">שיעור 3 / 8</div>
            </div>
          </div>
          <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: "38%" }} /></div>
        </div>
      </div>
    ),
  },
  {
    icon: Scissors,
    accentColor: "#8B5CF6",
    accentBg: "#F5F3FF",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    accentBorder: "border-t-[3px]",
    accentStyle: { borderTopColor: "#8B5CF6" },
    checkColor: "text-violet-500",
    title: "גרומרים",
    features: [
      "יומן חכם ששולח תזכורות לבד, בלי חפירות בוואטסאפ",
      "תיק עבודות לפני ואחרי לכל לקוח, הוכחות בשטח",
      "לינק לתשלום נשלח בוואטסאפ — הכסף מגיע בלי מרדפים",
    ],
    mockupBg: "from-violet-50 to-violet-100",
    mockupContent: (
      <div className="p-3 space-y-2">
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">קו</div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-800">קוקו · טיפוח מלא</div>
              <div className="text-[9px] text-slate-400">היום · 14:00</div>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">אושר</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-300 flex items-center justify-center text-white text-[10px] font-bold shrink-0">בו</div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-800">בובי · גזירה</div>
              <div className="text-[9px] text-slate-400">15:30</div>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">תשלום</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Home,
    accentColor: "#3B82F6",
    accentBg: "#EFF6FF",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accentBorder: "border-t-[3px]",
    accentStyle: { borderTopColor: "#3B82F6" },
    checkColor: "text-blue-500",
    title: "פנסיונים",
    features: [
      "ניהול חדרים בזמן אמת, המערכת מונעת כפל הזמנות לפני שזה קורה",
      "פרטי החיה, הרגלים ובריאות מוכנים לפני שנכנסים לצ'ק-אין",
      "תמונות ועדכוני WhatsApp יוצאים לבד לבעלים, בלי שתזכר",
    ],
    mockupBg: "from-blue-50 to-blue-100",
    mockupContent: (
      <div className="p-3 space-y-2">
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold text-slate-800">חדרים · ספטמבר</div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">9 / 12</span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className={`h-1.5 rounded-sm ${i <= 4 ? "bg-blue-500" : "bg-blue-100"}`} />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">מק</div>
            <div>
              <div className="text-[11px] font-semibold text-slate-800">מאקס · 3 לילות</div>
              <div className="text-[9px] text-slate-400">חדר 4 · אוכל מהבית</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Shield,
    accentColor: "#10B981",
    accentBg: "#ECFDF5",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accentBorder: "border-t-[3px]",
    accentStyle: { borderTopColor: "#10B981" },
    checkColor: "text-emerald-500",
    title: "מרכזי הכשרת כלבי שירות",
    features: [
      "מעקב שלבי הכשרה מלא ודיווח למשרד החקלאות",
      "ניהול תיקי זכאים, שיבוצים והסמכות במקום אחד",
      "ייצוא דוחות מקצועיים וכרטיסי זיהוי עם QR",
    ],
    mockupBg: "from-emerald-50 to-emerald-100",
    mockupContent: (
      <div className="p-3 space-y-2">
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">בל</div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-800">בלאק · שלב 4 / 6</div>
              <div className="text-[9px] text-slate-400">הכשרה מלאה</div>
            </div>
          </div>
          <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: "67%" }} /></div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-slate-800">QR מוכן</div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">דוח חודשי</span>
          </div>
        </div>
      </div>
    ),
  },
];

const FEATURES = [
  {
    icon: MessageCircle,
    iconBg: "bg-emerald-500",
    title: "WhatsApp בילט-אין",
    desc: "שליחה ישירות מהיומן. תזכורות אוטומטיות. 98% פתיחה.",
  },
  {
    icon: Calendar,
    iconBg: "bg-orange-500",
    title: "יומן חכם",
    desc: "חוקי זמינות גמישים. סנכרון Google Calendar.",
  },
  {
    icon: FileSignature,
    iconBg: "bg-blue-500",
    title: "חוזים דיגיטליים",
    desc: "חתימות מקוונות. תוקף משפטי.",
  },
  {
    icon: CreditCard,
    iconBg: "bg-violet-500",
    title: "חיובים אוטומטיים",
    desc: "חיוב חוזר בכרטיס. חשבוניות אוטומטיות.",
  },
  {
    icon: BarChart3,
    iconBg: "bg-amber-500",
    title: "דשבורד עסקי",
    desc: "הכנסות, ביצועים, חזרת לקוחות בזמן אמת.",
  },
  {
    icon: Smartphone,
    iconBg: "bg-pink-500",
    title: "אפליקציית לקוח",
    desc: "הזמנה אונליין במיתוג שלך. PWA, ללא הורדה.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "var(--font-heebo), sans-serif" }}>
      {/* Skip-to-content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-xl focus:font-medium focus:shadow-lg"
      >
        דלג לתוכן הראשי
      </a>

      <LandingNav />

      <main id="main-content" tabIndex={-1} className="outline-none" style={{ overflowX: "clip" }}>

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative"
          style={{ background: "#0B1220", paddingTop: 90, paddingBottom: 110, overflow: "clip" }}
        >
          {/* Orange radial glow — top-right (physical right in RTL) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              right: "-25%", top: "-10%", width: "75%", height: "75%",
              background: "radial-gradient(ellipse at center, rgba(249,115,22,0.22) 0%, transparent 60%)",
            }}
          />
          {/* Dot pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse 80% 60% at 60% 0%, black 0%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 60% 0%, black 0%, transparent 75%)",
            }}
          />

          <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-7">
            <div className="grid lg:grid-cols-[1fr_1.15fr] gap-[60px] items-center">

              {/* Text column — right side in RTL */}
              <div className="min-w-0 text-center lg:text-right">
                {/* Eyebrow pill */}
                <span className="mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium"
                  style={{ background: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.20)", color: "#FDBA74" }}>
                  <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">המערכת שנבנתה על ידי מקצוענים בבעלי חיים, עבור מקצוענים בבעלי חיים</span>
                  <span className="sm:hidden">בנויה במיוחד לעסקי חיות מחמד</span>
                </span>

                <h1
                  id="hero-heading"
                  className="mb-5 font-extrabold text-white"
                  style={{
                    fontSize: "clamp(26px, 7.5vw, 64px)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.035em",
                    textShadow: "0 2px 24px rgba(0,0,0,0.35)",
                  }}
                >
                  תפסיקו לרדוף<br />
                  אחרי זנבות.<br />
                  <span
                    style={{
                      color: "#FDBA74",
                      WebkitTextFillColor: "#FDBA74",
                      textShadow: "0 0 28px rgba(249,115,22,0.45), 0 2px 24px rgba(0,0,0,0.35)",
                      display: "inline-block",
                    }}
                  >תנו לפטרה</span> לנהל<br />
                  את העסק שלכם.
                </h1>

                <p className="mb-8 max-w-[540px] mx-auto lg:mx-0 text-lg leading-[1.6]" style={{ color: "rgba(226,232,240,0.85)" }}>
                  כדי שתפסיקו לאבד לקוחות מתזכורות שנשכחו, ולא תטבעו בהודעות וואטסאפ,{" "}ותחזרו לעשות את מה שאתם באמת אוהבים לעבוד עם בעלי החיים שלכם.
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 mb-7">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-brand-400"
                    style={{
                      background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
                      boxShadow: "0 10px 28px -8px rgba(249,115,22,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                  >
                    התחל בחינם עכשיו
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="#video"
                    className="inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-medium text-white transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    צפה בדמו · 30 שניות
                  </Link>
                </div>

                <ul className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 list-none p-0 m-0">
                  {["ללא כרטיס אשראי למנוי החינמי", "מעבר קל ממערכות אחרות", "מסלול חינמי לצמיתות — ללא כרטיס אשראי"].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm" style={{ color: "rgba(226,232,240,0.75)" }}>
                      <span className="inline-flex w-[18px] h-[18px] rounded-full items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.20)" }}>
                        <Check className="w-2.5 h-2.5" style={{ color: "#FDBA74" }} aria-hidden="true" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Dashboard mockup column — left side in RTL */}
              <div aria-hidden="true" className="relative mt-8 lg:mt-0 min-w-0">
                {/* Outer glow */}
                <div className="absolute -inset-6 rounded-3xl pointer-events-none" style={{ background: "rgba(249,115,22,0.06)", filter: "blur(32px)" }} />

                <div className="relative">
                  <DashboardMockup />

                  {/* Floating toast — top-left of frame (RTL: physical left) */}
                  <div
                    className="absolute -top-6 -left-8 bg-white rounded-2xl flex items-center gap-3 px-4 py-3 min-w-[240px] pointer-events-none"
                    style={{
                      boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05)",
                      animation: "float 6s ease-in-out infinite",
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" style={{ strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">תזכורת נשלחה ✓</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">לדורית · WhatsApp · לפני שנייה</div>
                    </div>
                  </div>

                  {/* Floating WhatsApp bubble — bottom-left */}
                  <div
                    className="absolute -bottom-4 -left-8 bg-white rounded-2xl px-4 py-3 min-w-[220px] pointer-events-none"
                    style={{
                      boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05)",
                      animation: "float 6s ease-in-out infinite",
                      animationDelay: "-3s",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                        <MessageCircle className="w-3.5 h-3.5 text-white fill-white" />
                      </div>
                      <span className="text-[12px] font-semibold text-slate-900">לקוחות</span>
                      <span className="text-[10px] font-semibold text-emerald-600 mr-auto">98% פתיחה</span>
                    </div>
                    <div className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-2 leading-snug">
                      היי דורית, פלאפי מוזמנת מחר ב־15:30 לאילוף 🐾
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
          `}</style>
        </section>

        {/* ── Trust bar ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="נתוני אמינות"
          style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "22px 0" }}
        >
          <dl className="mx-auto max-w-[1240px] px-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {TRUST_STATS.map(({ num, label }, i) => (
              <div
                key={label}
                className="flex flex-col items-center text-center py-2"
                style={i < 3 ? { borderLeft: "1px solid rgba(255,255,255,0.10)" } : undefined}
              >
                <dt
                  className="text-2xl font-extrabold mb-1"
                  style={{ color: "#FDBA74", fontFamily: "SFMono-Regular, Menlo, monospace", letterSpacing: "-0.02em" }}
                >
                  {num}
                </dt>
                <dd className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="py-[100px] bg-white" id="how">
          <div className="mx-auto max-w-[1240px] px-7">
            <div className="text-center mb-14">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ background: "var(--brand-50, #FFF7ED)", color: "var(--brand-700, #C2410C)" }}>
                תוך 3 דקות
              </span>
              <h2
                id="how-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}
              >
                מתחילים בשלוש דקות.{" "}
                <span className="text-brand-500">פשוט כמו לשלוח וואטסאפ.</span>
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto leading-[1.55]">
                פשוט כמו לשלוח וואטסאפ. בלי ללמוד תוכנות מורכבות.
              </p>
            </div>

            <ol className="grid md:grid-cols-3 gap-6 list-none p-0 m-0">
              {HOW_IT_WORKS.map(({ n, icon: Icon, title, desc }) => (
                <li
                  key={n}
                  className="group relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-8 transition-all duration-200 hover:-translate-y-[3px] hover:border-orange-300 shadow-sm hover:shadow-xl"
                >
                  {/* Decorative big number */}
                  <div
                    aria-hidden="true"
                    className="absolute top-3 left-4 leading-none select-none font-black"
                    style={{ fontSize: 96, color: "#F97316", opacity: 0.08, fontFamily: "SFMono-Regular, Menlo, monospace", letterSpacing: "-0.05em" }}
                    dir="ltr"
                  >
                    {n}
                  </div>

                  {/* Icon tile */}
                  <div className="relative z-10 mb-5 w-12 h-12 rounded-[14px] border border-orange-100 bg-orange-50 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-500 group-hover:border-brand-500">
                    <Icon className="w-5 h-5 text-brand-500 transition-colors duration-200 group-hover:text-white" aria-hidden="true" />
                  </div>

                  <h3 className="relative z-10 text-[19px] font-bold text-slate-900 mb-2" style={{ letterSpacing: "-0.015em" }}>{title}</h3>
                  <p className="relative z-10 text-sm text-slate-500 leading-[1.6] m-0">{desc}</p>
                </li>
              ))}
            </ol>

            <div className="text-center mt-12">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-brand-400"
                style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)", boxShadow: "0 10px 28px -8px rgba(249,115,22,0.6)" }}
              >
                בוא נראה איך זה עובד
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Teaser video ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="video-heading" className="py-24 bg-slate-900" id="video">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 id="video-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
                פטרה בפעולה — 30 שניות
              </h2>
              <p className="text-slate-400 text-lg">
                ראה איך עסקי חיות מחמד מנהלים תורים, לידים ופנסיון — בלי אקסל ובלי בלאגן
              </p>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/8 aspect-video bg-slate-800">
              <video
                src="/teaser.mp4"
                controls
                preload="metadata"
                className="w-full h-full object-cover"
                aria-label="סרטון טיזר — פטרה ניהול עסקי חיות מחמד"
              />
            </div>
            <div className="text-center mt-8">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px"
                style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)", boxShadow: "0 10px 28px -8px rgba(249,115,22,0.6)" }}
              >
                התחל בחינם עכשיו
              </Link>
            </div>
          </div>
        </section>

        {/* ── Audiences ─────────────────────────────────────────────────────────── */}
        <section aria-labelledby="audience-heading" className="py-[100px] bg-slate-50" id="audiences">
          <div className="mx-auto max-w-[1240px] px-7">
            <div className="text-center mb-14">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ background: "var(--brand-50, #FFF7ED)", color: "var(--brand-700, #C2410C)" }}>
                למי פטרה מתאימה
              </span>
              <h2
                id="audience-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
              >
                בנויה במיוחד{" "}
                <span className="text-brand-500">לעסקי חיות מחמד.</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
                כלים ייעודיים לכל תחום — בלי לאלץ אותך להתאים את העסק לתוכנה.
              </p>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
              {AUDIENCES.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.title}>
                    <article
                      className="group flex flex-col rounded-[20px] border border-slate-200 bg-white overflow-hidden h-full transition-all duration-200 hover:-translate-y-[3px]"
                      style={a.accentStyle}
                    >
                      {/* Colored mockup header */}
                      <div className={`relative bg-gradient-to-br ${a.mockupBg} shrink-0`} style={{ minHeight: 130 }}>
                        {a.mockupContent}
                        {/* Icon badge */}
                        <div className={`absolute bottom-3 right-3 w-[42px] h-[42px] rounded-xl ${a.iconBg} flex items-center justify-center shadow-md`}>
                          <Icon className={`w-5 h-5 ${a.iconColor}`} aria-hidden="true" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col flex-1 p-5">
                        <h3 className="text-[17px] font-bold text-slate-900 mb-3" style={{ letterSpacing: "-0.01em" }}>{a.title}</h3>
                        <ul className="space-y-2 list-none p-0 m-0 flex-1">
                          {a.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-[13px] text-slate-600 leading-[1.45]">
                              <Check className={`w-3.5 h-3.5 ${a.checkColor} shrink-0 mt-0.5`} aria-hidden="true" style={{ strokeWidth: 2.5 }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <a
                          href="#pricing"
                          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition-all hover:gap-2 focus:outline-none focus:underline"
                          style={{ color: "var(--brand-700, #C2410C)" }}
                        >
                          מעבר למסלול שלי
                          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="features-heading" className="py-[100px] bg-white" id="features">
          <div className="mx-auto max-w-[1240px] px-7">
            <div className="text-center mb-14">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ background: "var(--brand-50, #FFF7ED)", color: "var(--brand-700, #C2410C)" }}>
                כל מה שצריך
              </span>
              <h2
                id="features-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
              >
                WhatsApp, יומן, פנסיון, חיובים —{" "}
                <span className="text-brand-500">באחד.</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
                לא עוד שש תוכנות שמדברות אחת עם השנייה דרך אקסל.
              </p>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
              {FEATURES.map(({ icon: Icon, iconBg, title, desc }) => (
                <li key={title}>
                  <article
                    className="group rounded-[20px] border border-slate-200 bg-white p-7 h-full transition-all duration-200 hover:-translate-y-[2px] hover:border-orange-300"
                    style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
                  >
                    <div className={`mb-4 w-14 h-14 rounded-[14px] ${iconBg} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" aria-hidden="true" style={{ strokeWidth: 1.75 }} />
                    </div>
                    <h3 className="text-[19px] font-bold text-slate-900 mb-2" style={{ letterSpacing: "-0.01em" }}>{title}</h3>
                    <p className="text-sm text-slate-500 leading-[1.55] m-0">{desc}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Client logos marquee ───────────────────────────────────────────────── */}
        <ClientsMarquee />

        {/* ── About / Our Story ─────────────────────────────────────────────────── */}
        <section
          aria-labelledby="about-heading"
          id="about"
          className="py-[100px] overflow-hidden"
          style={{ background: "linear-gradient(180deg, #FFF7ED 0%, #FFEDD5 100%)" }}
        >
          <div className="mx-auto max-w-[1240px] px-7">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Right col — Text */}
              <div>
                <span className="mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--brand-100, #FFEDD5)", color: "var(--brand-700, #C2410C)" }}>
                  <Dog className="w-3.5 h-3.5" aria-hidden="true" />
                  הסיפור שלנו
                </span>

                <h2
                  id="about-heading"
                  className="text-slate-900 font-extrabold"
                  style={{ fontSize: "clamp(28px, 3.5vw, 42px)", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 18 }}
                >
                  לא נולדנו במשרד ממוזג.<br />
                  <span className="text-brand-500">באנו מהשטח.</span>
                </h2>

                <p className="text-lg text-slate-600 leading-[1.6] mb-8" style={{ maxWidth: 480 }}>
                  פטרה היא החטיבה הדיגיטלית מבית All-Dog. זיקקנו 15 שנות ניסיון בעולם הכלבים לתוך פלטפורמה אחת.
                </p>

                <ul className="space-y-[18px] list-none p-0 m-0">
                  {[
                    { icon: Zap, text: "פטרה נבנתה מתוך הבנה של מה קורה כשיש לך רצועה ביד אחת וטלפון ביד שנייה. המערכת חושבת כמו איש מקצוע, לא כמו מתכנת." },
                    { icon: Users, text: "המערכת משתפרת כל יום. מאלפים, גרומרים ומנהלי פנסיונים יושבים פיזית עם צוות הפיתוח שלנו כדי לדייק כל כפתור." },
                    { icon: MessageCircle, text: "אנחנו מבינים את הלחץ של פנסיון בשיא העונה, ואת המחיר של תור שמתבטל. בנינו את הפתרון שאנחנו חיפשנו לעצמנו." },
                  ].map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--brand-100, #FFEDD5)" }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: "var(--brand-600, #EA580C)", strokeWidth: 2 }} aria-hidden="true" />
                      </div>
                      <p className="text-sm text-slate-600 leading-[1.55] m-0">{text}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Left col — Photo + stat card */}
              <div aria-hidden="true" className="relative">
                {/* Decorative blocks */}
                <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-2xl -z-10" style={{ background: "rgba(251,146,60,0.4)" }} />
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-xl -z-10" style={{ background: "rgba(245,158,11,0.4)" }} />

                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden" style={{ boxShadow: "0 30px 60px -20px rgba(15,23,42,0.25)" }}>
                  <Image
                    src="/about-field-2.png"
                    alt="מאלף עובד עם כלב — Petra ו-All-Dog"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  {/* Gradient overlay bottom */}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 60%, rgba(15,23,42,0.4) 100%)" }} />
                </div>

                {/* Floating stat card */}
                <div
                  className="absolute bottom-6 right-6 bg-white rounded-[14px] px-[18px] py-3.5"
                  style={{ boxShadow: "0 12px 32px -8px rgba(0,0,0,0.25)" }}
                >
                  <div className="text-[28px] font-extrabold leading-tight" style={{ color: "var(--brand-700, #C2410C)", letterSpacing: "-0.025em" }}>15+ שנים</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">בשטח · עם כלבים</div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────────── */}
        <PricingSection />

        {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="relative overflow-hidden text-center"
          style={{ background: "#0F172A", padding: "130px 0" }}
        >
          {/* Orange glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 60% at 50% 110%, rgba(249,115,22,0.32) 0%, transparent 65%)" }}
          />
          {/* Dot texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              opacity: 0.6,
            }}
          />

          <div className="relative z-10 mx-auto max-w-[720px] px-7">
            <span
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium"
              style={{ background: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.25)", color: "#FDBA74" }}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              התחל היום — חינם לגמרי
            </span>

            <h2
              id="cta-heading"
              className="font-extrabold text-white"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.035em", lineHeight: 1.05, marginBottom: 18 }}
            >
              מוכן לשדרג<br />את העסק שלך?
            </h2>
            <p className="text-lg mb-9" style={{ color: "rgba(226,232,240,0.75)" }}>
              הצטרף לבעלי עסקים שכבר עובדים עם פטרה.
            </p>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white transition-all hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-brand-400"
              style={{
                background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
                boxShadow: "0 10px 28px -8px rgba(249,115,22,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              תעבירו אותי לפטרה
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Link>

            <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 list-none p-0 m-0">
              {["מסלול חינמי לצמיתות", "ביטול פשוט בכל עת", "מעבר קל ממערכות אחרות"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(226,232,240,0.7)" }}>
                  <Check className="w-3 h-3 shrink-0" style={{ color: "#FDBA74", strokeWidth: 3 }} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer
        style={{ background: "#0B1120", color: "rgba(226,232,240,0.7)", padding: "56px 0 32px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        role="contentinfo"
      >
        <div className="mx-auto max-w-[1240px] px-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 pb-7"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 22 }}>
            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
              <Image src="/petra-logo.png" alt="לוגו פטרה" width={30} height={30} className="object-contain" />
              <div>
                <div className="text-white font-extrabold text-base" style={{ letterSpacing: "-0.02em" }}>פטרה</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.7)" }}>ניהול עסקי חיות מחמד</div>
              </div>
            </div>

            {/* Nav links */}
            <nav aria-label="ניווט תחתון">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-3 list-none p-0 m-0">
                {[
                  { href: "#features", label: "מאפיינים" },
                  { href: "#pricing", label: "מחירים" },
                  { href: WHATSAPP_SUPPORT, label: "תמיכה", external: true, icon: MessageCircle },
                  { href: "/privacy", label: "פרטיות" },
                  { href: "/terms", label: "תנאי שימוש" },
                  { href: "/accessibility", label: "נגישות" },
                ].map(({ href, label, external, icon: Icon }) => (
                  <li key={label}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm transition-colors hover:text-white inline-flex items-center gap-1.5 focus:outline-none focus:underline"
                      >
                        {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
                        {label}
                      </a>
                    ) : (
                      <Link href={href} className="text-sm transition-colors hover:text-white focus:outline-none focus:underline">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <p className="text-center text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.7)" }}>
            © 2026 Petra · הוקמה על ידי החטיבה הדיגיטלית של{" "}
            <a
              href="https://all-dog.co.il"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-400 underline underline-offset-2"
              style={{ color: "rgba(226,232,240,0.85)" }}
            >
              All-Dog
            </a>
          </p>
        </div>
      </footer>

      {/* ── Floating buttons ──────────────────────────────────────────────────── */}
      <WhatsAppFAB />
      <AccessibilityButton />

      {/* ── JSON-LD ───────────────────────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                "@id": "https://petra-app.com/#app",
                name: "Petra",
                url: "https://petra-app.com/landing",
                description: "מערכת ניהול חכמה לאלפי כלבים, גרומרים ופנסיונים בישראל. ניהול לקוחות, תורים, תזכורות WhatsApp אוטומטיות ויומן דיגיטלי.",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web, iOS, Android",
                inLanguage: "he",
                offers: [
                  { "@type": "Offer", name: "חינמי", price: "0", priceCurrency: "ILS", description: "עד 50 לקוחות, ללא כרטיס אשראי" },
                  { "@type": "Offer", name: "Basic", price: "99", priceCurrency: "ILS", billingDuration: "P1M" },
                  { "@type": "Offer", name: "Pro", price: "199", priceCurrency: "ILS", billingDuration: "P1M" },
                ],
                publisher: {
                  "@type": "Organization",
                  "@id": "https://petra-app.com/#org",
                  name: "Petra — All-Dog",
                  url: "https://petra-app.com",
                  logo: { "@type": "ImageObject", url: "https://petra-app.com/petra-logo.png" },
                  contactPoint: { "@type": "ContactPoint", telephone: "+972-54-256-0964", contactType: "customer support", availableLanguage: "Hebrew" },
                },
              },
              { "@type": "Organization", "@id": "https://petra-app.com/#org", name: "Petra", url: "https://petra-app.com", logo: "https://petra-app.com/petra-logo.png", sameAs: ["https://all-dog.co.il"] },
              { "@type": "WebSite", "@id": "https://petra-app.com/#website", url: "https://petra-app.com", name: "Petra", inLanguage: "he", publisher: { "@id": "https://petra-app.com/#org" } },
            ],
          }),
        }}
      />
    </div>
  );
}
