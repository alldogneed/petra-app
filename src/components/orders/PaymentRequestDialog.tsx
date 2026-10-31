"use client";

/**
 * "דרישת תשלום" for an order — one dialog for the order page and the orders list.
 *
 * Builds the WhatsApp message (lines, discount, VAT, total, payment link), shows it,
 * and lets the user open WhatsApp from a real link click. It used to open a blank
 * window in the click and redirect it after an async call: when the browser hid or
 * blocked that window, the button looked dead — no window, no toast (support ticket
 * 2026-10-19). A link inside the dialog is never popup-blocked, and the user always
 * sees what is about to be sent (+ can copy it when WhatsApp isn't available).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Link2, Send, X, AlertTriangle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { currencySymbol } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

export interface PaymentRequestOrder {
  id: string;
  total: number;
  discountAmount: number;
  taxTotal: number;
  customer: { id: string; name: string; phone: string | null };
  lines: Array<{ name: string; quantity: number; lineTotal: number; priceListItemId?: string | null }>;
}

// Customer-facing WhatsApp text (Phase 3: per-business locale for messages sent to clients).
const fmt = (n: number) => `₪${n.toFixed(2)}`; // i18n-ok

/** Pure message builder (exported for tests). */
export function buildPaymentRequestMessage(
  order: PaymentRequestOrder,
  links: string[],
  businessPhone?: string | null
): string {
  const itemLines = order.lines
    .map((l) => `• ${l.name}${l.quantity > 1 ? ` ×${l.quantity}` : ""} — ${fmt(l.lineTotal)}`)
    .join("\n");
  const discountLine = order.discountAmount > 0 ? `\nהנחה: −${fmt(order.discountAmount)}` : ""; // i18n-ok
  const taxLine = order.taxTotal > 0 ? `\nמע"מ: ${fmt(order.taxTotal)}` : ""; // i18n-ok
  const linkBlock = links.length > 0 ? `\n\n💳 לתשלום מאובטח לחצו כאן:\n${links.join("\n")}` : ""; // i18n-ok
  const footer = businessPhone ? `\n_לפניות ושאלות: ${businessPhone}_` : ""; // i18n-ok
  return `שלום ${order.customer.name}! 🐾\n\n*דרישת תשלום*\n\n${itemLines}${discountLine}${taxLine}\n\n💰 סה"כ לתשלום: *${fmt(order.total)}*${linkBlock}\n\nתודה שבחרתם בנו! 😊${footer}`; // i18n-ok
}

export function PaymentRequestDialog({ order, onClose }: { order: PaymentRequestOrder; onClose: () => void }) {
  const t = useTranslations("orders.paymentRequestDialog");
  const { locale, currency } = useBusinessLocale();
  const money = (n: number) => `${currencySymbol({ locale, currency })}${n.toFixed(2)}`;
  const { data: priceListItems, isLoading: itemsLoading } = useQuery<Array<{ id: string; paymentUrl: string | null }>>({
    queryKey: ["price-list-items"],
    queryFn: () => fetch("/api/price-list-items").then((r) => r.json()),
    staleTime: 60_000,
  });
  const { data: bizSettings } = useQuery<{ phone?: string | null }>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 300_000,
  });

  const productLinks = useMemo(() => {
    if (!Array.isArray(priceListItems)) return [];
    return Array.from(
      new Set(
        order.lines
          .map((l) => (l.priceListItemId ? priceListItems.find((i) => i.id === l.priceListItemId)?.paymentUrl : null))
          .filter((u): u is string => !!u)
      )
    );
  }, [order.lines, priceListItems]);

  // No product link → try a one-off Stripe checkout link (null when Stripe isn't set up).
  const [stripeLink, setStripeLink] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (itemsLoading || productLinks.length > 0 || stripeLink !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const description = Array.from(new Set(order.lines.map((l) => l.name))).join(", ") || "תשלום"; // i18n-ok — Stripe checkout description shown to the client
        const res = await fetch("/api/payments/stripe/payment-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: order.total, description, customerId: order.customer.id, orderId: order.id }),
        });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setStripeLink(data?.url ?? null);
      } catch {
        if (!cancelled) setStripeLink(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per order; `order` is a fresh object every render
  }, [itemsLoading, productLinks.length, stripeLink, order.id]);

  const resolving = itemsLoading || (productLinks.length === 0 && stripeLink === undefined);
  const links = productLinks.length > 0 ? productLinks : stripeLink ? [stripeLink] : [];

  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!resolving && !edited) setText(buildPaymentRequestMessage(order, links, bizSettings?.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolving, bizSettings?.phone, links.join("|")]);

  const phone = order.customer.phone?.trim() ?? "";
  const waUrl = phone && text ? buildWhatsAppUrl(phone, text) : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("toasts.copied"));
    } catch {
      toast.error(t("toasts.copyFailed"));
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t("title")}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-petra-text">{t("title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              {t("subtitle", { name: order.customer.name, amount: money(order.total) })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label={t("close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {resolving ? (
          <PetraLoader variant="inline" />
        ) : (
          <>
            <div
              className={
                links.length > 0
                  ? "flex items-center gap-2 text-xs rounded-xl px-3 py-2 mb-3 bg-emerald-50 text-emerald-700"
                  : "flex items-start gap-2 text-xs rounded-xl px-3 py-2 mb-3 bg-amber-50 text-amber-800"
              }
            >
              {links.length > 0 ? <Link2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {links.length > 0
                ? productLinks.length === 0
                  ? t("linkAttachedStripe")
                  : t("linkAttached")
                : t("noLink")}
            </div>

            <label className="label">{t("messageLabel")}</label>
            <textarea
              className="input min-h-[220px] text-sm leading-relaxed resize-y"
              value={text}
              onChange={(e) => { setText(e.target.value); setEdited(true); }}
            />

            {!phone && (
              <p className="text-xs text-red-600 mt-2">{t("noPhone")}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2 mt-4">
              <button type="button" onClick={copy} className="btn-secondary flex items-center gap-1.5">
                <Copy className="w-4 h-4" />
                {t("copyMessage")}
              </button>
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(onClose, 300)}
                  className="btn-primary flex items-center gap-1.5"
                  style={{ background: "#25D366", borderColor: "#25D366" }}
                >
                  <Send className="w-4 h-4" />
                  {t("openWhatsApp")}
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
