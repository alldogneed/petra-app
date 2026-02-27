"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FullSession } from "@/lib/session";
import { useState } from "react";

const nav = [
  { name: "דשבורד", href: "/owner", icon: LayoutDashboard, exact: true },
  { name: "עסקים", href: "/owner/tenants", icon: Building2 },
  { name: "משתמשים", href: "/owner/users", icon: Users },
  { name: "יומן פעולות", href: "/owner/audit-logs", icon: FileText },
  { name: "הגדרות", href: "/owner/settings", icon: Settings },
];

export function OwnerShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: FullSession;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className="w-[220px] flex-shrink-0 flex flex-col h-screen sticky top-0"
        style={{
          background: "linear-gradient(180deg, #0F172A 0%, #1a2744 100%)",
          borderInlineStart: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 gap-3 border-b border-white/[0.07]">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/logo.svg" alt="Petra" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">Petra</div>
            <div className="text-[10px] text-red-400 font-semibold leading-none mt-0.5 tracking-wider">
              ניהול פלטפורמה
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "text-white bg-orange-500/15"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white leading-tight truncate">
                {session.user.name}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight capitalize">
                {session.user.platformRole?.replace("_", " ")}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] text-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? "מתנתק..." : "התנתק"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 flex items-center px-6 bg-white/80 backdrop-blur border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="font-medium text-red-500">פאנל ניהול פלטפורמה</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              חזרה לאפליקציה ←
            </Link>
          </div>
        </header>

        <main className="p-6 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
