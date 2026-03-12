"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError] name:", error.name);
    console.error("[DashboardError] message:", error.message);
    console.error("[DashboardError] stack:", error.stack);
    console.error("[DashboardError] digest:", error.digest);
    console.error("[DashboardError] full error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div
      dir="rtl"
      className="flex items-center justify-center min-h-[60vh] p-6"
    >
      <div className="text-center space-y-4 max-w-lg">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800">אירעה שגיאה</h2>
        <p className="text-slate-500 text-sm">משהו השתבש בטעינת הדף. אנא נסה שוב.</p>
        {error.digest && (
          <p className="text-xs text-slate-400">קוד שגיאה: {error.digest}</p>
        )}
        {isDev && (
          <div className="text-right bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1 break-all">
            {error.name && <p><strong>Type:</strong> {error.name}</p>}
            {error.message && <p><strong>Message:</strong> {error.message}</p>}
            {error.stack && <p className="whitespace-pre-wrap font-mono text-[10px]">{error.stack.slice(0, 600)}</p>}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary">
            נסה שוב
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            לדף הבית
          </a>
        </div>
      </div>
    </div>
  );
}
