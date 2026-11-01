"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { brandCssVariables } from "@/lib/verticals/branding";

/**
 * Verticals phase 3: a "generic" business sees its own colour everywhere the app uses
 * `brand-*` (Tailwind tokens read --brand-N, see globals.css). Dogs businesses get no
 * override (`businessBranding` is null) → the Petra palette, unchanged.
 */
export function BrandTheme() {
  const { user } = useAuth();
  const branding = user?.businessBranding ?? null;

  const pathname = usePathname();
  const name = branding?.name;

  // Browser tab: the business's name instead of "Petra — מערכת ניהול…" on screens without
  // their own PageTitle (Next re-applies the root metadata title on navigation).
  useEffect(() => {
    if (!name) return;
    const t = setTimeout(() => {
      if (/Petra/.test(document.title)) document.title = document.title.replace(/Petra(\s—[^|]*)?/, name);
    }, 50);
    return () => clearTimeout(t);
  }, [name, pathname]);

  if (!branding) return null;
  return <style dangerouslySetInnerHTML={{ __html: `:root{${brandCssVariables(branding.primaryColor)}}` }} />;
}
