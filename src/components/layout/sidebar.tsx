"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Target,
  Hotel,
  Settings,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  X,
  BarChart3,
  CreditCard,
  CalendarCheck,
  Tag,
  ShoppingCart,
  Crown,
  Dog,
  Receipt,
  Shield,
  CalendarClock,
  Send,
  ClipboardList,
  Syringe,
  PawPrint,
  Pill,
  UtensilsCrossed,
  HelpCircle,
  ChevronDown,
  Wallet,
  Zap,
  UserCheck,
  Activity,
  AlertTriangle,
  FileText,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCenter } from "@/components/help/HelpCenter";
import { useAuth } from "@/providers/auth-provider";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: "owner" | "manager" | "user" | "volunteer";
}

interface NavGroup {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultHref: string; // where collapsed-icon click navigates to
  children: NavItem[];
  minRole?: "owner" | "manager" | "user" | "volunteer";
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const ROLE_LEVEL: Record<string, number> = { owner: 0, admin: 0, manager: 1, user: 2, volunteer: 3 };

function canSee(item: { minRole?: string }, role: string | null, platformRole?: string | null): boolean {
  if (!item.minRole) return true;
  if (platformRole === "super_admin" || platformRole === "admin") return true;
  // If role is unknown (null): still loading or DB inconsistency — show the item.
  // Real authorization is enforced server-side; sidebar visibility is just UX.
  if (!role) return true;
  return (ROLE_LEVEL[role] ?? 99) <= ROLE_LEVEL[item.minRole];
}

const navEntries: NavEntry[] = [
  { name: "דשבורד", href: "/dashboard", icon: LayoutDashboard },
  { name: "לקוחות", href: "/customers", icon: Users },
  { name: "מערכת מכירות", href: "/leads", icon: Target, minRole: "user" },
  {
    key: "tasks",
    name: "ניהול משימות",
    icon: ListTodo,
    defaultHref: "/tasks",
    children: [
      { name: "משימות", href: "/tasks", icon: ListTodo },
      { name: "משימות אוטומטיות", href: "/settings?tab=tasks", icon: Zap, minRole: "user" },
    ],
  },
  {
    key: "bookings-online",
    name: "ניהול תורים אונליין",
    icon: CalendarCheck,
    defaultHref: "/bookings",
    children: [
      { name: "ניהול תורים", href: "/bookings", icon: CalendarCheck },
      { name: "תור שליחה", href: "/scheduled-messages", icon: Send },
      { name: "תזמון", href: "/scheduler", icon: CalendarClock },
    ],
  },
  {
    key: "boarding",
    name: "פנסיון",
    icon: Hotel,
    defaultHref: "/boarding",
    children: [
      { name: "ניהול חדרים", href: "/boarding", icon: Hotel },
      { name: "לוח האכלה", href: "/feeding", icon: UtensilsCrossed },
      { name: "תרופות", href: "/medications", icon: Pill },
      { name: "חיסונים", href: "/vaccinations", icon: Syringe },
      { name: "טפסי קליטה", href: "/intake-forms", icon: ClipboardList },
    ],
  },
  {
    key: "finance",
    name: "פיננסים",
    icon: Wallet,
    defaultHref: "/payments",
    minRole: "user",
    children: [
      { name: "תשלומים", href: "/payments", icon: CreditCard, minRole: "manager" },
      { name: "בקשת תשלום", href: "/payment-request", icon: Send },
      // { name: "חשבוניות", href: "/invoices", icon: Receipt, minRole: "manager" }, // TODO: future
      { name: "מחירון", href: "/pricing", icon: Tag, minRole: "manager" },
      { name: "הזמנות", href: "/orders", icon: ShoppingCart },
    ],
  },
  {
    key: "service-dogs",
    name: "כלבי שירות",
    icon: Shield,
    defaultHref: "/service-dogs",
    children: [
      { name: "סקירה כללית", href: "/service-dogs", icon: LayoutDashboard },
      { name: "כלבים", href: "/service-dogs/dogs", icon: Dog },
      { name: "זכאים", href: "/service-dogs/recipients", icon: UserCheck },
      { name: "שיבוצים", href: "/service-dogs/placements", icon: Activity },
      { name: "משמעת ודיווח", href: "/service-dogs/compliance", icon: AlertTriangle },
      { name: "תעודות זהות", href: "/service-dogs/id-cards", icon: CreditCard },
    ],
  },
  { name: "תהליכי אילוף", href: "/training", icon: Dog },
  { name: "חיות מחמד", href: "/pets", icon: PawPrint },
  { name: "יומן", href: "/calendar", icon: Calendar },
  { name: "דוחות", href: "/analytics", icon: BarChart3, minRole: "owner" },
  { name: "ניהול ובקרה", href: "/business-admin", icon: ShieldCheck, minRole: "owner" },
  { name: "הגדרות", href: "/settings", icon: Settings, minRole: "user" },
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
  const { user } = useAuth();
  const isMaster = user?.platformRole === "super_admin" || user?.platformRole === "admin";

  // Collect all groups and compute which are active
  const groups = navEntries.filter(isGroup) as NavGroup[];

  function isGroupActive(group: NavGroup): boolean {
    return (
      group.children.some((c) =>
        c.href === group.defaultHref ? pathname === c.href : pathname.startsWith(c.href)
      ) ||
      (group.defaultHref !== "/" && pathname.startsWith(group.defaultHref + "/"))
    );
  }

  // Open state per group key
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((g) => {
      initial[g.key] = isGroupActive(g);
    });
    return initial;
  });

  // Auto-open groups when navigating to a child route
  useEffect(() => {
    groups.forEach((g) => {
      if (isGroupActive(g)) {
        setOpenGroups((prev) => (prev[g.key] ? prev : { ...prev, [g.key]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const { data: counters } = useQuery<{ openTasks: number; overdueFollowUps: number; pendingBookings: number }>({
    queryKey: ["sidebar-counters"],
    queryFn: () => fetch("/api/dashboard/counters").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const BADGES: Record<string, number> = {
    "/tasks": counters?.openTasks || 0,
    "/leads": counters?.overdueFollowUps || 0,
    "/bookings": counters?.pendingBookings || 0,
  };

  const [helpOpen, setHelpOpen] = useState(false);

  const renderNavItem = (item: NavItem, isMobile: boolean, isChild = false) => {
    const isActive =
      item.href === "/dashboard"
        ? pathname === "/" || pathname === "/dashboard"
        : item.href === "/boarding" || item.href === "/bookings" || item.href === "/service-dogs"
        ? pathname === item.href
        : pathname.startsWith(item.href);
    const Icon = item.icon;
    const badge = BADGES[item.href] || 0;
    const isExpanded = isMobile || !collapsed;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={isMobile ? onMobileClose : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
          isChild && isExpanded && "pr-8",
          isActive ? "text-white" : "text-slate-400 hover:text-white"
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
          if (!isActive)
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "";
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
          {badge > 0 && collapsed && !isMobile && (
            <span className="absolute -top-1 -left-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        {isExpanded && (
          <span className={cn("flex-1", isActive ? "text-white" : "")}>{item.name}</span>
        )}
        {badge > 0 && isExpanded && (
          <span className="min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none flex-shrink-0">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {isActive && isExpanded && (
          <span
            className="absolute right-0 w-1 h-5 rounded-l-full"
            style={{ background: "#F97316" }}
          />
        )}
      </Link>
    );
  };

  const renderGroup = (group: NavGroup, isMobile: boolean) => {
    const isExpanded = isMobile || !collapsed;
    const isOpen = openGroups[group.key] ?? false;
    const anyChildActive = isGroupActive(group);
    const Icon = group.icon;

    // Collapsed sidebar: show icon only, navigate to defaultHref
    if (!isExpanded) {
      return (
        <Link
          key={`${group.key}-collapsed`}
          href={group.defaultHref}
          title={group.name}
          className="flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-150 group"
          style={
            anyChildActive
              ? {
                  background: "rgba(249,115,22,0.15)",
                  boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.2)",
                }
              : undefined
          }
          onMouseEnter={(e) => {
            if (!anyChildActive)
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            if (!anyChildActive) (e.currentTarget as HTMLElement).style.background = "";
          }}
        >
          <Icon
            className={cn(
              "w-[18px] h-[18px]",
              anyChildActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"
            )}
          />
        </Link>
      );
    }

    return (
      <div key={group.key}>
        <button
          onClick={() => toggleGroup(group.key)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
            anyChildActive ? "text-white" : "text-slate-400 hover:text-white"
          )}
          style={
            anyChildActive && !isOpen
              ? {
                  background: "rgba(249,115,22,0.15)",
                  boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.2)",
                }
              : undefined
          }
          onMouseEnter={(e) => {
            if (!anyChildActive || isOpen)
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            if (!anyChildActive || isOpen)
              (e.currentTarget as HTMLElement).style.background = "";
          }}
        >
          <Icon
            className={cn(
              "w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150",
              anyChildActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"
            )}
          />
          <span className="flex-1 text-right">{group.name}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 text-slate-500",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="mt-0.5 space-y-0.5 relative">
            <div
              className="absolute top-0 bottom-0 right-[26px] w-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            {group.children
              .filter((c) => canSee(c, user?.businessRole ?? null, user?.platformRole))
              .map((child) => renderNavItem(child, isMobile, true))}
          </div>
        )}
      </div>
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
            {navEntries
              .filter((entry) => canSee(entry, user?.businessRole ?? null, user?.platformRole))
              .map((entry) =>
                isGroup(entry)
                  ? renderGroup(entry, isMobile)
                  : renderNavItem(entry as NavItem, isMobile)
              )}

            {/* Help button */}
            <button
              onClick={handleHelpClick}
              title={!isMobile && collapsed ? "עזרה" : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group text-slate-400 hover:text-white"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <div className="flex-shrink-0 text-slate-500 group-hover:text-slate-300">
                <HelpCircle className="w-[18px] h-[18px]" />
              </div>
              {isExpanded && <span>עזרה</span>}
            </button>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.07]">
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
              {isExpanded && <span className="text-sm font-bold">Master Admin</span>}
            </Link>
          )}

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
      <div
        className={cn(
          "hidden md:block fixed top-0 right-0 h-screen z-40 transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {sidebarContent(false)}
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(2px)" }}
      />

      <div
        className={cn(
          "fixed top-0 right-0 h-screen z-50 md:hidden transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ boxShadow: "-8px 0 32px rgba(0,0,0,0.4)" }}
      >
        {sidebarContent(true)}
      </div>

      <HelpCenter open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
