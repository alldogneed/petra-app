"use client";
import { PageTitle } from "@/components/ui/PageTitle";
import { useCallback, useMemo, useRef } from "react";
import {
  Building2, Plug, MessageCircle, Database, Hotel, Users2, Shield, FileSignature, PawPrint,
  CalendarRange, Bot, CreditCard, Lock, ChevronDown,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MessagesPanel } from "@/components/messages/messages-panel";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { PaywallCard } from "@/components/paywall/PaywallCard";
import { McpConnectionsTab } from "@/components/settings/McpConnectionsTab";
import { BusinessTab } from "@/components/settings/BusinessTab";
import { SubscriptionTab } from "@/components/settings/SubscriptionTab";
import { AccountTab } from "@/components/settings/AccountTab";
import { BoardingSettingsTab } from "@/components/settings/BoardingSettingsTab";
import { BookingTab } from "@/components/settings/BookingTab";
import { PaymentsTab } from "@/components/settings/ContractsTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataTab } from "@/components/settings/DataTab";
import { TeamTab } from "@/components/settings/TeamTab";
import { ServiceDogsSettingsTab } from "@/components/settings/ServiceDogsSettingsTab";
import { SettingsDirtyProvider, useSettingsDirty } from "@/components/settings/SettingsDirtyContext";
import {
  SETTINGS_GROUPS, SETTINGS_TABS, isTabLocked, isTabVisible, resolveTabParam,
  type SettingsTabDef, type SettingsTabId,
} from "@/components/settings/settings-tabs";

const TAB_ICONS: Record<SettingsTabId, React.ComponentType<{ className?: string }>> = {
  business: Building2,
  subscription: CreditCard,
  booking: CalendarRange,
  boarding: Hotel,
  "service-dogs": PawPrint,
  payments: FileSignature,
  messages: MessageCircle,
  team: Users2,
  integrations: Plug,
  "ai-agents": Bot,
  data: Database,
  security: Shield,
};

function TabContent({ id }: { id: SettingsTabId }) {
  switch (id) {
    case "business": return <BusinessTab />;
    case "subscription": return <SubscriptionTab />;
    case "booking": return <BookingTab />;
    case "boarding": return <BoardingSettingsTab />;
    case "service-dogs": return <ServiceDogsSettingsTab />;
    case "payments": return <PaymentsTab />;
    case "messages": return <MessagesPanel />;
    case "team": return <TeamTab />;
    case "integrations": return <IntegrationsTab />;
    case "ai-agents": return <McpConnectionsTab />;
    case "data": return <DataTab />;
    case "security": return <AccountTab />;
  }
}

export default function SettingsPage() {
  return (
    <SettingsDirtyProvider>
      <SettingsScreen />
    </SettingsDirtyProvider>
  );
}

function SettingsScreen() {
  const t = useTranslations("settings.settingsPage");
  // Tab / group labels hold FULL message keys (settings-tabs.ts) → root translator.
  const tr = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isOwner, isManager } = useAuth();
  const plan = usePlan();
  const { guard } = useSettingsDirty();
  const tabRefs = useRef<Partial<Record<SettingsTabId, HTMLButtonElement | null>>>({});

  const visibleTabs = useMemo(
    () => SETTINGS_TABS.filter((tab) => isTabVisible(tab, {
      isOwner, isManager, isGroomer: plan.isGroomer, mcpAllowed: user?.mcpAllowed === true,
    })),
    [isOwner, isManager, plan.isGroomer, user?.mcpAllowed],
  );

  // The URL is the source of truth (?tab=) — refresh, back/forward and deep links
  // all land on the right tab. ?gcal= (Google OAuth return) opens integrations.
  const requested = resolveTabParam(searchParams.get("tab")) ?? (searchParams.get("gcal") ? "integrations" : null);
  const activeTab: SettingsTabDef =
    visibleTabs.find((tab) => tab.id === requested) ?? visibleTabs[0] ?? SETTINGS_TABS[0];

  const selectTab = useCallback((id: SettingsTabId) => {
    if (id === activeTab.id) return;
    guard(() => router.push(`${pathname}?tab=${id}`, { scroll: false }));
  }, [activeTab.id, guard, pathname, router]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (index + 1) % visibleTabs.length;
    else if (e.key === "ArrowUp") next = (index - 1 + visibleTabs.length) % visibleTabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = visibleTabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    const tab = visibleTabs[next];
    tabRefs.current[tab.id]?.focus();
    selectTab(tab.id);
  };

  const locked = isTabLocked(activeTab, plan);
  const ActiveIcon = TAB_ICONS[activeTab.id];

  return (
    <div>
      <PageTitle title={t("title")} />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="page-title">{t("title")}</h1>
      </div>

      <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:items-start">
        {/* Mobile: one compact picker instead of a 12-chip horizontal scroller */}
        <div className="md:hidden mb-5">
          <label htmlFor="settings-tab-select" className="sr-only">{t("selectArea")}</label>
          <div className="relative">
            <ActiveIcon className="w-4 h-4 text-brand-500 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              id="settings-tab-select"
              className="input appearance-none ps-9 pe-9 font-medium"
              value={activeTab.id}
              onChange={(e) => selectTab(e.target.value as SettingsTabId)}
            >
              {SETTINGS_GROUPS.map((g) => {
                const tabs = visibleTabs.filter((tab) => tab.group === g.id);
                if (tabs.length === 0) return null;
                return (
                  <optgroup key={g.id} label={tr(g.labelKey)}>
                    {tabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tr(tab.labelKey)}{isTabLocked(tab, plan) ? " 🔒" : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-petra-muted absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Desktop: grouped vertical nav */}
        <nav aria-label={t("areasNavAriaLabel")} className="hidden md:block md:sticky md:top-4">
          <div role="tablist" aria-orientation="vertical" aria-label={t("title")} className="card p-2 space-y-3">
            {SETTINGS_GROUPS.map((g) => {
              const tabs = visibleTabs.filter((tab) => tab.group === g.id);
              if (tabs.length === 0) return null;
              return (
                <div key={g.id}>
                  <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-petra-muted">{tr(g.labelKey)}</p>
                  <div className="space-y-0.5">
                    {tabs.map((tab) => {
                      const Icon = TAB_ICONS[tab.id];
                      const selected = tab.id === activeTab.id;
                      const index = visibleTabs.indexOf(tab);
                      return (
                        <button
                          key={tab.id}
                          ref={(el) => { tabRefs.current[tab.id] = el; }}
                          id={`settings-tab-${tab.id}`}
                          role="tab"
                          type="button"
                          aria-selected={selected}
                          aria-controls="settings-panel"
                          tabIndex={selected ? 0 : -1}
                          onClick={() => selectTab(tab.id)}
                          onKeyDown={(e) => onTabKeyDown(e, index)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-start",
                            selected
                              ? "bg-brand-50 text-brand-700 font-semibold"
                              : "text-petra-muted hover:bg-slate-50 hover:text-petra-text",
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 truncate">{tr(tab.labelKey)}</span>
                          {isTabLocked(tab, plan) && <Lock className="w-3 h-3 flex-shrink-0 opacity-60" aria-label={t("lockedAriaLabel")} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <section
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeTab.id}`}
          className="min-w-0"
        >
          {locked ? (
            <PaywallCard
              title={tr(activeTab.paywallTitleKey ?? activeTab.labelKey)}
              description={activeTab.paywallDescriptionKey ? tr(activeTab.paywallDescriptionKey) : ""}
              requiredTier={activeTab.requiredTier ?? "pro"}
              variant="page"
            />
          ) : (
            <TabContent key={activeTab.id} id={activeTab.id} />
          )}
        </section>
      </div>
    </div>
  );
}
