"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Plus, Loader2, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  status: string;
  createdAt: string;
  _count: { members: number };
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

const TIER_LABEL: Record<string, string> = {
  free: "חינמי",
  basic: "בייסיק",
  pro: "פרו",
  groomer: "גרומר",
  enterprise: "ארגוני",
};

const TIERS = [
  { value: "free", label: "חינמי", price: "₪0" },
  { value: "basic", label: "בייסיק", price: "₪99" },
  { value: "pro", label: "פרו", price: "₪199" },
  { value: "groomer", label: "גרומר", price: "₪169" },
];

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery<{ tenants: Tenant[]; total: number }>({
    queryKey: ["owner", "tenants", { search, statusFilter, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] }),
  });

  const tenants = data?.tenants ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">עסקים</h1>
          <p className="text-sm text-slate-400 mt-1">{total} סה״כ</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          עסק חדש
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש עסקים..."
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header-cell">עסק</th>
                <th className="table-header-cell">חבילה</th>
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
                        {tenant.email && (
                          <div className="text-xs text-slate-400">{tenant.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-neutral">{TIER_LABEL[tenant.tier] ?? tenant.tier}</span>
                  </td>
                  <td className="table-cell text-sm text-slate-600">
                    {tenant._count.members}
                  </td>
                  <td className="table-cell">
                    <span className={cn("badge", STATUS_BADGE[tenant.status] ?? "badge-neutral")}>
                      {STATUS_LABEL[tenant.status] ?? tenant.status}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-400">
                    {new Date(tenant.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => toggleMutation.mutate(tenant)}
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
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                    לא נמצאו עסקים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
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
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
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
            <label className="label">חבילה</label>
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
                <p className="text-xs text-slate-400">אם לא תמלא, תוכל להוסיף מנהל מאוחר יותר</p>
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
