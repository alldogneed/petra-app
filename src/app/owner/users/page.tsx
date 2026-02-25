"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, UserCheck, UserX, Plus, Loader2, X } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";

interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  platformRole: string | null;
  isActive: boolean;
  twoFaEnabled: boolean;
  createdAt: string;
  _count: { businessMemberships: number };
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700",
  admin: "bg-orange-100 text-orange-700",
  support: "bg-blue-100 text-blue-700",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "סופר אדמין",
  admin: "אדמין",
  support: "תמיכה",
};

export default function OwnerUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery<{ users: PlatformUserRow[]; total: number }>({
    queryKey: ["owner", "users", { search, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      return fetchJSON(`/api/owner/users?${params}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (user: PlatformUserRow) =>
      fetchJSON(`/api/owner/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner", "users"] }),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">משתמשי פלטפורמה</h1>
          <p className="text-sm text-slate-400 mt-1">{total} סה״כ</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          משתמש חדש
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש משתמשים..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input w-full pr-10"
          />
        </div>
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
                <th className="table-header-cell">משתמש</th>
                <th className="table-header-cell">תפקיד פלטפורמה</th>
                <th className="table-header-cell">2FA</th>
                <th className="table-header-cell">עסקים</th>
                <th className="table-header-cell">מצב</th>
                <th className="table-header-cell">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold flex-shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <Link
                          href={`/owner/users/${user.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                        >
                          {user.name}
                        </Link>
                        <div className="text-xs text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    {user.platformRole ? (
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded",
                          ROLE_BADGE[user.platformRole] ?? "bg-gray-100 text-gray-600"
                        )}
                      >
                        {ROLE_LABEL[user.platformRole] ?? user.platformRole}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    {user.twoFaEnabled ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Shield className="w-3.5 h-3.5" /> מופעל
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="table-cell text-sm text-slate-600">
                    {user._count.businessMemberships}
                  </td>
                  <td className="table-cell">
                    <span
                      className={cn(
                        "badge",
                        user.isActive ? "badge-success" : "badge-danger"
                      )}
                    >
                      {user.isActive ? "פעיל" : "חסום"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => toggleMutation.mutate(user)}
                      disabled={toggleMutation.isPending}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5",
                        user.isActive
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      )}
                    >
                      {user.isActive ? (
                        <><UserX className="w-3.5 h-3.5" /> חסום</>
                      ) : (
                        <><UserCheck className="w-3.5 h-3.5" /> בטל חסימה</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                    לא נמצאו משתמשים
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

      {/* Create User Modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
          }}
        />
      )}
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
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">משתמש חדש</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
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
              <option value="super_admin">סופר אדמין</option>
              <option value="admin">אדמין</option>
              <option value="support">תמיכה</option>
            </select>
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
