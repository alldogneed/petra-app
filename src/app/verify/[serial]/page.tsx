import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTimeZone, getTranslations } from "next-intl/server";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";
import { getCertificateBySerial } from "@/services/certificates";
import CertificateView from "@/components/online-classes/CertificateView";

export const dynamic = "force-dynamic";

type Props = { params: { serial: string } };

/** Route params can arrive percent-encoded depending on the runtime. */
function decodeSerial(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const loadCertificate = cache(async (rawSerial: string) => {
  try {
    return await getCertificateBySerial(decodeSerial(rawSerial));
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const certificate = await loadCertificate(params.serial);
  const t = await getTranslations("auth.verifyDetailPage");
  if (!certificate) {
    return { title: t("meta.notFoundTitle"), robots: { index: false, follow: false } };
  }
  return {
    title: t("meta.title", { studentName: certificate.studentName }),
    description: t("meta.description", {
      courseTitle: certificate.courseTitle,
      businessName: certificate.businessName,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCertificatePage({ params }: Props) {
  const certificate = await loadCertificate(params.serial);
  if (!certificate) notFound();

  const t = await getTranslations("auth.verifyDetailPage");
  const locale = localeFromBusiness({ locale: await getLocale() });
  const cfg = LOCALE_CONFIG[locale];
  const timeZone = await getTimeZone();

  const verifiedDate = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(certificate.issuedAt);

  const isRevoked = certificate.revokedAt != null;

  return (
    <main dir={cfg.dir} className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        {isRevoked ? (
          <div className="petra-cert-noprint mb-6 rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-center">
            <p className="text-lg font-bold text-red-700">{t("revokedBanner.title")}</p>
            <p className="mt-1 text-sm text-red-600">
              {t("revokedBanner.body")}
            </p>
          </div>
        ) : null}

        <div
          className={isRevoked ? "relative opacity-60 grayscale" : undefined}
        >
          {isRevoked ? (
            <div className="petra-cert-noprint pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="-rotate-12 rounded-lg border-4 border-red-500 px-6 py-2 text-3xl font-extrabold uppercase tracking-widest text-red-500 sm:text-5xl">
                {t("revokedStamp")}
              </span>
            </div>
          ) : null}

          <CertificateView
            studentName={certificate.studentName}
            courseTitle={certificate.courseTitle}
            issuedAt={certificate.issuedAt}
            businessName={certificate.businessName}
            businessLogo={certificate.businessLogo}
            serial={certificate.serial}
            primaryColor={certificate.primaryColor ?? undefined}
            signatureUrl={certificate.signatureUrl}
            signerName={certificate.signerName}
            footerText={certificate.footerText}
          />
        </div>

        {isRevoked ? (
          <p className="petra-cert-noprint mt-6 text-center text-sm text-red-600">
            {t("revokedFooter")}
          </p>
        ) : (
          <p className="petra-cert-noprint mt-6 text-center text-sm text-gray-600">
            {t("verifiedFooter", { date: verifiedDate })}
          </p>
        )}
      </div>
    </main>
  );
}
