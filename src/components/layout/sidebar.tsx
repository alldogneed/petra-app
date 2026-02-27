"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Target,
  MessageSquare,
  Hotel,
  Settings,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  X,
  BarChart3,
  CreditCard,
  CalendarCheck,
  HelpCircle,
  Tag,
  ShoppingCart,
  Crown,
  Dog,
  Receipt,
  Shield,
  CalendarClock,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCenter } from "@/components/help/HelpCenter";
import { useAuth } from "@/providers/auth-provider";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: "owner" | "manager";
}

const ROLE_LEVEL: Record<string, number> = { owner: 0, manager: 1, user: 2 };

function canSee(item: NavItem, role: string | null): boolean {
  if (!item.minRole) return true;
  if (!role) return false;
  return (ROLE_LEVEL[role] ?? 99) <= ROLE_LEVEL[item.minRole];
}

const navItems: NavItem[] = [
  { name: "דשבורד", href: "/dashboard", icon: LayoutDashboard },
  { name: "לידים", href: "/leads", icon: Target },
  { name: "לקוחות", href: "/customers", icon: Users },
  { name: "יומן", href: "/calendar", icon: Calendar },
  { name: "תזמון", href: "/scheduler", icon: CalendarClock },
  { name: "משימות", href: "/tasks", icon: ListTodo },
  { name: "תשלומים", href: "/payments", icon: CreditCard, minRole: "manager" },
  { name: "בקשת תשלום", href: "/payment-request", icon: Send },
  { name: "חשבוניות", href: "/invoices", icon: Receipt, minRole: "manager" },
  { name: "מחירון", href: "/pricing", icon: Tag, minRole: "manager" },
  { name: "הזמנות", href: "/orders", icon: ShoppingCart },
  { name: "פנסיון", href: "/boarding", icon: Hotel },
  { name: "אימונים וכלבים", href: "/training", icon: Dog },
  { name: "כלבי שירות", href: "/service-dogs", icon: Shield },
  { name: "הודעות", href: "/messages", icon: MessageSquare },
  { name: "ניהול תורים", href: "/bookings", icon: CalendarCheck },
  { name: "אנליטיקס", href: "/analytics", icon: BarChart3, minRole: "owner" },
  { name: "הגדרות", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const { user } = useAuth();
  const isMaster = user?.role === "MASTER";

  // Urgency counters for sidebar badges
  const { data: counters } = useQuery<{ openTasks: number; overdueFollowUps: number }>({
    queryKey: ["sidebar-counters"],
    queryFn: () => fetch("/api/dashboard/counters").then((r) => r.json()),
    refetchInterval: 60_000, // refresh every minute
    staleTime: 30_000,
  });

  const BADGES: Record<string, number> = {
    "/tasks": counters?.openTasks || 0,
    "/leads": counters?.overdueFollowUps || 0,
  };

  const renderNavItem = (item: NavItem, isMobile: boolean) => {
    const isActive =
      item.href === "/dashboard"
        ? pathname === "/" || pathname === "/dashboard"
        : pathname.startsWith(item.href);
    const Icon = item.icon;
    const badge = BADGES[item.href] || 0;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={isMobile ? onMobileClose : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
          isActive
            ? "text-white"
            : "text-slate-400 hover:text-white"
        )}
        style={
          isActive
            ? {
              background: "rgba(249,115,22,0.15)",
              boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.2)",
            }
            : undefined
        }
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.06)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = "";
          }
        }}
        title={!isMobile && collapsed ? item.name : undefined}
      >
        <div
          className={cn(
            "flex-shrink-0 transition-transform duration-150 relative",
            isActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"
          )}
        >
          <Icon className="w-[18px] h-[18px]" />
          {badge > 0 && (collapsed && !isMobile) && (
            <span className="absolute -top-1 -left-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        {(isMobile || !collapsed) && (
          <span className={cn("flex-1", isActive ? "text-white" : "")}>{item.name}</span>
        )}
        {badge > 0 && (isMobile || !collapsed) && (
          <span className="min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none flex-shrink-0">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {isActive && (isMobile || !collapsed) && (
          <span
            className="absolute right-0 w-1 h-5 rounded-l-full"
            style={{ background: "#F97316" }}
          />
        )}
      </Link>
    );
  };

  const sidebarContent = (isMobile: boolean) => {
    const isExpanded = isMobile || !collapsed;

    const handleHelpClick = () => {
      setHelpOpen(true);
      if (isMobile) onMobileClose();
    };

    return (
      <aside
        className={cn(
          "flex flex-col h-full transition-all duration-300",
          "bg-petra-sidebar",
          !isMobile && (collapsed ? "w-[72px]" : "w-[240px]"),
          isMobile && "w-[240px]"
        )}
        style={{
          background: "linear-gradient(180deg, #0F172A 0%, #1a2744 100%)",
          borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-white/[0.07]",
            !isMobile && collapsed ? "justify-center px-0" : "px-4 gap-3"
          )}
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/logo.svg" alt="Petra" className="w-full h-full object-cover" />
          </div>
          {isExpanded && (
            <div className="flex-1">
              <span className="text-white font-bold text-[17px] tracking-tight leading-none">
                Petra
              </span>
              <span className="block text-[10px] text-slate-500 font-medium leading-none mt-0.5 tracking-wider uppercase">
                Pet Business
              </span>
            </div>
          )}
          {isMobile && (
            <button
              onClick={onMobileClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-hide">
          <div className="space-y-0.5">
            {navItems
              .filter((item) => canSee(item, user?.businessRole ?? null))
              .map((item) => renderNavItem(item, isMobile))}

            {/* Help button */}
            <button
              onClick={handleHelpClick}
              title={!isMobile && collapsed ? "עזרה" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
                "text-slate-400 hover:text-white"
              )}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <div className="flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-transform duration-150">
                <HelpCircle className="w-[18px] h-[18px]" />
              </div>
              {isExpanded && <span>עזרה</span>}
            </button>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.07]">
          {/* Master Admin link - only visible for MASTER users */}
          {isMaster && (
            <Link
              href="/admin"
              onClick={isMobile ? onMobileClose : undefined}
              title={!isMobile && collapsed ? "Master Admin" : undefined}
              className={cn(
                "w-full flex items-center h-11 transition-colors",
                !isMobile && collapsed ? "justify-center" : "px-4 gap-2.5",
                pathname.startsWith("/admin")
                  ? "text-cyan-400"
                  : "text-amber-400 hover:text-amber-300 hover:bg-white/[0.06]"
              )}
            >
              <Crown className="w-[18px] h-[18px] flex-shrink-0" />
              {isExpanded && (
                <span className="text-sm font-bold">Master Admin</span>
              )}
            </Link>
          )}

          {/* Collapse toggle (desktop only) */}
          {!isMobile && (
            <button
              onClick={() => onCollapsedChange(!collapsed)}
              className={cn(
                "w-full flex items-center h-12 text-slate-500 hover:text-slate-300 transition-colors border-t border-white/[0.04]",
                collapsed ? "justify-center" : "px-4 gap-2"
              )}
            >
              {collapsed ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-xs font-medium">כווץ תפריט</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden md:block fixed top-0 right-0 h-screen z-40 transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {sidebarContent(false)}
      </div>

      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(2px)" }}
      />

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-screen z-50 md:hidden transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ boxShadow: "-8px 0 32px rgba(0,0,0,0.4)" }}
      >
        {sidebarContent(true)}
      </div>

      {/* Help Center Dialog */}
      <HelpCenter open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
