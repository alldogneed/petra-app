"use client";

import { Monitor } from "lucide-react";

/**
 * Subtle informational banner shown on pages that are better suited for desktop.
 * Visible only on mobile (md:hidden). Static — no dismiss button needed.
 */
export function DesktopBanner() {
  return (
    <div className="md:hidden flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-slate-100 text-slate-500 text-xs">
      <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
      הדף הזה מותאם לשימוש בדסקטופ — חלק מהפעולות עשויות להיות מוגבלות במובייל
    </div>
  );
}
