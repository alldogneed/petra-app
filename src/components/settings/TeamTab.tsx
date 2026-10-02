"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, AlertCircle, Info, UserPlus, Shield, X } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { PendingApprovalsPanel } from "@/components/settings/PendingApprovalsPanel";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { CRITICAL_CAPABILITIES, hasTenantPermission, type TenantRole } from "@/lib/permissions";

// ─── Team Tab (Owner only) ───────────────────────────────────────────────────

interface TeamMember {
  id: string;
  role: string;
  permissionOverrides?: Record<string, boolean> | null;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    sessions?: { lastSeenAt: string }[];
  };
}

const ROLE_LABELS: Record<string, string> = { owner: "בעלים", manager: "מנהל", user: "עובד" };
const ROLE_COLORS: Record<string, string> = {
  owner: "badge-brand",
  manager: "badge-warning",
  user: "badge-neutral",
};

export function TeamTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [permsOpenFor, setPermsOpenFor] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => fetchJSON<TeamMember[]>(`/api/admin/${user?.businessId}/members`),
    enabled: !!user?.businessId,
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      fetch(`/api/admin/${user?.businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("הרשאות עודכנו בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון הרשאות. נסה שוב."),
  });

  const permsMutation = useMutation({
    mutationFn: ({ memberId, permissionOverrides }: { memberId: string; permissionOverrides: Record<string, boolean> }) =>
      fetch(`/api/admin/${user?.businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionOverrides }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("ההרשאות נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת ההרשאות. נסה שוב."),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ memberId, isActive }: { memberId: string; isActive: boolean }) =>
      fetch(`/api/admin/${user?.businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success(isActive ? "המשתמש הופעל" : "המשתמש הושבת");
    },
    onError: () => toast.error("שגיאה בעדכון הסטטוס. נסה שוב."),
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ניהול צוות</h3>
          <span className="text-sm text-petra-muted">({members?.length ?? 0})</span>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAddModal(true)}>
          <UserPlus className="w-4 h-4" />
          הוסף עובד
        </button>
      </div>

      <div className="space-y-3">
        {members?.map((member) => {
          const isSelf = member.user.id === user?.id;
          const lastSeen = member.user.sessions?.[0]?.lastSeenAt;

          return (
            <div key={member.id} className="card p-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                member.isActive ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-400"
              )}>
                {member.user.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-petra-text truncate">{member.user.name}</span>
                  <span className={cn("badge text-xs", ROLE_COLORS[member.role] ?? "badge-neutral")}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  {!member.isActive && (
                    <span className="badge badge-danger text-xs">מושבת</span>
                  )}
                  {isSelf && (
                    <span className="text-xs text-petra-muted">(את/ה)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-petra-muted">{member.user.email}</span>
                  <span className="text-xs text-petra-muted">
                    {lastSeen ? formatRelativeTime(lastSeen) : "לא התחבר"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {!isSelf && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    className="input text-xs py-1.5 px-2 w-24"
                    value={member.role}
                    onChange={(e) => roleMutation.mutate({ memberId: member.id, role: e.target.value })}
                    disabled={roleMutation.isPending}
                  >
                    <option value="owner">בעלים</option>
                    <option value="manager">מנהל</option>
                    <option value="user">עובד</option>
                  </select>
                  <button
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                      member.isActive
                        ? "text-red-600 hover:bg-red-50 border border-red-200"
                        : "text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                    )}
                    onClick={() => toggleActiveMutation.mutate({ memberId: member.id, isActive: !member.isActive })}
                    disabled={toggleActiveMutation.isPending}
                  >
                    {member.isActive ? "השבת" : "הפעל"}
                  </button>
                  {member.role !== "owner" && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-200 text-petra-muted hover:bg-slate-50 transition-colors"
                      onClick={() => setPermsOpenFor(permsOpenFor === member.id ? null : member.id)}
                    >
                      הרשאות
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Per-member critical capabilities. Unchecked boxes are stored as an
                explicit false so a role change can never silently hand them back. */}
            {permsOpenFor === member.id && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs text-petra-muted">
                  סמן מה מותר ל{member.user.name}. ברירת המחדל נגזרת מהתפקיד — כל סימון כאן גובר עליה.
                </p>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {CRITICAL_CAPABILITIES.map((cap) => {
                    const overrides = member.permissionOverrides ?? {};
                    const checked =
                      typeof overrides[cap.key] === "boolean"
                        ? (overrides[cap.key] as boolean)
                        : hasTenantPermission(member.role as TenantRole, cap.key);
                    return (
                      <label key={cap.key} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={checked}
                          disabled={permsMutation.isPending}
                          onChange={(e) =>
                            permsMutation.mutate({
                              memberId: member.id,
                              permissionOverrides: { ...overrides, [cap.key]: e.target.checked },
                            })
                          }
                        />
                        <span>{cap.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <AddEmployeeModal
          businessId={user?.businessId ?? ""}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["team-members"] });
          }}
        />
      )}

      {/* Pending approvals panel — visible to all team members (owner sees full controls, manager sees own requests) */}
      <PendingApprovalsPanel />
    </div>
  );
}

// ─── Add Employee Modal ─────────────────────────────────────────────────────

function AddEmployeeModal({
  businessId,
  onClose,
  onSuccess,
}: {
  businessId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!businessId) {
        throw new Error("לא ניתן להוסיף עובד — מזהה העסק חסר. נסה לרענן את הדף.");
      }
      return fetch(`/api/admin/${businessId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, temporaryPassword: password }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "שגיאה ביצירת עובד");
        }
        return r.json();
      });
    },
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">עובד חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף עובד חדש לצוות</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">שם מלא *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">אימייל *</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
            </div>
            <div>
              <label className="label">סיסמה זמנית *</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 8 תווים" dir="ltr" minLength={8} />
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-red-500 mt-1">הסיסמה חייבת להכיל לפחות 8 תווים (כרגע {password.length})</p>
              )}
            </div>
          </div>
          <div>
            <label className="label">תפקיד</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">עובד</option>
              <option value="manager">מנהל</option>
              <option value="owner">בעלים</option>
            </select>
          </div>
        </div>

        {/* Validation hint — shown only when user has started filling but can't submit yet */}
        {(name || email || password) && (!name.trim() || !email.trim() || password.length < 8) && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs space-y-1">
            <p className="font-medium">כדי להוסיף עובד יש למלא:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {!name.trim() && <li>שם מלא</li>}
              {!email.trim() && <li>כתובת אימייל</li>}
              {password.length < 8 && <li>סיסמה זמנית (לפחות 8 תווים)</li>}
            </ul>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            className="btn-primary flex-1"
            disabled={!name.trim() || !email.trim() || !password.trim() || password.length < 8 || mutation.isPending}
            onClick={() => { setError(null); mutation.mutate(); }}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {mutation.isPending ? "מוסיף..." : "הוסף עובד"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
