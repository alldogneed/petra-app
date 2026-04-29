"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  Home,
  Crown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  BarChart2,
  Megaphone,
  Database,
  Shield,
  Building2,
  HeartHandshake,
  LifeBuoy,
  FileText,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const ADMIN_ITEMS: NavItem[] = [
  { name: "דשבורד", href: "/admin", icon: LayoutDashboard, exact: true },
  { name: "משתמשים", href: "/admin/users", icon: Users },
  { name: "הודעות שידור", href: "/admin/messages", icon: Megaphone },
  { name: "סטטיסטיקות", href: "/admin/stats", icon: BarChart2 },
  { name: "פיד פעילות", href: "/admin/feed", icon: Activity },
  { name: "מיגרציה", href: "/admin/migration", icon: Database },
  { name: "תנאי שימוש חתומים", href: "/admin/consents", icon: Shield },
];

// Owner Panel items — only shown to platform admins (not legacy MASTER without platformRole)
const OWNER_ITEMS: NavItem[] = [
  { name: "עסקים (Impersonate)", href: "/owner/tenants", icon: Building2 },
  { name: "Customer Success", href: "/owner/customer-success", icon: HeartHandshake },
  { name: "תמיכה", href: "/owner/support", icon: LifeBuoy },
  { name: "יומן פעולות", href: "/owner/audit-logs", icon: FileText },
];

interface AdminShellProps {
  userName: string;
  /** When true, also render the Owner Panel section in the sidebar. */
  showOwnerSection?: boolean;
  children: React.ReactNode;
}

export default function AdminShell({ userName, showOwnerSection = false, children }: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const sidebarWidth = collapsed ? "w-[68px]" : "w-[220px]";

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0F", color: "#E2E8F0" }}>
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ background: "#0D0D14", borderBottom: "1px solid #1E1E2E" }}>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-white/5">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-sm">Master Admin</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 transition-all duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } md:translate-x-0 ${sidebarWidth}`}
        style={{ background: "#0D0D14", borderLeft: "1px solid #1E1E2E" }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: "1px solid #1E1E2E" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)" }}>
            <Crown className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-white truncate">Master Admin</div>
              <div className="text-[10px] text-slate-500 truncate">Petra Platform</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {ADMIN_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? "text-cyan-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
                style={active ? { background: "rgba(6, 182, 212, 0.1)" } : undefined}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-cyan-400" : ""}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}

          {showOwnerSection && (
            <>
              {!collapsed && (
                <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-wider font-bold text-slate-600">
                  Owner Panel
                </div>
              )}
              {collapsed && <div className="my-2 mx-3 border-t border-slate-800" />}
              {OWNER_ITEMS.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      active
                        ? "text-violet-300"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    }`}
                    style={active ? { background: "rgba(139, 92, 246, 0.12)" } : undefined}
                  >
                    <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-violet-400" : ""}`} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 space-y-2" style={{ borderTop: "1px solid #1E1E2E" }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>חזרה לאפליקציה</span>}
          </Link>

          {!collapsed && (
            <div className="px-3 py-2">
              <div className="text-xs text-slate-500 truncate">{userName}</div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center w-full py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`transition-all duration-300 min-h-screen pt-0 md:pt-0 ${
          collapsed ? "md:mr-[68px]" : "md:mr-[220px]"
        }`}
      >
        <div className="p-4 md:p-6 mt-[52px] md:mt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
