"use client";

import { type ReactNode } from "react";
import { usePlan } from "@/hooks/usePlan";
import { getUpgradeTier } from "@/lib/feature-flags";
import { PaywallCard } from "./PaywallCard";
import { type FeatureKey, type TierKey } from "@/lib/feature-flags";

interface TierGateProps {
  feature: FeatureKey;
  /** Title shown on the paywall */
  title: string;
  /** Description shown on the paywall */
  description: string;
  /** Override which tier to show in the upgrade CTA */
  upgradeTier?: TierKey;
  /** Override the CTA label */
  ctaLabel?: string;
  children: ReactNode;
}

export function TierGate({
  feature,
  title,
  description,
  upgradeTier,
  ctaLabel,
  children,
}: TierGateProps) {
  const { can, tier } = usePlan();

  if (!can(feature)) {
    const target = upgradeTier ?? getUpgradeTier(tier) ?? "pro";
    return (
      <PaywallCard
        title={title}
        description={description}
        requiredTier={target}
        ctaLabel={ctaLabel}
      />
    );
  }

  return <>{children}</>;
}
