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
  Sparkles,
  BarChart3,
  Globe,
  Target,
  Sunrise,
  UserPlus,
  BellRing,
  MoonStar,
} from "lucide-react";
import { PricingSection } from "./_components/PricingSection";
import { WhatsAppFAB } from "./_components/WhatsAppFAB";
import { AccessibilityButton } from "./_components/AccessibilityButton";
import { ClientsMarquee } from "./_components/ClientsMarquee";
import { LandingNav } from "./_components/LandingNav";
import { Reveal } from "./_components/Reveal";
import { BrowserShot, PhoneShot } from "./_components/ProductShots";
import { TeaserVideo } from "./_components/TeaserVideo";
import { ProductDemo } from "./_components/ProductDemo";

export const metadata: Metadata = {
  title: "Petra — מערכת ניהול לעסקי חיות מחמד | אילוף, פנסיון, גרומינג",
  description:
    "מערכת ניהול חכמה לאלפי כלבים, גרומרים ופנסיונים בישראל. ניהול לקוחות, תורים, תזכורות WhatsApp אוטומטיות, עוזר AI, יומן דיגיטלי ועוד — במקום אחד. מסלול חינמי ללא כרטיס אשראי.",
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
    "עוזר AI לעסק",
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
  { num: "130", label: "עסקים פעילים" },
  { num: "5,000+", label: "תורים שנקבעו" },
  { num: "98%", label: "שביעות רצון" },
  { num: "15", label: "שנות ניסיון בשטח" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: Users,
    title: "פותחים חשבון",
    desc: "נרשמים לפטרה ונכנסים למערכת. בלי התקנות ובלי תהליך הרשמה ארוך.",
  },
  {
    n: "02",
    icon: Zap,
    title: "מכניסים את הלקוחות",
    desc: "מעבירים את רשימת הלקוחות הקיימת ומרכזים את כל הפרטים במקום אחד. לא צריך להתחיל מאפס.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "חוזרים לעבוד",
    desc: "היומן מסודר, התזכורות נשלחות אוטומטית ואתם יכולים להתרכז בעבודה עם בעלי החיים.",
  },
];

const AUDIENCES = [
  {
    icon: Dog,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    title: "מאלפי כלבים",
    desc: "כל תהליך האילוף מסודר, גם כשאתם באמצע שיעור.",
    features: [
      "רואים מה כבר עבדתם על כל כלב ומה השלב הבא.",
      "שומרים את סיכומי המפגשים, המשימות וההתקדמות במקום אחד.",
      "הלקוחות מקבלים תזכורות בלי שתצטרכו לעצור ולשלוח הודעות.",
    ],
    shot: { src: "/landing/screens/aud-trainers.webp", alt: "מסך תהליכי האילוף: כלבים באימון, מפגשים שבוצעו וכלבים שדורשים תשומת לב" },
  },
  {
    icon: Scissors,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    title: "גרומרים",
    desc: "פחות התעסקות עם היומן. יותר זמן לטיפולים.",
    features: [
      "הלקוחות קובעים תור בלי שתצטרכו לענות לכל הודעה.",
      "תזכורות נשלחות אוטומטית ועוזרות לצמצם תורים שנשכחים.",
      "שומרים תמונות ופרטי טיפול, כך שבביקור הבא הכול כבר מחכה לכם.",
    ],
    shot: { src: "/landing/screens/aud-groomers.webp", alt: "כרטיס לקוח: פרטי קשר, חיות מחמד, תורים, תשלומים והזמנות" },
  },
  {
    icon: Home,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    title: "פנסיונים",
    desc: "יודעים מי מגיע, מי עוזב ואיפה כל כלב נמצא.",
    features: [
      "רואים את תפוסת החדרים ומזהים התנגשויות בהזמנות.",
      "מגיעים לקבלת הכלב כשפרטי הטיפול וההנחיות שלו כבר מסודרים.",
      "שומרים את פרטי השהייה והעדכונים במקום אחד, בלי לחפש בין שיחות.",
    ],
    shot: { src: "/landing/screens/aud-boarding.webp", alt: "מפת חדרי הפנסיון: חדרים תפוסים ופנויים ושהייה עם צ׳ק-אין" },
  },
  {
    icon: Shield,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    title: "מרכזי הכשרת כלבי שירות",
    desc: "כל כלב, זכאי ותהליך הכשרה במקום אחד.",
    features: [
      "עוקבים אחרי שלבי ההכשרה ויודעים מה עוד נשאר לבצע.",
      "מנהלים את פרטי הזכאים, הכלבים והשיבוצים בלי לפזר מידע.",
      "מפיקים דוחות ומרכזים את המידע הנדרש לתיעוד ולמעקב.",
    ],
    shot: { src: "/landing/screens/aud-service-dogs.webp", alt: "ניהול כלבי שירות: רשימת כלבים לפי שלב הכשרה, גזע וזכאי" },
  },
];

const FEATURES: {
  icon: typeof MessageCircle;
  name: string;
  title: string;
  desc: string;
  tier?: string;
  examples?: string[];
}[] = [
  {
    icon: MessageCircle,
    name: "תזכורות בוואטסאפ",
    tier: "במסלולי Basic ו-Pro",
    title: "פחות הודעות. פחות שכחות.",
    desc: "תזכורות לתורים נשלחות אוטומטית בוואטסאפ, גם כשאתם באמצע טיפול או שיעור.",
  },
  {
    icon: Calendar,
    name: "יומן תורים",
    title: "היומן שלכם תמיד מסודר.",
    desc: "רואים מה מחכה לכם היום, מנהלים זמינות ומסנכרנים עם יומן Google. בלי לקבוע בטעות על זמן שכבר תפוס.",
  },
  {
    icon: FileSignature,
    name: "חוזים דיגיטליים",
    tier: "במסלולי Basic ו-Pro",
    title: "בלי לרדוף אחרי חתימות.",
    desc: "שולחים חוזה ללקוח לחתימה מרחוק ושומרים את המסמך החתום בתיק שלו. בלי הדפסות ובלי ניירת שהולכת לאיבוד.",
  },
  {
    icon: BarChart3,
    name: "ניהול העסק",
    title: "יודעים מה קורה עם הכסף.",
    desc: "עוקבים אחרי הכנסות, תשלומים ופעילות העסק. רואים את התמונה בלי להתחיל לאסוף נתונים מכל מיני מקומות.",
  },
  {
    icon: Globe,
    name: "הזמנת תורים אונליין",
    tier: "במסלולי Basic ו-Pro",
    title: "שיקבעו תור גם כשאתם עסוקים.",
    desc: "שולחים ללקוחות קישור להזמנת תור והם בוחרים זמן פנוי בעצמם. אתם יכולים להמשיך לעבוד בלי לעצור כדי לפתוח יומן.",
  },
  {
    icon: Target,
    name: "ניהול לידים",
    title: "אף פנייה לא הולכת לאיבוד.",
    desc: "רואים מי פנה, עם מי כבר דיברתם ולמי צריך לחזור. פחות לקוחות פוטנציאליים שנשכחים בתוך הוואטסאפ.",
  },
  {
    icon: Sparkles,
    name: "עוזר AI במסלול Pro",
    title: "תשאלו את פטרה. היא מכירה.",
    desc: "צריכים למצוא פרט על לקוח או להבין מה קורה בעסק? שואלים את העוזר ומקבלים תשובה מתוך המידע שלכם, בהתאם לנתונים הזמינים במערכת.",
    examples: [
      "למי צריך לחזור היום?",
      "מה סיכמנו עם הלקוח בפגישה האחרונה?",
      "אילו תשלומים עדיין פתוחים?",
    ],
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

          <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-7">
            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 items-center">

              {/* Text column — right side in RTL */}
              <div className="min-w-0 text-center lg:text-right">

                <h1
                  id="hero-heading"
                  className="lp-rise mb-5 font-extrabold text-white"
                  style={{
                    ["--lp-d" as string]: "80ms",
                    fontSize: "clamp(40px, 6vw, 80px)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.02em",
                  }}
                >
                  תפסיקו לרדוף<br />
                  אחרי זנבות.
                </h1>

                <p style={{ ["--lp-d" as string]: "160ms", color: "rgba(226,232,240,0.85)" }} className="lp-rise mb-8 max-w-[540px] mx-auto lg:mx-0 text-lg leading-[1.6]">
                  תנו לפטרה לטפל בתורים, בלקוחות ובתזכורות. אתם תתפנו למה שאתם באמת אוהבים, לעבוד עם בעלי חיים.
                </p>

                <div style={{ ["--lp-d" as string]: "240ms" }} className="lp-rise flex flex-wrap items-center justify-center lg:justify-start gap-3.5 mb-7">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
                    style={{
                      background: "#C2410C",
                    }}
                  >
                    התחילו בחינם
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="#video"
                    className="inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-medium text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
                    style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    צפו בדמו
                  </Link>
                </div>

                <ul className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 list-none p-0 m-0">
                  {["חינם, בלי כרטיס אשראי", "עוברים בקלות ממערכות אחרות", "עוזר AI במסלול Pro"].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm" style={{ color: "rgba(226,232,240,0.75)" }}>
                      <span className="inline-flex w-[18px] h-[18px] rounded-full items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.20)" }}>
                        <Check className="w-2.5 h-2.5" style={{ color: "#FDBA74" }} aria-hidden="true" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Product screenshot column — left side in RTL */}
              <div style={{ ["--lp-d" as string]: "200ms" }} className="lp-rise relative mt-8 lg:mt-0 min-w-0 lg:pb-10">

                <div className="relative">
                  <BrowserShot
                    src="/landing/screens/hero-leads.webp"
                    alt="מערכת המכירות של פטרה: לוח לידים לפי שלבים עם סה״כ לידים, לידים בתהליך ושיעור המרה"
                    width={2400}
                    height={1283}
                    priority
                  />

                  {/* Phone — customer card, overlapping the frame's bottom-left (RTL: physical left) */}
                  <div className="hidden md:block absolute -bottom-10 -left-6 w-[150px] lg:w-[170px]">
                    <PhoneShot
                      src="/landing/screens/phone-customer.webp"
                      alt="כרטיס לקוח בנייד: פרטי קשר, תשלומים, מעקב חבילות וחיות מחמד"
                      width={780}
                      height={1580}
                    />
                  </div>

                  {/* Floating toast — top-left of frame (RTL: physical left) */}
                  <div
                    aria-hidden="true"
                    className="lp-float hidden md:flex absolute -top-6 md:-left-2 lg:-left-8 bg-white rounded-2xl items-center gap-3 px-4 py-3 min-w-[240px] pointer-events-none"
                    style={{
                      boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05)",
                      animation: "lpFloat 6s ease-in-out infinite",
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" style={{ strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">תזכורת נשלחה</div>
                      <div className="text-[13px] text-slate-500 mt-0.5">דורית קיבלה תזכורת לתור בוואטסאפ</div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </section>

        {/* ── Trust bar ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="נתוני אמינות"
          style={{ background: "#0F172A", padding: "22px 0" }}
        >
          <dl className="mx-auto max-w-[1240px] px-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {TRUST_STATS.map(({ num, label }) => (
              <div
                key={label}
                className="flex flex-col items-center text-center py-2"
              >
                <dt
                  className="text-2xl font-extrabold mb-1"
                  style={{ color: "#FDBA74", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}
                >
                  {num}
                </dt>
                <dd className="text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Product demo: real screens + promo video ──────────────────────────── */}
        <section aria-labelledby="video-heading" className="py-24 bg-slate-900" id="video">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-7">
            <div className="text-center mb-10">
              <h2 id="video-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
                ככה פטרה עובדת.
              </h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                הציצו ליומן, לניהול הלקוחות ולמעקב אחרי העבודה השוטפת. תראו איך הכול מתחבר בלי לקפוץ בין מערכות.
              </p>
            </div>
            <ProductDemo />
            <div className="max-w-4xl mx-auto mt-16">
              <TeaserVideo />
            </div>
          </div>
        </section>

        {/* ── A day with Petra ───────────────────────────────────────────────────── */}
        <section aria-labelledby="day-heading" className="py-[100px] bg-white" id="day">
          <div className="mx-auto max-w-[1240px] px-7">
            <Reveal className="text-center mb-12">
              <h2
                id="day-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
              >
                ככה נראה יום עם פטרה
              </h2>
            </Reveal>

            <ol className="grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-4 list-none p-0 m-0">
              {[
              { icon: Sunrise, when: "בבוקר", text: "פותחים את היומן ורואים מי מגיע היום, מה סוג הטיפול ומה צריך להכין." },
              { icon: UserPlus, when: "באמצע העבודה", text: "לקוח חדש פונה אליכם. רושמים אותו כליד בכמה שניות, ואתם יודעים למי צריך לחזור." },
              { icon: BellRing, when: "לפני התור", text: "תזכורת נשלחת ללקוח בוואטסאפ, בלי שתצטרכו לעצור את מה שאתם עושים.", note: "תזכורות אוטומטיות במסלולי Basic ו-Pro." },
              { icon: MoonStar, when: "בסוף היום", text: "רואים את הפגישות שבוצעו, התשלומים ומה מחכה לכם מחר." },
              ].map(({ icon: Icon, when, text, note }: { icon: typeof Sunrise; when: string; text: string; note?: string }, i) => (
                <Reveal as="li" key={when} delay={i * 80} className="flex gap-4 lg:flex-col lg:gap-3">
                  <div className="w-11 h-11 rounded-[12px] bg-orange-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-orange-600" aria-hidden="true" style={{ strokeWidth: 1.75 }} />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold text-slate-900 mb-1.5" style={{ letterSpacing: "-0.01em" }}>{when}</h3>
                    <p className="text-base text-slate-700 leading-[1.6] m-0">{text}</p>
                    {note && <p className="text-[13px] text-slate-500 mt-2 m-0">{note}</p>}
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Audiences ─────────────────────────────────────────────────────────── */}
        <section aria-labelledby="audience-heading" className="py-[100px] bg-slate-50" id="audiences">
          <div className="mx-auto max-w-[1240px] px-7">
            <Reveal className="text-center mb-14">
              <h2
                id="audience-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
              >
                פטרה מכירה את העבודה שלכם.
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
                לכל עסק יש את היום שלו. פטרה מתאימה את עצמה לאיך שאתם עובדים, ולא להפך.
              </p>
            </Reveal>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
              {AUDIENCES.map((a, i) => {
                const Icon = a.icon;
                return (
                  <Reveal as="li" key={a.title} delay={i * 80}>
                    <article
                      className="group flex flex-col rounded-[20px] bg-white overflow-hidden h-full lp-card"
                    >
                      {/* Real screen from the app */}
                      <div className="relative shrink-0 aspect-[16/10] overflow-hidden bg-slate-100">
                        <Image
                          src={a.shot.src}
                          alt={a.shot.alt}
                          fill
                          sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover object-right-top transition-transform duration-500 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]"
                        />
                        {/* Icon badge */}
                        <div className={`absolute bottom-3 right-3 w-[42px] h-[42px] rounded-xl ${a.iconBg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${a.iconColor}`} aria-hidden="true" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col flex-1 p-5">
                        <h3 className="text-[17px] font-bold text-slate-900 mb-1" style={{ letterSpacing: "-0.01em" }}>{a.title}</h3>
                        <p className="text-[15px] font-medium text-slate-900 leading-[1.5] mb-3">{a.desc}</p>
                        <ul className="space-y-2 list-none p-0 m-0 flex-1">
                          {a.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-[15px] text-slate-700 leading-[1.5]">
                              <Check className={`w-3.5 h-3.5 ${a.checkColor} shrink-0 mt-0.5`} aria-hidden="true" style={{ strokeWidth: 2.5 }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </ul>

            <div className="text-center mt-12">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
                style={{ background: "#C2410C" }}
              >
                התחילו בחינם
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="features-heading" className="py-[100px] bg-white" id="features">
          <div className="mx-auto max-w-[1240px] px-7">
            <Reveal className="text-center mb-14">
              <h2
                id="features-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
              >
                פחות עבודה מסביב לעבודה.
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
                היומן, הלקוחות, ההודעות והתשלומים עובדים יחד. אתם לא צריכים לחבר הכול בעצמכם.
              </p>
            </Reveal>

            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
              {FEATURES.map(({ icon: Icon, name, title, desc, tier, examples }, i) => (
                <Reveal as="li" key={title} delay={(i % 4) * 80} className={examples ? "md:col-span-2" : undefined}>
                  <article
                    className="group rounded-[20px] bg-slate-50 p-7 h-full lp-card"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-[12px] bg-orange-100 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-orange-600" aria-hidden="true" style={{ strokeWidth: 1.75 }} />
                      </div>
                      <span className="text-[15px] font-semibold text-brand-700">{name}</span>
                    </div>
                    <h3 className="text-[19px] font-bold text-slate-900 mb-2" style={{ letterSpacing: "-0.01em" }}>{title}</h3>
                    <p className="text-base text-slate-600 leading-[1.55] m-0">{desc}</p>
                    {examples && (
                      <ul className="mt-4 flex flex-wrap gap-2 list-none p-0 m-0" aria-label="שאלות לדוגמה">
                        {examples.map((q) => (
                          <li key={q} className="rounded-xl bg-white px-3.5 py-2 text-[15px] text-slate-800">{q}</li>
                        ))}
                      </ul>
                    )}
                    {tier && <p className="text-[13px] text-slate-500 mt-3 m-0">{tier}</p>}
                  </article>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Google Contacts sync ──────────────────────────────────────────────── */}
        <section aria-labelledby="gcontacts-heading" className="py-[100px] bg-slate-50" id="google-contacts">
          <div className="mx-auto max-w-[1240px] px-7">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--brand-50, #FFF7ED)", color: "var(--brand-700, #C2410C)" }}>
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  סנכרון Google Contacts
                </span>
                <h2
                  id="gcontacts-heading"
                  className="text-slate-900 font-extrabold"
                  style={{ fontSize: "clamp(28px, 3.5vw, 42px)", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 18 }}
                >
                  ליד חדש בפטרה —{" "}
                  <span className="text-brand-500">איש קשר בגוגל.</span>
                </h2>
                <p className="text-lg text-slate-600 leading-[1.6] mb-7" style={{ maxWidth: 520 }}>
                  כשמפעילים את הסנכרון, כל ליד (לקוח פוטנציאלי) שנוצר בפטרה נשמר אוטומטית כאיש קשר ב-Google Contacts שלכם,
                  ומתעדכן כשמשנים את הפרטים שלו בפטרה. כך השם מופיע בטלפון וב-WhatsApp כבר בשיחה הראשונה.
                </p>
                <ul className="space-y-3.5 list-none p-0 m-0">
                  {[
                    "הסנכרון פועל רק לאחר שאישרתם את הגישה במסך ההרשאות של Google (OAuth).",
                    "פטרה רק יוצרת ומעדכנת את אנשי הקשר של הלידים שלכם — היא לא קוראת את אנשי הקשר הקיימים שלכם, לא משתפת אותם ולא מוחקת אותם.",
                    "הסנכרון כבוי כברירת מחדל, ואפשר לכבות אותו בכל רגע בהגדרות ← אינטגרציות, או לבטל את הגישה מחשבון Google.",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-slate-600 leading-[1.55]">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-brand-500" style={{ strokeWidth: 3 }} aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* English summary — what Petra is and how it uses the Google Contacts API */}
              <div
                dir="ltr"
                lang="en"
                className="rounded-[20px] border border-slate-200 bg-white p-7 text-left"
                style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
              >
                <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  About Petra &amp; Google Contacts
                </div>
                <h3 className="text-[19px] font-bold text-slate-900 mb-3" style={{ letterSpacing: "-0.01em" }}>
                  What is Petra?
                </h3>
                <p className="text-sm text-slate-600 leading-[1.65] mb-3">
                  Petra is a business management platform (CRM) for pet-service businesses in Israel — dog trainers,
                  boarding kennels, groomers and service-dog organizations. Business owners use it to manage leads,
                  customers, appointments, boarding stays, payments and automated WhatsApp reminders in one place.
                </p>
                <p className="text-sm text-slate-600 leading-[1.65] mb-3">
                  <strong className="font-semibold text-slate-800">How Petra uses the Google Contacts API:</strong>{" "}
                  when a business owner chooses to connect their Google account and grants access on Google&apos;s OAuth
                  consent screen, Petra creates a contact in the owner&apos;s own Google Contacts for each lead recorded in
                  Petra, and updates that same contact when the lead&apos;s details change in Petra. The Google Contacts
                  API is used only to create and update contacts for leads — Petra does not read, export, share, sell
                  or use the user&apos;s existing contacts for advertising.
                </p>
                <p className="text-sm text-slate-600 leading-[1.65] m-0">
                  The sync is optional, starts only after explicit OAuth consent, and can be turned off at any time in
                  Petra under Settings → Integrations or from the user&apos;s Google Account permissions. See our{" "}
                  <Link href="/privacy#google-contacts" className="font-medium text-brand-600 underline underline-offset-2">
                    Privacy Policy
                  </Link>{" "}
                  for details and our Limited Use disclosure.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Client logos marquee ───────────────────────────────────────────────── */}
        <ClientsMarquee />

        {/* ── About / Our Story ─────────────────────────────────────────────────── */}
        <section
          aria-labelledby="about-heading"
          id="about"
          className="py-[100px] overflow-hidden"
          style={{ background: "#F8FAFC" }}
        >
          <div className="mx-auto max-w-[1240px] px-7">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Right col — Text */}
              <div>

                <h2
                  id="about-heading"
                  className="text-slate-900 font-extrabold"
                  style={{ fontSize: "clamp(28px, 3.5vw, 42px)", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 18 }}
                >
                  לא נולדנו במשרד ממוזג.
                </h2>

                <p className="text-lg text-slate-600 leading-[1.6] mb-8" style={{ maxWidth: 480 }}>
                  באנו מהשטח. פטרה היא החטיבה הדיגיטלית של All-Dog, מרכז אילוף עם 15 שנות ניסיון. בנינו מערכת שמבינה איך באמת נראה יום עבודה עם בעלי חיים.
                </p>

                <ul className="space-y-[18px] list-none p-0 m-0">
                  {[
                    { icon: Zap, title: "אנחנו מכירים את היום שלכם.", text: "רצועה ביד אחת, טלפון בשנייה, לקוח שמתקשר באמצע שיעור והודעה שצריך לזכור לחזור אליה. אנחנו מכירים את זה, כי גם אנחנו עובדים ככה." },
                    { icon: Users, title: "פטרה נבנית יחד איתכם.", text: "אנחנו מקשיבים למאלפים, לגרומרים ולמנהלי פנסיונים שעובדים במערכת. מה שמסבך את היום שלהם עוזר לנו להבין מה צריך לשפר." },
                    { icon: MessageCircle, title: "בנינו את מה שהיה חסר לנו.", text: "רצינו מקום אחד שבו אפשר לנהל לקוחות, תורים ותהליכי עבודה בלי לבזבז את היום על הודעות, טבלאות וניירת. משם פטרה התחילה." },
                  ].map(({ icon: Icon, title, text }, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--brand-100, #FFEDD5)" }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: "var(--brand-600, #EA580C)", strokeWidth: 2 }} aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
                        <p className="text-base text-slate-700 leading-[1.55] m-0">{text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Left col — Photo + stat card */}
              <div aria-hidden="true" className="relative">

                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
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
                  <div className="text-[22px] font-extrabold leading-tight" style={{ color: "var(--brand-700, #C2410C)", letterSpacing: "-0.02em" }}>15 שנות ניסיון</div>
                  <div className="text-[13px] text-slate-600 font-medium mt-0.5">עם כלבים. בשטח.</div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="py-[100px] bg-white" id="how">
          <div className="mx-auto max-w-[1240px] px-7">
            <Reveal className="text-center mb-14">
              <h2
                id="how-heading"
                className="text-slate-900 font-extrabold"
                style={{ fontSize: "clamp(30px, 3.5vw, 44px)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}
              >
                מתחילים בלי להסתבך.
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto leading-[1.55]">
                פותחים חשבון, מכניסים את הלקוחות ומתחילים לעבוד. בלי ללמוד מערכת מסובכת.
              </p>
            </Reveal>

            <ol className="grid md:grid-cols-3 gap-6 list-none p-0 m-0">
              {HOW_IT_WORKS.map(({ n, icon: Icon, title, desc }, i) => (
                <Reveal as="li" key={n} delay={i * 90}>
                <div
                  className="group relative overflow-hidden rounded-[20px] bg-slate-50 p-8 lp-card h-full"
                >

                  {/* Icon tile */}
                  <div className="relative z-10 mb-5 w-12 h-12 rounded-[14px] bg-orange-100 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-500">
                    <Icon className="w-5 h-5 text-brand-500 transition-colors duration-200 group-hover:text-white" aria-hidden="true" />
                  </div>

                  <h3 className="relative z-10 text-[19px] font-bold text-slate-900 mb-2" style={{ letterSpacing: "-0.015em" }}>{title}</h3>
                  <p className="relative z-10 text-base text-slate-600 leading-[1.6] m-0">{desc}</p>
                </div>
                </Reveal>
              ))}
            </ol>

            <div className="text-center mt-12">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
                style={{ background: "#C2410C", }}
              >
                התחילו בחינם
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Link>
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

          <div className="relative z-10 mx-auto max-w-[720px] px-7">

            <h2
              id="cta-heading"
              className="font-extrabold text-white"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", letterSpacing: "-0.035em", lineHeight: 1.05, marginBottom: 18 }}
            >
              תנו לפטרה לעשות קצת סדר.
            </h2>
            <p className="text-lg mb-9" style={{ color: "rgba(226,232,240,0.75)" }}>
              הלקוחות, התורים והתזכורות במקום אחד. פחות דברים לזכור, פחות הודעות לחפש ויותר זמן לעבודה שאתם אוהבים.
            </p>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
              style={{
                background: "#C2410C",
              }}
            >
              התחילו בחינם
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Link>

            <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 list-none p-0 m-0">
              {["חינם, בלי כרטיס אשראי", "עוברים בקלות ממערכות אחרות", "אפשר להתקדם למסלול בתשלום כשתרצו"].map((t) => (
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
        style={{ background: "#0B1120", color: "rgba(226,232,240,0.7)", padding: "56px 0 32px" }}
        role="contentinfo"
      >
        <div className="mx-auto max-w-[1240px] px-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 pb-7"
            style={{ marginBottom: 22 }}>
            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
              <Image src="/petra-logo.png" alt="לוגו פטרה" width={30} height={30} className="object-contain" />
              <div>
                <div className="text-white font-extrabold text-base" style={{ letterSpacing: "-0.02em" }}>פטרה</div>
                <div className="text-sm mt-0.5" style={{ color: "rgba(203,213,225,0.8)" }}>ניהול עסקי חיות מחמד</div>
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

          <p className="text-center text-sm leading-relaxed" style={{ color: "rgba(203,213,225,0.75)" }}>
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
                description: "מערכת ניהול חכמה לאלפי כלבים, גרומרים ופנסיונים בישראל. ניהול לקוחות, תורים, תזכורות WhatsApp אוטומטיות, עוזר AI ויומן דיגיטלי.",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web, iOS, Android",
                inLanguage: "he",
                offers: [
                  { "@type": "Offer", name: "חינמי", price: "0", priceCurrency: "ILS", description: "עד 30 לקוחות, ללא כרטיס אשראי" },
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
