// Shared dashboard types, labels and helpers (used by the page and widgets/*).
import { Calendar, Clock, CheckCircle2, AlertCircle, Hotel, Package, Dumbbell, Scissors } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCustomers: number;
  totalPets: number;
  todayAppointments: number;
  monthRevenue: number;
  todayRevenue: number;
  pendingPayments: number;
  openLeads: number;
  activeOrders: number;
  pendingPaymentsAmount: number;
  /** Customers who owe money (shared definition, src/lib/outstanding-balances.ts). */
  debtorsCount: number;
  /** Total owed by all of them; null without FINANCE_SUMMARY. */
  debtTotal: number | null;
  upcomingByType: {
    training: number;
    grooming: number;
    boarding: number;
  };
  revenueByMonth: { month: string; amount: number }[];
  revenueTarget: number;
  topService: { name: string; count: number } | null;
  recentTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
  }[];
  upcomingAppointments: {
    id: string;
    date: string;
    startTime: string;
    status: string;
    service: { id: string; name: string; color: string | null; type?: string } | null;
    priceListItem: { id: string; name: string; category: string | null } | null;
    customer: { id: string; name: string; phone: string };
    pet: { name: string; species: string } | null;
    notes: string | null;
  }[];
  tomorrowAppointments: {
    id: string;
    startTime: string;
    customerName: string;
    customerId: string;
    customerPhone: string;
    petName: string | null;
    serviceName: string;
  }[];
  recentOrders: {
    id: string;
    orderType: string;
    status: string;
    total: number;
    customerName: string;
    createdAt: string;
  }[];
  todayTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    dueAt: string | null;
    dueDate: string | null;
  }[];
  overdueTasks: {
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    dueAt: string | null;
    dueDate: string | null;
  }[];
  urgentLeads: {
    id: string;
    name: string;
    phone: string | null;
    nextFollowUpAt: string | null;
    customer: { name: string } | null;
  }[];
  topDebtors: {
    id: string;
    name: string;
    phone: string;
    total: number;
  }[];
  atRiskCustomers: {
    id: string;
    name: string;
    phone: string;
    lastAppointment: string;
    daysSinceVisit: number;
    totalVisits: number;
  }[];
  todayArrivals: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    pet: { id: string; name: string; species: string };
    customer: { id: string; name: string; phone: string } | null;
    room: { name: string } | null;
  }[];
  todayDepartures: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    status: string;
    pet: { id: string; name: string; species: string };
    customer: { id: string; name: string; phone: string } | null;
    room: { name: string } | null;
  }[];
  /** Checked-in stays whose check-out date already passed (optional: older API responses). */
  overdueDepartures?: DashboardStats["todayDepartures"];
  upcomingBirthdays: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    daysUntil: number;
    age: number;
    customer: { id: string; name: string; phone: string };
  }[];
  pendingBookings?: number;
}

export interface ActivityItem {
  id: string;
  type: "activity" | "whatsapp";
  userName: string;
  action: string;
  description: string;
  createdAt: string;
  href?: string | null;
  channel?: string;
  status?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Appointment status colours/icons — labels via `useDashboardLabels().appointmentStatus(key)`. */
export const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  scheduled: { color: "#3B82F6", bg: "#EFF6FF", icon: Clock },
  completed: { color: "#10B981", bg: "#ECFDF5", icon: CheckCircle2 },
  canceled: { color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  no_show: { color: "#F59E0B", bg: "#FFFBEB", icon: AlertCircle },
};

/** Service-type filter tabs — labels via `useDashboardLabels().serviceTab(key)`. */
export const SERVICE_TYPE_TABS = [{ key: "all" }, { key: "training" }, { key: "boarding" }, { key: "grooming" }];

// Maps Hebrew price-list category names → filter key
export const CATEGORY_TO_FILTER: Record<string, string> = {
  "אילוף": "training", // i18n-ok — DB price-list category value (data)
  "פנסיון": "boarding", // i18n-ok — DB price-list category value (data)
  "טיפוח": "grooming", // i18n-ok — DB price-list category value (data)
};

/** Order type icons — labels via `useDashboardLabels().orderType(key)`. */
export const ORDER_TYPE_INFO: Record<string, { icon: React.ElementType }> = {
  sale: { icon: Package },
  products: { icon: Package },
  appointment: { icon: Calendar },
  boarding: { icon: Hotel },
  training: { icon: Dumbbell },
  grooming: { icon: Scissors },
};

/** Order status text colours (new dashboard design — status as coloured text, no pill). */
export const ORDER_STATUS_COLOR: Record<string, string> = {
  draft: "#64748B",
  confirmed: "#C2410C",
  in_progress: "#1D4ED8",
  completed: "#047857",
  cancelled: "#B91C1C",
  canceled: "#B91C1C",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export type DashboardSharedT = ReturnType<typeof useTranslations<"dashboard.dashboardShared">>;

export function relativeTime(dateStr: string, t: DashboardSharedT): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("relativeTime.now");
  if (mins < 60) return t("relativeTime.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("relativeTime.hoursAgo", { count: hours });
  return t("relativeTime.daysAgo", { count: Math.floor(hours / 24) });
}

/**
 * Translated dashboard labels (task category, appointment status, service tab, order type/status; keys/ids unchanged).
 * Each returns `undefined` for an unknown key — same as a map lookup, so callers
 * keep their own fallback (`?? task.category`, `|| order.status`…).
 */
export function useDashboardLabels() {
  const t = useTranslations("dashboard.dashboardShared");
  return useMemo(() => {
    const pick = (group: string, key: string | null | undefined): string | undefined =>
      key && t.has(`${group}.${key}`) ? t(`${group}.${key}`) : undefined;
    return {
      taskCategory: (key: string | null | undefined) => pick("taskCategories", key),
      appointmentStatus: (key: string | null | undefined) => pick("appointmentStatus", key),
      serviceTab: (key: string | null | undefined) => pick("serviceTabs", key),
      orderType: (key: string | null | undefined) => pick("orderTypes", key),
      orderStatus: (key: string | null | undefined) => pick("orderStatus", key),
      relativeTime: (dateStr: string) => relativeTime(dateStr, t),
    };
  }, [t]);
}
