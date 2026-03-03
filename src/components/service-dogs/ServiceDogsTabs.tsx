"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dog, UserCheck, Activity, AlertTriangle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "סקירה",          href: "/service-dogs",             icon: LayoutDashboard },
  { name: "כלבים",          href: "/service-dogs/dogs",        icon: Dog             },
  { name: "זכאים",          href: "/service-dogs/recipients",  icon: UserCheck       },
  { name: "שיבוצים",        href: "/service-dogs/placements",  icon: Activity        },
  { name: "משמעת ודיווח",   href: "/service-dogs/compliance",  icon: AlertTriangle   },
  { name: "תעודות זהות",    href: "/service-dogs/id-cards",    icon: CreditCard      },
];

export function ServiceDogsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/service-dogs"
            ? pathname === "/service-dogs"
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
