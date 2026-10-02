/** Shared types + constants for the customers list page (src/app/(dashboard)/customers/page.tsx). */
import { parseTagList } from "@/lib/customer-filters";

export const DEFAULT_CUSTOMER_TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"];

export interface PetInfo {
  id: string;
  name: string;
  species: string;
  breed: string | null;
}

export interface AppointmentInfo {
  date: string;
  startTime: string;
  serviceName: string | null;
}

export interface FinancialInfo {
  totalPaid: number;
  /** Outstanding balance (server: src/lib/customer-balance.ts). */
  totalPending: number;
  hasDeposits: boolean;
}

export interface EnhancedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  idNumber: string | null;
  notes: string | null;
  tags: string;
  source: string | null;
  createdAt: string;
  pets: PetInfo[];
  _count: { pets: number; appointments: number };
  status: "active" | "dormant" | "vip";
  isActive?: boolean;
  isVip?: boolean;
  isInBoarding?: boolean;
  hasActiveTraining?: boolean;
  appointmentsLast30?: number;
  lastAppointment: AppointmentInfo | null;
  nextAppointment: AppointmentInfo | null;
  financial: FinancialInfo;
  serviceTypes: string[];
}

export interface CustomerListStats {
  total: number;
  active: number;
  dormant: number;
  vip: number;
  withDebt: number;
  totalDebt: number | null;
  businessTotal: number;
}

export interface CustomerListPage {
  customers: EnhancedCustomer[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number | null;
  stats?: CustomerListStats;
}

/** Customer intake sources (Customer.source). */
export const REFERRAL_SOURCES = [
  { value: "referral", label: "המלצה מלקוח" },
  { value: "google", label: "גוגל" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "facebook", label: "פייסבוק" },
  { value: "tiktok", label: "טיקטוק" },
  { value: "signage", label: "שלט / מעבר ברחוב" },
  { value: "website", label: "אתר" },
  { value: "manual", label: "ידני" },
  { value: "other", label: "אחר" },
];

export function parseTags(tagsStr: string): string[] {
  return parseTagList(tagsStr);
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "UTC" });
}
