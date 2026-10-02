"use client";

import { useState } from "react";
import { TierGate } from "@/components/paywall/TierGate";
import { ShieldCheck, Users, Activity, Monitor, BarChart2, MessageSquare, CreditCard, Bot, BellRing, HeartPulse } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { OverviewTab } from "@/components/business-admin/OverviewTab";
import { ActivityTab } from "@/components/business-admin/ActivityTab";
import { TeamTab } from "@/components/business-admin/TeamTab";
import { SessionsTab } from "@/components/business-admin/SessionsTab";
import { SystemMessagesTab } from "@/components/business-admin/SystemMessagesTab";
import { BillingTab } from "@/components/business-admin/BillingTab";
import { AiActivityTab } from "@/components/business-admin/AiActivityTab";
import { SecurityAlertsTab } from "@/components/business-admin/SecurityAlertsTab";
import { DataHealthTab } from "@/components/business-admin/DataHealthTab";

// ── Page ─────────────────────────────────────────────────────────

type Tab = "overview" | "activity" | "ai" | "team" | "sessions" | "security" | "health" | "messages" | "billing";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "סקירה", icon: BarChart2 },
  { id: "activity", label: "פעילות", icon: Activity },
  { id: "ai", label: "פעילות AI", icon: Bot },
  { id: "team", label: "צוות", icon: Users },
  { id: "sessions", label: "סשנים", icon: Monitor },
  { id: "security", label: "התראות אבטחה", icon: BellRing },
  { id: "health", label: "בריאות נתונים", icon: HeartPulse },
  { id: "messages", label: "הודעות מערכת", icon: MessageSquare },
  { id: "billing", label: "מנוי וחיוב", icon: CreditCard },
];

function BusinessAdminPageContent() {
  const { user, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (!isOwner) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-700">גישה מוגבלת</h2>
          <p className="text-sm text-petra-muted">
            דף זה זמין לבעלי העסק בלבד.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-500" />
            ניהול ובקרה
          </h1>
          <p className="text-sm text-petra-muted mt-0.5">
            פיקוח על פעילות המשתמשים וניהול הצוות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-petra-muted bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span
              className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
            />
            ניטור פעיל
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max md:w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {tab.label}
            </button>
          );
        })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "activity" && <ActivityTab />}
      {activeTab === "team" && <TeamTab currentUserId={user?.id ?? ""} />}
      {activeTab === "ai" && <AiActivityTab />}
      {activeTab === "sessions" && <SessionsTab currentUserId={user?.id ?? ""} />}
      {activeTab === "security" && <SecurityAlertsTab />}
      {activeTab === "health" && <DataHealthTab />}
      {activeTab === "messages" && <SystemMessagesTab />}
      {activeTab === "billing" && <BillingTab />}
    </div>
  );
}

export default function BusinessAdminPage() {
  return (
    <TierGate
      feature="staff_management"
      title="ניהול צוות ומשתמשים"
      description="הוסף עובדים נוספים, נהל הרשאות, ועקוב אחר פעילות הצוות. זמין במסלול Pro ומעלה."
      upgradeTier="pro"
    >
      <BusinessAdminPageContent />
    </TierGate>
  );
}
