"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Shield, Building2, UserCheck, UserX, Loader2, Check, Minus } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";
import { type FeatureKey, type TierKey, hasFeature } from "@/lib/feature-flags";

// ─── Feature panel definitions ────────────────────────────────────────────────

const TIERS: { key: TierKey; label: string; price: string }[] = [
  // Public tiers
  { key: "free",        label: "Free (חינמי)",           price: "₪0"   },
  { key: "basic",       label: "Basic",                  price: "₪99"  },
  { key: "pro",         label: "Pro",                    price: "₪199" },
  // Enterprise / legacy
  { key: "service_dog", label: "Service Dog (ארגוני)",   price: "₪229" },
  { key: "groomer",     label: "Groomer+ (legacy)",      price: "₪169" },
];

const FEATURE_ROWS: { key: FeatureKey; label: string }[] = [
  { key: "gcal_sync",          label: "סנכרון גוגל"       },
  { key: "payments",           label: "תשלומים"           },
  { key: "invoicing",          label: "חשבוניות"          },
  { key: "scheduled_messages", label: "תזכורות WhatsApp"  },
  { key: "automations",        label: "אוטומציות"         },
  { key: "custom_messages",    label: "הודעות מותאמות"    },
  { key: "training",           label: "אילוף 1-על-1"      },
  { key: "training_groups",    label: "קבוצות וסדנאות"    },
  { key: "boarding",           label: "פנסיון"            },
  { key: "leads",              label: "CRM / לידים"       },
  { key: "staff_management",   label: "ניהול עובדים"      },
  { key: "excel_export",       label: "ייצוא Excel"       },
  { key: "groomer_portfolio",  label: "תיק עבודות לפני/אחרי" },
  { key: "service_dogs",       label: "כלבי שירות"        },
];

type OverrideValue = true | false | null;

interface BusinessInfo {
  id: string;
  name: string;
  status: string;
  tier: string;
  featureOverrides: Record<string, boolean> | null;
}

interface BusinessMembership {
  id: string;
  role: string;
  isActive: boolean;
  business: BusinessInfo;
}

interface UserDetail {
  id: string;
  email: string;
  name: string;
  platformRole: string | null;
  isActive: boolean;
  twoFaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  businessMemberships: BusinessMembership[];
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "סופר אדמין",
  admin: "אדמין",
  support: "תמיכה",
};

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "משתמש",
};

const BIZ_STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  suspended: "מושהה",
  closed: "סגור",
};

// ─── FeaturePanel ─────────────────────────────────────────────────────────────

function FeaturePanel({ business, onRefresh }: { business: BusinessInfo; onRefresh: () => void }) {
  const overrides = (business.featureOverrides as Record<string, boolean> | null) ?? {};
  const overrideCount = Object.keys(overrides).length;

  const tierMutation = useMutation({
    mutationFn: (tier: string) =>
      fetchJSON(`/api/owner/tenants/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      }),
    onSuccess: onRefresh,
  });

  const overrideMutation = useMutation({
    mutationFn: (newOverrides: Record<string, boolean>) =>
      fetchJSON(`/api/owner/tenants/${business.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: newOverrides }),
      }),
    onSuccess: onRefresh,
  });

  function setOverride(feature: FeatureKey, value: OverrideValue) {
    const next = { ...overrides };
    if (value === null) {
      delete next[feature];
    } else {
      next[feature] = value;
    }
    overrideMutation.mutate(next);
  }

  function resetAll() {
    overrideMutation.mutate({});
  }

  return (
    <div className="space-y-4">
      {/* Tier selector */}
      <div>
        <label className="label mb-1">מנוי</label>
        <div className="flex items-center gap-3">
          <select
            value={business.tier}
            onChange={(e) => tierMutation.mutate(e.target.value)}
            disabled={tierMutation.isPending}
            className="input flex-1"
          >
            {TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} — {t.price}/חודש
              </option>
            ))}
          </select>
          {tierMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {tierMutation.isSuccess && <Check className="w-4 h-4 text-green-500" />}
        </div>
      </div>

      {/* Feature overrides */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">פיצ׳רים</label>
          {overrideCount > 0 && (
            <button
              onClick={resetAll}
              disabled={overrideMutation.isPending}
              className="text-xs text-orange-600 hover:text-orange-700 underline"
            >
              אפס הכל ({overrideCount})
            </button>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-200">
            <div>פיצ׳ר</div>
            <div className="text-center">ברירת מנוי</div>
            <div className="text-center">עקיפה</div>
            <div className="text-center">בפועל</div>
          </div>

          {FEATURE_ROWS.map(({ key, label }) => {
            const tierDefault = hasFeature(business.tier, key);
            const override = key in overrides ? overrides[key] : null;
            const effective = override !== null ? override : tierDefault;
            const hasOverride = override !== null;

            return (
              <div
                key={key}
                className={cn(
                  "grid grid-cols-4 items-center px-3 py-2 border-b border-slate-100 last:border-0",
                  hasOverride ? "bg-orange-50/40" : "hover:bg-slate-50/50"
                )}
              >
                {/* Label */}
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  {label}
                  {hasOverride && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-700">
                      OR
                    </span>
                  )}
                </div>

                {/* Tier default */}
                <div className="flex justify-center">
                  {tierDefault ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Minus className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                {/* Override 3-state button */}
                <div className="flex justify-center">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[10px] font-medium">
                    <button
                      onClick={() => setOverride(key, null)}
                      disabled={overrideMutation.isPending}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        override === null
                          ? "bg-slate-600 text-white"
                          : "bg-white text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      ברירה
                    </button>
                    <button
                      onClick={() => setOverride(key, true)}
                      disabled={overrideMutation.isPending}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        override === true
                          ? "bg-green-500 text-white"
                          : "bg-white text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setOverride(key, false)}
                      disabled={overrideMutation.isPending}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        override === false
                          ? "bg-red-500 text-white"
                          : "bg-white text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      ✗
                    </button>
                  </div>
                </div>

                {/* Effective */}
                <div className="flex justify-center">
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded",
                    effective ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                  )}>
                    {effective ? "פעיל" : "חסום"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {overrideMutation.isPending && (
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> שומר...
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<UserDetail>({
    queryKey: ["owner", "users", userId],
    queryFn: () => fetchJSON(`/api/owner/users/${userId}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      fetchJSON(`/api/owner/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "users", userId] });
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: (platformRole: string | null) =>
      fetchJSON(`/api/owner/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformRole }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "users", userId] });
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
    },
  });

  function refetchDetail() {
    queryClient.invalidateQueries({ queryKey: ["owner", "users", userId] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 mb-4">שגיאה בטעינת פרטי המשתמש</p>
        <button onClick={() => router.push("/owner/users")} className="btn-secondary">
          חזרה לרשימת המשתמשים
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/owner/users" className="btn-ghost p-2 rounded-lg">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{user.name}</h1>
            <span className={cn("badge", user.isActive ? "badge-success" : "badge-danger")}>
              {user.isActive ? "פעיל" : "חסום"}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">{user.email}</p>
        </div>
        <button
          onClick={() => toggleMutation.mutate(!user.isActive)}
          disabled={toggleMutation.isPending}
          className={cn(
            "text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-40 flex items-center gap-2",
            user.isActive ? "btn-danger" : "bg-green-50 text-green-600 hover:bg-green-100"
          )}
        >
          {user.isActive ? (
            <><UserX className="w-4 h-4" /> {toggleMutation.isPending ? "חוסם..." : "חסום משתמש"}</>
          ) : (
            <><UserCheck className="w-4 h-4" /> {toggleMutation.isPending ? "מבטל חסימה..." : "בטל חסימה"}</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Details */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">פרטי משתמש</h2>
          <div className="space-y-3">
            <div>
              <div className="label">שם</div>
              <div className="text-sm text-slate-900">{user.name}</div>
            </div>
            <div>
              <div className="label">מייל</div>
              <div className="text-sm text-slate-900" dir="ltr">{user.email}</div>
            </div>
            <div>
              <div className="label">2FA</div>
              <div className="text-sm">
                {user.twoFaEnabled ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Shield className="w-3.5 h-3.5" /> מופעל
                  </span>
                ) : (
                  <span className="text-slate-400">לא מופעל</span>
                )}
              </div>
            </div>
            <div>
              <div className="label">נוצר</div>
              <div className="text-sm text-slate-900">{new Date(user.createdAt).toLocaleDateString("he-IL")}</div>
            </div>
            <div>
              <div className="label">עודכן לאחרונה</div>
              <div className="text-sm text-slate-900">{new Date(user.updatedAt).toLocaleDateString("he-IL")}</div>
            </div>
          </div>
        </div>

        {/* Role management */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">תפקיד פלטפורמה</h2>
          <div className="mb-3">
            <div className="label">תפקיד נוכחי</div>
            {user.platformRole ? (
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded",
                user.platformRole === "super_admin" ? "bg-red-100 text-red-700" :
                user.platformRole === "admin" ? "bg-orange-100 text-orange-700" :
                "bg-blue-100 text-blue-700"
              )}>
                {ROLE_LABEL[user.platformRole] ?? user.platformRole}
              </span>
            ) : (
              <span className="text-sm text-slate-400">ללא תפקיד פלטפורמה</span>
            )}
          </div>
          <div>
            <div className="label mb-1">שנה תפקיד</div>
            <select
              defaultValue={user.platformRole ?? ""}
              onChange={(e) => roleMutation.mutate(e.target.value || null)}
              disabled={roleMutation.isPending}
              className="input w-full"
            >
              <option value="">ללא תפקיד</option>
              <option value="super_admin">סופר אדמין</option>
              <option value="admin">אדמין</option>
              <option value="support">תמיכה</option>
            </select>
            {roleMutation.isPending && <p className="text-xs text-slate-400 mt-1">מעדכן תפקיד...</p>}
            {roleMutation.error && <p className="text-xs text-red-600 mt-1">{(roleMutation.error as Error).message}</p>}
          </div>
        </div>
      </div>

      {/* Subscription & Features per business */}
      {user.businessMemberships.length > 0 && (
        <div className="mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900">מנוי ופיצ׳רים לפי עסק</h2>
          {user.businessMemberships.map((membership) => (
            <div key={membership.id} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <Link
                    href={`/owner/tenants/${membership.business.id}`}
                    className="font-semibold text-slate-900 hover:text-orange-600 transition-colors"
                  >
                    {membership.business.name}
                  </Link>
                  <div className="text-xs text-slate-400">
                    {MEMBER_ROLE_LABEL[membership.role] ?? membership.role} ·{" "}
                    {BIZ_STATUS_LABEL[membership.business.status] ?? membership.business.status}
                  </div>
                </div>
              </div>
              <FeaturePanel business={membership.business} onRefresh={refetchDetail} />
            </div>
          ))}
        </div>
      )}

      {/* Business memberships summary (when no subscription features — free/no business) */}
      {user.businessMemberships.length === 0 && (
        <div className="card p-5 text-center text-slate-400 text-sm">
          לא משויך לעסקים
        </div>
      )}
    </div>
  );
}
