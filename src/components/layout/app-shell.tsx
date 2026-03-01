"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { type ReactNode, useState } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={[
          "transition-all duration-300",
          "mr-0",
          collapsed ? "md:mr-[72px]" : "md:mr-[240px]",
        ].join(" ")}
      >
        <Topbar onMenuToggle={() => setMobileOpen((prev) => !prev)} />
        <main className="p-4 md:p-6">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
