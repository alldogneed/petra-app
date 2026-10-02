"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Settings,
  LogOut,
  Shield,
  HeartHandshake,
  Megaphone,
  LifeBuoy,
  ShieldCheck,
  Bot,
  Database,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FullSession } from "@/lib/session";
import { useEffect, useState } from "react";
import { PLATFORM_ROLE_LABELS } from "@/lib/platform-labels";
import { OwnerSearch } from "@/components/owner/owner-search";

type NavEntry =
  | { eyebrow: string }
  | { name: string; href: string; icon: typeof LayoutDashboard; exact?: boolean };

// Grouped by eyebrows, same pattern as the main app sidebar.
const navEntries: NavEntry[] = [
  { eyebrow: "סקירה" },
  { name: "דשבורד", href: "/owner", icon: LayoutDashboard, exact: true },
  { eyebrow: "לקוחות" },
  { name: "עסקים", href: "/owner/tenants", icon: Building2 },
  { name: "משתמשים", href: "/owner/users", icon: Users },
  { name: "בריאות לקוחות", href: "/owner/customer-success", icon: HeartHandshake },
  { name: "תמיכה", href: "/owner/support", icon: LifeBuoy },
  { eyebrow: "תקשורת" },
  { name: "הודעות שידור", href: "/owner/broadcast", icon: Megaphone },
  { eyebrow: "תאימות ויומנים" },
  { name: "הסכמות תנאים", href: "/owner/consents", icon: ShieldCheck },
  { name: "יומן פעולות", href: "/owner/audit-logs", icon: FileText },
  { eyebrow: "מערכת" },
  { name: "עוזרי AI (MCP)", href: "/owner/mcp", icon: Bot },
  { name: "ייבוא נתונים", href: "/owner/migration", icon: Database },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed drawer on mobile, sticky column on desktop */}
      <aside
        className={cn(
          "w-[230px] flex-shrink-0 flex flex-col h-screen z-50 transition-transform duration-200",
          "fixed top-0 right-0 lg:sticky lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          background: "linear-gradient(180deg, #0F172A 0%, #1a2744 100%)",
          borderInlineStart: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 gap-3 border-b border-white/[0.07]">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/logo.svg" alt="Petra" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm leading-none">Petra</div>
            <div className="text-[10px] text-orange-300 font-semibold leading-none mt-1 tracking-wider">
              ניהול פלטפורמה
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
            aria-label="סגירת תפריט"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navEntries.map((entry) => {
            if ("eyebrow" in entry) {
              return (
                <div
                  key={entry.eyebrow}
                  className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40 first:pt-1"
                >
                  {entry.eyebrow}
                </div>
              );
            }
            const isActive = entry.exact ? pathname === entry.href : pathname.startsWith(entry.href);
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "text-white bg-orange-500/15"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-orange-400")} />
                {entry.name}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-orange-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white leading-tight truncate">
                {session.user.name}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">
                {PLATFORM_ROLE_LABELS[session.user.platformRole ?? ""] ?? session.user.platformRole}
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
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 lg:px-6 bg-white/90 backdrop-blur border-b border-slate-100">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ms-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="פתיחת תפריט"
          >
            <Menu className="w-5 h-5" />
          </button>
          <OwnerSearch />
          <Link
            href="/dashboard"
            className="ms-auto flex-shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            חזרה לאפליקציה ←
          </Link>
        </header>

        <main id="main-content" className="p-4 lg:p-6 max-w-7xl">{children}</main>
      </div>
      <Toaster position="top-left" richColors />
    </div>
  );
}
