"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Plus, X, ChevronDown, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchJSON, cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { TIER_LABELS } from "@/lib/platform-labels";

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  status: string;
  createdAt: string;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  owner: { id: string; name: string; email: string; lastLoginAt: string | null } | null;
  isTest: boolean;
  _count: { members: number };
}

interface TenantsResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
  includeTest: boolean;
  testCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "badge-success",
  suspended: "badge-danger",
  closed: "badge-neutral",
};

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  suspended: "מושהה",
  closed: "סגור",
};

const VALID_STATUSES = ["active", "suspended", "closed"];

/** dd.MM.yy */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

/** Relative Hebrew time ("לפני 3 ימים"); "מעולם לא" when null. */
function relativeHe(iso: string | null): string {
  if (!iso) return "מעולם לא";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return minutes === 1 ? "לפני דקה" : `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : hours === 2 ? "לפני שעתיים" : `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "אתמול";
  if (days === 2) return "לפני יומיים";
  if (days < 30) return `לפני ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "לפני חודש" : months === 2 ? "לפני חודשיים" : `לפני ${months} חודשים`;
  const years = Math.floor(days / 365) || 1;
  return years === 1 ? "לפני שנה" : years === 2 ? "לפני שנתיים" : `לפני ${years} שנים`;
}

/** Secondary line under the tier badge: paid-until or trial-until. */
function subscriptionLine(t: Tenant): string | null {
  if (t.subscriptionStatus === "active" && t.subscriptionEndsAt) {
    return `מנוי עד ${shortDate(t.subscriptionEndsAt)}`;
  }
  if (t.trialEndsAt && new Date(t.trialEndsAt).getTime() > Date.now()) {
    return `ניסיון עד ${shortDate(t.trialEndsAt)}`;
  }
  return null;
}

const TIERS = [
  { value: "free",        label: "חינמי",                price: "₪0"   },
  { value: "basic",       label: "Basic",                price: "₪99"  },
  { value: "pro",         label: "Pro",                  price: "₪199" },
  { value: "service_dog", label: "Service Dog (ארגוני)", price: "₪229" },
  { value: "groomer",     label: "Groomer+ (legacy)",    price: "₪169" },
];

export default function TenantsPage() {
  return (
    <Suspense fallback={<PetraLoader />}>
      <TenantsPageInner />
    </Suspense>
  );
}

function TenantsPageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    VALID_STATUSES.includes(initialStatus) ? initialStatus : ""
  );
  const [includeTest, setIncludeTest] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery<TenantsResponse>({
    queryKey: ["owner", "tenants", { search, statusFilter, tierFilter, page, includeTest }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (tierFilter) params.set("tier", tierFilter);
      if (includeTest) params.set("includeTest", "1");
      return fetchJSON(`/api/owner/tenants?${params}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (tenant: Tenant) =>
      fetchJSON(`/api/owner/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: tenant.status === "active" ? "suspended" : "active" }),
      }),
    onSuccess: (_res, tenant) => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] });
      toast.success(tenant.status === "active" ? `העסק "${tenant.name}" הושהה` : `העסק "${tenant.name}" הופעל`);
      setSuspendTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || "הפעולה נכשלה"),
  });

  const tenants = data?.tenants ?? [];
  const total = data?.total ?? 0;
  const hiddenTestCount = !includeTest ? data?.testCount ?? 0 : 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">עסקים</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} סה״כ
            {hiddenTestCount > 0 && (
              <span className="text-slate-500"> · {hiddenTestCount} עסקי בדיקה מוסתרים</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          עסק חדש
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם עסק, בעלים, אימייל או טלפון..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input w-full pr-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="suspended">מושהה</option>
          <option value="closed">סגור</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">כל המנויים</option>
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => { setIncludeTest(e.target.checked); setPage(1); }}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
          />
          הצג חשבונות בדיקה
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
          שגיאה בטעינת נתונים: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header-cell">עסק</th>
                <th className="table-header-cell">בעלים</th>
                <th className="table-header-cell">כניסה אחרונה</th>
                <th className="table-header-cell">מנוי</th>
                <th className="table-header-cell">חברי צוות</th>
                <th className="table-header-cell">סטטוס</th>
                <th className="table-header-cell">נוצר</th>
                <th className="table-header-cell">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <Link
                          href={`/owner/tenants/${tenant.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                        >
                          {tenant.name}
                        </Link>
                        {tenant.isTest && (
                          <span className="badge badge-neutral ms-2">בדיקה</span>
                        )}
                        {tenant.email && (
                          <div className="text-xs text-slate-500">{tenant.email}</div>
                        )}
                        {tenant.phone && (
                          <div className="text-xs text-slate-500" dir="ltr">{tenant.phone}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    {tenant.owner ? (
                      <div>
                        <Link
                          href={`/owner/users/${tenant.owner.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                        >
                          {tenant.owner.name || tenant.owner.email}
                        </Link>
                        <div className="text-xs text-slate-500">{tenant.owner.email}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">ללא בעלים</span>
                    )}
                  </td>
                  <td
                    className="table-cell text-sm text-slate-700 whitespace-nowrap"
                    title={tenant.owner?.lastLoginAt ? new Date(tenant.owner.lastLoginAt).toLocaleString("he-IL") : undefined}
                  >
                    {tenant.owner ? relativeHe(tenant.owner.lastLoginAt) : "—"}
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-neutral">{TIER_LABELS[tenant.tier] ?? tenant.tier}</span>
                    {subscriptionLine(tenant) && (
                      <div className="text-xs text-slate-500 mt-1 whitespace-nowrap">{subscriptionLine(tenant)}</div>
                    )}
                  </td>
                  <td className="table-cell text-sm text-slate-600">
                    {tenant._count.members}
                  </td>
                  <td className="table-cell">
                    <span className={cn("badge", STATUS_BADGE[tenant.status] ?? "badge-neutral")}>
                      {STATUS_LABEL[tenant.status] ?? tenant.status}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-500">
                    {new Date(tenant.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() =>
                        tenant.status === "active" ? setSuspendTarget(tenant) : toggleMutation.mutate(tenant)
                      }
                      disabled={toggleMutation.isPending || tenant.status === "closed"}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40",
                        tenant.status === "active"
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      )}
                    >
                      {tenant.status === "active" ? "השהה" : "הפעל"}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500 text-sm">
                    לא נמצאו עסקים התואמים לחיפוש ולסינון
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              עמוד {page} מתוך {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                הקודם
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                הבא
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suspend confirmation */}
      {suspendTarget && (
        <div
          className="modal-overlay"
          onClick={() => !toggleMutation.isPending && setSuspendTarget(null)}
        >
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-tenant-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 id="suspend-tenant-title" className="text-lg font-bold text-slate-900">
                  להשהות את העסק &quot;{suspendTarget.name}&quot;?
                </h2>
                <p className="text-sm text-slate-700 mt-1">
                  כל המשתמשים של העסק ({suspendTarget._count.members}) יאבדו גישה למערכת עד שהעסק יופעל מחדש.
                  הנתונים נשמרים, וניתן להפעיל את העסק שוב בכל עת.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setSuspendTarget(null)}
                disabled={toggleMutation.isPending}
                className="btn-secondary flex-1 disabled:opacity-40"
              >
                ביטול
              </button>
              <button
                onClick={() => toggleMutation.mutate(suspendTarget)}
                disabled={toggleMutation.isPending}
                className="btn-danger flex-1 disabled:opacity-40"
              >
                {toggleMutation.isPending ? "משהה..." : "השהה עסק"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={(ownerEmail) => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] });
            if (ownerEmail) {
              alert(`העסק נוצר בהצלחה!\nמנהל עסק נוצר: ${ownerEmail}`);
            }
          }}
        />
      )}
    </div>
  );
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ownerEmail?: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tier, setTier] = useState("basic");
  const [showOwner, setShowOwner] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/owner/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          tier,
          ownerName: showOwner && ownerName ? ownerName : undefined,
          ownerEmail: showOwner && ownerEmail ? ownerEmail : undefined,
          ownerPassword: showOwner && ownerPassword ? ownerPassword : undefined,
        }),
      }),
    onSuccess: (data: unknown) => {
      const result = data as { business: unknown; owner: { email: string } | null };
      onCreated(result.owner?.email);
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">עסק חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg" aria-label="סגור" title="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">שם העסק *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="לדוגמה: אילוף כלבים ישראל"
            />
          </div>
          <div>
            <label className="label">מייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="label">טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="050-1234567"
            />
          </div>
          <div>
            <label className="label">מנוי</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="input w-full">
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.price}/חודש
                </option>
              ))}
            </select>
          </div>

          {/* Owner section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOwner((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span>הוספת מנהל עסק</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showOwner && "rotate-180")} />
            </button>
            {showOwner && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-500">אם לא תמלא, תוכל להוסיף מנהל מאוחר יותר</p>
                <div>
                  <label className="label">שם מלא</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="input w-full"
                    placeholder="ישראל ישראלי"
                  />
                </div>
                <div>
                  <label className="label">אימייל</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="input w-full"
                    dir="ltr"
                    placeholder="owner@example.com"
                  />
                </div>
                <div>
                  <label className="label">סיסמה (לפחות 8 תווים)</label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="input w-full"
                    dir="ltr"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {mutation.error && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 text-red-600 text-xs">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">
            ביטול
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {mutation.isPending ? "יוצר..." : "צור עסק"}
          </button>
        </div>
      </div>
    </div>
  );
}
