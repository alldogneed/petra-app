"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "קביעת תור ידני", href: "/scheduler",           icon: CalendarClock },
  { name: "ניהול תורים",    href: "/bookings",             icon: CalendarCheck },
];

export function BookingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1",
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
