"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hotel, UtensilsCrossed, Pill, Syringe, ClipboardList, ClipboardCheck, Fence } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const TABS = [
  { key: "daily",          href: "/boarding/daily", icon: ClipboardCheck  },
  { key: "rooms",          href: "/boarding",        icon: Hotel           },
  { key: "yards",          href: "/boarding/yards",  icon: Fence           },
  { key: "feeding",        href: "/feeding",         icon: UtensilsCrossed },
  { key: "medications",    href: "/medications",     icon: Pill            },
  { key: "vaccinations",   href: "/vaccinations",    icon: Syringe         },
  { key: "intakeForms",    href: "/intake-forms",    icon: ClipboardList   },
] as const;

export function BoardingTabs() {
  const pathname = usePathname();
  const t = useTranslations("boarding.boardingTabs");

  return (
    <div className="no-print flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/boarding"
            ? pathname === "/boarding"
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        const name = t(tab.key);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={name}
            title={name}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 whitespace-nowrap",
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
