// Shared dashboard types, labels and helpers (used by the page and widgets/*).
import { Calendar, Clock, CheckCircle2, AlertCircle, Hotel, Package, Dumbbell, Scissors } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "כללי",
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  LEADS: "לידים",
  HEALTH: "בריאות",
  MEDICATION: "תרופות",
  FEEDING: "האכלה",
};

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

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  scheduled: { label: "מתוכנן", color: "#3B82F6", bg: "#EFF6FF", icon: Clock },
  completed: { label: "הושלם", color: "#10B981", bg: "#ECFDF5", icon: CheckCircle2 },
  canceled: { label: "בוטל", color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  no_show: { label: "לא הגיע", color: "#F59E0B", bg: "#FFFBEB", icon: AlertCircle },
};

export const SERVICE_TYPE_TABS = [
  { key: "all", label: "הכל" },
  { key: "training", label: "אילוף" },
  { key: "boarding", label: "פנסיון" },
  { key: "grooming", label: "טיפוח" },
];

// Maps Hebrew price-list category names → filter key
export const CATEGORY_TO_FILTER: Record<string, string> = {
  "אילוף": "training",
  "פנסיון": "boarding",
  "טיפוח": "grooming",
};

// Maps filter key → Hebrew label for badge display
export const ORDER_TYPE_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  sale: { label: "מוצרים", icon: Package },
  products: { label: "מוצרים", icon: Package },
  appointment: { label: "תור", icon: Calendar },
  boarding: { label: "פנסיון", icon: Hotel },
  training: { label: "אילוף", icon: Dumbbell },
  grooming: { label: "טיפוח", icon: Scissors },
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

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושר",
  completed: "הושלם",
  canceled: "בוטל",
  cancelled: "בוטל",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}
