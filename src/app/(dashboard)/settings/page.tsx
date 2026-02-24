"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Save,
  CheckCircle2,
  Wrench,
  Star,
  Zap,
  Crown,
  Tag,
  Plug,
  Calendar,
  MessageCircle,
  Mail,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TIERS } from "@/lib/constants";

interface Business {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tier: string;
  vatNumber: string | null;
  _count: { customers: number; appointments: number };
}

const TIER_ICONS = { basic: Star, pro: Zap, groomer: Crown };

function BusinessTab() {
  const queryClient = useQueryClient();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const [form, setForm] = useState<Partial<Business> | null>(null);
  const [saved, setSaved] = useState(false);

  const editing = form ?? biz;

  const mutation = useMutation({
    mutationFn: (data: Partial<Business>) =>
      fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-3 max-w-xl">
      {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}
    </div>
  );
  if (!editing) return null;

  const TierIcon = TIER_ICONS[editing.tier as keyof typeof TIER_ICONS] ?? Star;
  const tierInfo = TIERS[editing.tier as keyof typeof TIERS];

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3 p-4 rounded-2xl border"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(251,146,60,0.04) 100%)", borderColor: "rgba(249,115,22,0.15)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.1)" }}>
          <TierIcon className="w-5 h-5 text-brand-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-petra-text">חבילה: {tierInfo?.name ?? editing.tier}</p>
          <p className="text-xs text-petra-muted">{biz?._count.customers} לקוחות · {biz?._count.appointments} פגישות</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">שם העסק *</label>
          <input className="input" value={editing.name ?? ""} onChange={(e) => setForm({ ...editing, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">טלפון</label>
            <input className="input" value={editing.phone ?? ""} onChange={(e) => setForm({ ...editing, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">אימייל</label>
            <input className="input" type="email" value={editing.email ?? ""} onChange={(e) => setForm({ ...editing, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">כתובת</label>
          <input className="input" value={editing.address ?? ""} onChange={(e) => setForm({ ...editing, address: e.target.value })} />
        </div>
        <div>
          <label className="label">מספר עוסק מורשה</label>
          <input className="input" placeholder="000000000" value={editing.vatNumber ?? ""} onChange={(e) => setForm({ ...editing, vatNumber: e.target.value })} />
        </div>
      </div>

      <button
        className={cn("btn-primary flex items-center gap-2 transition-all", saved && "bg-emerald-500 hover:brightness-100")}
        style={saved ? { background: "#10B981" } : undefined}
        disabled={mutation.isPending}
        onClick={() => form && mutation.mutate(form)}
      >
        {saved ? <><CheckCircle2 className="w-4 h-4" /> נשמר!</> : <><Save className="w-4 h-4" /> שמור שינויים</>}
      </button>
    </div>
  );
}

function ServicesTab() {
  return (
    <div className="card p-8 text-center space-y-4 max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto">
        <Tag className="w-7 h-7 text-brand-500" />
      </div>
      <div>
        <h3 className="font-semibold text-lg text-slate-900">ניהול השירותים הועבר</h3>
        <p className="text-sm text-petra-muted mt-1 leading-relaxed">
          המחירון וניהול השירותים זמינים כעת בדף ייעודי עם אפשרויות מתקדמות
        </p>
      </div>
      <Link href="/pricing" className="btn-primary inline-flex items-center gap-2 w-full justify-center">
        <Tag className="w-4 h-4" />
        עבור למחירון
      </Link>
    </div>
  );
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  connectedEmail?: string | null;
  syncEnabled?: boolean;
  lastConnectedAt?: string | null;
  connectUrl?: string | null;
  disconnectUrl?: string | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  "message-circle": MessageCircle,
  mail: Mail,
};

function IntegrationsTab() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const gcalStatus = searchParams.get("gcal");

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => fetch("/api/integrations").then((r) => r.json()),
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      fetch("/api/integrations/google/disconnect", { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Disconnect failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  if (isLoading)
    return (
      <div className="animate-pulse space-y-3 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );

  return (
    <div className="space-y-4 max-w-2xl">
      {/* OAuth redirect feedback */}
      {gcalStatus === "connected" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          יומן גוגל חובר בהצלחה!
        </div>
      )}
      {gcalStatus === "denied" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          החיבור בוטל. ניתן לנסות שוב בכל עת.
        </div>
      )}
      {gcalStatus === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          אירעה שגיאה בחיבור. נסה שוב.
        </div>
      )}

      {integrations?.map((integ) => {
        const Icon = ICON_MAP[integ.icon] ?? Plug;
        return (
          <div key={integ.id} className="card p-5 flex items-start gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                integ.connected ? "bg-emerald-50" : "bg-slate-100"
              )}
            >
              <Icon className={cn("w-6 h-6", integ.connected ? "text-emerald-600" : "text-slate-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-petra-text">{integ.name}</h3>
                {integ.connected ? (
                  <span className="badge badge-success text-xs">מחובר</span>
                ) : (
                  <span className="badge badge-neutral text-xs">לא מחובר</span>
                )}
              </div>
              <p className="text-sm text-petra-muted mt-0.5">{integ.description}</p>
              {integ.connected && integ.connectedEmail && (
                <p className="text-xs text-emerald-600 mt-1">{integ.connectedEmail}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              {integ.connected && integ.disconnectUrl ? (
                <button
                  className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "נתק"
                  )}
                </button>
              ) : integ.connectUrl ? (
                <a
                  href={integ.connectUrl}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  חבר
                </a>
              ) : (
                <span className="text-xs text-petra-muted">בקרוב</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const [activeTab, setActiveTab] = useState<"business" | "services" | "integrations">(
    gcalParam ? "integrations" : "business"
  );

  const tabs = [
    { id: "business" as const, label: "פרטי העסק", icon: Building2 },
    { id: "services" as const, label: "שירותים", icon: Wrench },
    { id: "integrations" as const, label: "אינטגרציות", icon: Plug },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">הגדרות</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "business" && <BusinessTab />}
      {activeTab === "services" && <ServicesTab />}
      {activeTab === "integrations" && <IntegrationsTab />}
    </div>
  );
}
