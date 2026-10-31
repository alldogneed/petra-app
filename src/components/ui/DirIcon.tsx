"use client";

import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A directional icon (chevron / arrow) that mirrors in LTR.
 * Petra's icons were chosen for RTL, so the icon you pass is the one the
 * HEBREW screen shows; in an LTR (English) document it is flipped.
 *
 *   <DirIcon icon={ChevronLeft} className="w-4 h-4" />   // "next" in Hebrew → "next" in English
 *
 * Equivalent className-only form: add "ltr:-scale-x-100" to the icon.
 */
export function DirIcon({ icon: Icon, className, ...props }: LucideProps & { icon: LucideIcon }) {
  return <Icon className={cn("ltr:-scale-x-100", className)} {...props} />;
}
