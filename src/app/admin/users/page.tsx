"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Users, Shield, ShieldOff, X, Clock, Activity,
  ChevronLeft, ChevronRight, Crown, Laptop, RefreshCw, UserPlus, Eye, EyeOff,
} from "lucide-react";

const PLATFORM_ROLE_LABELS: Record<string, { label: string; style: React.CSSProperties }> = {
  super_admin: { label: "סופר-אדמין", style: { background: "#7C3AED20", color: "#A78BFA" } },
  admin:       { label: "אדמין",       style: { background: "#06B6D420", color: "#06B6D4" } },
  support:     { label: "תמיכה",       style: { background: "#F59E0B20", color: "#F59E0B" } },
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "התחבר", CREATE_CUSTOMER: "יצר לקוח", ADD_PET: "הוסיף חיה",
  CREATE_APPOINTMENT: "יצר תור", CREATE_PAYMENT: "רשם תשלום",
  CREATE_LEAD: "יצר ליד", CREATE_TASK: "יצר משימה",
  CREATE_BOARDING_STAY: "פנסיון", UPDATE_SETTINGS: "הגדרות",
};

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getScoreStyle(score: number): React.CSSProperties {
  if (score >= 20) return { background: "#06B6D420", color: "#06B6D4" };
  if (score >= 10) return { background: "#F59E0B20", color: "#F59E0B" };
  if (score >= 1)  return { background: "#64748B20", color: "#94A3B8" };
  return { background: "#EF444420", color: "#EF4444" };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  platformRole: string | null;
  isActive: boolean;
  createdAt: string;
  businessName: string | null;
  businessTier: string | null;
  activityScore: number;
  lastActivityAt: string | null;
}

interface UserDetail extends User {
  authProvider: string;
  twoFaEnabled: boolean;
  totalActivity: number;
  businessMemberships: Array<{
    id: string;
    role: string;
    isActive: boolean;
    business: { id: string; name: string; tier: string };
  }>;
  sessions: Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
  }>;
  activityLogs: Array<{ id: string; action: string; createdAt: string }>;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "blocked">("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        search,
        page: String(page),
        limit: "20",
      });
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "blocked") params.set("isActive", "false");
      return fetch(`/api/admin/users?${params}`).then((r) => r.json());
    },
  });

  const { data: userDetail, isLoading: detailLoading } = useQuery<UserDetail>({
    queryKey: ["admin-user-detail", selectedUserId],
    queryFn: () => fetch(`/api/admin/users/${selectedUserId}`).then((r) => r.json()),
    enabled: !!selectedUserId,
  });

  const toggleBlockMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail", selectedUserId] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, platformRole }: { id: string; platformRole: string | null }) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformRole }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail", selectedUserId] });
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const users: User[] = data?.users ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">משתמשים</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {data ? `${data.total} משתמשים רשומים` : "טוען..."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.25)" }}
          >
            <UserPlus className="w-4 h-4" />
            הוסף משתמש
          </button>
          {/* Status filter */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #1E1E2E" }}>
            {(["", "active", "blocked"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPage(1); }}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: statusFilter === f ? "rgba(6,182,212,0.15)" : "#12121A",
                  color: statusFilter === f ? "#06B6D4" : "#64748B",
                  borderLeft: f !== "" ? "1px solid #1E1E2E" : undefined,
                }}
              >
                {f === "" ? "הכל" : f === "active" ? "פעילים" : "חסומים"}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#475569" }} />
            <input
              type="text"
              placeholder="חיפוש לפי שם או אימייל..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pr-10 pl-4 py-2 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              dir="rtl"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
        {isLoading ? (
          <div className="p-12 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
        ) : !users.length ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#1E1E2E" }} />
            <p className="text-sm" style={{ color: "#64748B" }}>לא נמצאו משתמשים</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1E1E2E" }}>
                    {["שם", "תפקיד", "עסק", "הצטרפות", "פעילות אחרונה", "ציון", "פעולות"].map((h) => (
                      <th key={h} className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#64748B" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roleInfo = user.platformRole ? PLATFORM_ROLE_LABELS[user.platformRole] : null;
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-white/[0.02] transition-colors"
                        style={{
                          borderBottom: "1px solid #1E1E2E",
                          opacity: user.isActive ? 1 : 0.55,
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: user.isActive ? "rgba(6,182,212,0.15)" : "rgba(100,116,139,0.2)", color: user.isActive ? "#06B6D4" : "#64748B" }}
                            >
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm text-white flex items-center gap-1.5">
                                {user.name}
                                {user.role === "MASTER" && <Crown className="w-3 h-3 text-cyan-400" />}
                                {!user.isActive && (
                                  <span className="text-[10px] px-1.5 rounded" style={{ background: "#EF444420", color: "#EF4444" }}>חסום</span>
                                )}
                              </div>
                              <div className="text-xs" style={{ color: "#64748B" }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {roleInfo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style={roleInfo.style}>
                              {roleInfo.label}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "#475569" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: "#94A3B8" }}>{user.businessName || "—"}</div>
                          {user.businessTier && (
                            <div className="text-[10px]" style={{ color: "#475569" }}>{user.businessTier}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#94A3B8" }}>{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {user.lastActivityAt ? relativeTime(user.lastActivityAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={getScoreStyle(user.activityScore)}>
                            {user.activityScore}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedUserId(user.id)}
                              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                              style={{ background: "#1E1E2E", color: "#94A3B8" }}
                            >
                              פרטים
                            </button>
                            <button
                              onClick={() => toggleBlockMutation.mutate({ id: user.id, isActive: !user.isActive })}
                              disabled={toggleBlockMutation.isPending}
                              title={user.isActive ? "חסום משתמש" : "בטל חסימה"}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: user.isActive ? "#EF444410" : "#22C55E10", color: user.isActive ? "#EF4444" : "#22C55E" }}
                            >
                              {user.isActive ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #1E1E2E" }}>
                <span className="text-xs" style={{ color: "#64748B" }}>עמוד {page} מתוך {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg disabled:opacity-30 transition-colors"
                    style={{ background: "#1E1E2E", color: "#94A3B8" }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg disabled:opacity-30 transition-colors"
                    style={{ background: "#1E1E2E", color: "#94A3B8" }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUserId(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} />
          <div
            className="relative rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
            style={{ background: "#0D0D14", border: "1px solid #1E1E2E" }}
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-12 text-center text-sm" style={{ color: "#64748B" }}>טוען פרטים...</div>
            ) : userDetail ? (
              <>
                {/* Modal header */}
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E2E" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4" }}
                    >
                      {userDetail.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white flex items-center gap-1.5">
                        {userDetail.name}
                        {userDetail.role === "MASTER" && <Crown className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <div className="text-xs" style={{ color: "#64748B" }}>{userDetail.email}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUserId(null)} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "#64748B" }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Status + Block toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                    <div>
                      <div className="text-sm text-white font-medium">סטטוס חשבון</div>
                      <div className="text-xs mt-0.5" style={{ color: userDetail.isActive ? "#22C55E" : "#EF4444" }}>
                        {userDetail.isActive ? "פעיל" : "חסום"}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleBlockMutation.mutate({ id: userDetail.id, isActive: !userDetail.isActive })}
                      disabled={toggleBlockMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        background: userDetail.isActive ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                        color: userDetail.isActive ? "#EF4444" : "#22C55E",
                        border: `1px solid ${userDetail.isActive ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                      }}
                    >
                      {userDetail.isActive ? <><ShieldOff className="w-4 h-4" />חסום משתמש</> : <><Shield className="w-4 h-4" />בטל חסימה</>}
                    </button>
                  </div>

                  {/* Platform role */}
                  <div className="p-4 rounded-xl space-y-2" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                    <div className="text-sm text-white font-medium mb-3">הרשאות פלטפורמה</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: null, label: "ללא" },
                        { value: "support", label: "תמיכה" },
                        { value: "admin", label: "אדמין" },
                        { value: "super_admin", label: "סופר-אדמין" },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => changeRoleMutation.mutate({ id: userDetail.id, platformRole: opt.value })}
                          disabled={changeRoleMutation.isPending || userDetail.platformRole === opt.value}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={
                            userDetail.platformRole === opt.value
                              ? { background: "rgba(6,182,212,0.2)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.3)" }
                              : { background: "#0A0A0F", color: "#64748B", border: "1px solid #1E1E2E" }
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "הצטרפות", value: formatDate(userDetail.createdAt) },
                      { label: "ספק הזדהות", value: userDetail.authProvider },
                      { label: "2FA", value: userDetail.twoFaEnabled ? "מופעל" : "כבוי" },
                      { label: "סה״כ פעולות", value: userDetail.totalActivity },
                    ].map((f) => (
                      <div key={f.label} className="rounded-xl p-3" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                        <div className="text-[10px] mb-1" style={{ color: "#475569" }}>{f.label}</div>
                        <div className="text-sm text-white font-medium">{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Business memberships */}
                  {userDetail.businessMemberships.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
                        <Laptop className="w-3 h-3" />
                        עסקים
                      </div>
                      {userDetail.businessMemberships.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg mb-1.5" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                          <div>
                            <div className="text-sm text-white">{m.business.name}</div>
                            <div className="text-[10px]" style={{ color: "#475569" }}>תפקיד: {m.role} · tier: {m.business.tier}</div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: m.isActive ? "#22C55E20" : "#EF444420", color: m.isActive ? "#22C55E" : "#EF4444" }}>
                            {m.isActive ? "פעיל" : "לא פעיל"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sessions */}
                  {userDetail.sessions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
                        <Clock className="w-3 h-3" />
                        סשנים פעילים ({userDetail.sessions.length})
                      </div>
                      {userDetail.sessions.map((s) => (
                        <div key={s.id} className="px-3 py-2 rounded-lg mb-1.5" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-white">{s.ipAddress || "IP לא ידוע"}</div>
                            <div className="text-[10px]" style={{ color: "#475569" }}>{relativeTime(s.lastSeenAt)}</div>
                          </div>
                          {s.userAgent && (
                            <div className="text-[10px] mt-0.5 truncate" style={{ color: "#334155" }}>{s.userAgent.slice(0, 60)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent activity */}
                  {userDetail.activityLogs.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
                        <Activity className="w-3 h-3" />
                        פעילות אחרונה
                      </div>
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1E1E2E" }}>
                        {userDetail.activityLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid #1E1E2E" }}>
                            <span className="text-xs" style={{ color: "#94A3B8" }}>{ACTION_LABELS[log.action] || log.action}</span>
                            <span className="text-[10px]" style={{ color: "#475569" }}>{relativeTime(log.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Refresh button */}
                  <button
                    onClick={() => qc.invalidateQueries({ queryKey: ["admin-user-detail", selectedUserId] })}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "#12121A", color: "#64748B", border: "1px solid #1E1E2E" }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    רענן נתונים
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-sm" style={{ color: "#64748B" }}>שגיאה בטעינת פרטים</div>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); }} />}
    </div>
  );
}

// ─── Add User Modal ───────────────────────────────────────────────

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"USER" | "MASTER">("USER");
  const [platformRole, setPlatformRole] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "שגיאה ביצירת משתמש");
        return json;
      }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit() {
    setError("");
    if (!name.trim()) return setError("שם חובה");
    if (!email.trim() || !email.includes("@")) return setError("אימייל לא תקין");
    if (password.length < 8) return setError("סיסמה חייבת להכיל לפחות 8 תווים");
    mutation.mutate({ name, email, password, role, platformRole: platformRole || null });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} />
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-md"
        style={{ background: "#0D0D14", border: "1px solid #1E1E2E" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E2E" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(6,182,212,0.15)" }}>
              <UserPlus className="w-4 h-4" style={{ color: "#06B6D4" }} />
            </div>
            <div>
              <div className="text-base font-semibold text-white">הוסף משתמש מערכת</div>
              <div className="text-xs" style={{ color: "#64748B" }}>יצירת חשבון ידנית</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "#64748B" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>שם מלא *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              dir="rtl"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>אימייל *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              dir="ltr"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>סיסמה * (מינימום 8 תווים)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 8 תווים"
                dir="ltr"
                className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "#475569" }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role + Platform role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>תפקיד מערכת</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "USER" | "MASTER")}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              >
                <option value="USER">User</option>
                <option value="MASTER">Master</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>הרשאות פלטפורמה</label>
              <select
                value={platformRole}
                onChange={(e) => setPlatformRole(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}
              >
                <option value="">ללא</option>
                <option value="support">תמיכה</option>
                <option value="admin">אדמין</option>
                <option value="super_admin">סופר-אדמין</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.25)" }}
            >
              {mutation.isPending ? "יוצר..." : "צור משתמש"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "#1E1E2E", color: "#94A3B8" }}
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
