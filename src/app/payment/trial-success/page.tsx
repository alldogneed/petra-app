"use client";

import { useEffect, Suspense } from "react";
import { PetraLoader } from "@/components/ui/PetraLoader";

function TrialSuccessContent() {
  useEffect(() => {
    // This page is deprecated — redirect to /payment/success
    window.location.replace("/payment/success" + window.location.search);
  }, []);

  return <PetraLoader variant="splash" />;
}

export default function TrialSuccessPage() {
  return (
    <Suspense>
      <TrialSuccessContent />
    </Suspense>
  );
}
