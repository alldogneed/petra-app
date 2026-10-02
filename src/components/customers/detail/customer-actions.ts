"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toWhatsAppPhone } from "@/lib/utils";

/** wa.me deep link (opens the user's own WhatsApp — the server sends nothing). Empty string when there's no phone. */
export function waLink(phone: string | null | undefined, text?: string): string {
  if (!phone?.trim()) return "";
  const base = `https://wa.me/${toWhatsAppPhone(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Payment-request page pre-filled for this customer (PAYMENTS_WRITE). */
export function paymentRequestHref(customer: { id: string; name: string; phone: string }): string {
  return `/payment-request?customerId=${customer.id}&name=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone || "")}`;
}

/** wa.me link carrying the public booking page link (MESSAGES_SEND). */
export function bookingLinkHref(customer: { name: string; phone: string }, businessSlug: string | null | undefined): string {
  if (!businessSlug || !customer.phone) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return waLink(
    customer.phone,
    `שלום ${customer.name}! 📅\nקבע/י תור אונליין בקישור הבא:\n${origin}/book/${businessSlug}\nנשמח לראותך! 🐾`
  );
}

/**
 * Creates an intake form for the customer and opens WhatsApp with the link.
 * Single implementation for header + mobile menu (MESSAGES_SEND gate is the caller's job).
 */
export function useIntakeFormSender(customer: { id: string; name: string; phone: string }) {
  const [sending, setSending] = useState(false);

  async function send() {
    if (!customer.phone) {
      toast.error("אין מספר טלפון ללקוח");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/intake/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        toast.error(data?.error || "לא ניתן ליצור טופס קבלה");
        return;
      }
      const msg = `שלום ${customer.name}! 📋\nאנא מלא טופס קבלה עבור הכלב שלך:\n${data.url}\nהקישור בתוקף ל-7 ימים. תודה! 🐾`;
      window.open(waLink(customer.phone, msg), "_blank", "noopener,noreferrer");
    } catch {
      toast.error("שגיאה ביצירת טופס קבלה");
    } finally {
      setSending(false);
    }
  }

  return { send, sending };
}
