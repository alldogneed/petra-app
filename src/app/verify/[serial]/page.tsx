import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
  if (!certificate) {
    return { title: "תעודה לא נמצאה", robots: { index: false, follow: false } };
  }
  return {
    title: `תעודת סיום — ${certificate.studentName}`,
    description: `אימות תעודת סיום הקורס "${certificate.courseTitle}" מטעם ${certificate.businessName}`,
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCertificatePage({ params }: Props) {
  const certificate = await loadCertificate(params.serial);
  if (!certificate) notFound();

  const verifiedDate = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(certificate.issuedAt);

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <CertificateView
          studentName={certificate.studentName}
          courseTitle={certificate.courseTitle}
          issuedAt={certificate.issuedAt}
          businessName={certificate.businessName}
          businessLogo={certificate.businessLogo}
          serial={certificate.serial}
        />

        <p className="petra-cert-noprint mt-6 text-center text-sm text-gray-600">
          ✓ תעודה זו אומתה — הונפקה בתאריך {verifiedDate}
        </p>
      </div>
    </main>
  );
}
