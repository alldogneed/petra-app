"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Search, Shield, UserCheck, UserX, Plus, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchJSON, cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { TIER_LABELS, PLATFORM_ROLE_LABELS } from "@/lib/platform-labels";

interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  platformRole: string | null;
  isActive: boolean;
  twoFaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { businessMemberships: number };
  businessId: string | null;
  businessName: string | null;
  businessTier: string | null;
  businessRole: string | null;
  activityScore: number;
  lastActivityAt: string | null;
  isTest: boolean;
}

interface UsersResponse {
  users: PlatformUserRow[];
  total: number;
  page: number;
  limit: number;
}

type StatusFilter = "all" | "active" | "blocked";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "active", label: "פעילים" },
  { key: "blocked", label: "חסומים" },
];

const ROLE_BADGE: Record<string, string> = {
  super_admin: "badge-danger",
  admin: "badge-brand",
  support: "badge-neutral",
};

/** Relative Hebrew day distance: "היום", "אתמול", "לפני 3 ימים". */
function relativeDay(dateStr: string | null): string {
  if (!dateStr) return "מעולם לא";
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return "מעולם לא";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  if (days === 2) return "לפני יומיים";
  if (days < 30) return `לפני ${days} ימים`;
  if (days < 60) return "לפני חודש";
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return then.toLocaleDateString("he-IL");
}

export default function OwnerUsersPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [staffOnly, setStaffOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [blockTarget, setBlockTarget] = useState<PlatformUserRow | null>(null);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching, error } = useQuery<UsersResponse>({
    queryKey: ["owner", "users", { search, status, staffOnly, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (staffOnly) params.set("role", "staff");
      return fetchJSON<UsersResponse>(`/api/owner/users?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      fetchJSON(`/api/owner/users/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: vars.isActive }),
      }),
    onSuccess: (_res, vars) => {
      toast.success(vars.isActive ? "החסימה בוטלה" : "המשתמש נחסם והסשנים שלו נותקו");
      setBlockTarget(null);
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
    },
    onError: (err: Error) => toast.error(err.message || "הפעולה נכשלה"),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!search || status !== "all" || staffOnly;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">משתמשים</h1>
          <p className="text-sm text-slate-500 mt-1">
            כל משתמשי הפלטפורמה, העסק שלהם ורמת הפעילות · {total} סה״כ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            משתמש חדש
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="חיפוש לפי שם או מייל..."
            aria-label="חיפוש משתמשים"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input w-full pr-10"
          />
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label="סינון לפי מצב">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setStatus(opt.key); setPage(1); }}
              aria-pressed={status === opt.key}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg font-medium transition-colors",
                status === opt.key
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={staffOnly}
            onChange={(e) => { setStaffOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300 accent-orange-500"
          />
          צוות פלטפורמה בלבד
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          שגיאה בטעינת נתונים: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : users.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            {hasFilters
              ? "לא נמצאו משתמשים שתואמים לחיפוש או לסינון. נסו לשנות את הסינון."
              : "עדיין אין משתמשים בפלטפורמה."}
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header-cell">משתמש</th>
                  <th className="table-header-cell">עסק</th>
                  <th className="table-header-cell">תפקיד פלטפורמה</th>
                  <th className="table-header-cell">2FA</th>
                  <th className="table-header-cell">הצטרפות</th>
                  <th className="table-header-cell">פעילות אחרונה</th>
                  <th className="table-header-cell">ציון 30 יום</th>
                  <th className="table-header-cell">מצב</th>
                  <th className="table-header-cell">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const lastSeen = user.lastActivityAt ?? user.lastLoginAt;
                  const extraBusinesses = user._count.businessMemberships - 1;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold flex-shrink-0">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/owner/users/${user.id}`}
                                className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                              >
                                {user.name || user.email}
                              </Link>
                              {user.isTest && <span className="badge badge-neutral">בדיקה</span>}
                            </div>
                            <div className="text-xs text-slate-500" dir="ltr" style={{ textAlign: "right" }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        {user.businessId && user.businessName ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/owner/tenants/${user.businessId}`}
                              className="text-sm text-slate-700 hover:text-orange-600 transition-colors"
                            >
                              {user.businessName}
                            </Link>
                            {user.businessTier && (
                              <span className="badge badge-brand">
                                {TIER_LABELS[user.businessTier] ?? "מסלול אחר"}
                              </span>
                            )}
                            {extraBusinesses > 0 && (
                              <span
                                className="text-xs text-slate-500"
                                title={`משויך ל-${user._count.businessMemberships} עסקים`}
                              >
                                +{extraBusinesses}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {user.platformRole ? (
                          <span className={cn("badge", ROLE_BADGE[user.platformRole] ?? "badge-neutral")}>
                            {PLATFORM_ROLE_LABELS[user.platformRole] ?? "תפקיד אחר"}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {user.twoFaEnabled ? (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <Shield className="w-3.5 h-3.5" /> מופעל
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="table-cell text-sm text-slate-700 whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString("he-IL")}
                      </td>
                      <td
                        className="table-cell text-sm text-slate-700 whitespace-nowrap"
                        title={lastSeen ? new Date(lastSeen).toLocaleString("he-IL") : undefined}
                      >
                        {relativeDay(lastSeen)}
                      </td>
                      <td className="table-cell">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            user.activityScore > 0 ? "text-slate-900" : "text-slate-500"
                          )}
                          title="מספר פעולות ב-30 הימים האחרונים"
                        >
                          {user.activityScore}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={cn("badge", user.isActive ? "badge-success" : "badge-danger")}>
                          {user.isActive ? "פעיל" : "חסום"}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Link
                            href={`/owner/users/${user.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                          >
                            פרטים
                          </Link>
                          {user.isActive ? (
                            <button
                              onClick={() => setBlockTarget(user)}
                              disabled={toggleMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              <UserX className="w-3.5 h-3.5" /> חסום
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleMutation.mutate({ id: user.id, isActive: true })}
                              disabled={toggleMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> בטל חסימה
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Block confirmation */}
      {blockTarget && (
        <BlockUserModal
          user={blockTarget}
          pending={toggleMutation.isPending}
          onClose={() => setBlockTarget(null)}
          onConfirm={() => toggleMutation.mutate({ id: blockTarget.id, isActive: false })}
        />
      )}

      {/* Create User Modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            toast.success("המשתמש נוצר");
            queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
          }}
        />
      )}
    </div>
  );
}

function BlockUserModal({
  user,
  pending,
  onClose,
  onConfirm,
}: {
  user: { name: string; email: string };
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={pending ? undefined : onClose}>
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
          <button onClick={onClose} disabled={pending} className="btn-secondary flex-1 disabled:opacity-40">
            ביטול
          </button>
          <button onClick={onConfirm} disabled={pending} className="btn-danger flex-1 justify-center disabled:opacity-40">
            {pending ? "חוסם..." : "חסום משתמש"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [platformRole, setPlatformRole] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          platformRole: platformRole || null,
        }),
      }),
    onSuccess: () => onCreated(),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">משתמש חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg" aria-label="סגור" title="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">שם *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="שם מלא"
            />
          </div>
          <div>
            <label className="label">מייל *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="label">סיסמה *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="לפחות 8 תווים"
            />
          </div>
          <div>
            <label className="label">תפקיד פלטפורמה</label>
            <select value={platformRole} onChange={(e) => setPlatformRole(e.target.value)} className="input w-full">
              <option value="">ללא תפקיד פלטפורמה</option>
              {Object.entries(PLATFORM_ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {mutation.error && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 text-red-700 text-xs">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">
            ביטול
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || !email.trim() || !password || password.length < 8 || mutation.isPending}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {mutation.isPending ? "יוצר..." : "צור משתמש"}
          </button>
        </div>
      </div>
    </div>
  );
}
