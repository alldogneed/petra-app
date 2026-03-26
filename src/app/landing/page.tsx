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
  ArrowLeft,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";
import { PricingSection } from "./_components/PricingSection";
import { WhatsAppFAB } from "./_components/WhatsAppFAB";
import { AccessibilityButton } from "./_components/AccessibilityButton";
import { TestimonialsCarousel } from "./_components/TestimonialsCarousel";
import { LandingNav } from "./_components/LandingNav";
import { DashboardMockup } from "./_components/DashboardMockup";
import { WhatsAppMockupAnimated } from "./_components/WhatsAppMockupAnimated";
import { FeaturesSection } from "./_components/FeaturesSection";
import {
  TrainerMockup,
  GroomerMockup,
  BoardingMockup,
  ServiceDogMockup,
} from "./_components/AudienceMockups";

export const metadata: Metadata = {
  title: "Petra — מערכת ניהול לעסקי חיות מחמד",
  description:
    "ניהול לקוחות, תורים, WhatsApp ופנסיון — כל הכלים לעסק שלך במקום אחד. התחל בחינם.",
};

const WHATSAPP_DEMO =
  "https://wa.me/972515311435?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A9%D7%9E%D7%97%20%D7%9C%D7%A7%D7%91%D7%95%D7%A2%20%D7%93%D7%9E%D7%95%20%D7%9C%D7%A4%D7%98%D7%A8%D7%94";

// ─── Data ─────────────────────────────────────────────────────────────────────

const AUDIENCES = [
  {
    icon: Dog,
    color: "text-orange-500",
    bg: "bg-orange-50",
    title: "מאלפי כלבים",
    mockup: <TrainerMockup />,
    features: [
      "כל תוכנית האילוף בכיס שלך – מעקב התקדמות בזמן אמת מהשטח",
      "סדר בראש: יעדים ומשימות לכל חיית מחמד בלחיצת כפתור",
      "אפס הברזות: תזכורות WhatsApp נשלחות לבד",
    ],
  },
  {
    icon: Scissors,
    color: "text-purple-500",
    bg: "bg-purple-50",
    title: "גרומרים",
    mockup: <GroomerMockup />,
    features: [
      "די לחפירות בוואטסאפ: יומן חכם ששולח תזכורות לבד",
      "הוכחות בשטח: תיק עבודות 'לפני ואחרי' לכל לקוח",
      "גבייה ללא מאמץ: לינק לתשלום וחשבונית אוטומטית",
    ],
  },
  {
    icon: Home,
    color: "text-blue-500",
    bg: "bg-blue-50",
    title: "פנסיון לחיות מחמד",
    mockup: <BoardingMockup />,
    features: [
      "אפס כפל הזמנות: ניהול חדרים בזמן אמת — המערכת נועלת לפני שזה קורה",
      "צ'ק-אין בשניות: פרטי החיה, הרגלים ובריאות — מוכנים לפני שנכנסים",
      "ראש שקט לבעלים: תמונות ועדכוני WhatsApp יוצאים לבד — בלי שתזכר",
    ],
  },
  {
    icon: Shield,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    title: "ארגוני כלבי שירות",
    mockup: <ServiceDogMockup />,
    features: [
      "פרוטוקול הכשרה מלא: מעקב שלבים ודיווח למשרד החקלאות",
      "ניהול תיקי זכאים, שיבוצים והסמכות במקום אחד",
      "תיעוד מקצועי: ייצוא דוחות וכרטיסי זיהוי עם QR",
    ],
  },
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
    desc: "שלחו לנו את רשימת הלקוחות — נייבא הכל בשבילכם תוך 24 שעות. ממחברת ישנה, מאקסל, מגוגל קונטקטס או מכל קובץ CSV.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "העסק עובד בשבילך",
    desc: "תזכורות הוואטסאפ נשלחות לבד, היומן מתמלא — ואתה חוזר למקום שאתה הכי אוהב: לעבוד עם בעלי החיים.",
  },
];



// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "var(--font-heebo), sans-serif" }}
    >
      {/* Skip-to-content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-xl focus:font-medium focus:shadow-lg"
      >
        דלג לתוכן הראשי
      </a>

      {/* ── Sticky nav ───────────────────────────────────────────────────────── */}
      <LandingNav />

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main id="main-content" tabIndex={-1} className="outline-none">

        {/* ── Hero (split layout) ──────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative pt-16"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 60% -5%, rgba(249,115,22,0.22) 0%, transparent 55%), #0F172A",
          }}
        >
          {/* Dot pattern — subtle, not grid-line cliché */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse 80% 60% at 60% 0%, black 0%, transparent 75%)",
            }}
          />

          {/* Warm glow accent bottom-right */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 w-96 h-96 pointer-events-none opacity-10"
            style={{
              background: "radial-gradient(circle, rgba(249,115,22,1) 0%, transparent 70%)",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-28">
            <div className="grid lg:grid-cols-[5fr_7fr] gap-8 lg:gap-12 items-center">

              {/* Text col — first in DOM = right side in RTL */}
              <div className="text-center lg:text-right">
                <p
                  aria-hidden="true"
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 mb-6 animate-fadeIn"
                >
                  <Zap aria-hidden="true" className="w-3.5 h-3.5 text-brand-400" />
                  <span className="text-brand-300 text-sm font-medium">
                    המערכת שנבנתה על ידי מקצוענים בבעלי חיים, עבור מקצוענים בבעלי חיים
                  </span>
                </p>

                <h1
                  id="hero-heading"
                  className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.18] mb-6 animate-slideUp"
                >
                  תפסיק לרדוף אחרי זנבות
                  <br />
                  <span className="text-brand-400">תן לפטרה לנהל</span>
                  <br />
                  את היומן והתשלומים
                </h1>

                <p
                  className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed animate-slideUp"
                  style={{ animationDelay: "120ms" }}
                >
                  כדי שתפסיקו לאבד לקוחות מתזכורות שנשכחו, ולא תטבעו בהודעות וואטסאפ —
                  {" "}ותחזרו לעשות את מה שאתם באמת אוהבים: לעבוד עם בעלי החיים שלכם.
                </p>

                <div
                  className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-3 animate-slideUp"
                  style={{ animationDelay: "220ms" }}
                >
                  <Link
                    href="/register"
                    className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto justify-center shadow-xl shadow-brand-500/30"
                  >
                    התחל בחינם עכשיו
                  </Link>
                  <a
                    href={WHATSAPP_DEMO}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="קבע דמו — נפתח בחלון חדש"
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 text-white text-base font-medium hover:bg-white/10 transition-colors w-full sm:w-auto justify-center focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <MessageCircle aria-hidden="true" className="w-5 h-5" />
                    קבע דמו
                  </a>
                </div>

                {/* Trust signals */}
                <ul
                  className="mt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-x-6 gap-y-2 list-none p-0 m-0 animate-slideUp"
                  style={{ animationDelay: "300ms" }}
                >
                  <li className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                      <Check aria-hidden="true" className="w-3 h-3 text-brand-400" />
                    </div>
                    ללא כרטיס אשראי
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                      <Check aria-hidden="true" className="w-3 h-3 text-brand-400" />
                    </div>
                    מעבר קל ממערכות אחרות
                  </li>
                  <li className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                      <Check aria-hidden="true" className="w-3 h-3 text-brand-400" />
                    </div>
                    14 ימי ניסיון בחינם
                  </li>
                </ul>
              </div>

              {/* Visual col — dashboard mockup */}
              <div aria-hidden="true" className="relative mt-2 lg:mt-0 animate-fadeIn" style={{ animationDelay: "150ms" }}>
                {/* Glow ring behind the mockup */}
                <div className="absolute -inset-6 rounded-3xl bg-brand-500/8 blur-3xl pointer-events-none" />
                <div className="relative">
                  <DashboardMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust bar ─────────────────────────────────────────────────────────── */}
        <section aria-label="אמינות ובטחון" className="bg-slate-900 border-y border-white/6 py-6">
          <dl className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-6">
            {[
              { icon: "🔒", label: "נתוני הלקוחות שלך — שלך לנצח" },
              { icon: "🇮🇱", label: "מיוצר ונתמך בישראל בעברית" },
              { icon: "📱", label: "RTL מלא, עברית מושלמת, מובייל" },
              { icon: "✕",  label: "ביטול פשוט בכל עת — ללא קנסות" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xl shrink-0" aria-hidden="true">{icon}</span>
                <dt className="text-slate-400 text-sm leading-snug">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="py-24 bg-white" id="how">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2
                id="how-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                מתחילים בשלוש דקות
              </h2>
              <p className="text-slate-500 text-lg">
                פשוט כמו לשלוח וואטסאפ. בלי ללמוד תוכנות מורכבות.
              </p>
            </div>

            <ol className="grid md:grid-cols-3 gap-8 list-none p-0 m-0">
              {HOW_IT_WORKS.map(({ n, icon: Icon, title, desc }) => (
                <li key={n} className="relative group">
                  {/* Large decorative step number — editorial */}
                  <div
                    aria-hidden="true"
                    className="text-[96px] font-extrabold leading-none text-brand-500/8 select-none mb-1 transition-colors duration-300 group-hover:text-brand-500/14"
                    dir="ltr"
                  >
                    {n}
                  </div>
                  <div className="-mt-10 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4 group-hover:bg-brand-500 group-hover:border-brand-500 transition-colors duration-300">
                      <Icon
                        className="w-6 h-6 text-brand-500 group-hover:text-white transition-colors duration-300"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="text-center mt-14">
              <Link href="/register" className="btn-primary px-8 py-3.5 text-base shadow-lg shadow-brand-200">
                התחל בחינם עכשיו
              </Link>
            </div>
          </div>
        </section>

        {/* ── Audience section ─────────────────────────────────────────────────── */}
        <section aria-labelledby="audience-heading" className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2
                id="audience-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                מי פטרה מתאימה לך?
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                פטרה בנויה במיוחד לעסקי חיות מחמד — עם כלים ייעודיים לכל תחום
              </p>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none p-0 m-0">
              {AUDIENCES.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.title}>
                    <article className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                      {/* App mockup header */}
                      <div className="relative h-44 overflow-hidden rounded-t-2xl">
                        {a.mockup}
                        {/* Subtle gradient to blend mockup into card */}
                        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/10 to-transparent pointer-events-none" />
                        {/* Icon badge */}
                        <div
                          className={`absolute bottom-3 right-3 w-11 h-11 rounded-xl ${a.bg} flex items-center justify-center shadow-lg`}
                        >
                          <Icon className={`w-5 h-5 ${a.color}`} aria-hidden="true" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="text-base font-bold text-slate-900 mb-3">{a.title}</h3>
                        <ul className="space-y-2 list-none p-0 m-0 flex-1">
                          {a.features.map((f) => (
                            <li
                              key={f}
                              className="flex items-start gap-2 text-sm text-slate-600"
                            >
                              <Check
                                aria-hidden="true"
                                className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0"
                              />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <Link
                          href="/register"
                          className="mt-4 inline-flex items-center gap-1 text-brand-600 text-sm font-medium hover:gap-2 transition-all focus:outline-none focus:underline"
                          aria-label={`מעבר למסלול ${a.title}`}
                        >
                          מעבר למסלול שלי
                          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Service Dog USP banner ───────────────────────────────────────────── */}
        <section
          aria-labelledby="service-dog-usp-heading"
          className="py-16 bg-[#052E16] relative overflow-hidden"
        >
          {/* Subtle radial glow */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(16,185,129,0.12) 0%, transparent 65%)",
            }}
          />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-10">

              {/* Icon badge */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                  <Shield className="w-12 h-12 text-emerald-400" aria-hidden="true" />
                </div>
              </div>

              {/* Text */}
              <div className="text-center lg:text-right">
                {/* Badge above heading */}
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wide mb-4">
                  ייחודי בישראל
                </span>
                <h2
                  id="service-dog-usp-heading"
                  className="text-2xl md:text-3xl font-bold text-white mb-3 leading-snug"
                >
                  <span className="text-emerald-400">הבית הדיגיטלי היחיד בישראל</span>
                  {" "}לארגוני כלבי שירות
                </h2>
                <p className="text-emerald-200/80 text-base mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  בנינו את המערכת הראשונה מסוגה שדוברת את השפה שלכם. תאימות מלאה לדרישות משרד החקלאות, ניהול זכאים והסמכות – הכל במקום אחד, בלי ניירת ובלי טעויות.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-7 max-w-xl mx-auto lg:mx-0 text-right">
                  {[
                    "עמידה מלאה ברגולציה: דיווחים אוטומטיים למשרד החקלאות בפורמט הנדרש.",
                    "פרוטוקול הכשרה מקצועי: מעקב 8 שלבי הכשרה וצבירת 120+ שעות אילוף לכל כלב.",
                    "ניהול זכאים חכם: תיק דיגיטלי הכולל מסמכים, שיבוצים והיסטוריה רפואית.",
                    "כרטיסי זיהוי עם QR: הנפקת תעודות זיהוי חכמות לסריקה מהירה בשטח.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-emerald-100 text-sm">
                      <Check aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?plan=service_dog"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-emerald-950"
                >
                  <Shield className="w-4 h-4" aria-hidden="true" />
                  גלה את המודול המלא
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features grid ────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="features-heading"
          className="py-24 bg-white"
          id="features"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2
                id="features-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                כל מה שצריך — באחד
              </h2>
              <p className="text-slate-500 text-lg">
                12 מודולים מקצועיים שיחסכו לך שעות כל יום
              </p>
            </div>
            <FeaturesSection />
          </div>
        </section>

        {/* ── WhatsApp highlight ───────────────────────────────────────────────── */}
        <section aria-labelledby="whatsapp-heading" className="py-24 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  aria-hidden="true"
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6"
                >
                  <MessageCircle aria-hidden="true" className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 text-sm font-medium">WhatsApp API</span>
                </p>
                <h2
                  id="whatsapp-heading"
                  className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight"
                >
                  שלח תזכורות ב-WhatsApp
                  <br />
                  <span className="text-emerald-400">בלחיצה אחת</span>
                </h2>
                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                  הלקוחות שלך מקבלים תזכורת אוטומטית לפני כל תור — ישירות לוואטסאפ.
                  שיעור ביטול מינימלי, הכנסה מקסימלית.
                </p>
                <ul className="space-y-3 mb-8 list-none p-0 m-0">
                  {[
                    "תזכורות אוטומטיות 24/48/72 שעות לפני התור",
                    "בקשת תשלום עם לינק תשלום",
                    "הודעות מותאמות לכל עסק",
                    "5 תבניות Meta מאושרות ומוכנות לשימוש",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-slate-300">
                      <div
                        aria-hidden="true"
                        className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn-primary">
                  התחל בחינם עכשיו
                </Link>
              </div>

              {/* WhatsApp mockup — animated */}
              <div className="flex justify-center">
                <WhatsAppMockupAnimated />
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonials carousel ────────────────────────────────────────────── */}
        <section
          aria-labelledby="testimonials-heading"
          className="py-24 relative overflow-hidden"
          id="testimonials"
          style={{
            background: "linear-gradient(160deg, #f8fafc 0%, #fff7ed 60%, #f8fafc 100%)",
          }}
        >
          {/* Decorative warm circle */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-30 pointer-events-none blur-3xl"
            style={{ background: "radial-gradient(ellipse, rgba(249,115,22,0.15) 0%, transparent 70%)" }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2
                id="testimonials-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                מה אומרים עלינו
              </h2>
              <p className="text-slate-500 text-lg">
                בעלי עסקים שכבר עובדים עם פטרה בכל יום
              </p>
            </div>

            <TestimonialsCarousel />
          </div>
        </section>

        {/* ── Pricing (interactive client component) ───────────────────────────── */}
        <PricingSection />

        {/* ── Final CTA ────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="py-32 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 110%, rgba(249,115,22,0.25) 0%, transparent 65%), #0F172A",
          }}
        >
          {/* Dot texture */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative max-w-2xl mx-auto px-4 text-center">
            {/* Small brand badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/25 mb-8">
              <Zap className="w-3.5 h-3.5 text-brand-400" aria-hidden="true" />
              <span className="text-brand-300 text-sm font-medium">התחל היום — חינם לגמרי</span>
            </div>
            <h2
              id="cta-heading"
              className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight"
            >
              מוכן לשדרג
              <br />
              את העסק שלך?
            </h2>
            <p className="text-slate-300 text-lg mb-10 leading-relaxed">
              הצטרף לאלפי בעלי עסקים שכבר עובדים עם פטרה
            </p>
            <Link
              href="/register"
              className="btn-primary text-base px-10 py-4 shadow-2xl shadow-brand-500/30"
            >
              התחל בחינם עכשיו
            </Link>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 list-none p-0 m-0">
              <li className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" aria-hidden="true" />
                14 ימי ניסיון ללא חיוב
              </li>
              <li className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" aria-hidden="true" />
                ביטול פשוט בכל עת
              </li>
              <li className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" aria-hidden="true" />
                מעבר קל ממערכות אחרות
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        className="bg-[#0F172A] border-t border-white/8 py-10"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/petra-logo.png"
                alt="לוגו פטרה"
                width={32}
                height={32}
                className="object-contain"
              />
              <div>
                <span className="text-white font-semibold text-sm block">פטרה</span>
                <p className="text-slate-500 text-xs">ניהול עסקי חיות מחמד</p>
              </div>
            </div>

            <nav aria-label="ניווט תחתון">
              <ul className="flex flex-wrap items-center justify-center gap-5 text-sm text-slate-400 list-none p-0 m-0">
                <li>
                  <a
                    href="#features"
                    className="hover:text-white transition-colors focus:outline-none focus:underline"
                  >
                    מאפיינים
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-white transition-colors focus:outline-none focus:underline"
                  >
                    מחירים
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_DEMO}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="תמיכה — פתיחת WhatsApp בחלון חדש"
                    className="hover:text-white transition-colors flex items-center gap-1 focus:outline-none focus:underline"
                  >
                    <MessageCircle aria-hidden="true" className="w-3.5 h-3.5" />
                    תמיכה
                  </a>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors focus:outline-none focus:underline"
                  >
                    פרטיות
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-white transition-colors focus:outline-none focus:underline"
                  >
                    תנאי שימוש
                  </Link>
                </li>
              </ul>
            </nav>

            <p className="text-slate-500 text-sm">© 2026 Petra</p>
          </div>
        </div>
      </footer>

      {/* ── Floating buttons (right side) ────────────────────────────────────── */}
      <WhatsAppFAB />
      <AccessibilityButton />
    </div>
  );
}
