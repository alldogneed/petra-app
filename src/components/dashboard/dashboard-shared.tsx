// Shared dashboard types, labels and helpers (used by the page and widgets/*).
import { Users, Calendar, PawPrint, Clock, CheckCircle2, AlertCircle, Target, CreditCard, ShoppingCart, LogIn, UserPlus, MessageCircle, Hotel, Package, ClipboardList, Dumbbell, Scissors } from "lucide-react";

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
export const FILTER_TO_LABEL: Record<string, string> = {
  training: "אילוף",
  boarding: "פנסיון",
  grooming: "טיפוח",
  consultation: "ייעוץ",
  daycare: "דיי קר",
};

export const ORDER_TYPE_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  sale: { label: "מוצרים", icon: Package },
  products: { label: "מוצרים", icon: Package },
  appointment: { label: "תור", icon: Calendar },
  boarding: { label: "פנסיון", icon: Hotel },
  training: { label: "אילוף", icon: Dumbbell },
  grooming: { label: "טיפוח", icon: Scissors },
};

export const ORDER_STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  confirmed: "badge-brand",
  completed: "badge-success",
  canceled: "badge-danger",
  cancelled: "badge-danger",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושר",
  completed: "הושלם",
  canceled: "בוטל",
  cancelled: "בוטל",
};

export const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  LOGIN: { icon: LogIn, color: "#64748B", bg: "#F1F5F9" },
  CREATE_CUSTOMER: { icon: UserPlus, color: "#3B82F6", bg: "#EFF6FF" },
  UPDATE_CUSTOMER: { icon: Users, color: "#3B82F6", bg: "#EFF6FF" },
  CREATE_ORDER: { icon: ShoppingCart, color: "#F97316", bg: "#FFF7ED" },
  UPDATE_ORDER: { icon: ShoppingCart, color: "#F97316", bg: "#FFF7ED" },
  CREATE_PAYMENT: { icon: CreditCard, color: "#10B981", bg: "#ECFDF5" },
  CREATE_APPOINTMENT: { icon: Calendar, color: "#8B5CF6", bg: "#F5F3FF" },
  UPDATE_APPOINTMENT: { icon: Calendar, color: "#8B5CF6", bg: "#F5F3FF" },
  CANCEL_APPOINTMENT: { icon: AlertCircle, color: "#EF4444", bg: "#FEF2F2" },
  CREATE_LEAD: { icon: Target, color: "#EC4899", bg: "#FDF2F8" },
  ADD_PET: { icon: PawPrint, color: "#06B6D4", bg: "#ECFEFF" },
  CREATE_TASK: { icon: ClipboardList, color: "#F59E0B", bg: "#FFFBEB" },
  COMPLETE_TASK: { icon: CheckCircle2, color: "#10B981", bg: "#ECFDF5" },
  CREATE_BOARDING: { icon: Hotel, color: "#6366F1", bg: "#EEF2FF" },
  CHECK_IN: { icon: Hotel, color: "#10B981", bg: "#ECFDF5" },
  CHECK_OUT: { icon: Hotel, color: "#64748B", bg: "#F1F5F9" },
  WHATSAPP_SEND: { icon: MessageCircle, color: "#22C55E", bg: "#F0FDF4" },
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
