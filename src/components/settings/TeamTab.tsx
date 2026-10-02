"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Loader2, AlertCircle, UserPlus, Shield, X } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { PendingApprovalsPanel } from "@/components/settings/PendingApprovalsPanel";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { CAPABILITY_GROUPS, CRITICAL_CAPABILITIES, hasTenantPermission, type TenantRole } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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

const ROLE_LABELS: Record<string, string> = { owner: "בעלים", manager: "מנהל", user: "עובד", volunteer: "מתנדב" };
const ROLE_COLORS: Record<string, string> = {
  owner: "badge-brand",
  manager: "badge-warning",
  user: "badge-neutral",
  volunteer: "badge-neutral",
};
/** Higher = more privileges. Used to detect a downgrade before confirming it. */
const ROLE_RANK: Record<string, number> = { owner: 3, manager: 2, user: 1, volunteer: 0 };

/** PATCH a membership; surfaces the server's error message (403 hierarchy etc.). */
async function patchMember(businessId: string | null | undefined, memberId: string, body: Record<string, unknown>) {
  if (!businessId) throw new Error("מזהה העסק חסר. נסה לרענן את הדף.");
  const r = await fetch(`/api/admin/${businessId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof data.error === "string" && /[\u0590-\u05FF]/.test(data.error) ? data.error : "");
  return data;
}

type PendingConfirm =
  | { kind: "role"; member: TeamMember; role: string }
  | { kind: "deactivate"; member: TeamMember };

export function TeamTab() {
  const { user } = useAuth();
  const perms = usePermissions();
  // Server: PATCH/POST members → USERS_WRITE; owner role + per-member overrides → owner only.
  const canManageTeam = perms.canManageTeam;
  const isOwner = perms.isOwner;
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [permsOpenFor, setPermsOpenFor] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => fetchJSON<TeamMember[]>(`/api/admin/${user?.businessId}/members`),
    enabled: !!user?.businessId,
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      patchMember(user?.businessId, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setPending(null);
      toast.success("התפקיד עודכן בהצלחה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון התפקיד. נסה שוב."),
  });

  const permsMutation = useMutation({
    mutationFn: ({ memberId, permissionOverrides }: { memberId: string; permissionOverrides: Record<string, boolean> }) =>
      patchMember(user?.businessId, memberId, { permissionOverrides }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("ההרשאות נשמרו");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירת ההרשאות. נסה שוב."),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ memberId, isActive }: { memberId: string; isActive: boolean }) =>
      patchMember(user?.businessId, memberId, { isActive }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setPending(null);
      toast.success(isActive ? "המשתמש הופעל" : "המשתמש הושבת");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון הסטטוס. נסה שוב."),
  });

  /** Role select: downgrades and promotions to owner are confirmed first. */
  const requestRoleChange = (member: TeamMember, role: string) => {
    if (role === member.role) return;
    const isDowngrade = (ROLE_RANK[role] ?? 0) < (ROLE_RANK[member.role] ?? 0);
    if (isDowngrade || role === "owner") {
      setPending({ kind: "role", member, role });
      return;
    }
    roleMutation.mutate({ memberId: member.id, role });
  };

  if (isLoading) {
    return <PetraLoader />;
  }

  const confirmBusy = roleMutation.isPending || toggleActiveMutation.isPending;
  let confirmTitle = "";
  let confirmDescription: React.ReactNode = null;
  let confirmLabel = "אישור";
  if (pending?.kind === "deactivate") {
    confirmTitle = `להשבית את ${pending.member.user.name}?`;
    confirmDescription = "הגישה של המשתמש לעסק תיחסם מיד. אפשר להפעיל אותו מחדש בכל עת.";
    confirmLabel = "השבת";
  } else if (pending?.kind === "role") {
    const from = ROLE_LABELS[pending.member.role] ?? pending.member.role;
    const to = ROLE_LABELS[pending.role] ?? pending.role;
    if (pending.role === "owner") {
      confirmTitle = `להפוך את ${pending.member.user.name} לבעלים?`;
      confirmDescription = "לבעלים יש גישה מלאה לעסק — כולל הכנסות, מחיקות, הגדרות קריטיות וניהול הצוות (כולל אותך). לא תוכל/י לשנות את התפקיד שלו בחזרה.";
      confirmLabel = "הפוך לבעלים";
    } else {
      confirmTitle = `להוריד את ${pending.member.user.name} מ${from} ל${to}?`;
      confirmDescription = "המשתמש יאבד מיד את ההרשאות של התפקיד הקודם. הרשאות שסומנו לו אישית נשמרות.";
      confirmLabel = "שנה תפקיד";
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">ניהול צוות</h3>
          <span className="text-sm text-petra-muted">({members?.length ?? 0})</span>
        </div>
        {canManageTeam && (
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4" />
            הוסף עובד
          </button>
        )}
      </div>

      <div className="space-y-3">
        {members?.map((member) => {
          const isSelf = member.user.id === user?.id;
          const lastSeen = member.user.sessions?.[0]?.lastSeenAt;
          // Server refuses changes to yourself and to a higher role than yours.
          const canEditMember = canManageTeam && !isSelf && (isOwner || member.role !== "owner");

          return (
            <div key={member.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {/* Avatar */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                member.isActive ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-400"
              )}>
                {member.user.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-petra-text truncate max-w-full">{member.user.name}</span>
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
                <div className="flex items-center gap-x-3 gap-y-0.5 mt-0.5 flex-wrap min-w-0">
                  <span className="text-xs text-petra-muted truncate max-w-full" dir="ltr">{member.user.email}</span>
                  <span className="text-xs text-petra-muted">
                    {lastSeen ? formatRelativeTime(lastSeen) : "לא התחבר"}
                  </span>
                </div>
              </div>

              {/* Actions — full-width row on phones, inline from sm */}
              {canEditMember && (
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <select
                    className="input text-xs py-1.5 px-2 w-24"
                    value={member.role}
                    onChange={(e) => requestRoleChange(member, e.target.value)}
                    disabled={roleMutation.isPending}
                    aria-label={`תפקיד של ${member.user.name}`}
                  >
                    {isOwner && <option value="owner">בעלים</option>}
                    <option value="manager">מנהל</option>
                    <option value="user">עובד</option>
                    {member.role === "volunteer" && <option value="volunteer" disabled>מתנדב</option>}
                  </select>
                  <button
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                      member.isActive
                        ? "text-red-600 hover:bg-red-50 border border-red-200"
                        : "text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                    )}
                    onClick={() =>
                      member.isActive
                        ? setPending({ kind: "deactivate", member })
                        : toggleActiveMutation.mutate({ memberId: member.id, isActive: true })
                    }
                    disabled={toggleActiveMutation.isPending}
                  >
                    {member.isActive ? "השבת" : "הפעל"}
                  </button>
                  {isOwner && member.role !== "owner" && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-200 text-petra-muted hover:bg-slate-50 transition-colors"
                      onClick={() => setPermsOpenFor(permsOpenFor === member.id ? null : member.id)}
                      aria-expanded={permsOpenFor === member.id}
                    >
                      הרשאות
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Per-member critical capabilities. Unchecked boxes are stored as an
                explicit false so a role change can never silently hand them back. */}
            {isOwner && permsOpenFor === member.id && (
              <MemberCapabilities
                member={member}
                pending={permsMutation.isPending}
                onChange={(permissionOverrides) => permsMutation.mutate({ memberId: member.id, permissionOverrides })}
              />
            )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        danger
        loading={confirmBusy}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === "deactivate") toggleActiveMutation.mutate({ memberId: pending.member.id, isActive: false });
          else roleMutation.mutate({ memberId: pending.member.id, role: pending.role });
        }}
        onCancel={() => setPending(null)}
      />

      {showAddModal && (
        <AddEmployeeModal
          businessId={user?.businessId ?? ""}
          canAddOwner={isOwner}
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
  canAddOwner,
  onClose,
  onSuccess,
}: {
  businessId: string;
  canAddOwner: boolean;
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
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              {canAddOwner && <option value="owner">בעלים</option>}
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
            className="btn-primary flex-1 flex items-center justify-center gap-2"
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

// ─── Per-member capabilities (owner only) ─────────────────────────────────────
// Grouped list of everything the owner can grant or take away. The role supplies
// the default; any change here is stored as an explicit override (true/false) so
// a later role change can never silently hand a capability back.

function MemberCapabilities({
  member,
  pending,
  onChange,
}: {
  member: TeamMember;
  pending: boolean;
  onChange: (overrides: Record<string, boolean>) => void;
}) {
  const overrides = member.permissionOverrides ?? {};
  const role = member.role as TenantRole;
  const customized = CRITICAL_CAPABILITIES.filter(
    (c) => typeof overrides[c.key] === "boolean" && overrides[c.key] !== hasTenantPermission(role, c.key),
  ).length;
  const granted = CRITICAL_CAPABILITIES.filter((c) =>
    typeof overrides[c.key] === "boolean" ? overrides[c.key] : hasTenantPermission(role, c.key),
  ).length;

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-petra-muted max-w-md">
          מה מותר ל{member.user.name}? ברירת המחדל נגזרת מהתפקיד ({ROLE_LABELS[member.role] ?? member.role}) — כל שינוי כאן גובר עליה.
          {" "}<span className="font-medium text-petra-text">{granted} מתוך {CRITICAL_CAPABILITIES.length} מותרות.</span>
        </p>
        {customized > 0 && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline disabled:opacity-50"
            disabled={pending}
            onClick={() => onChange({})}
          >
            אפס לברירת המחדל של התפקיד ({customized} שינויים)
          </button>
        )}
      </div>
      {CAPABILITY_GROUPS.map((group) => {
        const caps = CRITICAL_CAPABILITIES.filter((c) => c.group === group.id);
        if (caps.length === 0) return null;
        return (
          <fieldset key={group.id} className="m-0 min-w-0 border-0 p-0">
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-petra-muted mb-1.5">{group.label}</legend>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
              {caps.map((cap) => {
                const roleDefault = hasTenantPermission(role, cap.key);
                const stored = overrides[cap.key];
                const checked = typeof stored === "boolean" ? stored : roleDefault;
                const isCustom = typeof stored === "boolean" && stored !== roleDefault;
                const id = `cap-${member.id}-${cap.key}`;
                return (
                  <label key={cap.key} htmlFor={id} className="flex items-start gap-2 text-sm cursor-pointer py-0.5">
                    <input
                      id={id}
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      checked={checked}
                      disabled={pending}
                      aria-describedby={`${id}-hint`}
                      onChange={(e) => onChange({ ...overrides, [cap.key]: e.target.checked })}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        {cap.label}
                        {isCustom && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
                            title="שונה ידנית — שונה מברירת המחדל של התפקיד"
                            aria-label="שונה ידנית"
                          />
                        )}
                      </span>
                      <span id={`${id}-hint`} className="block text-xs text-petra-muted leading-snug">{cap.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
