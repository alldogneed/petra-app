"use client";
import { PageTitle } from "@/components/ui/PageTitle";
import { useState } from "react";
import { Building2, Plug, MessageCircle, Database, Hotel, Users2, Shield, CreditCard, PawPrint, CalendarRange, Bot } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessagesPanel } from "@/components/messages/messages-panel";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { PaywallCard } from "@/components/paywall/PaywallCard";
import { McpConnectionsTab } from "@/components/settings/McpConnectionsTab";
import { BusinessTab } from "@/components/settings/BusinessTab";
import { BoardingSettingsTab } from "@/components/settings/BoardingSettingsTab";
import { BookingTab } from "@/components/settings/BookingTab";
import { PaymentsTab } from "@/components/settings/ContractsTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataTab } from "@/components/settings/DataTab";
import { TeamTab } from "@/components/settings/TeamTab";
import { ServiceDogsSettingsTab } from "@/components/settings/ServiceDogsSettingsTab";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const { user, isOwner, isManager } = useAuth();
  const mcpAllowed = user?.mcpAllowed === true;
  const { isFree, isBasic, isGroomer, can } = usePlan();
  const invoicingParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"business" | "booking" | "boarding" | "team" | "payments" | "integrations" | "data" | "messages" | "service-dogs" | "security" | "ai-agents">(
    gcalParam ? "integrations" : invoicingParam === "booking" ? "booking" : invoicingParam === "boarding" ? "boarding" : invoicingParam === "payments" ? "payments" : invoicingParam === "messages" ? "messages" : invoicingParam === "data" ? "data" : invoicingParam === "security" ? "security" : invoicingParam === "ai-agents" ? "ai-agents" : invoicingParam === "integrations" ? "integrations" : "business"
  );

  // Tabs locked per tier
  // booking = PRO+ only; boarding/payments = BASIC+ only
  const FREE_LOCKED_TABS = new Set(["booking", "boarding", "team", "messages", "service-dogs", "data", "integrations", "payments"]);
  // Basic: unlock boarding, payments, data, integrations — keep booking, team, messages, service-dogs locked
  const BASIC_LOCKED_TABS = new Set(["booking", "team", "service-dogs"]);

  const tabs = [
    { id: "business" as const, label: "פרטי העסק", icon: Building2 },
    { id: "booking" as const, label: "הזמנות", icon: CalendarRange },
    ...(!isGroomer ? [{ id: "boarding" as const, label: "פנסיון", icon: Hotel }] : []),
    ...(isOwner ? [{ id: "team" as const, label: "ניהול צוות", icon: Users2 }] : []),
    { id: "messages" as const, label: "הודעות ואוטומציות", icon: MessageCircle },
    ...(isOwner || isManager ? [{ id: "payments" as const, label: "חוזים", icon: CreditCard }] : []),
    ...(!isGroomer ? [{ id: "service-dogs" as const, label: "כלבי שירות", icon: PawPrint }] : []),
    { id: "data" as const, label: "נתונים", icon: Database },
    { id: "integrations" as const, label: "אינטגרציות", icon: Plug },
    // MCP private beta — tab visible only to allowlisted accounts (user.mcpAllowed from server)
    ...(mcpAllowed ? [{ id: "ai-agents" as const, label: "עוזרי AI", icon: Bot }] : []),
    { id: "security" as const, label: "אבטחה", icon: Shield },
  ];

  return (
    <div>
      <PageTitle title="הגדרות" />
      <DesktopBanner />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">הגדרות</h1>
      </div>

      {/* Tabs */}
      <div className="relative mb-6">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-hide">

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const locked = (isFree && FREE_LOCKED_TABS.has(tab.id)) || (isBasic && BASIC_LOCKED_TABS.has(tab.id));
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {locked && <span className="text-[10px]">🔒</span>}
            </button>
          );
        })}
      </div>
      {/* Fade hint on left edge (RTL: left = end of tabs) indicating more to scroll */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-100 to-transparent rounded-l-xl md:hidden" />
      </div>

      {activeTab === "business" && <BusinessTab />}
      {activeTab === "booking" && (
        (isFree || isBasic)
          ? <PaywallCard title="הזמנות" description="הגדר זמינות, שעות פעילות והזמנות אונליין — זמין במנוי פרו ומעלה." requiredTier="pro" variant="page" />
          : <BookingTab />
      )}
      {activeTab === "boarding" && !isGroomer && (
        isFree
          ? <PaywallCard title="הגדרות פנסיון" description="הגדר שעות צ׳ק-אין/אאוט ומינימום לילות — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <BoardingSettingsTab />
      )}
      {activeTab === "team" && isOwner && (
        (isFree || isBasic)
          ? <PaywallCard title="ניהול צוות" description="הוסף חברי צוות ונהל הרשאות — זמין במנוי פרו ומעלה." requiredTier="pro" variant="page" />
          : <TeamTab />
      )}
      {activeTab === "messages" && (
        isFree
          ? <PaywallCard title="הודעות ואוטומציות" description="תבניות WhatsApp, תזכורות אוטומטיות ואוטומציות — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <MessagesPanel />
      )}
      {activeTab === "payments" && (isOwner || isManager) && (
        isFree
          ? <PaywallCard title="תשלומים וחוזים" description="הגדרות חשבוניות, חיוב וחוזים דיגיטליים — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <PaymentsTab />
      )}
      {activeTab === "service-dogs" && !isGroomer && (
        !can("service_dogs")
          ? <PaywallCard title="הגדרות כלבי שירות" description="הגדרות תוכנית כלבי שירות — זמין במנוי Service Dog בלבד." requiredTier="service_dog" variant="page" />
          : <ServiceDogsSettingsTab />
      )}
      {activeTab === "data" && (
        isFree
          ? <PaywallCard title="ייצוא נתונים" description="ייצוא לקוחות ובעלי חיים ל-Excel/CSV — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <DataTab />
      )}
      {activeTab === "integrations" && (
        isFree
          ? <PaywallCard title="אינטגרציות" description="חבר יומן Google, WhatsApp ועוד — זמין במנוי בייסיק ומעלה." requiredTier="basic" variant="page" />
          : <IntegrationsTab />
      )}
      {activeTab === "ai-agents" && mcpAllowed && (
        !can("ai_assistant")
          ? <PaywallCard title="עוזרי AI" description="חבר את העסק שלך ל-Claude, ChatGPT ועוד — זמין במנוי פרו ומעלה." requiredTier="pro" variant="page" />
          : <McpConnectionsTab />
      )}
      {activeTab === "security" && <SecurityTab />}
    </div>
  );
}
