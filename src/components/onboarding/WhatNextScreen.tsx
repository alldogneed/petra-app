"use client";

import Image from "next/image";
import {
  Upload,
  Tag,
  CreditCard,
  UserPlus,
  Zap,
  Hotel,
  Scissors,
  GraduationCap,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const BASE_ACTIONS = [
  {
    id: "import",
    icon: Upload,
    href: "/customers",
    color: "#6366F1",
  },
  {
    id: "services",
    icon: Tag,
    href: "/price-lists",
    color: "#F97316",
  },
  {
    id: "payments",
    icon: CreditCard,
    href: "/settings",
    color: "#10B981",
  },
  {
    id: "staff",
    icon: UserPlus,
    href: "/settings",
    color: "#8B5CF6",
  },
  {
    id: "automations",
    icon: Zap,
    href: "/messages",
    color: "#EC4899",
  },
];

const BUSINESS_TYPE_EXTRAS: Record<
  string,
  { id: string; icon: typeof Hotel; href: string; color: string }
> = {
  פנסיון: { // i18n-ok — key = stored OnboardingProfile.businessType
    id: "boarding",
    icon: Hotel,
    href: "/boarding",
    color: "#0EA5E9",
  },
  מספרה: { // i18n-ok — key = stored OnboardingProfile.businessType
    id: "grooming",
    icon: Scissors,
    href: "/calendar",
    color: "#0EA5E9",
  },
  "מאלף כלבים": { // i18n-ok — key = stored OnboardingProfile.businessType
    id: "training",
    icon: GraduationCap,
    href: "/customers",
    color: "#0EA5E9",
  },
};

interface WhatNextScreenProps {
  businessType?: string;
}

export function WhatNextScreen({ businessType }: WhatNextScreenProps) {
  const router = useRouter();
  const t = useTranslations("onboarding.whatNextScreen");

  // Build action list with business-type-specific promotion
  const actions = [...BASE_ACTIONS];
  if (businessType && BUSINESS_TYPE_EXTRAS[businessType]) {
    // Insert promoted action at position 1 (right after import)
    actions.splice(1, 0, BUSINESS_TYPE_EXTRAS[businessType]);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-petra-bg">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-4">
            <Image src="/logo.svg" alt="Petra" width={56} height={56} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold text-petra-text mb-2">
            {t("title")}
          </h1>
          <p className="text-sm text-petra-muted">
            {t("subtitle")}
          </p>
        </div>

        {/* Action cards */}
        <div className="space-y-2.5 mb-8">
          {actions.map((action) => {
            const Icon = action.icon;
            const isPromoted =
              businessType &&
              BUSINESS_TYPE_EXTRAS[businessType]?.id === action.id;

            return (
              <button
                key={action.id}
                onClick={() => router.push(action.href)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 text-start group"
                style={{
                  background: isPromoted ? "#FFF7ED" : "#FFFFFF",
                  borderColor: isPromoted ? "#FDBA74" : "#E2E8F0",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${action.color}15` }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: action.color }}
                  />
                </div>
                <span className="flex-1 text-sm font-medium text-petra-text group-hover:text-brand-600 transition-colors">
                  {t(`actions.${action.id}`)}
                  {isPromoted && (
                    <span className="ms-2 text-xs text-brand-500 font-semibold">
                      {t("recommended")}
                    </span>
                  )}
                </span>
                <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors ltr:-scale-x-100" />
              </button>
            );
          })}
        </div>

        {/* Skip to dashboard */}
        <div className="text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-petra-muted hover:text-petra-text transition-colors"
          >
            {t("toDashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
