"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hotel, UtensilsCrossed, Pill, Syringe, ClipboardList, ClipboardCheck, TreePine } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "לוח יומי",      href: "/boarding/daily", icon: ClipboardCheck  },
  { name: "ניהול חדרים",   href: "/boarding",        icon: Hotel           },
  { name: "ניהול חצרות",   href: "/boarding/yards",  icon: TreePine        },
  { name: "האכלה",         href: "/feeding",         icon: UtensilsCrossed },
  { name: "תרופות",        href: "/medications",     icon: Pill            },
  { name: "חיסונים",       href: "/vaccinations",    icon: Syringe         },
  { name: "טפסי קליטה",    href: "/intake-forms",    icon: ClipboardList   },
];

export function BoardingTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/boarding"
            ? pathname === "/boarding"
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 whitespace-nowrap",
              isActive
                ? "bg-white text-petra-text shadow-sm"
                : "text-petra-muted hover:text-petra-text hover:bg-white/60"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
