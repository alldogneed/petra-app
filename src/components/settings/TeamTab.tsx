"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { UserPlus, Shield } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { PendingApprovalsPanel } from "@/components/settings/PendingApprovalsPanel";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { hasTenantPermission, type TenantRole } from "@/lib/permissions";
import { useGrantableCapabilities } from "@/hooks/useGrantableCapabilities";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InviteMemberModal, PendingInvitations } from "@/components/settings/TeamInvitations";
import { useTranslations } from "next-intl";

type TeamT = ReturnType<typeof useTranslations<"settings.teamTab">>;

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

const ROLE_IDS = new Set(["owner", "manager", "user", "volunteer"]);
/** Translated role label; unknown roles render as-is. */
const roleLabel = (t: TeamT, role: string) => (ROLE_IDS.has(role) ? t(`roles.${role}` as Parameters<TeamT>[0]) : role);
const ROLE_COLORS: Record<string, string> = {
  owner: "badge-brand",
  manager: "badge-warning",
  user: "badge-neutral",
  volunteer: "badge-neutral",
};
/** Higher = more privileges. Used to detect a downgrade before confirming it. */
const ROLE_RANK: Record<string, number> = { owner: 3, manager: 2, user: 1, volunteer: 0 };

/** PATCH a membership; surfaces the server's error message (403 hierarchy etc.). */
async function patchMember(businessId: string | null | undefined, memberId: string, body: Record<string, unknown>, missingBusinessError: string) {
  if (!businessId) throw new Error(missingBusinessError);
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
  | { kind: "deactivate"; member: TeamMember }
  | { kind: "delete"; member: TeamMember };

export function TeamTab() {
  const t = useTranslations("settings.teamTab");
  const tc = useTranslations("common");
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
    // NOT ["team-members"]: that key holds /api/team-members ({id,name}) for the
    // calendar / orders / boarding. Sharing it fed one shape to the other and
    // crashed both screens. Invalidating ["team-members"] still refreshes both.
    queryKey: ["team-members", "admin"],
    queryFn: () => fetchJSON<TeamMember[]>(`/api/admin/${user?.businessId}/members`),
    enabled: !!user?.businessId,
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      patchMember(user?.businessId, memberId, { role }, t("errors.missingBusiness")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setPending(null);
      toast.success(t("toasts.roleUpdated"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.roleUpdateError")),
  });

  const permsMutation = useMutation({
    mutationFn: ({ memberId, permissionOverrides }: { memberId: string; permissionOverrides: Record<string, boolean> }) =>
      patchMember(user?.businessId, memberId, { permissionOverrides }, t("errors.missingBusiness")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success(t("toasts.permsSaved"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.permsSaveError")),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ memberId, isActive }: { memberId: string; isActive: boolean }) =>
      patchMember(user?.businessId, memberId, { isActive }, t("errors.missingBusiness")),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setPending(null);
      toast.success(isActive ? t("toasts.userActivated") : t("toasts.userDeactivated"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.statusUpdateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!user?.businessId) throw new Error(t("errors.missingBusiness"));
      const r = await fetch(`/api/admin/${user.businessId}/members/${memberId}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setPending(null);
      toast.success(t("toasts.memberDeleted"));
    },
    onError: (e: Error) => toast.error(e.message || t("toasts.deleteError")),
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

  const confirmBusy = roleMutation.isPending || toggleActiveMutation.isPending || deleteMutation.isPending;
  let confirmTitle = "";
  let confirmDescription: React.ReactNode = null;
  let confirmLabel = t("confirm.defaultLabel");
  if (pending?.kind === "deactivate") {
    confirmTitle = t("confirm.deactivate.title", { name: pending.member.user.name });
    confirmDescription = t("confirm.deactivate.description");
    confirmLabel = t("confirm.deactivate.label");
  } else if (pending?.kind === "delete") {
    confirmTitle = t("confirm.delete.title", { name: pending.member.user.name });
    confirmDescription = t("confirm.delete.description");
    confirmLabel = t("confirm.delete.label");
  } else if (pending?.kind === "role") {
    const from = roleLabel(t, pending.member.role);
    const to = roleLabel(t, pending.role);
    if (pending.role === "owner") {
      confirmTitle = t("confirm.makeOwner.title", { name: pending.member.user.name });
      confirmDescription = t("confirm.makeOwner.description");
      confirmLabel = t("confirm.makeOwner.label");
    } else {
      confirmTitle = t("confirm.downgrade.title", { name: pending.member.user.name, from, to });
      confirmDescription = t("confirm.downgrade.description");
      confirmLabel = t("confirm.downgrade.label");
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-semibold text-petra-text">{t("header.title")}</h3>
          <span className="text-sm text-petra-muted">({members?.length ?? 0})</span>
        </div>
        {canManageTeam && (
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4" />
            {t("header.invite")}
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
                {(member.user?.name ?? "").charAt(0) || "?"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-petra-text truncate max-w-full">{member.user.name}</span>
                  <span className={cn("badge text-xs", ROLE_COLORS[member.role] ?? "badge-neutral")}>
                    {roleLabel(t, member.role)}
                  </span>
                  {!member.isActive && (
                    <span className="badge badge-danger text-xs">{t("member.inactive")}</span>
                  )}
                  {isSelf && (
                    <span className="text-xs text-petra-muted">{t("member.self")}</span>
                  )}
                </div>
                <div className="flex items-center gap-x-3 gap-y-0.5 mt-0.5 flex-wrap min-w-0">
                  <span className="text-xs text-petra-muted truncate max-w-full" dir="ltr">{member.user.email}</span>
                  <span className="text-xs text-petra-muted">
                    {lastSeen ? formatRelativeTime(lastSeen) : t("member.neverLoggedIn")}
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
                    aria-label={t("member.roleAria", { name: member.user.name })}
                  >
                    {isOwner && <option value="owner">{t("roles.owner")}</option>}
                    <option value="manager">{t("roles.manager")}</option>
                    <option value="user">{t("roles.user")}</option>
                    {member.role === "volunteer" && <option value="volunteer" disabled>{t("roles.volunteer")}</option>}
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
                    {member.isActive ? t("member.deactivate") : t("member.activate")}
                  </button>
                  {!member.isActive && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                      onClick={() => setPending({ kind: "delete", member })}
                      disabled={deleteMutation.isPending}
                    >
                      {tc("actions.delete")}
                    </button>
                  )}
                  {isOwner && member.role !== "owner" && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-200 text-petra-muted hover:bg-slate-50 transition-colors"
                      onClick={() => setPermsOpenFor(permsOpenFor === member.id ? null : member.id)}
                      aria-expanded={permsOpenFor === member.id}
                    >
                      {t("member.permissions")}
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
          else if (pending.kind === "delete") deleteMutation.mutate(pending.member.id);
          else roleMutation.mutate({ memberId: pending.member.id, role: pending.role });
        }}
        onCancel={() => setPending(null)}
      />

      {/* Invited, not confirmed yet — they join only after accepting from the link. */}
      <PendingInvitations
        businessId={user?.businessId ?? ""}
        businessName={user?.businessName ?? ""}
        canManage={canManageTeam}
      />

      {showAddModal && (
        <InviteMemberModal
          businessId={user?.businessId ?? ""}
          businessName={user?.businessName ?? ""}
          canAddOwner={isOwner}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Pending approvals panel — visible to all team members (owner sees full controls, manager sees own requests) */}
      <PendingApprovalsPanel />
    </div>
  );
}

// ─── Per-member capabilities (owner only) ─────────────────────────────────────
// Grouped list of everything the owner can grant or take away. The role supplies
// the default; any change here is stored as an explicit override (true/false) so
// a later role change can never silently hand a capability back.

/**
 * A stored value that differs from the role default — or a screen explicitly switched
 * off: that also blocks direct entry (isScreenBlocked), so it must stay visible and
 * resettable even when the role default is "off" as well.
 */
function isCustomOverride(role: TenantRole, key: string, stored: boolean | undefined): boolean {
  if (typeof stored !== "boolean") return false;
  if (stored === false && key.startsWith("tenant.view.")) return true;
  return stored !== hasTenantPermission(role, key as Parameters<typeof hasTenantPermission>[1]);
}

function MemberCapabilities({
  member,
  pending,
  onChange,
}: {
  member: TeamMember;
  pending: boolean;
  onChange: (overrides: Record<string, boolean>) => void;
}) {
  const t = useTranslations("settings.teamTab");
  const overrides = member.permissionOverrides ?? {};
  const role = member.role as TenantRole;
  const { groups, capabilities } = useGrantableCapabilities();
  const customized = capabilities.filter(
    (c) => isCustomOverride(role, c.key, overrides[c.key]),
  ).length;
  const granted = capabilities.filter((c) =>
    typeof overrides[c.key] === "boolean" ? overrides[c.key] : hasTenantPermission(role, c.key),
  ).length;

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-petra-muted max-w-md">
          {t("capabilities.intro", { name: member.user.name, role: roleLabel(t, member.role) })}
          {" "}<span className="font-medium text-petra-text">{t("capabilities.grantedCount", { granted, total: capabilities.length })}</span>
        </p>
        {customized > 0 && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline disabled:opacity-50"
            disabled={pending}
            onClick={() => onChange({})}
          >
            {t("capabilities.reset", { count: customized })}
          </button>
        )}
      </div>
      {groups.map((group) => {
        const caps = capabilities.filter((c) => c.group === group.id);
        if (caps.length === 0) return null;
        return (
          <fieldset key={group.id} className="m-0 min-w-0 border-0 p-0">
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-petra-muted mb-1.5">{group.label}</legend>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
              {caps.map((cap) => {
                const roleDefault = hasTenantPermission(role, cap.key);
                const stored = overrides[cap.key];
                const checked = typeof stored === "boolean" ? stored : roleDefault;
                const isCustom = isCustomOverride(role, cap.key, stored);
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
                            title={t("capabilities.customTitle")}
                            aria-label={t("capabilities.customAria")}
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
