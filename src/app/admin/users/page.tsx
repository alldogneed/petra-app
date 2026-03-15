"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Users, Shield, ShieldOff, X, Clock, Activity,
  ChevronLeft, ChevronRight, Crown, Laptop, RefreshCw, UserPlus, UserCheck, UserX, Eye, EyeOff,
  Check, Minus, ToggleLeft, ToggleRight, Zap, Loader2, Trash2, ChevronDown,
} from "lucide-react";
import { type FeatureKey, type TierKey, hasFeature } from "@/lib/feature-flags";

// ─── Tier / Feature definitions ──────────────────────────────────────────────

const TIERS: { key: TierKey; label: string; price: string }[] = [
  { key: "free",        label: "Free (חינמי)",  price: "₪0"   },
  { key: "basic",       label: "Basic",         price: "₪99"  },
  { key: "groomer",     label: "Groomer+",      price: "₪169" },
  { key: "pro",         label: "Pro",           price: "₪199" },
  { key: "service_dog", label: "Service Dog",   price: "₪229" },
];

const FEATURE_ROWS: { key: FeatureKey; label: string }[] = [
  { key: "gcal_sync",          label: "סנכרון גוגל"       },
  { key: "payments",           label: "תשלומים"           },
  { key: "invoicing",          label: "חשבוניות"          },
  { key: "scheduled_messages", label: "תזכורות WhatsApp"  },
  { key: "automations",        label: "אוטומציות"         },
  { key: "custom_messages",    label: "הודעות מותאמות"    },
  { key: "training",           label: "אילוף 1-על-1"      },
  { key: "training_groups",    label: "קבוצות וסדנאות"    },
  { key: "boarding",           label: "פנסיון"            },
  { key: "leads",              label: "CRM / לידים"       },
  { key: "staff_management",   label: "ניהול עובדים"      },
  { key: "excel_export",       label: "ייצוא Excel"       },
  { key: "groomer_portfolio",  label: "תיק עבודות גרומר"  },
  { key: "service_dogs",       label: "כלבי שירות"        },
];

// ─── Constants / helpers ─────────────────────────────────────────────────────

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

type OverrideValue = true | false | null;

interface TeamMember {
  id: string;
  role: string;
  isActive: boolean;
  user: { id: string; name: string; email: string };
}

interface BusinessInfo {
  id: string;
  name: string;
  tier: string;
  featureOverrides: Record<string, boolean> | null;
  members?: TeamMember[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  platformRole: string | null;
  isActive: boolean;
  createdAt: string;
  businessId: string | null;
  businessName: string | null;
  businessTier: string | null;
  teamCount: number;
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
    business: BusinessInfo;
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

// ─── Feature management panel ─────────────────────────────────────────────────

function FeaturePanel({ business, onRefresh }: { business: BusinessInfo; onRefresh: () => void }) {
  const [pending, setPending] = useState<Record<string, OverrideValue>>({});
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();

  const tierMutation = useMutation({
    mutationFn: (tier: string) =>
      fetch(`/api/owner/tenants/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      }).then((r) => r.json()),
    onSuccess: () => { onRefresh(); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  const featureMutation = useMutation({
    mutationFn: (overrides: Record<string, OverrideValue>) =>
      fetch(`/api/owner/tenants/${business.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      }).then((r) => r.json()),
    onSuccess: () => { onRefresh(); setPending({}); setDirty(false); },
  });

  const savedOverrides = (business.featureOverrides as Record<string, boolean> | null) ?? {};
  const activeTier = (business.tier || "free") as TierKey;

  const getOverride = (feature: FeatureKey): OverrideValue => {
    if (feature in pending) return pending[feature];
    if (feature in savedOverrides) return savedOverrides[feature] as boolean;
    return null;
  };

  const getEffective = (feature: FeatureKey): boolean => {
    const ov = getOverride(feature);
    if (ov !== null) return ov;
    return hasFeature(activeTier, feature);
  };

  const toggle = useCallback((feature: FeatureKey) => {
    const current = getEffective(feature);
    const tierDefault = hasFeature(activeTier, feature);
    const newValue: OverrideValue = !current === tierDefault ? null : !current;
    setPending((p) => ({ ...p, [feature]: newValue }));
    setDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTier, pending, savedOverrides]);

  const activeOverrides = Object.keys(savedOverrides).length;

  return (
    <div className="space-y-4">
      {/* Tier selector */}
      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: "#64748B" }}>מנוי</div>
        <div className="flex flex-wrap gap-1.5">
          {TIERS.map((t) => (
            <button
              key={t.key}
              onClick={() => tierMutation.mutate(t.key)}
              disabled={tierMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={
                t.key === activeTier
                  ? { background: "rgba(6,182,212,0.2)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.4)" }
                  : { background: "#12121A", color: "#94A3B8", border: "1px solid #1E1E2E" }
              }
            >
              {t.key === activeTier && <Check className="w-3 h-3" />}
              {t.label}
              <span style={{ color: "#475569" }}>{t.price}</span>
            </button>
          ))}
        </div>
        {tierMutation.isPending && (
          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "#64748B" }}>
            <Loader2 className="w-3 h-3 animate-spin" /> מעדכן מנוי...
          </p>
        )}
        {tierMutation.isSuccess && !tierMutation.isPending && (
          <p className="text-[11px] mt-1 text-green-500">✓ מנוי עודכן</p>
        )}
      </div>

      {/* Feature overrides */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#64748B" }}>
            <Zap className="w-3 h-3" />
            פיצ׳רים
            {activeOverrides > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#F59E0B20", color: "#F59E0B" }}>
                {activeOverrides} overrides
              </span>
            )}
          </div>
          {dirty && (
            <button
              onClick={() => featureMutation.mutate(pending)}
              disabled={featureMutation.isPending}
              className="text-[11px] px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
              style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.25)" }}
            >
              {featureMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin" />שומר...</> : "שמור שינויים"}
            </button>
          )}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_52px_52px_52px] text-[10px] font-semibold uppercase tracking-wide px-2 pb-1 mb-0.5"
          style={{ color: "#475569" }}>
          <span>פיצ׳ר</span>
          <span className="text-center">Tier</span>
          <span className="text-center">Override</span>
          <span className="text-center">בפועל</span>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1E1E2E" }}>
          {FEATURE_ROWS.map(({ key, label }, idx) => {
            const tierDefault = hasFeature(activeTier, key);
            const override = getOverride(key);
            const effective = getEffective(key);
            const hasPendingChange = key in pending;

            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_52px_52px_52px] items-center px-3 py-2 transition-colors"
                style={{
                  borderBottom: idx < FEATURE_ROWS.length - 1 ? "1px solid #1E1E2E" : undefined,
                  background: hasPendingChange ? "rgba(245,158,11,0.05)" : "transparent",
                }}
              >
                {/* Label */}
                <div className="text-xs text-white flex items-center gap-1">
                  {label}
                  {override !== null && (
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "#F59E0B20", color: "#F59E0B" }}>
                      OR
                    </span>
                  )}
                </div>

                {/* Tier default */}
                <div className="flex justify-center">
                  {tierDefault ? (
                    <Check className="w-3.5 h-3.5" style={{ color: "#22C55E" }} />
                  ) : (
                    <Minus className="w-3.5 h-3.5" style={{ color: "#334155" }} />
                  )}
                </div>

                {/* Override 3-way */}
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      const ov = getOverride(key);
                      const next: OverrideValue = ov === null ? true : ov === true ? false : null;
                      setPending((p) => ({ ...p, [key]: next }));
                      setDirty(true);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    title={override === null ? "ברירת מחדל" : override ? "כפוי פתוח" : "כפוי חסום"}
                    style={{
                      background: override === true ? "rgba(34,197,94,0.15)" : override === false ? "rgba(239,68,68,0.15)" : "#1E1E2E",
                      border: override !== null ? `1px solid ${override ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}` : "1px solid #2A2A3A",
                    }}
                  >
                    {override === true && <ToggleRight className="w-3.5 h-3.5" style={{ color: "#22C55E" }} />}
                    {override === false && <ToggleLeft className="w-3.5 h-3.5" style={{ color: "#EF4444" }} />}
                    {override === null && <Minus className="w-3 h-3" style={{ color: "#475569" }} />}
                  </button>
                </div>

                {/* Effective: big toggle click */}
                <div className="flex justify-center">
                  <button
                    onClick={() => toggle(key)}
                    title={effective ? "לחץ לחסום" : "לחץ לפתוח"}
                    className="w-8 h-5 rounded-full flex items-center transition-all relative"
                    style={{
                      background: effective ? "rgba(34,197,94,0.3)" : "rgba(100,116,139,0.2)",
                      border: `1px solid ${effective ? "rgba(34,197,94,0.5)" : "#334155"}`,
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full absolute transition-all"
                      style={{
                        background: effective ? "#22C55E" : "#475569",
                        right: effective ? "2px" : undefined,
                        left: effective ? undefined : "2px",
                      }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {featureMutation.isError && (
          <p className="text-[11px] mt-2" style={{ color: "#EF4444" }}>שגיאה בשמירה. נסה שוב.</p>
        )}
        {featureMutation.isSuccess && !dirty && (
          <p className="text-[11px] mt-2 text-green-500">✓ השינויים נשמרו</p>
        )}
        <p className="text-[10px] mt-2" style={{ color: "#334155" }}>
          OR = Override פעיל · לחץ על הטוגל לשינוי מהיר · לחץ על הכפתור האמצעי לבחירת ברירת מחדל / פתוח / חסום
        </p>
      </div>
    </div>
  );
}

// ─── Team Members Row ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "עובד",
  staff: "צוות",
};

function TeamMembersRow({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"owner" | "manager" | "user">("user");

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => fetch(`/api/admin/users/${userId}`).then((r) => r.json()),
  });

  const businessId = data?.businessMemberships?.[0]?.business?.id;

  const patchMember = useMutation({
    mutationFn: ({ memberId, body }: { memberId: string; body: Record<string, unknown> }) =>
      fetch(`/api/owner/tenants/${businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const deleteMember = useMutation({
    mutationFn: (memberId: string) =>
      fetch(`/api/owner/tenants/${businessId}/members/${memberId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const addMember = useMutation({
    mutationFn: () =>
      fetch(`/api/owner/tenants/${businessId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, email: addEmail, role: addRole, temporaryPassword: addPassword || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowAdd(false);
      setAddName(""); setAddEmail(""); setAddPassword(""); setAddRole("user");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: "#64748B" }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> טוען חברי צוות...
      </div>
    );
  }

  const members = data?.businessMemberships?.[0]?.business?.members ?? [];

  return (
    <div className="grid gap-2">
      {/* Members list */}
      {members.length === 0 ? (
        <div className="text-xs py-1" style={{ color: "#475569" }}>אין חברי צוות</div>
      ) : (
        members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: "#12121A", border: "1px solid #1E1E2E", opacity: m.isActive ? 1 : 0.6 }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: m.isActive ? "rgba(6,182,212,0.15)" : "rgba(100,116,139,0.2)", color: m.isActive ? "#06B6D4" : "#64748B" }}
              >
                {m.user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <span className="text-xs text-white">{m.user.name}</span>
                <span className="text-[10px] mx-1.5 truncate" style={{ color: "#475569" }}>{m.user.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Role select */}
              <select
                value={m.role}
                onChange={(e) => patchMember.mutate({ memberId: m.id, body: { role: e.target.value } })}
                className="text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                style={{ background: "#1E1E2E", color: "#94A3B8", border: "1px solid #2D2D3E" }}
              >
                <option value="user">עובד</option>
                <option value="manager">מנהל</option>
                <option value="owner">בעלים</option>
              </select>
              {/* Toggle active */}
              <button
                onClick={() => patchMember.mutate({ memberId: m.id, body: { isActive: !m.isActive } })}
                title={m.isActive ? "השהה גישה" : "הפעל גישה"}
                className="p-1 rounded transition-colors"
                style={{ color: m.isActive ? "#EF4444" : "#22C55E", background: m.isActive ? "#EF444415" : "#22C55E15" }}
              >
                {m.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
              </button>
              {/* Remove */}
              <button
                onClick={() => { if (confirm(`הסר את ${m.user.name}?`)) deleteMember.mutate(m.id); }}
                title="הסר מהעסק"
                className="p-1 rounded transition-colors"
                style={{ color: "#EF444460", background: "#EF444408" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#EF444460")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add member */}
      {showAdd ? (
        <div className="mt-1 p-3 rounded-lg" style={{ background: "#0A0A0F", border: "1px solid #1E1E2E" }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              placeholder="שם מלא"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="text-xs px-2 py-1.5 rounded focus:outline-none"
              style={{ background: "#1E1E2E", color: "#E2E8F0", border: "1px solid #2D2D3E" }}
            />
            <input
              placeholder="אימייל"
              type="email"
              dir="ltr"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="text-xs px-2 py-1.5 rounded focus:outline-none"
              style={{ background: "#1E1E2E", color: "#E2E8F0", border: "1px solid #2D2D3E" }}
            />
            <input
              placeholder="סיסמה זמנית"
              dir="ltr"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              className="text-xs px-2 py-1.5 rounded focus:outline-none"
              style={{ background: "#1E1E2E", color: "#E2E8F0", border: "1px solid #2D2D3E" }}
            />
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as "owner" | "manager" | "user")}
              className="text-xs px-2 py-1.5 rounded focus:outline-none"
              style={{ background: "#1E1E2E", color: "#E2E8F0", border: "1px solid #2D2D3E" }}
            >
              <option value="user">עובד</option>
              <option value="manager">מנהל</option>
              <option value="owner">בעלים</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addMember.mutate()}
              disabled={addMember.isPending || !addName || !addEmail}
              className="text-[11px] px-3 py-1 rounded font-medium disabled:opacity-50"
              style={{ background: "rgba(6,182,212,0.2)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.3)" }}
            >
              {addMember.isPending ? "מוסיף..." : "הוסף"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddName(""); setAddEmail(""); setAddPassword(""); }}
              className="text-[11px] px-3 py-1 rounded"
              style={{ background: "#1E1E2E", color: "#64748B" }}
            >
              ביטול
            </button>
            {addMember.isError && (
              <span className="text-[11px] self-center" style={{ color: "#EF4444" }}>שגיאה — ייתכן שהאימייל כבר קיים</span>
            )}
          </div>
        </div>
      ) : businessId && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg w-fit transition-colors"
          style={{ background: "rgba(6,182,212,0.08)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.15)" }}
        >
          <UserPlus className="w-3 h-3" />
          הוסף עובד לעסק
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "blocked">("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailTab, setDetailTab] = useState<"info" | "subscription">("info");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ search, page: String(page), limit: "20" });
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "blocked") params.set("isActive", "false");
      return fetch(`/api/admin/users?${params}`).then((r) => r.json());
    },
  });

  const { data: userDetail, isLoading: detailLoading, refetch: refetchDetail } = useQuery<UserDetail>({
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/users/${id}`, { method: "DELETE" }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "שגיאה במחיקה");
        return json;
      }),
    onSuccess: () => {
      setDeleteConfirmId(null);
      if (selectedUserId === deleteConfirmId) setSelectedUserId(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const users: User[] = data?.users ?? [];

  // Active business for selected user
  const activeBusiness = userDetail?.businessMemberships?.find((m) => m.isActive)?.business
    ?? userDetail?.businessMemberships?.[0]?.business
    ?? null;

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
            <UserPlus className="w-4 h-4" /> הוסף משתמש
          </button>
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
                    {["שם", "תפקיד", "עסק / מנוי", "צוות", "הצטרפות", "פעילות אחרונה", "ציון", "פעולות"].map((h) => (
                      <th key={h} className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#64748B" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roleInfo = user.platformRole ? PLATFORM_ROLE_LABELS[user.platformRole] : null;
                    return (
                      <React.Fragment key={user.id}>
                      <tr
                        className="hover:bg-white/[0.02] transition-colors"
                        style={{ borderBottom: "1px solid #1E1E2E", opacity: user.isActive ? 1 : 0.55 }}
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
                                {!user.isActive && <span className="text-[10px] px-1.5 rounded" style={{ background: "#EF444420", color: "#EF4444" }}>חסום</span>}
                              </div>
                              <div className="text-xs" style={{ color: "#64748B" }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {roleInfo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style={roleInfo.style}>{roleInfo.label}</span>
                          ) : <span className="text-xs" style={{ color: "#475569" }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: "#94A3B8" }}>{user.businessName || "—"}</div>
                          {user.businessTier && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(6,182,212,0.1)", color: "#06B6D4" }}>
                              {user.businessTier}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.teamCount > 0 ? (
                            <button
                              onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                              style={{ background: "rgba(6,182,212,0.1)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.2)" }}
                            >
                              <Users className="w-3 h-3" />
                              {user.teamCount}
                              <ChevronDown
                                className="w-3 h-3 transition-transform"
                                style={{ transform: expandedUserId === user.id ? "rotate(180deg)" : undefined }}
                              />
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: "#475569" }}>—</span>
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
                              onClick={() => { setSelectedUserId(user.id); setDetailTab("info"); }}
                              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                              style={{ background: "#1E1E2E", color: "#94A3B8" }}
                            >
                              פרטים
                            </button>
                            <button
                              onClick={() => { setSelectedUserId(user.id); setDetailTab("subscription"); }}
                              className="text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                              style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}
                              title="ניהול מנוי ופיצ'רים"
                            >
                              <Zap className="w-3 h-3" /> מנוי
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
                            <button
                              onClick={() => setDeleteConfirmId(user.id)}
                              title="מחק משתמש"
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: "#EF444408", color: "#EF444460" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#EF444460")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedUserId === user.id && (
                        <tr style={{ background: "#0A0A0F" }}>
                          <td colSpan={8} className="px-4 py-3">
                            <TeamMembersRow userId={user.id} />
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #1E1E2E" }}>
                <span className="text-xs" style={{ color: "#64748B" }}>עמוד {page} מתוך {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg disabled:opacity-30" style={{ background: "#1E1E2E", color: "#94A3B8" }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg disabled:opacity-30" style={{ background: "#1E1E2E", color: "#94A3B8" }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── User Detail Modal ──────────────────────────────────────────────── */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUserId(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} />
          <div
            className="relative rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            style={{ background: "#0D0D14", border: "1px solid #1E1E2E" }}
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-12 text-center text-sm flex-1 flex items-center justify-center" style={{ color: "#64748B" }}>
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : userDetail ? (
              <>
                {/* Modal header */}
                <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid #1E1E2E" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4" }}>
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
                  <button onClick={() => setSelectedUserId(null)} className="p-1 rounded-lg hover:bg-white/5" style={{ color: "#64748B" }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid #1E1E2E", background: "#0A0A0F" }}>
                  {([
                    { key: "info", label: "פרטים וניהול" },
                    { key: "subscription", label: "מנוי ופיצ׳רים" },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key)}
                      className="px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2"
                      style={
                        detailTab === tab.key
                          ? { color: "#06B6D4", borderBottom: "2px solid #06B6D4" }
                          : { color: "#64748B" }
                      }
                    >
                      {tab.key === "subscription" && <Zap className="w-3.5 h-3.5" />}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="overflow-y-auto flex-1 p-6">
                  {detailTab === "info" ? (
                    <div className="space-y-5">
                      {/* Status */}
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
                      <div className="p-4 rounded-xl space-y-3" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                        <div className="text-sm text-white font-medium">הרשאות פלטפורמה</div>
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

                      {/* Businesses */}
                      {userDetail.businessMemberships.length > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
                            <Laptop className="w-3 h-3" /> עסקים
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
                            <Clock className="w-3 h-3" /> סשנים פעילים ({userDetail.sessions.length})
                          </div>
                          {userDetail.sessions.map((s) => (
                            <div key={s.id} className="px-3 py-2 rounded-lg mb-1.5" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-white">{s.ipAddress || "IP לא ידוע"}</div>
                                <div className="text-[10px]" style={{ color: "#475569" }}>{relativeTime(s.lastSeenAt)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Activity */}
                      {userDetail.activityLogs.length > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
                            <Activity className="w-3 h-3" /> פעילות אחרונה
                          </div>
                          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1E1E2E" }}>
                            {userDetail.activityLogs.slice(0, 8).map((log) => (
                              <div key={log.id} className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid #1E1E2E" }}>
                                <span className="text-xs" style={{ color: "#94A3B8" }}>{ACTION_LABELS[log.action] || log.action}</span>
                                <span className="text-[10px]" style={{ color: "#475569" }}>{relativeTime(log.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => qc.invalidateQueries({ queryKey: ["admin-user-detail", selectedUserId] })}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                        style={{ background: "#12121A", color: "#64748B", border: "1px solid #1E1E2E" }}
                      >
                        <RefreshCw className="w-3 h-3" /> רענן נתונים
                      </button>
                    </div>
                  ) : (
                    /* ── Subscription & Features tab ───────────────────── */
                    activeBusiness ? (
                      <FeaturePanel
                        business={activeBusiness}
                        onRefresh={() => refetchDetail()}
                      />
                    ) : (
                      <div className="text-center py-10 text-sm" style={{ color: "#64748B" }}>
                        למשתמש זה אין עסק משויך
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-sm flex-1" style={{ color: "#64748B" }}>שגיאה בטעינת פרטים</div>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-right" style={{ background: "#0D0D14", border: "1px solid #EF444430" }} dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}>
                <Trash2 className="w-5 h-5" style={{ color: "#EF4444" }} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">מחיקת משתמש</h3>
                <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>פעולה זו אינה הפיכה</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              כל הנתונים של המשתמש (סשנים, חברויות בעסקים, הגדרות) יימחקו לצמיתות.
              העסקים עצמם <strong className="text-white">לא</strong> יימחקו.
            </p>
            {deleteMutation.isError && (
              <p className="text-xs" style={{ color: "#EF4444" }}>
                {(deleteMutation.error as Error).message}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(239,68,68,0.2)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleteMutation.isPending ? "מוחק..." : "כן, מחק"}
              </button>
              <button
                onClick={() => { setDeleteConfirmId(null); deleteMutation.reset(); }}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "#1E1E2E", color: "#94A3B8" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} />
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-md"
        style={{ background: "#0D0D14", border: "1px solid #1E1E2E" }}
        onClick={(e) => e.stopPropagation()}
      >
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
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5" style={{ color: "#64748B" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>שם מלא *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" dir="rtl"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>אימייל *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" dir="ltr"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>סיסמה * (מינימום 8 תווים)</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 8 תווים" dir="ltr"
                className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>תפקיד מערכת</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "USER" | "MASTER")}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}>
                <option value="USER">User</option>
                <option value="MASTER">Master</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>הרשאות פלטפורמה</label>
              <select value={platformRole} onChange={(e) => setPlatformRole(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0" }}>
                <option value="">ללא</option>
                <option value="support">תמיכה</option>
                <option value="admin">אדמין</option>
                <option value="super_admin">סופר-אדמין</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={() => { if (!name.trim()) return setError("שם חובה"); if (!email.includes("@")) return setError("אימייל לא תקין"); if (password.length < 8) return setError("סיסמה חייבת להכיל לפחות 8 תווים"); mutation.mutate({ name, email, password, role, platformRole: platformRole || null }); }}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.25)" }}>
              {mutation.isPending ? "יוצר..." : "צור משתמש"}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#1E1E2E", color: "#94A3B8" }}>
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
