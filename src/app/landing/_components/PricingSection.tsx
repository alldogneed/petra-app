"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ChevronDown, ChevronUp, MessageCircle, CreditCard, Sparkles, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";

const CARDCOM_TIERS = new Set(["basic", "pro"]);

// Labels live in messages: landing.pricingSection.plans.<key>.{name,badge,description,features.<id>,notIncluded.<id>}
type FeatureEntry = string | { id: string; star: true };

const PLANS: {
  key: "free" | "basic" | "pro";
  subtitle?: string;
  price: number;
  hasBadge: boolean;
  highlight: boolean;
  features: FeatureEntry[];
  notIncluded: string[];
}[] = [
  {
    key: "free",
    price: 0,
    hasBadge: false,
    highlight: false,
    features: ["clients30", "appointments20", "orders15", "leads15", "training10", "priceList8", "tasks20"],
    notIncluded: ["whatsappReminders", "googleCalendar", "reports", "paymentRequest"],
  },
  {
    key: "basic",
    price: 99,
    hasBadge: false,
    highlight: false,
    features: [
      "unlimitedClients",
      "calendarGcal",
      { id: "whatsappReminders", star: true },
      { id: "onlineBooking", star: true },
      "paymentRequestIntake",
      "portfolio",
      "contracts",
      "reports",
      "singleUser",
      "whatsappSupport",
    ],
    notIncluded: ["whatsappAutomations", "boardingTeam"],
  },
  {
    key: "pro",
    price: 199,
    hasBadge: true,
    highlight: true,
    features: [
      "allBasic",
      { id: "aiAssistant", star: true },
      { id: "leadAlert", star: true },
      { id: "leadWebhook", star: true },
      { id: "groupClasses", star: true },
      "teamPermissions",
      "boardingRooms",
      "advancedTraining",
      "whatsappAutomations",
      "financeReports",
      "prioritySupport",
    ],
    notIncluded: [],
  },
];

// ─── Comparison table (3 tiers only) ──────────────────────────────────────────
// A string value is a key under landing.pricingSection.compare.values
type FValKey = "upTo30" | "upTo15" | "upTo20" | "upTo10" | "upTo20Appointments" | "unlimited";
type FVal = boolean | FValKey;
interface FRow { id: string; free: FVal; basic: FVal; pro: FVal }

// Labels: landing.pricingSection.compare.groups.<id>.{title,rows.<rowId>}
const FEATURE_GROUPS: { id: string; features: FRow[] }[] = [
  {
    id: "clients",
    features: [
      { id: "clients", free: "upTo30", basic: "unlimited", pro: "unlimited" },
      { id: "leads", free: "upTo15", basic: "unlimited", pro: "unlimited" },
      { id: "petHealth", free: true, basic: true, pro: true },
      { id: "intakeForms", free: false, basic: true, pro: true },
      { id: "tasks", free: "upTo20", basic: "unlimited", pro: "unlimited" },
      { id: "priceList", free: true, basic: true, pro: true },
    ],
  },
  {
    id: "calendar",
    features: [
      { id: "calendar", free: "upTo20Appointments", basic: true, pro: true },
      { id: "onlineBooking", free: false, basic: true, pro: true },
      { id: "googleCalendar", free: false, basic: true, pro: true },
    ],
  },
  {
    id: "whatsapp",
    features: [
      { id: "reminders", free: false, basic: true, pro: true },
      { id: "paymentRequest", free: false, basic: true, pro: true },
      { id: "automations", free: false, basic: false, pro: true },
      { id: "customMessages", free: false, basic: false, pro: true },
      { id: "leadAlert", free: false, basic: false, pro: true },
    ],
  },
  {
    id: "ai",
    features: [
      { id: "aiConnect", free: false, basic: false, pro: true },
      { id: "leadWebhook", free: false, basic: false, pro: true },
    ],
  },
  {
    id: "professional",
    features: [
      { id: "training", free: "upTo10", basic: "unlimited", pro: "unlimited" },
      { id: "advancedTraining", free: false, basic: false, pro: true },
      { id: "groupClasses", free: false, basic: false, pro: true },
      { id: "boarding", free: false, basic: false, pro: true },
      { id: "portfolio", free: false, basic: true, pro: true },
    ],
  },
  {
    id: "finance",
    features: [
      { id: "paymentRequest", free: false, basic: true, pro: true },
      { id: "contracts", free: false, basic: true, pro: true },
      { id: "orders", free: "upTo15", basic: true, pro: true },
      { id: "reports", free: false, basic: true, pro: true },
      { id: "financeReports", free: false, basic: false, pro: true },
    ],
  },
  {
    id: "team",
    features: [
      { id: "team", free: false, basic: false, pro: true },
      { id: "roles", free: false, basic: false, pro: true },
    ],
  },
];

const PLAN_KEYS = ["free", "basic", "pro"] as const;

function FeatureCell({ value }: { value: FVal }) {
  const t = useTranslations("landing.pricingSection");
  if (typeof value === "string") {
    return <span className="text-[13px] text-slate-600 font-medium">{t(`compare.values.${value}`)}</span>;
  }
  return value
    ? <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-label={t("compare.included")} />
    : <X className="w-4 h-4 text-red-300 mx-auto" aria-label={t("compare.notIncluded")} />;
}

// Q/A text: landing.pricingSection.faq.items.<id>.{q,a}
const FAQ_IDS = [
  "whatCanManage",
  "basicVsPro",
  "aiAssistant",
  "mobile",
  "whatsappReminders",
  "onlineBooking",
  "googleCalendar",
  "payments",
  "boarding",
  "team",
  "importData",
  "cancel",
  "upgrade",
] as const;

function FaqAccordion() {
  const t = useTranslations("landing.pricingSection");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="mt-12 bg-slate-50 rounded-2xl p-6">
      <h2 id="faq" className="font-extrabold text-slate-900 mb-5 text-2xl" style={{ letterSpacing: "-0.02em" }}>
        {t("faq.title")}
      </h2>
      <div className="space-y-2">
        {FAQ_IDS.map((id, i) => {
          const q = t(`faq.items.${id}.q`);
          const a = t(`faq.items.${id}.a`);
          const isOpen = open === id;
          return (
            <div key={id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : id)}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-start hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800 text-sm">{q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div id={`faq-a-${i}`} className="lp-collapse" data-open={isOpen}>
                <div>
                  <div className="px-4 pb-4 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    {a}
                  </div>
                </div>
              </div>
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
  const t = useTranslations("landing.pricingSection");

  return (
    <section aria-labelledby="pricing-heading" className="py-20 bg-white" id="pricing">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 id="pricing-heading" className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {t("header.title")}
          </h2>
          <p className="text-slate-500 text-lg">{t("header.subtitle")}</p>
        </div>

        {/* 3 Plan cards */}
        <ul
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 list-none p-0 m-0 pt-6"
          aria-label={t("plansAria")}
        >
          {PLANS.map((plan) => {
            const planName = t(`plans.${plan.key}.name`);
            const planBadge = plan.hasBadge ? t(`plans.${plan.key}.badge`) : null;
            return (
            <li key={plan.key} className="flex flex-col">
              <div
                className={`relative rounded-2xl border-2 flex flex-col h-full transition-colors ${
                  plan.highlight
                    ? "border-brand-500 bg-brand-50 p-5 pt-9"
                    : "border-transparent bg-slate-50 p-5 hover:border-slate-200"
                }`}
              >
                {/* Badge */}
                {planBadge && (
                  plan.highlight ? (
                    <div
                      aria-hidden="true"
                      className="absolute -top-5 start-1/2 translate-x-1/2 ltr:-translate-x-1/2 flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-full bg-brand-600 text-white whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {planBadge}
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute -top-3 start-4 text-xs font-bold px-3 py-1 rounded-full bg-amber-500 text-white"
                    >
                      {planBadge}
                    </div>
                  )
                )}

                {/* Plan header */}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 mb-0.5">
                    {planName}
                    {planBadge && <span className="sr-only"> — {planBadge}</span>}
                  </h3>
                  {plan.subtitle && (
                    <p className="text-[13px] font-medium text-brand-700 mb-1 leading-snug">{plan.subtitle}</p>
                  )}
                  <p className="text-[13px] text-slate-500 leading-snug mb-3">{t(`plans.${plan.key}.description`)}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {t("priceAmount", { price: plan.price })}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-400 text-xs" aria-label={t("perMonthAria")}>{t("perMonth")}</span>
                    )}
                  </div>
                </div>

                {/* Included */}
                <ul className="space-y-1.5 mb-3 flex-1 list-none p-0 m-0">
                  {plan.features.map((f) => {
                    const isHighlighted = typeof f === "object" && f.star;
                    const featureId = typeof f === "object" ? f.id : f;
                    const label = t(`plans.${plan.key}.features.${featureId}`);
                    return (
                      <li
                        key={featureId}
                        className={`flex items-start gap-1.5 text-[13px] ${isHighlighted ? "text-brand-700 font-semibold" : "text-slate-700"}`}
                      >
                        <Check
                          aria-hidden="true"
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isHighlighted ? "text-brand-500" : "text-emerald-500"}`}
                        />
                        {isHighlighted ? (
                          <span>
                            {label}
                            <span className="ms-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 text-brand-600 align-middle">
                              {t("newBadge")}
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
                  <ul className="space-y-1 mb-4 list-none p-0 m-0 pt-2 mt-1">
                    {plan.notIncluded.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[13px] text-slate-500">
                        <X aria-hidden="true" className="w-3.5 h-3.5 text-red-300 mt-0.5 shrink-0" />
                        {t(`plans.${plan.key}.notIncluded.${f}`)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA */}
                {CARDCOM_TIERS.has(plan.key) ? (
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href={user ? `/checkout?tier=${plan.key}` : `/checkout?tier=${plan.key}`}
                      aria-label={t("cta.buyAria", { name: planName })}
                      className={`text-sm py-2.5 rounded-xl text-center font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        plan.highlight
                          ? "bg-brand-700 hover:bg-brand-800 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                      {user ? t("cta.upgradeNow") : t("cta.buyNow")}
                    </Link>
                    <p className="text-xs text-center text-slate-500 leading-snug px-1">
                      {t("cta.billingNote")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href="/register"
                      aria-label={t("cta.startFreeAria", { name: planName })}
                      className="text-sm py-2.5 rounded-xl text-center font-semibold transition-colors bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      {t("cta.startFree")}
                    </Link>
                    {!user && (
                      <p className="text-xs text-center text-emerald-700 font-medium leading-snug px-1">
                        {t("cta.freeNote")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
            );
          })}
        </ul>

        {/* ── Service Dog Enterprise Banner ─────────────────────────────────────── */}
        <div className="mt-6 rounded-2xl bg-emerald-50 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Icon */}
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <Shield className="w-7 h-7 text-emerald-600" aria-hidden="true" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-700 mb-1">{t("serviceDogs.eyebrow")}</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1 leading-snug">
              {t("serviceDogs.title")}
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              {t("serviceDogs.body")}
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
            {t("serviceDogs.cta")}
          </a>
        </div>

        {/* Toggle comparison table */}
        <div className="text-center mt-8">
          <button
            onClick={() => setShowComparison((v) => !v)}
            aria-expanded={showComparison}
            aria-controls="comparison-table"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
          >
            {showComparison
              ? <><ChevronUp className="w-4 h-4" aria-hidden="true" />{t("compare.hide")}</>
              : <><ChevronDown className="w-4 h-4" aria-hidden="true" />{t("compare.show")}</>
            }
          </button>
        </div>

        {/* Comparison table — 3 plans */}
        <div className="lp-collapse" data-open={showComparison}>
          <div>
          <div
            id="comparison-table"
            className="mt-8 overflow-x-auto rounded-2xl border border-slate-200"
            role="region"
            aria-label={t("compare.tableAria")}
          >
            <table className="w-full min-w-[480px] text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="text-start px-4 py-3 font-semibold text-slate-700 w-52">{t("compare.featureColumn")}</th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      scope="col"
                      className={`text-center px-3 py-3 font-semibold text-xs ${
                        p.highlight ? "text-brand-600 bg-brand-50/50" : "text-slate-700"
                      }`}
                    >
                      {t(`plans.${p.key}.name`)}
                      {p.hasBadge && (
                        <span className={`block text-xs font-bold mt-0.5 ${p.highlight ? "text-brand-500" : "text-amber-500"}`}>
                          {t(`plans.${p.key}.badge`)}
                        </span>
                      )}
                      <span className="block font-normal text-slate-500 mt-0.5 text-xs">
                        {p.price === 0 ? t("compare.freePrice") : t("priceAmount", { price: p.price })}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map((group) => (
                  <>
                    <tr key={`cat-${group.id}`} className="bg-slate-50/80">
                      <td colSpan={4} className="px-4 py-2 text-sm font-bold text-slate-600">
                        {t(`compare.groups.${group.id}.title`)}
                      </td>
                    </tr>
                    {group.features.map((feat, i) => (
                      <tr
                        key={feat.id}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                      >
                        <td className="px-4 py-2.5 text-slate-700 text-[13px]">{t(`compare.groups.${group.id}.rows.${feat.id}`)}</td>
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
          </div>
        </div>

        {/* FAQ */}
        <FaqAccordion />

        {/* WhatsApp contact */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400 mb-3">{t("contact.question")}</p>
          <a
            href="https://wa.me/972542560964"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("contact.aria")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            {t("contact.cta")}
          </a>
        </div>

        <p className="text-center text-[13px] text-slate-500 mt-6">
          {t("footnote")}
        </p>
      </div>
    </section>
  );
}
