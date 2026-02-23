"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Save,
  CheckCircle2,
  Wrench,
  Plus,
  X,
  Star,
  Zap,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TIERS, SERVICE_TYPES } from "@/lib/constants";

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

interface Service {
  id: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  color: string | null;
  isActive: boolean;
}

const TIER_ICONS = { basic: Star, pro: Zap, groomer: Crown };
const SERVICE_COLORS = ["#F97316", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#EC4899"];

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
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => fetch("/api/services").then((r) => r.json()),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "training", duration: "60", price: "", color: SERVICE_COLORS[0] });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, duration: parseInt(data.duration), price: parseFloat(data.price) }) }).then((r) => {
        if (!r.ok) throw new Error("Failed"); return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setShowForm(false);
      setForm({ name: "", type: "training", duration: "60", price: "", color: SERVICE_COLORS[0] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-petra-text">שירותים ({services.length})</h3>
        <button className="btn-ghost text-xs" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "ביטול" : "הוסף שירות"}
        </button>
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">שם השירות *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">סוג</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {SERVICE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-xs">משך (דק׳)</label>
              <input className="input" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">מחיר (₪) *</label>
              <input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">צבע</label>
              <div className="flex gap-1.5 mt-1">
                {SERVICE_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    className={cn("w-6 h-6 rounded-full transition-all", form.color === c ? "ring-2 ring-offset-1 ring-slate-400 scale-110" : "hover:scale-110")}
                    style={{ background: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <button className="btn-primary text-xs" disabled={!form.name || !form.price || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
            <Plus className="w-3.5 h-3.5" />{createMutation.isPending ? "שומר..." : "הוסף"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-14" />)}</div>
      ) : services.length === 0 ? (
        <p className="text-sm text-petra-muted text-center py-8">אין שירותים. הוסף שירות ראשון.</p>
      ) : (
        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.id} className="card p-3 flex items-center gap-3">
              <div className="w-3 h-8 rounded-full" style={{ background: service.color || "#F97316" }} />
              <div className="flex-1">
                <div className="text-sm font-medium text-petra-text">{service.name}</div>
                <div className="text-xs text-petra-muted">
                  {SERVICE_TYPES.find((t) => t.id === service.type)?.label || service.type} · {service.duration} דק׳ · ₪{service.price}
                </div>
              </div>
              <span className={cn("badge text-[10px]", service.isActive ? "badge-success" : "badge-neutral")}>
                {service.isActive ? "פעיל" : "מושבת"}
              </span>
            </div>
          ))}
        </div>
      )}
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
