"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

// Rendered OUTSIDE the root layout → no NextIntlClientProvider. Source of truth
// for these texts is messages/*.json → errors.globalError (keep in sync).
const TEXTS = {
  he: {
    title: "משהו השתבש", // i18n-ok — no intl provider in global-error
    description: "אנחנו כבר מודעים לבעיה. נסה לרענן את הדף.", // i18n-ok — no intl provider in global-error
    tryAgain: "נסה שוב", // i18n-ok — no intl provider in global-error
  },
  en: {
    title: "Something went wrong",
    description: "We're already aware of the issue. Try refreshing the page.",
    tryAgain: "Try again",
  },
} as const;

type Lang = keyof typeof TEXTS;

function detectLang(): Lang {
  if (typeof document === "undefined") return "he";
  return document.documentElement.lang?.toLowerCase().startsWith("en") ? "en" : "he";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang] = useState<Lang>(detectLang);
  const tx = TEXTS[lang];
  const dir = lang === "en" ? "ltr" : "rtl"; // rtl-ok — no provider; mirrors LOCALE_CONFIG dir

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={lang} dir={dir}>
      <body style={{ fontFamily: "Heebo, sans-serif", direction: dir }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <p style={{ fontSize: "48px", marginBottom: "16px" }}>🐾</p>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>{tx.title}</h2>
            <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "14px" }}>
              {tx.description}
            </p>
            <button
              onClick={reset}
              style={{
                background: "#f97316",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              {tx.tryAgain}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
