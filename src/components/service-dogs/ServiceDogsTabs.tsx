"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Dog, UserCheck, Activity, CreditCard, BarChart2, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

const TABS = [
  { key: "overview",         href: "/service-dogs",              icon: LayoutDashboard },
  { key: "dogs",             href: "/service-dogs/dogs",         icon: Dog             },
  { key: "recipients",       href: "/service-dogs/recipients",   icon: UserCheck,      requirePerm: "canSeeRecipientsSensitive" as const },
  { key: "placements",       href: "/service-dogs/placements",   icon: Activity,       requirePerm: "canSeeRecipientsSensitive" as const },
  { key: "vaccinations",     href: "/service-dogs/vaccinations", icon: Syringe         },
  { key: "idCards",          href: "/service-dogs/id-cards",     icon: CreditCard      },
  { key: "reports",          href: "/service-dogs/reports",      icon: BarChart2       },
];

export function ServiceDogsTabs() {
  const pathname = usePathname();
  const t = useTranslations("serviceDogs.serviceDogsTabs");
  const perms = usePermissions();

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
      {TABS.filter((tab) => !tab.requirePerm || perms[tab.requirePerm])
        // Both vaccination tables switched off for this member → nothing left to show there.
        .filter((tab) => tab.href !== "/service-dogs/vaccinations" || Object.values(perms.serviceDogVaccineTabs).some(Boolean))
        .map((tab) => {
        const isActive =
          tab.href === "/service-dogs"
            ? pathname === "/service-dogs"
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
