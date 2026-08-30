"use client";

/**
 * Printable course-completion certificate.
 * Presentational only — shared by the members portal and the public
 * verification page (/verify/[serial]). No data fetching, no side effects.
 */

const DEFAULT_PRIMARY = "#F97316";

export interface CertificateViewProps {
  studentName: string;
  courseTitle: string;
  issuedAt: Date | string;
  businessName: string;
  businessLogo: string | null;
  serial: string;
  primaryColor?: string;
  signatureUrl?: string | null;
  signerName?: string | null;
  footerText?: string | null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function heDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .petra-cert-root, .petra-cert-root * { visibility: visible !important; }
  .petra-cert-root {
    position: absolute !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: none !important;
    background: #ffffff !important;
  }
  .petra-cert-noprint { display: none !important; }
  .petra-cert-card {
    box-shadow: none !important;
    border-radius: 0 !important;
    width: 100% !important;
    max-width: none !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  @page { size: A4 landscape; margin: 10mm; }
}
`;

export default function CertificateView({
  studentName,
  courseTitle,
  issuedAt,
  businessName,
  businessLogo,
  serial,
  primaryColor,
  signatureUrl,
  signerName,
  footerText,
}: CertificateViewProps) {
  const color =
    primaryColor && HEX_COLOR.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY;
  const dateLabel = heDate(issuedAt);

  return (
    <div dir="rtl" className="petra-cert-root w-full">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div
        className="petra-cert-card mx-auto w-full max-w-4xl rounded-2xl bg-white p-3 shadow-lg sm:p-4"
        style={{
          border: `6px solid ${color}`,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        {/* Decorative inner border */}
        <div
          className="flex min-h-[420px] flex-col items-center justify-between rounded-xl px-6 py-10 text-center sm:px-12"
          style={{ border: `2px solid ${color}`, opacity: 1 }}
        >
          {/* Header — business identity */}
          <div className="flex flex-col items-center gap-3">
            {businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessLogo}
                alt={businessName}
                className="h-16 w-auto max-w-[200px] object-contain"
              />
            ) : null}
            <p className="text-sm font-medium tracking-wide text-gray-500">
              {businessName}
            </p>
          </div>

          {/* Body */}
          <div className="flex flex-col items-center gap-5 py-6">
            <h1
              className="font-serif text-3xl font-bold tracking-tight sm:text-5xl"
              style={{ color }}
            >
              תעודת סיום
            </h1>
            <div
              className="h-[3px] w-24 rounded-full"
              style={{ backgroundColor: color }}
            />

            <p className="text-base text-gray-600">מוענקת ל־</p>
            <p className="font-serif text-2xl font-bold text-gray-900 sm:text-4xl">
              {studentName}
            </p>

            <p className="text-base text-gray-600">על השלמת הקורס</p>
            <p className="font-serif text-xl font-semibold text-gray-800 sm:text-2xl">
              {courseTitle}
            </p>
          </div>

          {/* Signature block */}
          {signatureUrl || signerName ? (
            <div className="flex flex-col items-center gap-1 pb-2">
              {signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureUrl}
                  alt={signerName || "חתימה"}
                  className="h-16 w-auto max-w-[160px] object-contain"
                  style={{
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                />
              ) : null}
              <div
                className="mt-1 h-px w-40"
                style={{ backgroundColor: "#9ca3af" }}
              />
              {signerName ? (
                <p className="text-sm font-semibold text-gray-700">{signerName}</p>
              ) : null}
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex w-full flex-col items-center justify-between gap-2 border-t border-gray-200 pt-4 text-xs text-gray-500 sm:flex-row">
            <span>תאריך הנפקה: {dateLabel}</span>
            <span className="font-mono tracking-widest">{serial}</span>
          </div>

          {/* Accreditation / footer line */}
          {footerText ? (
            <p className="w-full pt-3 text-center text-[11px] text-gray-400">
              {footerText}
            </p>
          ) : null}
        </div>
      </div>

      <div className="petra-cert-noprint mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          הדפס / שמור כ-PDF
        </button>
      </div>
    </div>
  );
}

export { CertificateView };
