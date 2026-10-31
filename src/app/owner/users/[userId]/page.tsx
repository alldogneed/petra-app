"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Shield, Building2, UserCheck, UserX, Loader2, Check, Minus, AlertTriangle, Trash2, X } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";
import { type FeatureKey, type TierKey, hasFeature } from "@/lib/feature-flags";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";
import { TIER_LABELS, PLATFORM_ROLE_LABELS } from "@/lib/platform-labels";

// ─── Feature panel definitions ────────────────────────────────────────────────

type DetailT = ReturnType<typeof useTranslations<"owner">>;

// Monthly price (number, shown next to the currency symbol); `note` = has a tier note in messages.
const TIERS: { key: TierKey; price: number; note?: boolean }[] = [
  // Public tiers
  { key: "free",        price: 0   },
  { key: "basic",       price: 99  },
  { key: "pro",         price: 199 },
  // Enterprise / legacy
  { key: "service_dog", price: 229, note: true },
  { key: "groomer",     price: 169, note: true },
];

function tierLabel(tier: string, t: DetailT): string {
  return TIER_LABELS[tier] ?? t("usersDetailPage.otherTier");
}

const FEATURE_ROWS: { key: FeatureKey }[] = [
  { key: "gcal_sync" },
  { key: "payments" },
  { key: "invoicing" },
  { key: "scheduled_messages" },
  { key: "automations" },
  { key: "custom_messages" },
  { key: "training" },
  { key: "training_groups" },
  { key: "boarding" },
  { key: "leads" },
  { key: "staff_management" },
  { key: "excel_export" },
  { key: "groomer_portfolio" },
  { key: "service_dogs" },
];

type OverrideValue = true | false | null;

interface BusinessInfo {
  id: string;
  name: string;
  status: string;
  tier: string;
  featureOverrides: Record<string, boolean> | null;
}

interface BusinessMembership {
  id: string;
  role: string;
  isActive: boolean;
  business: BusinessInfo;
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

// Labels: owner.usersDetailPage.memberRoles.* / owner.usersDetailPage.bizStatus.*
const MEMBER_ROLES = ["owner", "manager", "user", "staff", "volunteer"];
const BIZ_STATUSES = ["active", "suspended", "closed"];

// ─── FeaturePanel ─────────────────────────────────────────────────────────────

function FeaturePanel({ business, onRefresh }: { business: BusinessInfo; onRefresh: () => void }) {
  const t = useTranslations("owner");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const symbol = currencySymbol({ locale, currency });
  const overrides = (business.featureOverrides as Record<string, boolean> | null) ?? {};
  const overrideCount = Object.keys(overrides).length;

  const tierMutation = useMutation({
    mutationFn: (tier: string) =>
      fetchJSON(`/api/owner/tenants/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      }),
    onSuccess: onRefresh,
  });

  const overrideMutation = useMutation({
    mutationFn: (newOverrides: Record<string, boolean>) =>
      fetchJSON(`/api/owner/tenants/${business.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: newOverrides }),
      }),
    onSuccess: onRefresh,
  });

  function setOverride(feature: FeatureKey, value: OverrideValue) {
    const next = { ...overrides };
    if (value === null) {
      delete next[feature];
    } else {
      next[feature] = value;
    }
    overrideMutation.mutate(next);
  }

  function resetAll() {
    overrideMutation.mutate({});
  }

  return (
    <div className="space-y-4">
      {/* Tier selector */}
      <div>
        <label className="label mb-1">{t("usersDetailPage.features.subscription")}</label>
        <div className="flex items-center gap-3">
          <select
            value={business.tier}
            onChange={(e) => tierMutation.mutate(e.target.value)}
            disabled={tierMutation.isPending}
            className="input flex-1"
          >
            {!TIERS.some((tier) => tier.key === business.tier) && (
              <option value={business.tier}>{tierLabel(business.tier, t)}</option>
            )}
            {TIERS.map((tier) => (
              <option key={tier.key} value={tier.key}>
                {tier.note
                  ? t("usersDetailPage.features.tierOptionWithNote", { tier: tierLabel(tier.key, t), note: t(`usersDetailPage.tierNotes.${tier.key}`), price: `${symbol}${tier.price}` })
                  : t("usersDetailPage.features.tierOption", { tier: tierLabel(tier.key, t), price: `${symbol}${tier.price}` })}
              </option>
            ))}
          </select>
          {tierMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
          {tierMutation.isSuccess && <Check className="w-4 h-4 text-green-500" />}
        </div>
      </div>

      {/* Feature overrides */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">{t("usersDetailPage.features.featuresLabel")}</label>
          {overrideCount > 0 && (
            <button
              onClick={resetAll}
              disabled={overrideMutation.isPending}
              className="text-xs text-orange-600 hover:text-orange-700 underline"
            >
              {t("usersDetailPage.features.resetAll", { count: overrideCount })}
            </button>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <div className="min-w-[440px]">
          <div className="grid grid-cols-4 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-200">
            <div>{t("usersDetailPage.features.colFeature")}</div>
            <div className="text-center">{t("usersDetailPage.features.colTierDefault")}</div>
            <div className="text-center">{t("usersDetailPage.features.colOverride")}</div>
            <div className="text-center">{t("usersDetailPage.features.colEffective")}</div>
          </div>

          {FEATURE_ROWS.map(({ key }) => {
            const tierDefault = hasFeature(business.tier, key);
            const override = key in overrides ? overrides[key] : null;
            const effective = override !== null ? override : tierDefault;
            const hasOverride = override !== null;

            return (
              <div
                key={key}
                className={cn(
                  "grid grid-cols-4 items-center px-3 py-2 border-b border-slate-100 last:border-0",
                  hasOverride ? "bg-orange-50/40" : "hover:bg-slate-50/50"
                )}
              >
                {/* Label */}
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  {t(`usersDetailPage.featureLabels.${key}`)}
                  {hasOverride && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-700">
                      OR
                    </span>
                  )}
                </div>

                {/* Tier default */}
                <div className="flex justify-center">
                  {tierDefault ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Minus className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                {/* Override 3-state button */}
                <div className="flex justify-center">
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[10px] font-medium">
                    <button
                      onClick={() => setOverride(key, null)}
                      disabled={overrideMutation.isPending}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        override === null
                          ? "bg-slate-600 text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {t("usersDetailPage.features.default")}
                    </button>
                    <button
                      onClick={() => setOverride(key, true)}
                      disabled={overrideMutation.isPending}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        override === true
                          ? "bg-green-500 text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setOverride(key, false)}
                      disabled={overrideMutation.isPending}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        override === false
                          ? "bg-red-500 text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      ✗
                    </button>
                  </div>
                </div>

                {/* Effective */}
                <div className="flex justify-center">
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded",
                    effective ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {effective ? t("usersDetailPage.features.effectiveOn") : t("usersDetailPage.features.effectiveOff")}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {overrideMutation.isPending && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> {tc("progress.saving")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const t = useTranslations("owner");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showBlock, setShowBlock] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

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
    onSuccess: (_res, isActive) => {
      toast.success(isActive ? t("usersDetailPage.toasts.unblocked") : t("usersDetailPage.toasts.blocked"));
      setShowBlock(false);
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
    },
    onError: (err: Error) => toast.error(err.message || t("usersDetailPage.toasts.actionFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetchJSON(`/api/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("usersDetailPage.toasts.deleted"));
      queryClient.removeQueries({ queryKey: ["owner", "users", userId] });
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
      router.push("/owner/users");
    },
    onError: (err: Error) => toast.error(err.message || t("usersDetailPage.toasts.deleteFailed")),
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

  function refetchDetail() {
    queryClient.invalidateQueries({ queryKey: ["owner", "users", userId] });
  }

  if (isLoading) {
    return <PetraLoader />;
  }

  if (error || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">{t("usersDetailPage.loadError")}</p>
        <button onClick={() => router.push("/owner/users")} className="btn-secondary">
          {t("usersDetailPage.backToList")}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/owner/users" className="btn-ghost p-2 rounded-lg" aria-label={t("usersDetailPage.backToList")} title={t("usersDetailPage.backToList")}>
          <ArrowRight className="w-5 h-5 ltr:-scale-x-100" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{user.name}</h1>
            <span className={cn("badge", user.isActive ? "badge-success" : "badge-danger")}>
              {user.isActive ? t("usersDetailPage.status.active") : t("usersDetailPage.status.blocked")}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 break-all">{user.email}</p>
        </div>
        <button
          onClick={() => (user.isActive ? setShowBlock(true) : toggleMutation.mutate(true))}
          disabled={toggleMutation.isPending}
          className={cn(
            "text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-40 flex items-center gap-2",
            user.isActive ? "btn-danger" : "bg-green-50 text-green-600 hover:bg-green-100"
          )}
        >
          {user.isActive ? (
            <><UserX className="w-4 h-4" /> {toggleMutation.isPending ? t("usersDetailPage.block.blocking") : t("usersDetailPage.block.blockUser")}</>
          ) : (
            <><UserCheck className="w-4 h-4" /> {toggleMutation.isPending ? t("usersDetailPage.block.unblocking") : t("usersDetailPage.block.unblock")}</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Details */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">{t("usersDetailPage.details.title")}</h2>
          <div className="space-y-3">
            <div>
              <div className="label">{t("usersDetailPage.details.name")}</div>
              <div className="text-sm text-slate-900">{user.name}</div>
            </div>
            <div>
              <div className="label">{t("usersDetailPage.details.email")}</div>
              <div className="text-sm text-slate-900" dir="ltr">{user.email}</div>
            </div>
            <div>
              <div className="label">2FA</div>
              <div className="text-sm">
                {user.twoFaEnabled ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Shield className="w-3.5 h-3.5" /> {t("usersDetailPage.details.twoFaOn")}
                  </span>
                ) : (
                  <span className="text-slate-500">{t("usersDetailPage.details.twoFaOff")}</span>
                )}
              </div>
            </div>
            <div>
              <div className="label">{t("usersDetailPage.details.created")}</div>
              <div className="text-sm text-slate-900">{new Date(user.createdAt).toLocaleDateString(locale)}</div>
            </div>
            <div>
              <div className="label">{t("usersDetailPage.details.updated")}</div>
              <div className="text-sm text-slate-900">{new Date(user.updatedAt).toLocaleDateString(locale)}</div>
            </div>
          </div>
        </div>

        {/* Role management */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">{t("usersDetailPage.role.title")}</h2>
          <div className="mb-3">
            <div className="label">{t("usersDetailPage.role.current")}</div>
            {user.platformRole ? (
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded",
                user.platformRole === "super_admin" ? "bg-red-100 text-red-700" :
                user.platformRole === "admin" ? "bg-orange-100 text-orange-700" :
                "bg-blue-100 text-blue-700"
              )}>
                {PLATFORM_ROLE_LABELS[user.platformRole] ?? t("usersDetailPage.role.otherRole")}
              </span>
            ) : (
              <span className="text-sm text-slate-500">{t("usersDetailPage.role.noPlatformRole")}</span>
            )}
          </div>
          <div>
            <div className="label mb-1">{t("usersDetailPage.role.change")}</div>
            <select
              defaultValue={user.platformRole ?? ""}
              onChange={(e) => roleMutation.mutate(e.target.value || null)}
              disabled={roleMutation.isPending}
              className="input w-full"
            >
              <option value="">{t("usersDetailPage.role.noRole")}</option>
              {Object.entries(PLATFORM_ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {roleMutation.isPending && <p className="text-xs text-slate-500 mt-1">{t("usersDetailPage.role.updating")}</p>}
            {roleMutation.error && <p className="text-xs text-red-600 mt-1">{(roleMutation.error as Error).message}</p>}
          </div>
        </div>
      </div>

      {/* Subscription & Features per business */}
      {user.businessMemberships.length > 0 && (
        <div className="mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900">{t("usersDetailPage.memberships.title")}</h2>
          {user.businessMemberships.map((membership) => (
            <div key={membership.id} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <Link
                    href={`/owner/tenants/${membership.business.id}`}
                    className="font-semibold text-slate-900 hover:text-orange-600 transition-colors"
                  >
                    {membership.business.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {t("usersDetailPage.memberships.line", {
                      role: MEMBER_ROLES.includes(membership.role)
                        ? t(`usersDetailPage.memberRoles.${membership.role}`)
                        : t("usersDetailPage.memberships.otherRole"),
                      status: BIZ_STATUSES.includes(membership.business.status)
                        ? t(`usersDetailPage.bizStatus.${membership.business.status}`)
                        : t("usersDetailPage.memberships.unknownStatus"),
                      tier: tierLabel(membership.business.tier, t),
                    })}
                    {!membership.isActive && t("usersDetailPage.memberships.inactive")}
                  </div>
                </div>
              </div>
              <FeaturePanel business={membership.business} onRefresh={refetchDetail} />
            </div>
          ))}
        </div>
      )}

      {/* Business memberships summary (when no subscription features — free/no business) */}
      {user.businessMemberships.length === 0 && (
        <div className="card p-5 mb-6 text-center text-slate-500 text-sm">
          {t("usersDetailPage.memberships.none")}
        </div>
      )}

      {/* Danger zone */}
      <div className="card p-5 border border-red-200">
        <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {t("usersDetailPage.danger.title")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            {t("usersDetailPage.danger.body")}
          </p>
          <button
            onClick={() => { setConfirmEmail(""); setShowDelete(true); }}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> {t("usersDetailPage.danger.deleteButton")}
          </button>
        </div>
      </div>

      {/* Block confirmation */}
      {showBlock && (
        <div className="modal-overlay" onClick={toggleMutation.isPending ? undefined : () => setShowBlock(false)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-label={t("usersDetailPage.block.dialogAria")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">{t("usersDetailPage.block.title", { name: user.name || user.email })}</h2>
                <p className="text-xs text-slate-500 mt-0.5 break-all" dir="ltr" style={{ textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              {t("usersDetailPage.block.body")}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowBlock(false)}
                disabled={toggleMutation.isPending}
                className="btn-secondary flex-1 disabled:opacity-40"
              >
                {tc("actions.cancel")}
              </button>
              <button
                onClick={() => toggleMutation.mutate(false)}
                disabled={toggleMutation.isPending}
                className="btn-danger flex-1 justify-center disabled:opacity-40"
              >
                {toggleMutation.isPending ? t("usersDetailPage.block.blocking") : t("usersDetailPage.block.blockUser")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — requires typing the user's email */}
      {showDelete && (
        <div className="modal-overlay" onClick={deleteMutation.isPending ? undefined : () => setShowDelete(false)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-label={t("usersDetailPage.delete.dialogAria")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">{t("usersDetailPage.delete.title", { name: user.name || user.email })}</h2>
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleteMutation.isPending}
                className="btn-ghost p-1 rounded-lg"
                aria-label={tc("actions.close")}
                title={tc("actions.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-700 mb-3">
              {t("usersDetailPage.delete.body")}
            </p>
            <p className="text-sm font-medium text-slate-900 mb-2 break-all" dir="ltr" style={{ textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
              {user.email}
            </p>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="input w-full"
              dir="ltr"
              autoComplete="off"
              aria-label={t("usersDetailPage.delete.inputAria")}
              placeholder={user.email}
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleteMutation.isPending}
                className="btn-secondary flex-1 disabled:opacity-40"
              >
                {tc("actions.cancel")}
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={
                  deleteMutation.isPending ||
                  confirmEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
                }
                className="btn-danger flex-1 justify-center disabled:opacity-40"
              >
                {deleteMutation.isPending ? tc("progress.deleting") : t("usersDetailPage.delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
