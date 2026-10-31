"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarClock, FileText, GitMerge, Link2, ListTodo, MessageCircle, MoreVertical, Printer, Send,
  ShoppingCart, Trash2, type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { CustomerLeadChip } from "@/components/customers/CustomerSalesHistory";
import { bookingLinkHref, paymentRequestHref } from "./customer-actions";

interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Also rendered as an inline button on ≥sm — then the menu copy is mobile-only. */
  inline?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

export interface CustomerHeaderProps {
  customer: { id: string; name: string; phone: string; createdAt: string };
  businessSlug: string | null | undefined;
  canSendMessages: boolean;
  canWritePayments: boolean;
  /** Delete button visible (direct delete or manager approval request). */
  canDelete: boolean;
  /** true → the server will open a pending approval instead of deleting. */
  deleteIsRequest: boolean;
  canMerge: boolean;
  intakeSending: boolean;
  onNewAppointment: () => void;
  onNewTask: () => void;
  onNewOrder: () => void;
  onCompose: () => void;
  onSendIntake: () => void;
  onDelete: () => void;
  onMerge: () => void;
}

export function CustomerHeader(props: CustomerHeaderProps) {
  const { customer, canSendMessages, canWritePayments } = props;
  const t = useTranslations("customers.customerHeader");
  const { locale } = useBusinessLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasPhone = !!customer.phone?.trim();
  const bookingHref = canSendMessages ? bookingLinkHref(customer, props.businessSlug) : "";

  const items: MenuItem[] = [
    { key: "appointment", label: t("menu.appointment"), icon: CalendarClock, inline: true, onClick: props.onNewAppointment },
    { key: "task", label: t("menu.task"), icon: ListTodo, onClick: props.onNewTask },
    ...(canSendMessages && hasPhone
      ? [{ key: "compose", label: t("menu.compose"), icon: MessageCircle, inline: true, onClick: props.onCompose } as MenuItem]
      : []),
    ...(canWritePayments
      ? [{ key: "payreq", label: t("menu.paymentRequest"), icon: Send, href: paymentRequestHref(customer) } as MenuItem]
      : []),
    ...(canSendMessages && hasPhone
      ? [{ key: "intake", label: props.intakeSending ? t("menu.intakeSending") : t("menu.intake"), icon: FileText, disabled: props.intakeSending, onClick: props.onSendIntake } as MenuItem]
      : []),
    ...(bookingHref
      ? [{ key: "booking", label: t("menu.bookingLink"), icon: Link2, href: bookingHref, external: true } as MenuItem]
      : []),
    { key: "print", label: t("menu.print"), icon: Printer, onClick: () => window.print() },
    ...(props.canMerge ? [{ key: "merge", label: t("menu.merge"), icon: GitMerge, onClick: props.onMerge } as MenuItem] : []),
    ...(props.canDelete
      ? [{ key: "delete", label: props.deleteIsRequest ? t("menu.deleteRequest") : t("menu.delete"), icon: Trash2, danger: true, onClick: props.onDelete } as MenuItem]
      : []),
    { key: "order", label: t("menu.newOrder"), icon: ShoppingCart, inline: true, onClick: props.onNewOrder },
  ];

  const itemClass = (it: MenuItem) =>
    cn(
      "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-start transition-colors disabled:opacity-50",
      it.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50",
      it.inline && "sm:hidden"
    );

  const renderMenuItem = (it: MenuItem) => {
    const Icon = it.icon;
    const content = (
      <>
        <Icon className={cn("w-4 h-4 flex-shrink-0", it.danger ? "text-red-500" : "text-slate-400")} />
        {it.label}
      </>
    );
    const close = () => setMenuOpen(false);
    if (it.href && it.external) {
      return (
        <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" onClick={close} className={itemClass(it)}>
          {content}
        </a>
      );
    }
    if (it.href) {
      return (
        <Link key={it.key} href={it.href} onClick={close} className={itemClass(it)}>
          {content}
        </Link>
      );
    }
    return (
      <button key={it.key} type="button" disabled={it.disabled} onClick={() => { close(); it.onClick?.(); }} className={itemClass(it)}>
        {content}
      </button>
    );
  };

  const inlineBtn =
    "hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/customers"
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-petra-muted transition-colors flex-shrink-0"
          aria-label={t("backToList")}
        >
          <ArrowRight className="w-5 h-5 ltr:-scale-x-100" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-petra-text truncate">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-petra-muted">{t("added", { date: formatDate(customer.createdAt, { locale }) })}</p>
            <CustomerLeadChip customerId={customer.id} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 no-print">
        <button onClick={props.onNewAppointment} className={inlineBtn} title={t("newAppointmentTitle")}>
          <CalendarClock className="w-4 h-4" />
          {t("menu.appointment")}
        </button>
        {canSendMessages && hasPhone && (
          <button onClick={props.onCompose} className={inlineBtn} title={t("composeTitle")}>
            <MessageCircle className="w-4 h-4" />
            {t("menu.compose")}
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
            aria-label={t("moreActions")}
            aria-expanded={menuOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute end-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 animate-fade-in">
                {items.map(renderMenuItem)}
              </div>
            </>
          )}
        </div>
        <button onClick={props.onNewOrder} className="hidden sm:flex btn-primary items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          {t("menu.newOrder")}
        </button>
      </div>
    </div>
  );
}
