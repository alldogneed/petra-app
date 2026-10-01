"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  UserCheck,
  UserX,
  PenLine,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { TeamMember, ROLE_LABELS, ROLE_COLORS, relativeTime, formatTs, isOnline, Avatar } from "./shared";

export function TeamTab({ currentUserId }: { currentUserId: string }) {
  const { user } = useAuth();
  const businessId = user?.businessId ?? "";
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["ba-team"],
    enabled: !!businessId,
    queryFn: () => fetch(`/api/admin/${businessId}/members`).then((r) => r.json()),
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
    <div className="card overflow-hidden">
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
  );
}
