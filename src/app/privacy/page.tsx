import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export async function generateMetadata() {
  const t = await getTranslations("legal.privacyPage");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

// Section ids + item keys; the texts live in messages (legal.privacyPage.sections.*).
const SECTIONS: { id?: string; key: string; items: string[] }[] = [
  { key: "intro", items: ["about", "purpose", "consent", "lastUpdated"] },
  { key: "collected", items: ["account", "clients", "pets", "appointments", "payment", "googleCalendar", "googleContacts", "usage"] },
  { key: "calendarApi", items: ["purpose", "consentOnly", "visibleFunction", "noUnrelated", "noSharing", "noAds", "staffAccess", "revoke", "compliance"] },
  { id: "google-contacts", key: "contactsApi", items: ["optional", "scope", "dataWritten", "noReading", "noSharing", "revoke", "limitedUse"] },
  { id: "ai-and-google-data", key: "aiGoogleData", items: ["petraAi", "mcp", "noTransfer", "noAggregators", "statement"] },
  { key: "usage", items: ["operate", "reminders", "improve", "security", "support"] },
  { key: "sharing", items: ["noSale", "email", "whatsapp", "payments", "storage", "google", "legal", "transfer"] },
  { key: "storage", items: ["cloud", "oauthTokens", "login", "staffAccess", "rateLimiting"] },
  { key: "retention", items: ["active", "afterEnd", "earlyDeletion"] },
  { key: "rights", items: ["access", "correction", "deletion", "portability", "googleRevoke", "exercise"] },
  { key: "cookies", items: ["session", "noTracking", "blocking"] },
  { key: "contact", items: ["intro", "email", "response"] },
  { key: "changes", items: ["updates", "notice", "continued"] },
];

// English Google disclosures (CLAUDE.md #42) — rendered verbatim for every locale.
const GOOGLE_CONTACTS_EN = [
  "Petra is a business management platform for pet-service businesses (dog trainers, boarding kennels, groomers). Connecting Google Contacts is optional and happens only after you explicitly grant access through Google's OAuth consent screen.",
  "Petra uses the Google Contacts scope (https://www.googleapis.com/auth/contacts) only to create and update contacts for the leads recorded in your Petra account, inside your own Google Contacts.",
  "Data written to a contact: the lead's name, phone number, email address (if provided), city and a short note from Petra. Petra stores only the identifier of each contact it created, so it can update that contact later.",
  "Petra does not read, download, store or analyze your existing Google contacts. The only contacts it accesses are the ones Petra itself created, in order to update them.",
  "Petra does not sell Google user data, does not transfer or share it with third parties, and does not use it for advertising, targeting, tracking or training AI models.",
  "You can turn the sync off at any time in Petra under Settings → Integrations, or revoke access at myaccount.google.com/permissions. After that Petra creates and updates no further contacts; contacts already created remain in your Google account under your control.",
  "Limited Use: Petra's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
  "Questions: info@petra-app.com",
];

const AI_EN = [
  "Petra AI, the in-app support assistant, runs on Anthropic's Claude API (a commercial API service). It receives only the user's question and general, non-Google information about the account (such as the subscription plan and the number of clients). It never receives any data obtained from Google APIs.",
  "AI assistants (MCP connector, private beta): a business owner can connect their own Claude or ChatGPT account to their Petra business records. This connector does not expose any data obtained from Google APIs — no Google contacts and no Google Calendar events or busy times.",
  "Petra does not transfer raw, aggregated, anonymized or derived data obtained from Google APIs to any third-party AI service, and does not use such data to create, train or improve AI or machine-learning models.",
  "Petra does not use AI model aggregators or gateways and does not run self-hosted models.",
  "The use of raw or derived user data received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
];

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacyPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: await getLocale() })];
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4" dir={cfg.dir}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
            <Image src="/logo.svg" alt="Petra" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t("header.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("header.lastUpdated")}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-slate-600">
              {t("intro")}
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.key} id={section.id} className="scroll-mt-6">
              <h3 className="font-bold text-slate-800 mb-2">{t(`sections.${section.key}.title`)}</h3>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item} className="text-sm text-slate-600 leading-relaxed">
                    {t(`sections.${section.key}.items.${item}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* English disclosure — Google API Services User Data Policy */}
          <div dir="ltr" lang="en" id="google-contacts-en" className="pt-6 border-t border-slate-100 text-left scroll-mt-6">
            <h3 className="font-bold text-slate-800 mb-2">Google Contacts &amp; Limited Use Disclosure (English)</h3>
            <ul className="space-y-1.5">
              {GOOGLE_CONTACTS_EN.map((item, i) => (
                <li key={i} className="text-sm text-slate-600 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div dir="ltr" lang="en" id="ai-en" className="pt-6 border-t border-slate-100 text-left scroll-mt-6">
            <h3 className="font-bold text-slate-800 mb-2">AI Services &amp; Google User Data (English)</h3>
            <ul className="space-y-1.5">
              {AI_EN.map((item, i) => (
                <li key={i} className="text-sm text-slate-600 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 text-center">
          {t.rich("footer", {
            year: String(new Date().getFullYear()),
            link: (c) => (
              <a href="/terms" className="underline hover:text-slate-600">
                {c}
              </a>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
