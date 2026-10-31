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
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.landingPage");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    keywords: t("meta.keywords").split(","),
    alternates: {
      canonical: "https://petra-app.com/landing",
    },
    openGraph: {
      title: t("meta.ogTitle"),
      description: t("meta.ogDescription"),
      url: "https://petra-app.com/landing",
      images: [
        {
          url: "/hero-image.png",
          width: 1200,
          height: 630,
          alt: t("meta.ogImageAlt"),
        },
      ],
    },
  };
}

const WHATSAPP_SUPPORT = "https://wa.me/972542560964";

// ─── Data ─────────────────────────────────────────────────────────────────────
// Labels live in messages (landing.landingPage.*); ids here are message keys.

// CLAUDE.md #22 — keep 130 / 5,000+ / 98% aligned with login + ClientsMarquee.
const TRUST_STATS = [
  { num: "130", id: "activeBusinesses" },
  { num: "5,000+", id: "appointmentsBooked" },
  { num: "98%", id: "satisfaction" },
  { num: "15", id: "yearsInField" },
] as const;

const HOW_IT_WORKS = [
  { n: "01", id: "openAccount", icon: Users },
  { n: "02", id: "addClients", icon: Zap },
  { n: "03", id: "backToWork", icon: TrendingUp },
] as const;

const AUDIENCES = [
  {
    id: "trainers",
    icon: Dog,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    features: ["progress", "records", "reminders"],
    shotSrc: "/landing/screens/aud-trainers.webp",
  },
  {
    id: "groomers",
    icon: Scissors,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    features: ["selfBooking", "reminders", "records"],
    shotSrc: "/landing/screens/aud-groomers.webp",
  },
  {
    id: "boarding",
    icon: Home,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    features: ["occupancy", "checkIn", "stayRecords"],
    shotSrc: "/landing/screens/aud-boarding.webp",
  },
  {
    id: "serviceDogs",
    icon: Shield,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    checkColor: "text-orange-600",
    features: ["stages", "records", "reports"],
    shotSrc: "/landing/screens/aud-service-dogs.webp",
  },
] as const;

const FEATURES: {
  icon: typeof MessageCircle;
  id: string;
  tier?: boolean;
  examples?: string[];
}[] = [
  { icon: MessageCircle, id: "whatsapp", tier: true },
  { icon: Calendar, id: "calendar" },
  { icon: FileSignature, id: "contracts", tier: true },
  { icon: BarChart3, id: "business" },
  { icon: Globe, id: "onlineBooking", tier: true },
  { icon: Target, id: "leads" },
  { icon: Sparkles, id: "ai", examples: ["callBack", "lastMeeting", "openPayments"] },
];

const DAY_STEPS: { icon: typeof Sunrise; id: string; note?: boolean }[] = [
  { icon: Sunrise, id: "morning" },
  { icon: UserPlus, id: "midday" },
  { icon: BellRing, id: "beforeAppointment", note: true },
  { icon: MoonStar, id: "endOfDay" },
];

const ABOUT_POINTS = [
  { icon: Zap, id: "knowYourDay" },
  { icon: Users, id: "builtTogether" },
  { icon: MessageCircle, id: "builtWhatWasMissing" },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const t = await getTranslations("landing.landingPage");
  const locale = await getLocale();
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale })];
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
      {/* Skip-to-content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-xl focus:font-medium focus:shadow-lg"
      >
        {t("skipToContent")}
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
              <div className="min-w-0 text-center lg:text-start">

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
                  {t("hero.titleLine1")}<br />
                  {t("hero.titleLine2")}
                </h1>

                <p style={{ ["--lp-d" as string]: "160ms", color: "rgba(226,232,240,0.85)" }} className="lp-rise mb-8 max-w-[540px] mx-auto lg:mx-0 text-lg leading-[1.6]">
                  {t("hero.subtitle")}
                </p>

                <div style={{ ["--lp-d" as string]: "240ms" }} className="lp-rise flex flex-wrap items-center justify-center lg:justify-start gap-3.5 mb-7">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
                    style={{
                      background: "#C2410C",
                    }}
                  >
                    {t("startFree")}
                    <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />
                  </Link>
                  <Link
                    href="#video"
                    className="inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-medium text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
                    style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {t("hero.watchDemo")}
                  </Link>
                </div>

                <ul className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 list-none p-0 m-0">
                  {(["free", "easyMigration", "aiAssistant"] as const).map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm" style={{ color: "rgba(226,232,240,0.75)" }}>
                      <span className="inline-flex w-[18px] h-[18px] rounded-full items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.20)" }}>
                        <Check className="w-2.5 h-2.5" style={{ color: "#FDBA74" }} aria-hidden="true" />
                      </span>
                      {t(`bullets.${b}`)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Product screenshot column — left side in RTL */}
              <div style={{ ["--lp-d" as string]: "200ms" }} className="lp-rise relative mt-8 lg:mt-0 min-w-0 lg:pb-10">

                <div className="relative">
                  <BrowserShot
                    src="/landing/screens/hero-leads.webp"
                    alt={t("hero.shotAlt")}
                    width={2400}
                    height={1283}
                    priority
                  />

                  {/* Phone — customer card, overlapping the frame's bottom-left (RTL: physical left) */}
                  <div className="hidden md:block absolute -bottom-10 -end-6 w-[150px] lg:w-[170px]">
                    <PhoneShot
                      src="/landing/screens/phone-customer.webp"
                      alt={t("hero.phoneAlt")}
                      width={780}
                      height={1580}
                    />
                  </div>

                  {/* Floating toast — top-left of frame (RTL: physical left) */}
                  <div
                    aria-hidden="true"
                    className="lp-float hidden md:flex absolute -top-6 md:-end-2 lg:-end-8 bg-white rounded-2xl items-center gap-3 px-4 py-3 min-w-[240px] pointer-events-none"
                    style={{
                      boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05)",
                      animation: "lpFloat 6s ease-in-out infinite",
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" style={{ strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">{t("hero.toastTitle")}</div>
                      <div className="text-[13px] text-slate-500 mt-0.5">{t("hero.toastBody")}</div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </section>

        {/* ── Trust bar ─────────────────────────────────────────────────────────── */}
        <section
          aria-label={t("trust.ariaLabel")}
          style={{ background: "#0F172A", padding: "22px 0" }}
        >
          <dl className="mx-auto max-w-[1240px] px-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {TRUST_STATS.map(({ num, id }) => (
              <div
                key={id}
                className="flex flex-col items-center text-center py-2"
              >
                <dt
                  className="text-2xl font-extrabold mb-1"
                  style={{ color: "#FDBA74", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}
                >
                  {num}
                </dt>
                <dd className="text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>{t(`trust.stats.${id}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Product demo: real screens + promo video ──────────────────────────── */}
        <section aria-labelledby="video-heading" className="py-24 bg-slate-900" id="video">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-7">
            <div className="text-center mb-10">
              <h2 id="video-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
                {t("demo.title")}
              </h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                {t("demo.subtitle")}
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
                {t("day.title")}
              </h2>
            </Reveal>

            <ol className="grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-4 list-none p-0 m-0">
              {DAY_STEPS.map(({ icon: Icon, id, note }, i) => (
                <Reveal as="li" key={id} delay={i * 80} className="flex gap-4 lg:flex-col lg:gap-3">
                  <div className="w-11 h-11 rounded-[12px] bg-orange-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-orange-600" aria-hidden="true" style={{ strokeWidth: 1.75 }} />
                  </div>
                  <div>
                    <h3 className="text-[19px] font-bold text-slate-900 mb-1.5" style={{ letterSpacing: "-0.01em" }}>{t(`day.steps.${id}.when`)}</h3>
                    <p className="text-base text-slate-700 leading-[1.6] m-0">{t(`day.steps.${id}.text`)}</p>
                    {note && <p className="text-[13px] text-slate-500 mt-2 m-0">{t(`day.steps.${id}.note`)}</p>}
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
                {t("audiences.title")}
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
                {t("audiences.subtitle")}
              </p>
            </Reveal>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
              {AUDIENCES.map((a, i) => {
                const Icon = a.icon;
                return (
                  <Reveal as="li" key={a.id} delay={i * 80}>
                    <article
                      className="group flex flex-col rounded-[20px] bg-white overflow-hidden h-full lp-card"
                    >
                      {/* Real screen from the app */}
                      <div className="relative shrink-0 aspect-[16/10] overflow-hidden bg-slate-100">
                        <Image
                          src={a.shotSrc}
                          alt={t(`audiences.items.${a.id}.shotAlt`)}
                          fill
                          sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover object-right-top ltr:object-left-top transition-transform duration-300 [transition-timing-function:var(--lp-ease)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]"
                        />
                        {/* Icon badge */}
                        <div className={`absolute bottom-3 start-3 w-[42px] h-[42px] rounded-xl ${a.iconBg} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${a.iconColor}`} aria-hidden="true" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col flex-1 p-5">
                        <h3 className="text-[17px] font-bold text-slate-900 mb-1" style={{ letterSpacing: "-0.01em" }}>{t(`audiences.items.${a.id}.title`)}</h3>
                        <p className="text-[15px] font-medium text-slate-900 leading-[1.5] mb-3">{t(`audiences.items.${a.id}.desc`)}</p>
                        <ul className="space-y-2 list-none p-0 m-0 flex-1">
                          {a.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-[15px] text-slate-700 leading-[1.5]">
                              <Check className={`w-3.5 h-3.5 ${a.checkColor} shrink-0 mt-0.5`} aria-hidden="true" style={{ strokeWidth: 2.5 }} />
                              {t(`audiences.items.${a.id}.features.${f}`)}
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
                {t("startFree")}
                <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />
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
                {t("features.title")}
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
                {t("features.subtitle")}
              </p>
            </Reveal>

            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
              {FEATURES.map(({ icon: Icon, id, tier, examples }, i) => (
                <Reveal as="li" key={id} delay={(i % 4) * 80} className={examples ? "md:col-span-2" : undefined}>
                  <article
                    className="group rounded-[20px] bg-slate-50 p-7 h-full lp-card"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-[12px] bg-orange-100 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-orange-600" aria-hidden="true" style={{ strokeWidth: 1.75 }} />
                      </div>
                      <span className="text-[15px] font-semibold text-brand-700">{t(`features.items.${id}.name`)}</span>
                    </div>
                    <h3 className="text-[19px] font-bold text-slate-900 mb-2" style={{ letterSpacing: "-0.01em" }}>{t(`features.items.${id}.title`)}</h3>
                    <p className="text-base text-slate-600 leading-[1.55] m-0">{t(`features.items.${id}.desc`)}</p>
                    {examples && (
                      <ul className="mt-4 flex flex-wrap gap-2 list-none p-0 m-0" aria-label={t("features.examplesAriaLabel")}>
                        {examples.map((q) => (
                          <li key={q} className="rounded-xl bg-white px-3.5 py-2 text-[15px] text-slate-800">{t(`features.items.${id}.examples.${q}`)}</li>
                        ))}
                      </ul>
                    )}
                    {tier && <p className="text-[13px] text-slate-500 mt-3 m-0">{t("features.tierBasicPro")}</p>}
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
                  {t("googleContacts.badge")}
                </span>
                <h2
                  id="gcontacts-heading"
                  className="text-slate-900 font-extrabold"
                  style={{ fontSize: "clamp(28px, 3.5vw, 42px)", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 18 }}
                >
                  {t.rich("googleContacts.title", {
                    accent: (chunks) => <span className="text-brand-500">{chunks}</span>,
                  })}
                </h2>
                <p className="text-lg text-slate-600 leading-[1.6] mb-7" style={{ maxWidth: 520 }}>
                  {t("googleContacts.body")}
                </p>
                <ul className="space-y-3.5 list-none p-0 m-0">
                  {(["consent", "createUpdateOnly", "offByDefault"] as const).map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-slate-600 leading-[1.55]">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-brand-500" style={{ strokeWidth: 3 }} aria-hidden="true" />
                      {t(`googleContacts.points.${p}`)}
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
                  {t("about.title")}
                </h2>

                <p className="text-lg text-slate-600 leading-[1.6] mb-8" style={{ maxWidth: 480 }}>
                  {t("about.intro")}
                </p>

                <ul className="space-y-[18px] list-none p-0 m-0">
                  {ABOUT_POINTS.map(({ icon: Icon, id }, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--brand-100, #FFEDD5)" }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: "var(--brand-600, #EA580C)", strokeWidth: 2 }} aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">{t(`about.points.${id}.title`)}</h3>
                        <p className="text-base text-slate-700 leading-[1.55] m-0">{t(`about.points.${id}.text`)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Left col — Photo + stat card */}
              <div aria-hidden="true" className="relative">

                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
                  <Image
                    src="/about-field-3.webp"
                    alt={t("about.imageAlt")}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  {/* Gradient overlay bottom */}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 60%, rgba(15,23,42,0.4) 100%)" }} />
                </div>

                {/* Floating stat card */}
                <div
                  className="absolute bottom-6 start-6 bg-white rounded-[14px] px-[18px] py-3.5"
                  style={{ boxShadow: "0 12px 32px -8px rgba(0,0,0,0.25)" }}
                >
                  <div className="text-[22px] font-extrabold leading-tight" style={{ color: "var(--brand-700, #C2410C)", letterSpacing: "-0.02em" }}>{t("about.statTitle")}</div>
                  <div className="text-[13px] text-slate-600 font-medium mt-0.5">{t("about.statSubtitle")}</div>
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
                {t("how.title")}
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto leading-[1.55]">
                {t("how.subtitle")}
              </p>
            </Reveal>

            <ol className="grid md:grid-cols-3 gap-6 list-none p-0 m-0">
              {HOW_IT_WORKS.map(({ n, id, icon: Icon }, i) => (
                <Reveal as="li" key={n} delay={i * 90}>
                <div
                  className="group relative overflow-hidden rounded-[20px] bg-slate-50 p-8 lp-card h-full"
                >

                  {/* Icon tile */}
                  <div className="relative z-10 mb-5 w-12 h-12 rounded-[14px] bg-orange-100 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-500">
                    <Icon className="w-5 h-5 text-brand-500 transition-colors duration-200 group-hover:text-white" aria-hidden="true" />
                  </div>

                  <h3 className="relative z-10 text-[19px] font-bold text-slate-900 mb-2" style={{ letterSpacing: "-0.015em" }}>{t(`how.steps.${id}.title`)}</h3>
                  <p className="relative z-10 text-base text-slate-600 leading-[1.6] m-0">{t(`how.steps.${id}.desc`)}</p>
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
                {t("startFree")}
                <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />
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
              {t("finalCta.title")}
            </h2>
            <p className="text-lg mb-9" style={{ color: "rgba(226,232,240,0.75)" }}>
              {t("finalCta.subtitle")}
            </p>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
              style={{
                background: "#C2410C",
              }}
            >
              {t("startFree")}
              <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />
            </Link>

            <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 list-none p-0 m-0">
              {(["free", "easyMigration", "upgradeAnytime"] as const).map((b) => (
                <li key={b} className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(226,232,240,0.7)" }}>
                  <Check className="w-3 h-3 shrink-0" style={{ color: "#FDBA74", strokeWidth: 3 }} aria-hidden="true" />
                  {t(`bullets.${b}`)}
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
              <Image src="/petra-logo.png" alt={t("footer.logoAlt")} width={30} height={30} className="object-contain" />
              <div>
                <div className="text-white font-extrabold text-base" style={{ letterSpacing: "-0.02em" }}>{t("footer.brandName")}</div>
                <div className="text-sm mt-0.5" style={{ color: "rgba(203,213,225,0.8)" }}>{t("footer.tagline")}</div>
              </div>
            </div>

            {/* Nav links */}
            <nav aria-label={t("footer.navAriaLabel")}>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-3 list-none p-0 m-0">
                {[
                  { href: "#features", id: "features" },
                  { href: "#pricing", id: "pricing" },
                  { href: WHATSAPP_SUPPORT, id: "support", external: true, icon: MessageCircle },
                  { href: "/privacy", id: "privacy" },
                  { href: "/terms", id: "terms" },
                  { href: "/accessibility", id: "accessibility" },
                ].map(({ href, id, external, icon: Icon }) => (
                  <li key={id}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm transition-colors hover:text-white inline-flex items-center gap-1.5 focus:outline-none focus:underline"
                      >
                        {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
                        {t(`footer.links.${id}`)}
                      </a>
                    ) : (
                      <Link href={href} className="text-sm transition-colors hover:text-white focus:outline-none focus:underline">
                        {t(`footer.links.${id}`)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <p className="text-center text-sm leading-relaxed" style={{ color: "rgba(203,213,225,0.75)" }}>
            {t.rich("footer.credit", {
              link: (chunks) => (
                <a
                  href="https://all-dog.co.il"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-slate-400 underline underline-offset-2"
                  style={{ color: "rgba(226,232,240,0.85)" }}
                >
                  {chunks}
                </a>
              ),
            })}
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
                description: t("jsonLd.description"),
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web, iOS, Android",
                inLanguage: cfg.lang,
                offers: [
                  { "@type": "Offer", name: t("jsonLd.freeOfferName"), price: "0", priceCurrency: "ILS", description: t("jsonLd.freeOfferDescription") }, // i18n-ok: Petra's real prices are in ILS
                  { "@type": "Offer", name: "Basic", price: "99", priceCurrency: "ILS", billingDuration: "P1M" }, // i18n-ok: Petra's real prices are in ILS
                  { "@type": "Offer", name: "Pro", price: "199", priceCurrency: "ILS", billingDuration: "P1M" }, // i18n-ok: Petra's real prices are in ILS
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
              { "@type": "WebSite", "@id": "https://petra-app.com/#website", url: "https://petra-app.com", name: "Petra", inLanguage: cfg.lang, publisher: { "@id": "https://petra-app.com/#org" } },
            ],
          }),
        }}
      />
    </div>
  );
}
