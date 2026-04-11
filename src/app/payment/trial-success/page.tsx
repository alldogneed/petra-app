"use client";

import { useEffect, Suspense } from "react";

function TrialSuccessContent() {
  useEffect(() => {
    // This page is deprecated — redirect to /payment/success
    window.location.replace("/payment/success" + window.location.search);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <p className="text-slate-400 text-sm animate-pulse">מעביר...</p>
    </div>
  );
}

export default function TrialSuccessPage() {
  return (
    <Suspense>
      <TrialSuccessContent />
    </Suspense>
  );
}
