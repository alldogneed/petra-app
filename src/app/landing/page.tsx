import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  MessageCircle,
  Globe,
  Home,
  BarChart3,
  FileText,
  CalendarCheck,
  Dog,
  Scissors,
  Heart,
  Shield,
  Check,
  ArrowLeft,
  Zap,
  Receipt,
  UserCog,
  Layers,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { PricingSection } from "./_components/PricingSection";
import { WhatsAppFAB } from "./_components/WhatsAppFAB";
import { AnimatedStats } from "./_components/AnimatedStats";
import { AccessibilityButton } from "./_components/AccessibilityButton";
import { PhoneMockup } from "./_components/PhoneMockup";
import { TestimonialsCarousel } from "./_components/TestimonialsCarousel";

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
    photo: "/trainer-black-shepherd.jpg",
    features: [
      "תוכניות אילוף בכיס שלך – מעקב התקדמות שזמין לך מהשטח",
      "מעקב יעדים ומשימות לכל כלב",
      "תזכורות WhatsApp אוטומטיות",
    ],
  },
  {
    icon: Scissors,
    color: "text-purple-500",
    bg: "bg-purple-50",
    title: "גרומרים",
    photo: "/groomer-poodle.jpg",
    features: [
      "סוף לסמסים של 'מתי התור שלי' – יומן מסודר עם תזכורות אוטומטיות",
      "תיק עבודות לפני/אחרי",
      "חשבוניות ותשלומים מובנים",
    ],
  },
  {
    icon: Home,
    color: "text-blue-500",
    bg: "bg-blue-50",
    title: "פנסיון לכלבים",
    photo:
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=400&q=80",
    features: [
      "שקט תעשייתי בפנסיון – ניהול זמינות ועדכוני סטטוס לבעלים בלחיצת כפתור",
      "Check-in/out ומעקב יומי",
      "הודעות WhatsApp לבעלים",
    ],
  },
  {
    icon: Shield,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    title: "ארגוני כלבי שירות",
    photo:
      "https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=400&q=80",
    features: [
      "מעקב שלבי הכשרה מלא",
      "ניהול זכאים ושיבוצים",
      "ייצוא דוחות ומסמכים",
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
    desc: "מעבירים את כל הלקוחות מהסמארטפון או מהמחברת הישנה למקום אחד מסודר. אנחנו נעשה את העבודה השחורה בשבילך.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "העסק עובד בשבילך",
    desc: "תזכורות הוואטסאפ נשלחות לבד, היומן מתמלא — ואתה חוזר למקום שאתה הכי אוהב: לשטח עם הכלבים.",
  },
];

const FEATURES = [
  {
    icon: Users,
    title: "כל ההיסטוריה של הכלב מול העיניים",
    desc: "תוכניות אילוף, חיסונים ותמונות – הכל בכרטיס לקוח אחד שמלווה אותך בשטח.",
    color: "bg-orange-50 text-orange-500",
  },
  {
    icon: CalendarDays,
    title: "יומן חכם שמסדר לך את היום",
    desc: "יומן שבועי/יומי, תורים חוזרים, צפייה לפי עובד",
    color: "bg-blue-50 text-blue-500",
  },
  {
    icon: MessageCircle,
    title: "סוף לביטולים ברגע האחרון",
    desc: "תזכורות WhatsApp אוטומטיות ללקוחות — 24/48/72 שעות לפני התור, ישר מה-API",
    color: "bg-emerald-50 text-emerald-500",
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
    icon: Receipt,
    title: "תשלומים בלי מרדפים",
    desc: "שלח לינק לתשלום בוואטסאפ וקבל חשבונית אוטומטית. בלי לרדוף אחרי לקוחות.",
    color: "bg-rose-50 text-rose-500",
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


      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main id="main-content" tabIndex={-1} className="outline-none">

        {/* ── Hero (split layout) ──────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 60% -5%, rgba(249,115,22,0.22) 0%, transparent 55%), #0F172A",
          }}
        >
          {/* Grid pattern */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-28">
            <div className="grid lg:grid-cols-[5fr_7fr] gap-8 lg:gap-12 items-center">

              {/* Text col — first in DOM = right side in RTL */}
              <div className="text-center lg:text-right">
                <p
                  aria-hidden="true"
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 mb-6"
                >
                  <Zap aria-hidden="true" className="w-3.5 h-3.5 text-brand-400" />
                  <span className="text-brand-300 text-sm font-medium">
                    המערכת שנבנתה על ידי אנשי כלבים, עבור אנשי כלבים
                  </span>
                </p>

                <h1
                  id="hero-heading"
                  className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.18] mb-6"
                >
                  תתמקדו בטיפול
                  <br />
                  <span className="text-brand-400">פטרה תדאג לניהול</span>
                </h1>

                <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed">
                  נבנתה ע״י מומחי שטח. מיועדת למקצוענים בבעלי חיים.{" "}
                  זיקקנו ניסיון של שנים באילוף, טיפוח והכשרה לתוך מערכת אחת חכמה.{" "}
                  פטרה נותנת לכם את הכלים לנהל את העסק ביעילות, כדי שתוכלו להישאר ממוקדים בבעלי החיים.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-3">
                  <Link
                    href="/register"
                    className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto justify-center"
                  >
                    אני רוצה לנסות בחינם – בלי התחייבות
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

                {/* Two trust signals */}
                <ul className="mt-4 space-y-2.5 list-none p-0 m-0">
                  <li className="flex items-center justify-center lg:justify-start gap-2.5 text-white text-base font-medium">
                    <Check aria-hidden="true" className="w-4 h-4 text-brand-400 shrink-0" />
                    מסלול חינמי — ללא כרטיס אשראי, ללא הגבלת זמן.
                  </li>
                  <li className="flex items-center justify-center lg:justify-start gap-2.5 text-white text-base font-medium">
                    <Check aria-hidden="true" className="w-4 h-4 text-brand-400 shrink-0" />
                    מעבירים אותך מהמערכת הישנה — אנחנו עושים את העבודה.
                  </li>
                </ul>
              </div>

              {/* Visual col — second in DOM = left side in RTL */}
              <div aria-hidden="true" className="relative mt-2 lg:mt-0 lg:-ml-4 lg:-mr-0">
                <Image
                  src="/hero-image.jpg"
                  alt=""
                  width={1400}
                  height={800}
                  className="w-full h-auto rounded-2xl shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats bar ────────────────────────────────────────────────────────── */}
        <section
          aria-label="נתונים מספריים"
          className="bg-gradient-to-l from-brand-600 to-brand-500 py-12"
        >
          <AnimatedStats />
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

            <div className="relative">
              {/* Connector line (desktop only) */}
              <div
                aria-hidden="true"
                className="absolute top-10 right-[16.66%] left-[16.66%] h-0.5 bg-gradient-to-l from-brand-200 via-brand-300 to-brand-200 hidden md:block"
              />

              <ol className="grid md:grid-cols-3 gap-10 list-none p-0 m-0">
                {HOW_IT_WORKS.map(({ n, icon: Icon, title, desc }) => (
                  <li key={n} className="flex flex-col items-center text-center">
                    <div className="relative mb-6 z-10">
                      <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-200">
                        <Icon className="w-8 h-8 text-white" aria-hidden="true" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border-2 border-brand-500 flex items-center justify-center text-brand-600 text-xs font-bold shadow-sm">
                        {n}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{desc}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="text-center mt-12">
              <Link href="/register" className="btn-primary px-8 py-3.5 text-base">
                אני רוצה לנסות בחינם
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
                      {/* Photo header */}
                      <div className="relative h-44 overflow-hidden">
                        <Image
                          src={a.photo}
                          alt=""
                          width={400}
                          height={176}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent" />
                        {/* Icon badge over photo */}
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
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wide">
                  ייחודי בישראל
                </span>
              </div>

              {/* Text */}
              <div className="text-center lg:text-right">
                <h2
                  id="service-dog-usp-heading"
                  className="text-2xl md:text-3xl font-bold text-white mb-3 leading-snug"
                >
                  כלבי שירות —{" "}
                  <span className="text-emerald-400">המערכת היחידה בישראל</span>
                </h2>
                <p className="text-emerald-200/80 text-base mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  פותחה יחד עם מומחים מתוך התחום. מספקת מענה מלא מהכשרה ועד שיבוץ — כולל כל מה שהמשרד מצריך.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-7 max-w-xl mx-auto lg:mx-0 text-right">
                  {[
                    "מעקב שלבי הכשרה מלא (8 שלבים)",
                    "דיווח אוטומטי למשרד החקלאות",
                    "ניהול תיקי זכאים ושיבוצים",
                    "מבחני הסמכה ופרוטוקולים רפואיים",
                    "כרטיסי זיהוי + קוד QR",
                    "120+ שעות מעקב אילוף",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-emerald-100 text-sm">
                      <Check aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" />
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

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 list-none p-0 m-0">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                const [iconBg, iconColor] = f.color.split(" ");
                return (
                  <li key={f.title}>
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full">
                      <div
                        aria-hidden="true"
                        className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-3`}
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
                  נסה בחינם
                </Link>
              </div>

              {/* WhatsApp mockup */}
              <div aria-hidden="true" className="flex justify-center">
                <div className="w-72 rounded-3xl bg-[#0F172A] border border-white/10 overflow-hidden shadow-2xl">
                  <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-300 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-emerald-800" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">
                        פטרה — תזכורת תור
                      </div>
                      <div className="text-emerald-200 text-xs">מחובר ✓</div>
                    </div>
                  </div>
                  <div
                    className="px-3 py-4 space-y-3 min-h-[200px]"
                    style={{ backgroundColor: "#1a2533" }}
                  >
                    <div className="flex justify-start">
                      <div className="bg-[#202C33] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-white text-xs leading-relaxed">
                          שלום יעל! 👋
                          <br />
                          תזכורת לתור של ביסקוויט
                          <br />
                          <strong>מחר, 10:00</strong> — אצל מירב
                          <br />
                          <br />
                          לאישור: השב ✅
                          <br />
                          לביטול: השב ❌
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 text-left">09:15 ✓✓</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-[#005C4B] rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <p className="text-white text-xs">✅</p>
                        <p className="text-[10px] text-slate-400 mt-1 text-left">09:17 ✓✓</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonials carousel ────────────────────────────────────────────── */}
        <section
          aria-labelledby="testimonials-heading"
          className="py-24 bg-slate-50"
          id="testimonials"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          className="py-24 relative"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 110%, rgba(249,115,22,0.2) 0%, transparent 60%), #0F172A",
          }}
        >
          <div className="relative max-w-2xl mx-auto px-4 text-center">
            <h2
              id="cta-heading"
              className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight"
            >
              מוכן לשדרג את העסק שלך?
            </h2>
            <p className="text-slate-300 text-lg mb-8">
              הצטרף לאלפי בעלי עסקים שכבר עובדים עם פטרה
            </p>
            <Link href="/register" className="btn-primary text-base px-10 py-4">
              אני רוצה לנסות בחינם
            </Link>
            <p className="mt-4 text-slate-500 text-sm">14 ימי ניסיון חינם — ללא חיוב מיידי · בטל בכל עת בלחיצת כפתור</p>
            <p className="mt-2 text-brand-400/80 text-sm">מעבר קל ממערכות אחרות — אנחנו נעזור לך</p>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        className="bg-[#0F172A] border-t border-white/5 py-10"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/petra-logo.png"
                alt="לוגו פטרה"
                width={36}
                height={36}
                className="object-contain"
              />
              <p className="text-slate-500 text-xs">ניהול עסקי חיות מחמד</p>
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
