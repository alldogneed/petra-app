"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, Send, Tag, ShoppingCart, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "pricing",         href: "/pricing",          icon: Tag         },
  { key: "orders",          href: "/orders",           icon: ShoppingCart },
  { key: "paymentRequests", href: "/payment-request", icon: Send        },
  { key: "payments",        href: "/payments",        icon: CreditCard  },
  // חשבוניות hidden until the Israeli invoicing regulation setup is complete
  // { key: "invoices",        href: "/invoices",        icon: FileText    },
] as const;

export function FinanceTabs() {
  const pathname = usePathname();
  const t = useTranslations("finance.financeTabs");

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        const name = t(tab.key);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={name}
            title={name}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1",
              isActive
                ? "bg-white text-petra-text shadow-sm"
                : "text-petra-muted hover:text-petra-text hover:bg-white/60"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{name}</span>
          </Link>
        );
      })}
    </div>
  );
}
