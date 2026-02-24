"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, BarChart2, FileText, LogOut, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FullSession } from "@/lib/session";
import type { SessionMembership } from "@/lib/permissions";
import { useState } from "react";

interface Business {
  id: string;
  name: string;
  status: string;
}

function buildNav(businessId: string) {
  return [
    { name: "אנליטיקס", href: `/app/admin/${businessId}`, icon: BarChart2, exact: true },
    { name: "חברי צוות", href: `/app/admin/${businessId}/members`, icon: Users },
    { name: "יומן פעולות", href: `/app/admin/${businessId}/audit-logs`, icon: FileText },
  ];
}

export function TenantAdminShell({
  children,
  session,
  business,
  membership,
}: {
  children: React.ReactNode;
  session: FullSession;
  business: Business;
  membership: SessionMembership | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const nav = buildNav(business.id);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className="w-[220px] flex-shrink-0 flex flex-col h-screen sticky top-0"
        style={{
          background: "linear-gradient(180deg, #0F172A 0%, #1a2744 100%)",
          borderInlineStart: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center h-16 px-4 gap-3 border-b border-white/[0.07]">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/logo.svg" alt="Petra" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-none truncate">{business.name}</div>
            <div className="text-[10px] text-orange-400 font-semibold leading-none mt-0.5 tracking-wider">
              פאנל ניהול
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {session.user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white leading-tight truncate">
                {session.user.name}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight capitalize">
                {membership?.role ?? session.user.platformRole ?? "user"}
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] text-sm transition-all mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
            חזרה לאפליקציה
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] text-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            התנתק
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 h-14 flex items-center px-6 bg-white/80 backdrop-blur border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500">
            {business.name} — פאנל ניהול
          </span>
          {business.status === "suspended" && (
            <span className="mr-3 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
              מושהה
            </span>
          )}
        </header>
        <main className="p-6 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
