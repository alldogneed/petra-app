"use client";

import { type ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
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
  const { hasFeature, upgradeTier: defaultUpgrade } = useSubscription();

  if (!hasFeature(feature)) {
    const target = upgradeTier ?? defaultUpgrade ?? "pro";
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
