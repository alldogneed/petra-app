"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
    >
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800">אירעה שגיאה</h1>
        <p className="text-slate-500 text-sm">
          {error.message?.includes("מסד הנתונים")
            ? error.message
            : "משהו השתבש. אנא רענן את הדף ונסה שוב."}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400">קוד שגיאה: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
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
