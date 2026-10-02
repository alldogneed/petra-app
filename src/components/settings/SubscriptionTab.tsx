"use client";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { fetchJSON } from "@/lib/utils";
import { BUSINESS_SETTINGS_QUERY_KEY } from "@/hooks/useBusinessSettings";
import { SubscriptionCard } from "./SubscriptionCard";
import { SettingsSectionHeader } from "./settings-ui";
import type { Business } from "./shared";

export function SubscriptionTab() {
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: BUSINESS_SETTINGS_QUERY_KEY,
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  if (isLoading) return <PetraLoader />;
  if (!biz) return null;

  return (
    <div className="max-w-xl">
      <SettingsSectionHeader icon={CreditCard} title="מנוי וחיוב" description="המסלול הנוכחי, סטטוס החיוב ושדרוג" />
      <SubscriptionCard
        tier={biz.tier ?? "free"}
        customerCount={biz._count?.customers ?? 0}
        appointmentCount={biz._count?.appointments ?? 0}
      />
    </div>
  );
}
