"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { type ReactNode, useState } from "react";
import { HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";

const HelpCenter = dynamic(
  () => import("@/components/help/HelpCenter").then((m) => ({ default: m.HelpCenter })),
  { ssr: false }
);

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onHelpOpen={() => setHelpOpen(true)}
      />
      <div
        className={[
          "transition-all duration-300",
          "mr-0",
          collapsed ? "md:mr-[72px]" : "md:mr-[240px]",
        ].join(" ")}
      >
        <Topbar onMenuToggle={() => setMobileOpen((prev) => !prev)} />
        <main className="p-4 md:p-6 overflow-x-hidden">{children}</main>
        <MobileBottomNav />
      </div>

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-40 w-11 h-11 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all flex items-center justify-center"
        aria-label="מרכז עזרה"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      <HelpCenter open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
