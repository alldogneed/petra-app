"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "Heebo, sans-serif", direction: "rtl" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <p style={{ fontSize: "48px", marginBottom: "16px" }}>🐾</p>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>משהו השתבש</h2>
            <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "14px" }}>
              אנחנו כבר מודעים לבעיה. נסה לרענן את הדף.
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
              נסה שוב
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
