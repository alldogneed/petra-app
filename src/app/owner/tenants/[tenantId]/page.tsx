"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Calendar, ArrowRight, Shield, Loader2, ToggleLeft, ToggleRight, Minus, Zap } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import type { FeatureKey } from "@/lib/feature-flags";

// ─── Feature management section data ────────────────────────────────────────

const FEATURE_ROWS: { key: FeatureKey; label: string; description: string }[] = [
  { key: "gcal_sync",         label: "סנכרון יומן גוגל",         description: "חיבור Google Calendar לאימות ועדכון תורים" },
  { key: "invoicing",         label: "סליקה וחשבוניות",          description: "הפקת חשבוניות וקבלות דיגיטליות (Green Invoice / Morning)" },
  { key: "leads",             label: "מערכת לידים / CRM",        description: "קנבן לידים, מעקב מכירות ומערכת קריאה" },
  { key: "boarding",          label: "ניהול פנסיון",             description: "חדרים, לינות ויומן תפוסה (drag & drop)" },
  { key: "training",          label: "מנוע אילוף 1-על-1",        description: "תכניות אילוף, מטרות ומעקב מפגשים" },
  { key: "training_groups",   label: "סדנאות וקבוצות",           description: "ניהול קבוצות אילוף וסדנאות" },
  { key: "automations",       label: "אוטומציות הודעות",         description: "כללי שליחה אוטומטית לפי אירועים" },
  { key: "scheduled_messages",label: "תזכורות בוואטסאפ",         description: "תזכורות אוטומטיות לתורים ופעולות" },
  { key: "staff_management",  label: "ניהול צוות",               description: "הוספת משתמשים, תפקידים וניהול גישה" },
  { key: "excel_export",      label: "ייצוא לאקסל",             description: "ייצוא לקוחות, חיות ומידע לקובץ Excel" },
  { key: "service_dogs",      label: "מודול כלבי שירות",        description: "ניהול כלבי שירות, זכאים, שיבוצים ותעודות ADI" },
  { key: "groomer_portfolio", label: "תיק עבודות גרומר",        description: "גלריית לפני/אחרי לגרומר" },
];

type OverrideValue = true | false | null; // null = use tier default

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

interface TenantDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  members: TenantMember[];
  _count: { customers: number; appointments: number };
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

const TIER_LABEL: Record<string, string> = {
  basic: "בסיסי",
  pro: "מקצועי",
  enterprise: "ארגוני",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "משתמש",
};

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Local state for pending override edits
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, OverrideValue>>({});
  const [overridesDirty, setOverridesDirty] = useState(false);

  const { data: tenant, isLoading, error } = useQuery<TenantDetail>({
    queryKey: ["owner", "tenants", tenantId],
    queryFn: () => fetchJSON(`/api/owner/tenants/${tenantId}`),
  });

  const { data: featureData } = useQuery<{ tier: string; featureOverrides: Record<string, boolean> }>({
    queryKey: ["owner", "tenants", tenantId, "features"],
    queryFn: () => fetchJSON(`/api/owner/tenants/${tenantId}/features`),
    enabled: !!tenantId,
  });

  const toggleMutation = useMutation({
    mutationFn: (newStatus: string) =>
      fetchJSON(`/api/owner/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] });
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

  const setOverride = useCallback((feature: FeatureKey, value: OverrideValue) => {
    setPendingOverrides((prev) => ({ ...prev, [feature]: value }));
    setOverridesDirty(true);
  }, []);

  // Compute effective override value for a feature (pending → saved → null)
  const getOverrideValue = (feature: FeatureKey): OverrideValue => {
    if (feature in pendingOverrides) return pendingOverrides[feature];
    const saved = featureData?.featureOverrides ?? {};
    if (feature in saved) return saved[feature] as boolean;
    return null;
  };

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
        <button onClick={() => router.push("/owner/tenants")} className="btn-secondary">
          חזרה לרשימת העסקים
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/owner/tenants" className="btn-ghost p-2 rounded-lg">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{tenant.name}</h1>
            <span className={cn("badge", STATUS_BADGE[tenant.status] ?? "badge-neutral")}>
              {STATUS_LABEL[tenant.status] ?? tenant.status}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            נוצר {new Date(tenant.createdAt).toLocaleDateString("he-IL")}
          </p>
        </div>
        <button
          onClick={() =>
            toggleMutation.mutate(tenant.status === "active" ? "suspended" : "active")
          }
          disabled={toggleMutation.isPending || tenant.status === "closed"}
          className={cn(
            "text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-40",
            tenant.status === "active"
              ? "btn-danger"
              : "bg-green-50 text-green-600 hover:bg-green-100"
          )}
        >
          {toggleMutation.isPending
            ? "מעדכן..."
            : tenant.status === "active"
            ? "השהה עסק"
            : "הפעל עסק"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Details card */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 mb-4">פרטי עסק</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="label">שם</div>
              <div className="text-sm text-slate-900">{tenant.name}</div>
            </div>
            <div>
              <div className="label">חבילה</div>
              <div className="text-sm text-slate-900">{TIER_LABEL[tenant.tier] ?? tenant.tier}</div>
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

        {/* Stats card */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{tenant._count.customers}</div>
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
                <div className="text-2xl font-bold text-slate-900">{tenant._count.appointments}</div>
                <div className="text-xs text-slate-400">תורים</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Feature Management Card ─────────────────────────────────────── */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-slate-900">ניהול פיצ׳רים והרשאות</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              מנוי: <span className="font-medium text-slate-700">{featureData?.tier ?? tenant.tier}</span>
            </span>
            {overridesDirty && (
              <button
                onClick={() => saveOverridesMutation.mutate()}
                disabled={saveOverridesMutation.isPending}
                className="text-sm px-3 py-1.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {saveOverridesMutation.isPending ? "שומר..." : "שמור שינויים"}
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            עקוף את ברירת המחדל של המנוי לפיצ׳רים ספציפיים.
            <strong className="text-slate-600"> ברירת מחדל</strong> = לפי המנוי.
            <strong className="text-green-600"> פתוח</strong> = פתיחה כפויה.
            <strong className="text-red-600"> חסום</strong> = חסימה כפויה.
          </p>

          <div className="divide-y divide-slate-50">
            {FEATURE_ROWS.map(({ key, label, description }) => {
              const val = getOverrideValue(key);
              return (
                <div key={key} className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{label}</div>
                    <div className="text-xs text-slate-400">{description}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {/* Default */}
                    <button
                      onClick={() => setOverride(key, null)}
                      title="ברירת מחדל (לפי מנוי)"
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                        val === null
                          ? "bg-slate-200 text-slate-700"
                          : "text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      <Minus className="w-3 h-3" />
                      ברירת מחדל
                    </button>
                    {/* Force enable */}
                    <button
                      onClick={() => setOverride(key, true)}
                      title="פתוח (Force Enable)"
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                        val === true
                          ? "bg-green-100 text-green-700"
                          : "text-slate-400 hover:bg-green-50 hover:text-green-700"
                      )}
                    >
                      <ToggleRight className="w-3.5 h-3.5" />
                      פתוח
                    </button>
                    {/* Force disable */}
                    <button
                      onClick={() => setOverride(key, false)}
                      title="חסום (Force Disable)"
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                        val === false
                          ? "bg-red-100 text-red-700"
                          : "text-slate-400 hover:bg-red-50 hover:text-red-700"
                      )}
                    >
                      <ToggleLeft className="w-3.5 h-3.5" />
                      חסום
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {saveOverridesMutation.isError && (
            <p className="text-xs text-red-500 mt-3">שגיאה בשמירת השינויים. נסה שוב.</p>
          )}
          {saveOverridesMutation.isSuccess && !overridesDirty && (
            <p className="text-xs text-green-600 mt-3">✓ השינויים נשמרו בהצלחה</p>
          )}
        </div>
      </div>

      {/* Members table */}
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
                        <Link
                          href={`/owner/users/${member.user.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                        >
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
                    <span className={cn(
                      "badge",
                      member.user.isActive ? "badge-success" : "badge-danger"
                    )}>
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
