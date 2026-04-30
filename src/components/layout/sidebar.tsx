"use client";

import Link from "next/link";
import Image from "next/image";
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
  Shield,
  CalendarClock,
  Send,
  PawPrint,
  HelpCircle,
  ChevronDown,
  Wallet,
  Zap,
  UserCheck,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Lock,
  PlayCircle,
} from "lucide-react";
import { hasFeatureWithOverrides, type FeatureKey, type TierKey } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: "owner" | "manager" | "user" | "volunteer";
  /** Feature that must be enabled for this item to be unlocked (shows lock badge if not). */
  lockedFeature?: FeatureKey;
  /** Tiers for which this item is completely hidden (not shown at all). */
  hiddenForTiers?: TierKey[];
  /** Show orange "חדש" badge */
  isNew?: boolean;
}

interface NavGroup {
  key: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultHref: string; // where collapsed-icon click navigates to
  children: NavItem[];
  minRole?: "owner" | "manager" | "user" | "volunteer";
}

interface NavEyebrow {
  /** Section label rendered as an uppercase eyebrow above the next group of items. */
  eyebrow: string;
}

type NavEntry = NavItem | NavGroup | NavEyebrow;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

function isEyebrow(entry: NavEntry): entry is NavEyebrow {
  return "eyebrow" in entry;
}

const ROLE_LEVEL: Record<string, number> = { owner: 0, admin: 0, manager: 1, user: 2, volunteer: 3 };

function canSee(item: { minRole?: string }, role: string | null, isAdmin?: boolean): boolean {
  if (!item.minRole) return true;
  if (isAdmin) return true;
  // If role is unknown (null): still loading or DB inconsistency — show the item.
  // Real authorization is enforced server-side; sidebar visibility is just UX.
  if (!role) return true;
  return (ROLE_LEVEL[role] ?? 99) <= ROLE_LEVEL[item.minRole];
}

const navEntries: NavEntry[] = [
  { eyebrow: "תפריט ראשי" },
  { name: "דשבורד", href: "/dashboard", icon: LayoutDashboard },
  { name: "לקוחות", href: "/customers", icon: Users, minRole: "manager" },
  { name: "מערכת מכירות", href: "/leads", icon: Target, minRole: "manager", lockedFeature: "leads" },
  { name: "ניהול משימות", href: "/tasks", icon: ListTodo },
  { name: "ניהול תורים אונליין", href: "/scheduler", icon: CalendarCheck, minRole: "manager", lockedFeature: "online_bookings" },
  { name: "יומן", href: "/calendar", icon: Calendar, minRole: "manager" },

  { eyebrow: "מודולים" },
  { name: "פנסיון", href: "/boarding", icon: Hotel, lockedFeature: "boarding", hiddenForTiers: ["groomer", "groomer_plus"] },
  { name: "פיננסים", href: "/pricing", icon: Wallet, minRole: "manager" },
  { name: "ניהול כלבי שירות", href: "/service-dogs", icon: Shield, lockedFeature: "service_dogs", hiddenForTiers: ["groomer", "groomer_plus"] },
  { name: "ניהול תהליכי אילוף", href: "/training", icon: Dog, hiddenForTiers: ["groomer", "groomer_plus"] },
  { name: "חיות מחמד", href: "/pets", icon: PawPrint, minRole: "manager", lockedFeature: "pets_advanced" },

  { eyebrow: "ניהול" },
  { name: "דוחות", href: "/analytics", icon: BarChart3, minRole: "owner", lockedFeature: "analytics" },
  { name: "ניהול ובקרה", href: "/business-admin", icon: ShieldCheck, minRole: "owner", lockedFeature: "staff_management" },
  { name: "הגדרות", href: "/settings", icon: Settings, minRole: "owner" },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onHelpOpen: () => void;
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
  onHelpOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const isMaster = user?.isAdmin === true;

  // Ref to the desktop nav element for scroll management
  const navRef = useRef<HTMLElement>(null);

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

  // Accordion: on every navigation, open ONLY the active group and close all others.
  // Also resets the nav scroll to the top so the sidebar is never "stuck" showing
  // only the bottom items (e.g. after the boarding group expands and the user scrolls).
  useEffect(() => {
    const activeGroup = groups.find((g) => isGroupActive(g));
    // Always sync — even when no group is active (non-group pages), close all groups
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = {};
      groups.forEach((g) => { next[g.key] = g.key === activeGroup?.key; });
      const changed = groups.some((g) => (prev[g.key] ?? false) !== next[g.key]);
      return changed ? next : prev;
    });
    // Always reset the nav scroll position to the top on every navigation.
    // This prevents the sidebar from appearing "broken" after the boarding group
    // expands and the user has scrolled — which could leave top items (Dashboard,
    // Customers…) above the visible fold and unreachable.
    const raf = requestAnimationFrame(() => {
      if (navRef.current) navRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // Compute per-item lock status from current user's tier + overrides
  const userTier = (user?.businessEffectiveTier ?? user?.businessTier ?? "free") as TierKey;
  const userOverrides: Record<string, boolean> | null =
    (user as (typeof user & { businessFeatureOverrides?: Record<string, boolean> | null }))?.businessFeatureOverrides ?? null;

  function isItemLocked(item: NavItem): boolean {
    if (!item.lockedFeature) return false;
    // Optimistic during auth load: treat as unlocked so the user doesn't see a
    // "free tier" flash before /api/auth/me hydrates the real tier. Server
    // routes remain authoritative — locking is a UX hint, not a security gate.
    if (authLoading || !user) return false;
    return !hasFeatureWithOverrides(userTier, item.lockedFeature, userOverrides);
  }

  /** Features that should be completely hidden (not just locked) when unavailable */
  const HIDDEN_WHEN_LOCKED: FeatureKey[] = ["pets_advanced"];

  function isItemHidden(item: NavItem): boolean {
    // While auth is loading, never hide an item — same optimistic policy as locking.
    if (authLoading || !user) return false;
    // Hidden if tier is in the item's hiddenForTiers list
    if (item.hiddenForTiers?.includes(userTier)) return true;
    // Hidden if in HIDDEN_WHEN_LOCKED and feature is disabled
    if (!item.lockedFeature) return false;
    if (!HIDDEN_WHEN_LOCKED.includes(item.lockedFeature)) return false;
    return !hasFeatureWithOverrides(userTier, item.lockedFeature, userOverrides);
  }

  // Split nav into main (unlocked) and locked sections for cleaner sidebar
  const [lockedSectionOpen, setLockedSectionOpen] = useState(false);

  const visibleEntries = navEntries
    .filter((entry) => isEyebrow(entry) || canSee(entry, user?.businessRole ?? null, user?.isAdmin))
    .filter((entry) => isGroup(entry) || isEyebrow(entry) ? true : !isItemHidden(entry as NavItem));
  const mainNavEntries = visibleEntries.filter(e => isEyebrow(e) || isGroup(e) || !isItemLocked(e as NavItem));
  const lockedNavEntries = visibleEntries.filter(e => !isGroup(e) && !isEyebrow(e) && isItemLocked(e as NavItem)) as NavItem[];

  const { data: counters } = useQuery<{ openTasks: number; overdueFollowUps: number; pendingBookings: number; activeBoarding: number }>({
    queryKey: ["sidebar-counters"],
    queryFn: () => fetch("/api/dashboard/counters").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: sdAlerts } = useQuery<{ total: number }>({
    queryKey: ["sd-alerts"],
    queryFn: () => fetch("/api/service-dogs/alerts").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    refetchInterval: 5 * 60_000,
    staleTime: 3 * 60_000,
  });


  const BADGES: Record<string, number> = {
    "/tasks": counters?.openTasks || 0,
    "/leads": counters?.overdueFollowUps || 0,
    "/scheduler": counters?.pendingBookings || 0,
    "/boarding": counters?.activeBoarding || 0,
    "/service-dogs": sdAlerts?.total || 0,
  };
  const BADGE_TOOLTIPS: Record<string, string> = {
    "/tasks": `${counters?.openTasks || 0} משימות פתוחות`,
    "/leads": `${counters?.overdueFollowUps || 0} לידים עם מעקב באיחור`,
    "/scheduler": `${counters?.pendingBookings || 0} הזמנות ממתינות לאישור`,
    "/boarding": `${counters?.activeBoarding || 0} כלבים בפנסיון`,
    "/service-dogs": `${sdAlerts?.total || 0} התראות פעילות`,
  };

  const renderNavItem = (item: NavItem, isMobile: boolean, isChild = false) => {
    const isActive =
      item.href === "/dashboard"
        ? pathname === "/" || pathname === "/dashboard"
        : item.href === "/boarding"
        ? pathname === "/boarding" || pathname.startsWith("/feeding") || pathname.startsWith("/medications") || pathname.startsWith("/vaccinations") || pathname.startsWith("/intake-forms")
        : item.href === "/pricing"
        ? ["/pricing", "/payments", "/payment-request", "/orders"].some(
            (p) => pathname === p || pathname.startsWith(p + "/")
          )
        : item.href === "/scheduler"
        ? ["/bookings", "/scheduled-messages", "/scheduler"].some(
            (p) => pathname === p || pathname.startsWith(p + "/")
          )
        : pathname.startsWith(item.href);
    const Icon = item.icon;
    const badge = BADGES[item.href] || 0;
    const badgeTooltip = BADGE_TOOLTIPS[item.href];
    const isExpanded = isMobile || !collapsed;
    const locked = isItemLocked(item);

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        onClick={isMobile ? onMobileClose : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
          isChild && isExpanded && "pr-8",
          locked
            ? "text-slate-500 hover:text-slate-400 hover:bg-white/[0.04]"
            : isActive
            ? "text-white"
            : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
        )}
        style={
          !locked && isActive
            ? {
                background: "rgba(249,115,22,0.15)",
                boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.4)",
              }
            : undefined
        }
        title={!isMobile && collapsed ? item.name : undefined}
      >
        <div
          className={cn(
            "flex-shrink-0 transition-transform duration-150 relative",
            locked
              ? "text-slate-600"
              : isActive
              ? "text-brand-400"
              : "text-slate-500 group-hover:text-slate-300"
          )}
        >
          <Icon className="w-[18px] h-[18px]" />
          {badge > 0 && !locked && collapsed && !isMobile && (
            <span title={badgeTooltip} aria-label={badgeTooltip} className="absolute -top-1 -left-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
        {isExpanded && (
          <span className={cn("flex-1", !locked && isActive ? "text-white" : "")}>{item.name}</span>
        )}
        {/* Lock badge — shown instead of notification badge */}
        {locked && isExpanded && (
          <Lock className="w-3 h-3 text-slate-600 flex-shrink-0" />
        )}
        {badge > 0 && !locked && isExpanded && (
          <span title={badgeTooltip} aria-label={badgeTooltip} className="min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none flex-shrink-0">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {item.isNew && !locked && badge === 0 && isExpanded && (
          <span className="text-[10px] font-bold bg-brand-500 text-white px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">חדש</span>
        )}
        {!locked && isActive && isExpanded && (
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
          prefetch={false}
          title={group.name}
          className={cn(
            "flex items-center justify-center px-3 py-1.5 rounded-xl transition-all duration-150 group",
            !anyChildActive && "hover:bg-white/[0.06]"
          )}
          style={
            anyChildActive
              ? {
                  background: "rgba(249,115,22,0.15)",
                  boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.4)",
                }
              : undefined
          }
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
          aria-expanded={isOpen}
          aria-controls={`sidebar-group-${group.key}`}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 group",
            anyChildActive ? "text-white" : "text-slate-400 hover:text-white",
            (!anyChildActive || isOpen) && "hover:bg-white/[0.06]"
          )}
          style={
            anyChildActive && !isOpen
              ? {
                  background: "rgba(249,115,22,0.15)",
                  boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.4)",
                }
              : undefined
          }
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
          <div id={`sidebar-group-${group.key}`} className="mt-0.5 space-y-0.5 relative">
            <div
              className="absolute top-0 bottom-0 right-[26px] w-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            {group.children
              .filter((c) => canSee(c, user?.businessRole ?? null, user?.isAdmin))
              .map((child) => renderNavItem(child, isMobile, true))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (isMobile: boolean) => {
    const isExpanded = isMobile || !collapsed;

    const handleHelpClick = () => {
      onHelpOpen();
      if (isMobile) onMobileClose();
    };

    return (
      <aside
        aria-label="סרגל ניווט"
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
            <Image src="/logo.svg" alt="Petra" width={36} height={36} className="w-full h-full object-cover" priority />
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
        <nav ref={!isMobile ? navRef : undefined} aria-label="ניווט ראשי" className="sidebar-nav flex-1 px-3 py-2 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.3) transparent", overflowAnchor: "none" }}>
          <div className="space-y-0.5">
            {/* Main nav — unlocked items (expanded) or all items (collapsed) */}
            {(isExpanded ? mainNavEntries : visibleEntries.filter(e => !isEyebrow(e))).map((entry, idx) => {
              if (isEyebrow(entry)) {
                if (!isExpanded) return null;
                return (
                  <div
                    key={`eyebrow-${idx}-${entry.eyebrow}`}
                    className={cn(
                      "px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40",
                      idx === 0 ? "pt-1 pb-1.5" : "pt-4 pb-1.5"
                    )}
                  >
                    {entry.eyebrow}
                  </div>
                );
              }
              return isGroup(entry)
                ? renderGroup(entry, isMobile)
                : renderNavItem(entry as NavItem, isMobile);
            })}

            {/* Locked features — collapsible section (expanded sidebar only) */}
            {lockedNavEntries.length > 0 && isExpanded && (
              <>
                <div className="mt-2 mb-1 mx-2 border-t border-white/[0.06]" />
                <button
                  onClick={() => setLockedSectionOpen(v => !v)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <Lock className="w-3 h-3 flex-shrink-0" />
                  <span className="flex-1 text-right">תכונות נוספות</span>
                  <span className="text-[10px] bg-white/[0.08] text-slate-500 px-1.5 py-0.5 rounded-full">{lockedNavEntries.length}</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform duration-200 text-slate-600", lockedSectionOpen && "rotate-180")} />
                </button>
                {lockedSectionOpen && (
                  <div className="space-y-0.5">
                    {lockedNavEntries.map(item => renderNavItem(item, isMobile))}
                  </div>
                )}
              </>
            )}

            {/* Tutorials link */}
            <Link
              href="/tutorials"
              onClick={isMobile ? onMobileClose : undefined}
              title={!isMobile && collapsed ? "סרטוני הדרכה" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                pathname.startsWith("/tutorials")
                  ? "text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              )}
              style={
                pathname.startsWith("/tutorials")
                  ? { background: "rgba(249,115,22,0.15)", boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.4)" }
                  : undefined
              }
            >
              <div className={cn("flex-shrink-0 relative", pathname.startsWith("/tutorials") ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300")}>
                <PlayCircle className="w-[18px] h-[18px]" />
              </div>
              {isExpanded && (
                <>
                  <span className="flex-1">סרטוני הדרכה</span>
                  <span className="text-[10px] font-bold bg-brand-500 text-white px-1.5 py-0.5 rounded-full leading-none">חדש</span>
                </>
              )}
            </Link>

            {/* Help button */}
            <button
              onClick={handleHelpClick}
              title={!isMobile && collapsed ? "עזרה" : undefined}
              className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 group text-slate-400 hover:text-white hover:bg-white/[0.06]"
            >
              <div className="flex-shrink-0 text-slate-500 group-hover:text-slate-300">
                <HelpCircle className="w-[18px] h-[18px]" />
              </div>
              {isExpanded && <span>עזרה</span>}
            </button>

            {/* Upgrade banner — shown when there are locked features or user is on free/basic */}
            {(lockedNavEntries.length > 0 || userTier === "free" || userTier === "basic") && (
              <Link
                href="/upgrade"
                onClick={isMobile ? onMobileClose : undefined}
                title={!isMobile && collapsed ? "שדרג מנוי" : undefined}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 bg-gradient-to-r from-brand-600/30 to-brand-500/20 text-brand-300 hover:from-brand-600/50 hover:to-brand-500/30 border border-brand-500/20"
              >
                <div className="flex-shrink-0">
                  <Crown className="w-[18px] h-[18px]" />
                </div>
                {isExpanded && <span>שדרג מנוי</span>}
              </Link>
            )}
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

    </>
  );
}
