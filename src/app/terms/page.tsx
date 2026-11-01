import Image from "next/image";
import { ScrollText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

export async function generateMetadata() {
  const t = await getTranslations("legal.termsPage");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

// Section / item ids → messages legal.termsPage.sections.<id>.{title,items.<item>}
const SECTIONS = [
  { id: "intro", items: ["bindingAgreement", "acceptance", "additionalTerms", "ongoingDevelopment"] },
  { id: "definitions", items: ["system", "company", "user", "service", "content", "tradeSecret"] },
  { id: "registration", items: ["accurateDetails", "passwordSecrecy", "refuseOrSuspend", "authorizedUsers"] },
  { id: "acceptableUse", items: ["prohibitedIntro", "illegalContent", "unauthorizedAccess", "spam", "ipInfringement", "competitiveAnalysis", "systematicDocumentation", "scraping"] },
  { id: "license", items: ["ownership", "grant", "noCopying", "anonymousData"] },
  { id: "tradeSecrets", items: ["definition", "noDisclosure", "permittedUseOnly", "remedies", "survival"] },
  { id: "payments", items: ["billingCycle", "prepaid", "cancellation", "priceChanges", "noRefund", "subscriptionEnd", "trial"] },
  { id: "dataRetention", items: ["retentionPeriod", "deletionOrTransfer", "dpa"] },
  { id: "privacy", items: ["confidentiality", "reasonableMeasures", "noCardStorage"] },
  { id: "liability", items: ["asIs", "indirectDamages", "cap"] },
  { id: "indemnification", items: ["indemnify"] },
  { id: "termination", items: ["suspendOnBreach", "dataDeletion", "noPartialRefund"] },
  { id: "changes", items: ["notice", "continuedUse"] },
  { id: "jurisdiction", items: ["governingLaw", "venue", "arbitration"] },
  { id: "forceMajeure", items: ["noLiability"] },
];

export default async function TermsPage() {
  const t = await getTranslations("legal.termsPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: await getLocale() })];
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4" dir={cfg.dir}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
            <Image src="/logo.svg" alt="Petra" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("version")}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <ScrollText className="w-5 h-5 text-brand-500 flex-shrink-0" />
            <p className="text-sm text-slate-600">
              {t.rich("intro", { b: (c) => <strong>{c}</strong> })}
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.id}>
              <h3 className="font-bold text-slate-800 mb-2">{t(`sections.${section.id}.title`)}</h3>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item} className="text-sm text-slate-600 leading-relaxed">
                    {t(`sections.${section.id}.items.${item}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} {t("footer.rights")}{" "}
          <a href="/privacy" className="underline hover:text-slate-600">
            {t("footer.privacyLink")}
          </a>
        </p>
      </div>
    </div>
  );
}
