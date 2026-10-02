"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TeamStatsResponse, TeamStatsMember, TeamStatsDays } from "@/lib/team-stats";
import { PermissionsMatrix } from "./PermissionsMatrix";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  UserCheck,
  UserX,
  PenLine,
  CheckCircle2,
  XCircle,
  BarChart3,
  KeyRound,
  Users,
} from "lucide-react";
import { TeamMember, ROLE_LABELS, ROLE_COLORS, relativeTime, formatTs, isOnline, Avatar } from "./shared";

type MemberRow = TeamMember & { permissionOverrides?: Record<string, boolean> | null };

const PERIODS: { days: TeamStatsDays; label: string }[] = [
  { days: 7, label: "7 ימים" },
  { days: 30, label: "30 יום" },
  { days: 90, label: "90 יום" },
];

const TEAM_QUERY_KEY = ["ba-team"] as const;

export function TeamTab({ currentUserId }: { currentUserId: string }) {
  const { user } = useAuth();
  const businessId = user?.businessId ?? "";
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [days, setDays] = useState<TeamStatsDays>(30);

  const { data: members, isLoading } = useQuery<MemberRow[]>({
    queryKey: TEAM_QUERY_KEY,
    enabled: !!businessId,
    queryFn: () =>
      fetch(`/api/admin/${businessId}/members`).then(async (r) => {
        const d = await r.json();
        if (!r.ok || !Array.isArray(d)) throw new Error(d?.error || "שגיאה בטעינת הצוות");
        return d;
      }),
  });

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<TeamStatsResponse>({
    queryKey: ["ba-team-stats", days],
    enabled: !!businessId,
    queryFn: () =>
      fetch(`/api/business-admin/team-stats?days=${days}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "שגיאה בטעינת הסיכום");
        return d;
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/admin/${businessId}/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ba-team"] });
      queryClient.invalidateQueries({ queryKey: ["ba-overview"] });
      queryClient.invalidateQueries({ queryKey: ["ba-team-stats"] });
      setEditingId(null);
      toast.success("עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const handleRoleSave = (memberId: string) => {
    if (newRole) updateMutation.mutate({ id: memberId, data: { role: newRole } });
    setEditingId(null);
  };

  const handleToggleActive = (member: TeamMember) => {
    updateMutation.mutate({
      id: member.id,
      data: { isActive: !member.isActive },
    });
  };

  if (isLoading) {
    return <PetraLoader />;
  }

  return (
    <div className="space-y-6">
      {/* ── Per-employee summary ─────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-petra-text">סיכום לפי עובד</h3>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="תקופה">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                aria-pressed={days === p.days}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  days === p.days ? "bg-brand-500 text-white" : "text-petra-muted hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {statsLoading ? (
          <div className="card">
            <PetraLoader variant="inline" />
          </div>
        ) : statsError || !stats ? (
          <div className="card p-6 text-center text-sm text-petra-muted">לא ניתן לטעון את סיכום הפעילות</div>
        ) : stats.members.length === 0 ? (
          <div className="card p-6 text-center text-sm text-petra-muted">אין עובדים להצגה</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.members.map((m) => (
              <MemberSummaryCard key={m.userId} member={m} isMe={m.userId === currentUserId} />
            ))}
          </div>
        )}
      </section>

      {/* ── Team table ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-petra-text">ניהול צוות</h3>
        </div>
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-petra-muted">
            <th className="text-right px-4 py-3 font-medium">משתמש</th>
            <th className="text-right px-4 py-3 font-medium">תפקיד</th>
            <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
              פעילות אחרונה
            </th>
            <th className="text-right px-4 py-3 font-medium">סטטוס</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members?.map((member) => {
            const isMe = member.userId === currentUserId;
            const latestSession = member.user.sessions[0];
            const online = latestSession ? isOnline(latestSession.lastSeenAt) : false;

            return (
              <tr
                key={member.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar name={member.user.name} url={member.user.avatarUrl} size={8} />
                      {online && (
                        <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {member.user.name}
                        {isMe && (
                          <span className="text-xs text-petra-muted font-normal"> (אתה)</span>
                        )}
                      </p>
                      <p className="text-xs text-petra-muted">{member.user.email}</p>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  {editingId === member.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="input py-1 text-xs"
                        defaultValue={member.role}
                        onChange={(e) => setNewRole(e.target.value)}
                        autoFocus
                      >
                        <option value="owner">בעלים</option>
                        <option value="manager">מנג׳ר</option>
                        <option value="user">עובד</option>
                      </select>
                      <button
                        onClick={() => handleRoleSave(member.id)}
                        className="text-green-600 hover:text-green-700"
                        title="שמור"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-slate-600"
                        title="בטל"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ROLE_COLORS[member.role] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  )}
                </td>

                {/* Last seen */}
                <td className="px-4 py-3 text-petra-muted hidden sm:table-cell">
                  {latestSession ? (
                    <span title={formatTs(latestSession.lastSeenAt)}>
                      {relativeTime(latestSession.lastSeenAt)}
                    </span>
                  ) : (
                    <span className="text-slate-300">מעולם לא</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      member.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {member.isActive ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        פעיל
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        מושבת
                      </>
                    )}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  {!isMe && (
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => {
                          setEditingId(member.id);
                          setNewRole(member.role);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="שנה תפקיד"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(member)}
                        disabled={updateMutation.isPending}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          member.isActive
                            ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                            : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title={member.isActive ? "השבת משתמש" : "הפעל משתמש"}
                      >
                        {member.isActive ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      </section>

      {/* ── Permissions matrix ───────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-petra-text">הרשאות לפי עובד</h3>
        </div>
        <div className="card p-4">
          <PermissionsMatrix
            businessId={businessId}
            members={members ?? []}
            currentUserId={currentUserId}
            queryKey={TEAM_QUERY_KEY}
          />
        </div>
      </section>
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────

function MemberSummaryCard({ member, isMe }: { member: TeamStatsMember; isMe: boolean }) {
  const c = member.counts;
  const items: { label: string; value: number; sub?: string; danger?: boolean }[] = [
    { label: "תורים שהושלמו", value: c.appointmentsCompleted, sub: c.appointmentsCreated ? `${c.appointmentsCreated} נוצרו` : undefined },
    { label: "לקוחות חדשים", value: c.customersCreated },
    { label: "לידים שנסגרו", value: c.leadsWon, sub: c.leadsLost ? `${c.leadsLost} אבדו` : undefined },
    { label: "משימות שהושלמו", value: c.tasksCompleted },
    { label: "תשלומים שנרשמו", value: c.paymentsRecorded },
    { label: "מחיקות", value: c.deletes, danger: c.deletes > 0 },
  ];

  return (
    <div className={`card p-4 ${member.isActive ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">
            {member.name}
            {isMe && <span className="text-xs text-petra-muted font-normal"> (אתה)</span>}
          </p>
          <p className="text-xs text-petra-muted">
            פעיל לאחרונה:{" "}
            {member.lastActiveAt ? (
              <span title={formatTs(member.lastActiveAt)}>{relativeTime(member.lastActiveAt)}</span>
            ) : (
              "מעולם לא"
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role] ?? "bg-slate-100 text-slate-700"}`}>
            {ROLE_LABELS[member.role] ?? member.role}
          </span>
          {!member.isActive && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">מושבת</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.label} className={`rounded-lg px-2 py-1.5 ${it.danger ? "bg-red-50" : "bg-slate-50"}`}>
            <p className={`text-base font-semibold leading-tight ${it.danger ? "text-red-600" : "text-slate-800"}`}>{it.value}</p>
            <p className="text-[11px] text-petra-muted leading-tight">{it.label}</p>
            {it.sub && <p className="text-[10px] text-slate-400 leading-tight">{it.sub}</p>}
          </div>
        ))}
      </div>

      {member.openTasks !== null && (
        <p className="text-xs text-petra-muted mt-3">
          משימות פתוחות: <span className="font-medium text-slate-700">{member.openTasks}</span>
          {" / "}באיחור:{" "}
          <span className={member.overdueTasks ? "font-semibold text-red-600" : "font-medium text-slate-700"}>
            {member.overdueTasks ?? 0}
          </span>
        </p>
      )}
    </div>
  );
}
