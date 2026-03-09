"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Calendar, ArrowRight, Shield, Loader2,
  ToggleLeft, ToggleRight, Minus, Zap, Check, X,
  ChevronDown, RotateCcw, LogIn, Clock, CreditCard,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { type FeatureKey, type TierKey, hasFeature } from "@/lib/feature-flags";

// ─── Tier definitions ────────────────────────────────────────────────────────

const TIERS: { key: TierKey; label: string; price: string; color: string }[] = [
  { key: "free",        label: "Free (חינמי)",       price: "₪0",   color: "bg-slate-100 text-slate-600 border-slate-300" },
  { key: "basic",       label: "Basic",              price: "₪99",  color: "bg-blue-50 text-blue-700 border-blue-300" },
  { key: "groomer",     label: "Groomer+",           price: "₪169", color: "bg-pink-50 text-pink-700 border-pink-300" },
  { key: "pro",         label: "Pro",                price: "₪199", color: "bg-violet-50 text-violet-700 border-violet-300" },
  { key: "service_dog", label: "Service Dog",        price: "₪229", color: "bg-amber-50 text-amber-700 border-amber-300" },
];

// ─── Feature rows ─────────────────────────────────────────────────────────────

const FEATURE_ROWS: { key: FeatureKey; label: string; description: string }[] = [
  { key: "gcal_sync",          label: "סנכרון יומן גוגל",     description: "חיבור Google Calendar לאימות ועדכון תורים" },
  { key: "payments",           label: "תשלומים",              description: "קישורי תשלום, סליקה" },
  { key: "invoicing",          label: "חשבוניות",             description: "הפקת חשבוניות וקבלות (Green Invoice / Morning)" },
  { key: "scheduled_messages", label: "תזכורות בוואטסאפ",    description: "תזכורות אוטומטיות לתורים" },
  { key: "automations",        label: "אוטומציות הודעות",     description: "כללי שליחה אוטומטית לפי אירועים" },
  { key: "custom_messages",    label: "הודעות מותאמות",       description: "תבניות הודעה מותאמות אישית" },
  { key: "training",           label: "אילוף 1-על-1",         description: "תכניות אילוף, מטרות ומעקב מפגשים" },
  { key: "training_groups",    label: "קבוצות וסדנאות",       description: "ניהול קבוצות אילוף וסדנאות" },
  { key: "boarding",           label: "פנסיון",               description: "חדרים, לינות ויומן תפוסה (drag & drop)" },
  { key: "leads",              label: "CRM / לידים",          description: "קנבן לידים ומעקב מכירות" },
  { key: "staff_management",   label: "ניהול עובדים",         description: "הוספת משתמשים, תפקידים וניהול גישה" },
  { key: "excel_export",       label: "ייצוא לאקסל",         description: "ייצוא לקוחות וחיות ל-Excel" },
  { key: "groomer_portfolio",  label: "תיק עבודות גרומר",    description: "גלריית לפני/אחרי לגרומר" },
  { key: "service_dogs",       label: "מודול כלבי שירות",    description: "ניהול כלבי שירות, זכאים, שיבוצים ו-ADI" },
];

type OverrideValue = true | false | null; // null = use tier default

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantMember {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    platformRole: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

interface TenantStats {
  customerCount: number;
  monthlyAppointments: number;
  monthlyRevenue: number;
  lastSeenAt: string | null;
}

interface TenantDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  status: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  members: TenantMember[];
  _count: { customers: number; appointments: number };
  stats?: TenantStats;
}

// ─── Small components ─────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const t = TIERS.find((t) => t.key === tier);
  if (!t) return <span className="text-xs text-slate-500">{tier}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", t.color)}>
      {t.label}
      <span className="opacity-60">{t.price}</span>
    </span>
  );
}

function EffectiveBadge({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-green-600">
      <Check className="w-3 h-3" /> פעיל
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400">
      <X className="w-3 h-3" /> חסום
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  suspended: "מושהה",
  closed: "סגור",
};

const STATUS_BADGE: Record<string, string> = {
  active: "badge-success",
  suspended: "badge-danger",
  closed: "badge-neutral",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "משתמש",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [pendingOverrides, setPendingOverrides] = useState<Record<string, OverrideValue>>({});
  const [overridesDirty, setOverridesDirty] = useState(false);
  const [tierSelectOpen, setTierSelectOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: tenant, isLoading, error } = useQuery<TenantDetail>({
    queryKey: ["owner", "tenants", tenantId],
    queryFn: () => fetchJSON(`/api/owner/tenants/${tenantId}`),
  });

  const { data: featureData } = useQuery<{ tier: string; featureOverrides: Record<string, boolean> }>({
    queryKey: ["owner", "tenants", tenantId, "features"],
    queryFn: () => fetchJSON(`/api/owner/tenants/${tenantId}/features`),
    enabled: !!tenantId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const patchTenantMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchJSON(`/api/owner/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants", tenantId, "features"] });
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] });
      setTierSelectOpen(false);
    },
  });

  const saveOverridesMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/owner/tenants/${tenantId}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: pendingOverrides }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants", tenantId, "features"] });
      setPendingOverrides({});
      setOverridesDirty(false);
    },
  });

  const setTrialMutation = useMutation({
    mutationFn: (trialEndsAt: string | null) =>
      fetchJSON(`/api/owner/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialEndsAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants", tenantId] });
    },
  });

  const setSubscriptionMutation = useMutation({
    mutationFn: (subscriptionEndsAt: string | null) =>
      fetchJSON(`/api/owner/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionEndsAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants", tenantId] });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/owner/tenants/${tenantId}/impersonate`, {
        method: "POST",
      }),
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
  });

  // ── Override helpers ──────────────────────────────────────────────────────────
  const setOverride = useCallback((feature: FeatureKey, value: OverrideValue) => {
    setPendingOverrides((prev) => ({ ...prev, [feature]: value }));
    setOverridesDirty(true);
  }, []);

  const clearAllOverrides = useCallback(() => {
    const reset: Record<string, OverrideValue> = {};
    const saved = featureData?.featureOverrides ?? {};
    for (const key of Object.keys(saved)) reset[key] = null;
    setPendingOverrides(reset);
    setOverridesDirty(true);
  }, [featureData]);

  const getOverrideValue = (feature: FeatureKey): OverrideValue => {
    if (feature in pendingOverrides) return pendingOverrides[feature];
    const saved = featureData?.featureOverrides ?? {};
    if (feature in saved) return saved[feature] as boolean;
    return null;
  };

  const getEffective = (feature: FeatureKey): boolean => {
    const override = getOverrideValue(feature);
    if (override !== null) return override;
    return hasFeature(featureData?.tier ?? tenant?.tier, feature);
  };

  // ── Trial helpers ─────────────────────────────────────────────────────────────
  const trialEndsAt = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  const trialActive = trialEndsAt && trialEndsAt > new Date();
  const trialExpired = trialEndsAt && trialEndsAt <= new Date();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : 0;

  function addTrialDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setTrialMutation.mutate(d.toISOString());
  }

  // ── Subscription helpers ──────────────────────────────────────────────────────
  const subEndsAt = tenant?.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt) : null;
  const subActive = subEndsAt !== null && subEndsAt > new Date();
  const subExpired = subEndsAt !== null && subEndsAt <= new Date();
  const subDaysLeft = subEndsAt
    ? Math.max(0, Math.ceil((subEndsAt.getTime() - Date.now()) / 86400000))
    : 0;

  function addSubMonths(months: number) {
    // Extend from current end date if still active, otherwise from today
    const base = subActive && subEndsAt ? new Date(subEndsAt) : new Date();
    base.setMonth(base.getMonth() + months);
    setSubscriptionMutation.mutate(base.toISOString());
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const activeTier = (featureData?.tier ?? tenant?.tier ?? "free") as TierKey;
  const savedOverrides = featureData?.featureOverrides ?? {};
  const activeOverridesCount = Object.keys(savedOverrides).length;

  // ── Loading / error ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error || !tenant) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 mb-4">שגיאה בטעינת פרטי העסק</p>
        <button onClick={() => router.push("/owner/tenants")} className="btn-secondary">חזרה לרשימת העסקים</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/owner/tenants" className="btn-ghost p-2 rounded-lg">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{tenant.name}</h1>
            <span className={cn("badge", STATUS_BADGE[tenant.status] ?? "badge-neutral")}>
              {STATUS_LABEL[tenant.status] ?? tenant.status}
            </span>
            <TierBadge tier={activeTier} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            נוצר {new Date(tenant.createdAt).toLocaleDateString("he-IL")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Impersonate button — super_admin only */}
          <button
            onClick={() => {
              impersonateMutation.mutate();
            }}
            disabled={impersonateMutation.isPending || tenant.status === "closed"}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40"
            title="כנס כעסק (impersonation)"
          >
            {impersonateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            כנס כעסק
          </button>
          <button
            onClick={() => patchTenantMutation.mutate({ status: tenant.status === "active" ? "suspended" : "active" })}
            disabled={patchTenantMutation.isPending || tenant.status === "closed"}
            className={cn(
              "text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-40",
              tenant.status === "active" ? "btn-danger" : "bg-green-50 text-green-600 hover:bg-green-100"
            )}
          >
            {patchTenantMutation.isPending ? "מעדכן..." : tenant.status === "active" ? "השהה עסק" : "הפעל עסק"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Details + Tier selector ──────────────────────────────────────── */}
        <div className="card p-5 lg:col-span-2 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900 mb-4">פרטי עסק</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="label">שם</div>
                <div className="text-sm text-slate-900">{tenant.name}</div>
              </div>
              <div>
                <div className="label">מייל</div>
                <div className="text-sm text-slate-900" dir="ltr">{tenant.email ?? "—"}</div>
              </div>
              <div>
                <div className="label">טלפון</div>
                <div className="text-sm text-slate-900" dir="ltr">{tenant.phone ?? "—"}</div>
              </div>
            </div>
          </div>

          {/* ── Tier selector ──────────────────────────────────────────────── */}
          <div>
            <div className="label mb-2">מנוי נוכחי</div>
            <div className="relative inline-block">
              <button
                onClick={() => setTierSelectOpen((p) => !p)}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:border-slate-300 bg-white transition-colors text-sm"
              >
                <TierBadge tier={activeTier} />
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {tierSelectOpen && (
                <div className="absolute top-full mt-1 right-0 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20 min-w-[200px]">
                  {TIERS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => patchTenantMutation.mutate({ tier: t.key })}
                      disabled={patchTenantMutation.isPending}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors",
                        t.key === activeTier && "bg-orange-50"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0 border", t.color)} />
                      <span className="font-medium flex-1 text-right">{t.label}</span>
                      <span className="text-xs text-slate-400">{t.price}</span>
                      {t.key === activeTier && <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {patchTenantMutation.isPending && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> שומר...
              </p>
            )}
            {patchTenantMutation.isSuccess && !tierSelectOpen && (
              <p className="text-xs text-green-600 mt-1">✓ המנוי עודכן</p>
            )}
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{tenant.stats?.customerCount ?? tenant._count.customers}</div>
                <div className="text-xs text-slate-400">לקוחות</div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{tenant.stats?.monthlyAppointments ?? 0}</div>
                <div className="text-xs text-slate-400">תורים החודש</div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">₪{(tenant.stats?.monthlyRevenue ?? 0).toLocaleString()}</div>
                <div className="text-xs text-slate-400">הכנסה החודש</div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-400 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {tenant.stats?.lastSeenAt
                    ? new Date(tenant.stats.lastSeenAt).toLocaleDateString("he-IL")
                    : "—"}
                </div>
                <div className="text-xs text-slate-400">כניסה אחרונה</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trial Management ──────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-900">ניסיון חינמי</h2>
          {trialActive && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              פעיל — {trialDaysLeft} ימים נותרו
            </span>
          )}
          {trialExpired && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">פג תוקף</span>
          )}
          {!trialEndsAt && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ללא ניסיון</span>
          )}
        </div>
        {trialEndsAt && (
          <p className="text-sm text-slate-500 mb-4">
            תאריך סיום: {trialEndsAt.toLocaleDateString("he-IL")}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => addTrialDays(14)}
            disabled={setTrialMutation.isPending}
            className="text-sm px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors disabled:opacity-40"
          >
            הגדר ניסיון 14 יום
          </button>
          <button
            onClick={() => addTrialDays(30)}
            disabled={setTrialMutation.isPending}
            className="text-sm px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors disabled:opacity-40"
          >
            הגדר ניסיון 30 יום
          </button>
          <button
            onClick={() => setTrialMutation.mutate(new Date().toISOString())}
            disabled={setTrialMutation.isPending || !trialEndsAt}
            className="text-sm px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-40"
          >
            סיים מיידית
          </button>
          <button
            onClick={() => setTrialMutation.mutate(null)}
            disabled={setTrialMutation.isPending || !trialEndsAt}
            className="text-sm px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors disabled:opacity-40"
          >
            הסר ניסיון
          </button>
          {setTrialMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {setTrialMutation.isSuccess && <span className="text-xs text-green-600">✓ עודכן</span>}
        </div>
      </div>

      {/* ── Subscription Management ────────────────────────────────────────── */}
      {activeTier !== "free" && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-green-600" />
            <h2 className="font-semibold text-slate-900">מנוי שנתי</h2>
            {subActive && subDaysLeft > 14 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                פעיל — {subDaysLeft} ימים נותרו
              </span>
            )}
            {subActive && subDaysLeft <= 14 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                ⚠️ פחות מ-14 יום!
              </span>
            )}
            {subExpired && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">פג תוקף</span>
            )}
            {!subEndsAt && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ללא מנוי פעיל</span>
            )}
          </div>
          {subEndsAt && (
            <p className="text-sm text-slate-500 mb-4">
              תאריך סיום: {subEndsAt.toLocaleDateString("he-IL")}
              {subActive && subDaysLeft <= 14 && (
                <span className="mr-2 text-amber-600 font-medium">({subDaysLeft} ימים נותרו)</span>
              )}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => addSubMonths(1)}
              disabled={setSubscriptionMutation.isPending}
              className="text-sm px-3 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-40"
            >
              +1 חודש
            </button>
            <button
              onClick={() => addSubMonths(6)}
              disabled={setSubscriptionMutation.isPending}
              className="text-sm px-3 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-40"
            >
              +6 חודשים
            </button>
            <button
              onClick={() => addSubMonths(12)}
              disabled={setSubscriptionMutation.isPending}
              className="text-sm px-3 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors disabled:opacity-40"
            >
              +שנה
            </button>
            <button
              onClick={() => setSubscriptionMutation.mutate(new Date().toISOString())}
              disabled={setSubscriptionMutation.isPending || !subEndsAt}
              className="text-sm px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-40"
            >
              סיים מיידית
            </button>
            <button
              onClick={() => setSubscriptionMutation.mutate(null)}
              disabled={setSubscriptionMutation.isPending || !subEndsAt}
              className="text-sm px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors disabled:opacity-40"
            >
              הסר מנוי
            </button>
            {setSubscriptionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            {setSubscriptionMutation.isSuccess && <span className="text-xs text-green-600">✓ עודכן</span>}
          </div>
        </div>
      )}

      {/* ── Feature Management ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-slate-900">ניהול פיצ׳רים</h2>
            {activeOverridesCount > 0 && (
              <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {activeOverridesCount} חריגות פעילות
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeOverridesCount > 0 && !overridesDirty && (
              <button
                onClick={clearAllOverrides}
                className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                אפס הכל
              </button>
            )}
            {overridesDirty && (
              <button
                onClick={() => saveOverridesMutation.mutate()}
                disabled={saveOverridesMutation.isPending}
                className="text-sm px-4 py-1.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saveOverridesMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> שומר...</>
                ) : (
                  "שמור שינויים"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-6 text-[11px] text-slate-500">
          <span><strong className="text-slate-700">ברירת מחדל</strong> = לפי המנוי</span>
          <span className="text-green-600 font-semibold">פתוח = Override פתיחה כפויה</span>
          <span className="text-red-600 font-semibold">חסום = Override חסימה כפויה</span>
        </div>

        {/* Column headers */}
        <div className="hidden md:grid md:grid-cols-[1fr_90px_160px_80px] px-5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide gap-4">
          <span>פיצ׳ר</span>
          <span className="text-center">ברירת מחדל<br/><span className="font-normal normal-case">(לפי {TIERS.find(t=>t.key===activeTier)?.label})</span></span>
          <span className="text-center">Override</span>
          <span className="text-center">בפועל</span>
        </div>

        {/* Feature rows */}
        <div className="divide-y divide-slate-50">
          {FEATURE_ROWS.map(({ key, label, description }) => {
            const tierDefault = hasFeature(activeTier, key);
            const override = getOverrideValue(key);
            const effective = getEffective(key);
            const hasOverride = override !== null;

            return (
              <div
                key={key}
                className={cn(
                  "grid grid-cols-1 md:grid-cols-[1fr_90px_160px_80px] items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors",
                  hasOverride && "bg-orange-50/30"
                )}
              >
                {/* Name + description */}
                <div>
                  <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    {label}
                    {hasOverride && (
                      <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold">override</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{description}</div>
                </div>

                {/* Tier default */}
                <div className="flex justify-center">
                  {tierDefault ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-600">
                      <Check className="w-3 h-3" /> כלול
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-400">
                      <X className="w-3 h-3" /> לא כלול
                    </span>
                  )}
                </div>

                {/* Override buttons */}
                <div className="flex gap-1 justify-center">
                  <button
                    onClick={() => setOverride(key, null)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors",
                      override === null ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    <Minus className="w-3 h-3" /> ברירת מחדל
                  </button>
                  <button
                    onClick={() => setOverride(key, true)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors",
                      override === true ? "bg-green-100 text-green-700" : "text-slate-400 hover:bg-green-50 hover:text-green-700"
                    )}
                  >
                    <ToggleRight className="w-3.5 h-3.5" /> פתוח
                  </button>
                  <button
                    onClick={() => setOverride(key, false)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors",
                      override === false ? "bg-red-100 text-red-700" : "text-slate-400 hover:bg-red-50 hover:text-red-700"
                    )}
                  >
                    <ToggleLeft className="w-3.5 h-3.5" /> חסום
                  </button>
                </div>

                {/* Effective */}
                <div className="flex justify-center">
                  <EffectiveBadge on={effective} />
                </div>
              </div>
            );
          })}
        </div>

        {saveOverridesMutation.isError && (
          <div className="px-5 py-3 text-xs text-red-500 border-t border-red-50 bg-red-50/50">
            שגיאה בשמירת השינויים. נסה שוב.
          </div>
        )}
        {saveOverridesMutation.isSuccess && !overridesDirty && (
          <div className="px-5 py-3 text-xs text-green-600 border-t border-green-50 bg-green-50/50">
            ✓ השינויים נשמרו בהצלחה
          </div>
        )}
      </div>

      {/* ── Members table ─────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">חברי צוות ({tenant.members.length})</h2>
        </div>
        {tenant.members.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">אין חברי צוות</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header-cell">משתמש</th>
                <th className="table-header-cell">תפקיד</th>
                <th className="table-header-cell">תפקיד פלטפורמה</th>
                <th className="table-header-cell">מצב</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tenant.members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold flex-shrink-0">
                        {member.user.name.charAt(0)}
                      </div>
                      <div>
                        <Link href={`/owner/users/${member.user.id}`} className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors">
                          {member.user.name}
                        </Link>
                        <div className="text-xs text-slate-400">{member.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-neutral">{ROLE_LABEL[member.role] ?? member.role}</span>
                  </td>
                  <td className="table-cell">
                    {member.user.platformRole ? (
                      <span className="flex items-center gap-1 text-xs text-orange-600">
                        <Shield className="w-3.5 h-3.5" />
                        {member.user.platformRole.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={cn("badge", member.user.isActive ? "badge-success" : "badge-danger")}>
                      {member.user.isActive ? "פעיל" : "חסום"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
