"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Shield, Building2, UserCheck, UserX, Loader2, Check, Minus, AlertTriangle, Trash2, X } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";
import { type FeatureKey, type TierKey, hasFeature } from "@/lib/feature-flags";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { toast } from "sonner";
import { TIER_LABELS, PLATFORM_ROLE_LABELS } from "@/lib/platform-labels";

// ─── Feature panel definitions ────────────────────────────────────────────────

const TIERS: { key: TierKey; price: string; note?: string }[] = [
  // Public tiers
  { key: "free",        price: "₪0"   },
  { key: "basic",       price: "₪99"  },
  { key: "pro",         price: "₪199" },
  // Enterprise / legacy
  { key: "service_dog", price: "₪229", note: "ארגוני" },
  { key: "groomer",     price: "₪169", note: "ישן" },
];

function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? "מסלול אחר";
}

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

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "משתמש",
  staff: "איש צוות",
  volunteer: "מתנדב",
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
            {!TIERS.some((t) => t.key === business.tier) && (
              <option value={business.tier}>{tierLabel(business.tier)}</option>
            )}
            {TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {tierLabel(t.key)}{t.note ? ` (${t.note})` : ""} — {t.price}/חודש
              </option>
            ))}
          </select>
          {tierMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
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

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <div className="min-w-[440px]">
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
                          : "bg-white text-slate-500 hover:bg-slate-50"
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
                          : "bg-white text-slate-500 hover:bg-slate-50"
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
                          : "bg-white text-slate-500 hover:bg-slate-50"
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
                    effective ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {effective ? "פעיל" : "חסום"}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {overrideMutation.isPending && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
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
  const [showBlock, setShowBlock] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

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
    onSuccess: (_res, isActive) => {
      toast.success(isActive ? "החסימה בוטלה" : "המשתמש נחסם והסשנים שלו נותקו");
      setShowBlock(false);
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
    },
    onError: (err: Error) => toast.error(err.message || "הפעולה נכשלה"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetchJSON(`/api/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("המשתמש נמחק לצמיתות");
      queryClient.removeQueries({ queryKey: ["owner", "users", userId] });
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
      router.push("/owner/users");
    },
    onError: (err: Error) => toast.error(err.message || "מחיקת המשתמש נכשלה"),
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
    return <PetraLoader />;
  }

  if (error || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">שגיאה בטעינת פרטי המשתמש</p>
        <button onClick={() => router.push("/owner/users")} className="btn-secondary">
          חזרה לרשימת המשתמשים
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/owner/users" className="btn-ghost p-2 rounded-lg" aria-label="חזרה לרשימת המשתמשים" title="חזרה לרשימת המשתמשים">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{user.name}</h1>
            <span className={cn("badge", user.isActive ? "badge-success" : "badge-danger")}>
              {user.isActive ? "פעיל" : "חסום"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 break-all">{user.email}</p>
        </div>
        <button
          onClick={() => (user.isActive ? setShowBlock(true) : toggleMutation.mutate(true))}
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
                  <span className="text-slate-500">לא מופעל</span>
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
                {PLATFORM_ROLE_LABELS[user.platformRole] ?? "תפקיד אחר"}
              </span>
            ) : (
              <span className="text-sm text-slate-500">ללא תפקיד פלטפורמה</span>
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
              {Object.entries(PLATFORM_ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {roleMutation.isPending && <p className="text-xs text-slate-500 mt-1">מעדכן תפקיד...</p>}
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
                  <div className="text-xs text-slate-500">
                    {MEMBER_ROLE_LABEL[membership.role] ?? "חבר צוות"} ·{" "}
                    {BIZ_STATUS_LABEL[membership.business.status] ?? "מצב לא ידוע"} ·{" "}
                    מסלול {tierLabel(membership.business.tier)}
                    {!membership.isActive && " · חברות לא פעילה"}
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
        <div className="card p-5 mb-6 text-center text-slate-500 text-sm">
          המשתמש לא משויך לאף עסק, ולכן אין מנוי או פיצ׳רים לניהול.
        </div>
      )}

      {/* Danger zone */}
      <div className="card p-5 border border-red-200">
        <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> אזור מסוכן
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            מחיקת המשתמש היא פעולה בלתי הפיכה. החשבון והגישה שלו לכל העסקים יימחקו לצמיתות.
          </p>
          <button
            onClick={() => { setConfirmEmail(""); setShowDelete(true); }}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> מחק משתמש לצמיתות
          </button>
        </div>
      </div>

      {/* Block confirmation */}
      {showBlock && (
        <div className="modal-overlay" onClick={toggleMutation.isPending ? undefined : () => setShowBlock(false)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-label="אישור חסימת משתמש"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">לחסום את {user.name || user.email}?</h2>
                <p className="text-xs text-slate-500 mt-0.5 break-all" dir="ltr" style={{ textAlign: "right" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              המשתמש לא יוכל להתחבר למערכת, וכל הסשנים הפעילים שלו ינותקו מיד. אפשר לבטל את החסימה בכל עת.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowBlock(false)}
                disabled={toggleMutation.isPending}
                className="btn-secondary flex-1 disabled:opacity-40"
              >
                ביטול
              </button>
              <button
                onClick={() => toggleMutation.mutate(false)}
                disabled={toggleMutation.isPending}
                className="btn-danger flex-1 justify-center disabled:opacity-40"
              >
                {toggleMutation.isPending ? "חוסם..." : "חסום משתמש"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — requires typing the user's email */}
      {showDelete && (
        <div className="modal-overlay" onClick={deleteMutation.isPending ? undefined : () => setShowDelete(false)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-label="אישור מחיקת משתמש"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">מחיקת {user.name || user.email} לצמיתות</h2>
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleteMutation.isPending}
                className="btn-ghost p-1 rounded-lg"
                aria-label="סגור"
                title="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-700 mb-3">
              הפעולה אינה ניתנת לביטול. החשבון, הסשנים והחברות של המשתמש בכל העסקים יימחקו.
              כדי לאשר, הקלידו את כתובת המייל של המשתמש:
            </p>
            <p className="text-sm font-medium text-slate-900 mb-2 break-all" dir="ltr" style={{ textAlign: "right" }}>
              {user.email}
            </p>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="input w-full"
              dir="ltr"
              autoComplete="off"
              aria-label="הקלדת כתובת המייל לאישור המחיקה"
              placeholder={user.email}
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleteMutation.isPending}
                className="btn-secondary flex-1 disabled:opacity-40"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={
                  deleteMutation.isPending ||
                  confirmEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
                }
                className="btn-danger flex-1 justify-center disabled:opacity-40"
              >
                {deleteMutation.isPending ? "מוחק..." : "מחק לצמיתות"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
