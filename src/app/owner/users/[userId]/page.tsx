"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Shield, Building2, UserCheck, UserX, Loader2 } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";

interface BusinessMembership {
  id: string;
  role: string;
  isActive: boolean;
  business: {
    id: string;
    name: string;
    status: string;
  };
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
            user.isActive
              ? "btn-danger"
              : "bg-green-50 text-green-600 hover:bg-green-100"
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
            <div className="flex gap-2">
              <select
                defaultValue={user.platformRole ?? ""}
                onChange={(e) => roleMutation.mutate(e.target.value || null)}
                disabled={roleMutation.isPending}
                className="input flex-1"
              >
                <option value="">ללא תפקיד</option>
                <option value="super_admin">סופר אדמין</option>
                <option value="admin">אדמין</option>
                <option value="support">תמיכה</option>
              </select>
            </div>
            {roleMutation.isPending && (
              <p className="text-xs text-slate-400 mt-1">מעדכן תפקיד...</p>
            )}
            {roleMutation.error && (
              <p className="text-xs text-red-600 mt-1">{(roleMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Business memberships */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">עסקים ({user.businessMemberships.length})</h2>
        </div>
        {user.businessMemberships.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">לא משויך לעסקים</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header-cell">עסק</th>
                <th className="table-header-cell">תפקיד</th>
                <th className="table-header-cell">סטטוס עסק</th>
                <th className="table-header-cell">מצב חברות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {user.businessMemberships.map((membership) => (
                <tr key={membership.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <Link
                        href={`/owner/tenants/${membership.business.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                      >
                        {membership.business.name}
                      </Link>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-neutral">
                      {MEMBER_ROLE_LABEL[membership.role] ?? membership.role}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={cn(
                      "badge",
                      membership.business.status === "active" ? "badge-success" :
                      membership.business.status === "suspended" ? "badge-danger" : "badge-neutral"
                    )}>
                      {BIZ_STATUS_LABEL[membership.business.status] ?? membership.business.status}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={cn("badge", membership.isActive ? "badge-success" : "badge-danger")}>
                      {membership.isActive ? "פעיל" : "לא פעיל"}
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
