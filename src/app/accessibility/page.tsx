import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LandingNav } from "@/app/landing/_components/LandingNav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.accessibilityPage");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

const CONTACT_EMAIL = "support@petra-app.com";
const CONTACT_PHONE = "051-531-1435";
const CONTACT_WHATSAPP = "https://wa.me/972542560964";

// ── Section component ─────────────────────────────────────────────────────────
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <h2 id={id} className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      <div className="text-slate-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold">✓</span>
      <span>{children}</span>
    </li>
  );
}

function IssueItem({ children, level }: { children: React.ReactNode; level: "partial" | "missing" }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${level === "partial" ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
        {level === "partial" ? "~" : "!"}
      </span>
      <span>{children}</span>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AccessibilityPage() {
  const t = await getTranslations("legal.accessibilityPage");
  const LAST_UPDATED = t("lastUpdatedValue");
  const strong = (c: React.ReactNode) => <strong>{c}</strong>;
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "var(--font-sans), sans-serif" }}>

      <LandingNav />

      {/* Hero strip — matches landing dark style */}
      <div className="bg-slate-950 border-b border-white/8 pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"/>
                <path d="M9 19l3-8 3 8M9 12h6M5 8l2 2M19 8l-2 2"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-brand-400 tracking-widest uppercase">{t("hero.eyebrow")}</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-3">{t("hero.title")}</h1>
          <p className="text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed">
            {t("hero.intro")}
          </p>
          <p className="mt-4 text-slate-500 text-sm">{t("hero.lastUpdated", { date: LAST_UPDATED })}</p>
        </div>
      </div>

      {/* Main content */}
      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-10">

          {/* WCAG badges */}
          <div className="flex flex-wrap gap-3 mb-10">
            {[
              { id: "wcag", label: "WCAG 2.1", sub: "Web Content Accessibility Guidelines", color: "bg-brand-50 border-brand-200 text-brand-800" },
              { id: "level", label: t("badges.levelLabel"), sub: t("badges.levelSub"), color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
              { id: "israel", label: "AA-IL", sub: t("badges.israeliSub"), color: "bg-slate-100 border-slate-200 text-slate-700" },
            ].map((b) => (
              <div key={b.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${b.color}`}>
                <div>
                  <div className="font-bold text-sm">{b.label}</div>
                  <div className="text-xs opacity-70">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <Section id="about-section" title={t("about.title")}>
            <p>
              {t.rich("about.body", {
                link: (c) => <a href="https://all-dog.co.il" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">{c}</a>,
              })}
            </p>
            <p>
              {t.rich("about.siteAddress", {
                code: (c) => <span className="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded">{c}</span>,
              })}
            </p>
          </Section>

          <Section id="commitment-section" title={t("commitment.title")}>
            <p>
              {t.rich("commitment.body1", { strong })}
            </p>
            <p>
              {t("commitment.body2")}
            </p>
          </Section>

          <Section id="measures-section" title={t("measures.title")}>
            <ul className="space-y-2 list-none p-0">
              <CheckItem>{t("measures.rtl")}</CheckItem>
              <CheckItem>{t("measures.contrast")}</CheckItem>
              <CheckItem>{t("measures.keyboard")}</CheckItem>
              <CheckItem>{t("measures.aria")}</CheckItem>
              <CheckItem>{t("measures.textSize")}</CheckItem>
              <CheckItem>{t("measures.skipLink")}</CheckItem>
              <CheckItem>{t.rich("measures.altText", { code: (c) => <span className="font-mono text-xs bg-slate-100 px-1 rounded">{c}</span> })}</CheckItem>
              <CheckItem>{t("measures.toolProfiles")}</CheckItem>
              <CheckItem>{t("measures.toolControls")}</CheckItem>
              <CheckItem>{t("measures.headings")}</CheckItem>
              <CheckItem>{t("measures.forms")}</CheckItem>
              <CheckItem>{t("measures.responsive")}</CheckItem>
            </ul>
          </Section>

          <Section id="limitations-section" title={t("limitations.title")}>
            <p className="text-sm text-slate-500 mb-4">
              {t("limitations.intro")}
            </p>
            <ul className="space-y-2 list-none p-0">
              <IssueItem level="partial">
                {t.rich("limitations.documents", { strong })}
              </IssueItem>
              <IssueItem level="partial">
                {t.rich("limitations.charts", { strong })}
              </IssueItem>
              <IssueItem level="partial">
                {t.rich("limitations.userContent", { strong })}
              </IssueItem>
            </ul>
          </Section>

          <Section id="tech-section" title={t("tech.title")}>
            <p>{t("tech.intro")}</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              {[
                { id: "browsers", title: t("tech.browsers"), items: ["Chrome 120+", "Firefox 120+", "Safari 17+", "Edge 120+"] },
                { id: "screenReaders", title: t("tech.screenReaders"), items: ["NVDA (Windows)", "VoiceOver (macOS / iOS)", "TalkBack (Android)"] },
                { id: "testingTools", title: t("tech.testingTools"), items: ["WAVE Accessibility Tool", "axe DevTools", "Lighthouse Accessibility Audit"] },
                { id: "references", title: t("tech.references"), items: ["WCAG 2.1 (W3C)", t("tech.israeliStandard"), t("tech.equalRightsLaw")] },
              ].map((group) => (
                <div key={group.id} className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">{group.title}</h3>
                  <ul className="space-y-1 list-none p-0">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-slate-500 flex items-center gap-1.5">
                        <span aria-hidden="true" className="text-brand-400">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="feedback-section" title={t("feedback.title")}>
            <p>
              {t.rich("feedback.body", { strong })}
            </p>
            <div className="mt-5 grid sm:grid-cols-3 gap-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center text-xl transition-colors">📧</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-0.5">{t("feedback.email")}</div>
                  <div className="text-xs text-brand-600 break-all">{CONTACT_EMAIL}</div>
                </div>
              </a>
              <a
                href={`tel:${CONTACT_PHONE.replace(/-/g, "")}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center text-xl transition-colors">📞</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-0.5">{t("feedback.phone")}</div>
                  <div className="text-xs text-brand-600" dir="ltr">{CONTACT_PHONE}</div>
                </div>
              </a>
              <a
                href={CONTACT_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-green-100 flex items-center justify-center text-xl transition-colors">💬</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-0.5">WhatsApp</div>
                  <div className="text-xs text-green-600">{t("feedback.sendMessage")}</div>
                </div>
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              {t.rich("feedback.commission", {
                link: (c) => (
                  <a href="https://www.gov.il/he/departments/units/commissioner-equal-rights-disabilities" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    {c}
                  </a>
                ),
              })}
            </p>
          </Section>

          <Section id="date-section" title={t("date.title")}>
            <p>
              {t.rich("date.body", { strong, date: LAST_UPDATED })}
            </p>
            <p>
              {t("date.auditBy")}
            </p>
          </Section>

        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link href="/landing" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:underline">
            {t("backLink")}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/8 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-slate-500 text-sm">
          {t("footer")}
        </div>
      </footer>
    </div>
  );
}
