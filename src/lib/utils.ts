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
