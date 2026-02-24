"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GlobalFilters } from "./GlobalFilters";
import { BarChart2 } from "lucide-react";

const TABS = [
  { href: "/analytics", label: "סקירה", exact: true },
  { href: "/analytics/revenue", label: "הכנסות", exact: false },
  { href: "/analytics/bookings", label: "תורים", exact: false },
  { href: "/analytics/services", label: "שירותים", exact: false },
  { href: "/analytics/customers", label: "לקוחות", exact: false },
  { href: "/analytics/cancellations", label: "ביטולים", exact: false },
];

interface AnalyticsShellProps {
  children: React.ReactNode;
}

export function AnalyticsShell({ children }: AnalyticsShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            <BarChart2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">דוחות וניתוחים</h1>
            <p className="text-sm text-gray-500">מעקב אחר ביצועי העסק</p>
          </div>
        </div>

        {/* Global Filters */}
        <GlobalFilters />

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            const href = qs ? `${tab.href}?${qs}` : tab.href;
            return (
              <Link
                key={tab.href}
                href={href}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
