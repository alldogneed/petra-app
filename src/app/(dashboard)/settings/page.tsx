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
} from "lucide-react";
import Link from "next/link";
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "services">("business");

  const tabs = [
    { id: "business" as const, label: "פרטי העסק", icon: Building2 },
    { id: "services" as const, label: "שירותים", icon: Wrench },
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
    </div>
  );
}
