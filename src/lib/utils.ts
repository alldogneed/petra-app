import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Calendar, PawPrint, CreditCard, User, Clock } from "lucide-react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEMO_BUSINESS_ID = "demo-business-001"

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800"
    case "completed":
      return "bg-green-100 text-green-800"
    case "canceled":
      return "bg-red-100 text-red-800"
    case "no_show":
      return "bg-gray-100 text-gray-800"
    case "paid":
      return "bg-green-100 text-green-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "refunded":
      return "bg-purple-100 text-purple-800"
    case "partial":
      return "bg-orange-100 text-orange-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "מתוזמן"
    case "completed":
      return "הושלם"
    case "canceled":
      return "בוטל"
    case "no_show":
      return "לא הגיע"
    case "paid":
      return "שולם"
    case "pending":
      return "ממתין"
    case "refunded":
      return "הוחזר"
    case "partial":
      return "חלקי"
    default:
      return status
  }
}

/** Convert any IL phone to WhatsApp-ready digits (972XXXXXXXXX) */
export function toWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  if (!digits.startsWith("972")) digits = "972" + digits;
  return digits;
}

/** Safe fetch that throws on non-ok responses (for use with React Query) */
/** Copy text to clipboard — works on iOS Safari (fallback via execCommand) */
export async function copyToClipboard(text: string): Promise<void> {
  // Modern API — works on iOS 13.4+, Android Chrome, desktop
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to execCommand fallback
    }
  }
  // execCommand fallback — use <input> + setSelectionRange for iOS Safari compatibility
  const el = document.createElement("input");
  el.value = text;
  el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(el);
  el.focus();
  el.setSelectionRange(0, text.length);
  document.execCommand("copy");
  document.body.removeChild(el);
}

export async function fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "כרגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

export function getTimelineIcon(type: string) {
  switch (type) {
    case "appointment_scheduled":
    case "appointment_completed":
    case "appointment_canceled":
      return Calendar
    case "pet_added":
      return PawPrint
    case "payment_received":
      return CreditCard
    case "customer_created":
      return User
    default:
      return Clock
  }
}
