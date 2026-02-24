"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { UserX, UserCheck, Plus, Shield } from "lucide-react";

interface Member {
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
    twoFaEnabled: boolean;
  };
}

const ROLE_OPTIONS = ["owner", "manager", "user"] as const;

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-orange-100 text-orange-700",
  manager: "bg-blue-100 text-blue-700",
  user: "bg-slate-100 text-slate-600",
};

export default function MembersPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "manager" | "user">("user");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/${businessId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  async function toggleMember(member: Member) {
    setActionLoading(member.id);
    await fetch(`/api/admin/${businessId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !member.isActive }),
    });
    setActionLoading(null);
    load();
  }

  async function changeRole(member: Member, role: string) {
    setActionLoading(member.id);
    await fetch(`/api/admin/${businessId}/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setActionLoading(null);
    load();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    const res = await fetch(`/api/admin/${businessId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        ...(invitePassword ? { temporaryPassword: invitePassword } : {}),
      }),
    });
    if (res.ok) {
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("user");
      setInvitePassword("");
      load();
    } else {
      const data = await res.json();
      setInviteError(data.error ?? "Invite failed");
    }
    setInviteLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
          <h3 className="font-semibold text-slate-900 mb-4">Invite New Member</h3>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r} className="capitalize">{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Temporary Password <span className="text-slate-400">(if new user)</span>
                </label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  dir="ltr"
                  minLength={8}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Min 8 characters"
                />
              </div>
            </div>
            {inviteError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inviteError}</div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                {inviteLoading ? "Inviting..." : "Send Invite"}
              </button>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Member</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Role</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">2FA</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold flex-shrink-0">
                        {member.user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{member.user.name}</div>
                        <div className="text-xs text-slate-400">{member.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={member.role}
                      onChange={(e) => changeRole(member, e.target.value)}
                      disabled={actionLoading === member.id}
                      className={`text-xs font-medium px-2 py-1 rounded capitalize border-0 focus:ring-2 focus:ring-orange-400 cursor-pointer ${
                        ROLE_BADGE[member.role] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r} className="capitalize">{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {member.user.twoFaEnabled ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Shield className="w-3.5 h-3.5" /> On
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      member.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleMember(member)}
                      disabled={actionLoading === member.id}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 ${
                        member.isActive
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                    >
                      {member.isActive ? (
                        <><UserX className="w-3.5 h-3.5" /> Deactivate</>
                      ) : (
                        <><UserCheck className="w-3.5 h-3.5" /> Reactivate</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No members yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
