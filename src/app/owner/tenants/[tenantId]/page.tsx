"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Calendar, ArrowRight, Shield, Loader2 } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";

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

  const { data: tenant, isLoading, error } = useQuery<TenantDetail>({
    queryKey: ["owner", "tenants", tenantId],
    queryFn: () => fetchJSON(`/api/owner/tenants/${tenantId}`),
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
