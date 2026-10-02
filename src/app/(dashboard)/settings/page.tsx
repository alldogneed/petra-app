"use client";
import { PageTitle } from "@/components/ui/PageTitle";
import { useCallback, useMemo, useRef } from "react";
import {
  Building2, Plug, MessageCircle, Database, Hotel, Users2, Shield, FileSignature, PawPrint,
  CalendarRange, Bot, CreditCard, Lock, ChevronDown,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isOwner, isManager } = useAuth();
  const plan = usePlan();
  const { guard } = useSettingsDirty();
  const tabRefs = useRef<Partial<Record<SettingsTabId, HTMLButtonElement | null>>>({});

  const visibleTabs = useMemo(
    () => SETTINGS_TABS.filter((t) => isTabVisible(t, {
      isOwner, isManager, isGroomer: plan.isGroomer, mcpAllowed: user?.mcpAllowed === true,
    })),
    [isOwner, isManager, plan.isGroomer, user?.mcpAllowed],
  );

  // The URL is the source of truth (?tab=) — refresh, back/forward and deep links
  // all land on the right tab. ?gcal= (Google OAuth return) opens integrations.
  const requested = resolveTabParam(searchParams.get("tab")) ?? (searchParams.get("gcal") ? "integrations" : null);
  const activeTab: SettingsTabDef =
    visibleTabs.find((t) => t.id === requested) ?? visibleTabs[0] ?? SETTINGS_TABS[0];

  const selectTab = useCallback((id: SettingsTabId) => {
    if (id === activeTab.id) return;
    guard(() => router.replace(`${pathname}?tab=${id}`, { scroll: false }));
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
      <PageTitle title="הגדרות" />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="page-title">הגדרות</h1>
      </div>

      <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:items-start">
        {/* Mobile: one compact picker instead of a 12-chip horizontal scroller */}
        <div className="md:hidden mb-5">
          <label htmlFor="settings-tab-select" className="sr-only">בחר אזור הגדרות</label>
          <div className="relative">
            <ActiveIcon className="w-4 h-4 text-brand-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              id="settings-tab-select"
              className="input appearance-none pr-9 pl-9 font-medium"
              value={activeTab.id}
              onChange={(e) => selectTab(e.target.value as SettingsTabId)}
            >
              {SETTINGS_GROUPS.map((g) => {
                const tabs = visibleTabs.filter((t) => t.group === g.id);
                if (tabs.length === 0) return null;
                return (
                  <optgroup key={g.id} label={g.label}>
                    {tabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}{isTabLocked(t, plan) ? " 🔒" : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-petra-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Desktop: grouped vertical nav */}
        <nav aria-label="אזורי הגדרות" className="hidden md:block md:sticky md:top-4">
          <div role="tablist" aria-orientation="vertical" aria-label="הגדרות" className="card p-2 space-y-3">
            {SETTINGS_GROUPS.map((g) => {
              const tabs = visibleTabs.filter((t) => t.group === g.id);
              if (tabs.length === 0) return null;
              return (
                <div key={g.id}>
                  <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-petra-muted">{g.label}</p>
                  <div className="space-y-0.5">
                    {tabs.map((t) => {
                      const Icon = TAB_ICONS[t.id];
                      const selected = t.id === activeTab.id;
                      const index = visibleTabs.indexOf(t);
                      return (
                        <button
                          key={t.id}
                          ref={(el) => { tabRefs.current[t.id] = el; }}
                          id={`settings-tab-${t.id}`}
                          role="tab"
                          type="button"
                          aria-selected={selected}
                          aria-controls="settings-panel"
                          tabIndex={selected ? 0 : -1}
                          onClick={() => selectTab(t.id)}
                          onKeyDown={(e) => onTabKeyDown(e, index)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-right",
                            selected
                              ? "bg-brand-50 text-brand-700 font-semibold"
                              : "text-petra-muted hover:bg-slate-50 hover:text-petra-text",
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 truncate">{t.label}</span>
                          {isTabLocked(t, plan) && <Lock className="w-3 h-3 flex-shrink-0 opacity-60" aria-label="נעול במסלול הנוכחי" />}
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
              title={activeTab.paywallTitle ?? activeTab.label}
              description={activeTab.paywallDescription ?? ""}
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
