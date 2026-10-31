"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Search, Shield, UserCheck, UserX, Plus, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { fetchJSON, cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { TIER_LABELS, PLATFORM_ROLE_LABELS } from "@/lib/platform-labels";

interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  platformRole: string | null;
  isActive: boolean;
  twoFaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { businessMemberships: number };
  businessId: string | null;
  businessName: string | null;
  businessTier: string | null;
  businessRole: string | null;
  activityScore: number;
  lastActivityAt: string | null;
  isTest: boolean;
}

interface UsersResponse {
  users: PlatformUserRow[];
  total: number;
  page: number;
  limit: number;
}

type StatusFilter = "all" | "active" | "blocked";

const PAGE_SIZE = 20;

// Labels: owner.ownerUsersPage.statusFilter.*
const STATUS_OPTIONS: { key: StatusFilter }[] = [
  { key: "all" },
  { key: "active" },
  { key: "blocked" },
];

const ROLE_BADGE: Record<string, string> = {
  super_admin: "badge-danger",
  admin: "badge-brand",
  support: "badge-neutral",
};

type UsersT = ReturnType<typeof useTranslations<"owner">>;

/** Relative day distance ("today", "yesterday", "3 days ago") — texts in owner.ownerUsersPage.relative.*. */
function relativeDay(dateStr: string | null, t: UsersT, locale: string): string {
  if (!dateStr) return t("ownerUsersPage.relative.never");
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return t("ownerUsersPage.relative.never");
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return t("ownerUsersPage.relative.today");
  if (days === 1) return t("ownerUsersPage.relative.yesterday");
  if (days === 2) return t("ownerUsersPage.relative.twoDaysAgo");
  if (days < 30) return t("ownerUsersPage.relative.daysAgo", { days });
  if (days < 60) return t("ownerUsersPage.relative.monthAgo");
  if (days < 365) return t("ownerUsersPage.relative.monthsAgo", { months: Math.floor(days / 30) });
  return then.toLocaleDateString(locale);
}

export default function OwnerUsersPage() {
  const t = useTranslations("owner");
  const { locale, cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [staffOnly, setStaffOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [blockTarget, setBlockTarget] = useState<PlatformUserRow | null>(null);

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching, error } = useQuery<UsersResponse>({
    queryKey: ["owner", "users", { search, status, staffOnly, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (staffOnly) params.set("role", "staff");
      return fetchJSON<UsersResponse>(`/api/owner/users?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      fetchJSON(`/api/owner/users/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: vars.isActive }),
      }),
    onSuccess: (_res, vars) => {
      toast.success(vars.isActive ? t("ownerUsersPage.toasts.unblocked") : t("ownerUsersPage.toasts.blocked"));
      setBlockTarget(null);
      queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
    },
    onError: (err: Error) => toast.error(err.message || t("ownerUsersPage.toasts.actionFailed")),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!search || status !== "all" || staffOnly;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t("ownerUsersPage.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("ownerUsersPage.subtitle", { total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t("ownerUsersPage.newUser")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t("ownerUsersPage.searchPlaceholder")}
            aria-label={t("ownerUsersPage.searchAria")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input w-full ps-10"
          />
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label={t("ownerUsersPage.statusFilterAria")}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setStatus(opt.key); setPage(1); }}
              aria-pressed={status === opt.key}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg font-medium transition-colors",
                status === opt.key
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {t(`ownerUsersPage.statusFilter.${opt.key}`)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={staffOnly}
            onChange={(e) => { setStaffOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300 accent-orange-500"
          />
          {t("ownerUsersPage.staffOnly")}
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          {t("ownerUsersPage.loadError", { message: (error as Error).message })}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : users.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            {hasFilters
              ? t("ownerUsersPage.emptyFiltered")
              : t("ownerUsersPage.empty")}
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header-cell">{t("ownerUsersPage.columns.user")}</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.business")}</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.platformRole")}</th>
                  <th className="table-header-cell">2FA</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.joined")}</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.lastActivity")}</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.score30")}</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.status")}</th>
                  <th className="table-header-cell">{t("ownerUsersPage.columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const lastSeen = user.lastActivityAt ?? user.lastLoginAt;
                  const extraBusinesses = user._count.businessMemberships - 1;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold flex-shrink-0">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/owner/users/${user.id}`}
                                className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                              >
                                {user.name || user.email}
                              </Link>
                              {user.isTest && <span className="badge badge-neutral">{t("ownerUsersPage.testBadge")}</span>}
                            </div>
                            <div className="text-xs text-slate-500" dir="ltr" style={{ textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        {user.businessId && user.businessName ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/owner/tenants/${user.businessId}`}
                              className="text-sm text-slate-700 hover:text-orange-600 transition-colors"
                            >
                              {user.businessName}
                            </Link>
                            {user.businessTier && (
                              <span className="badge badge-brand">
                                {TIER_LABELS[user.businessTier] ?? t("ownerUsersPage.otherTier")}
                              </span>
                            )}
                            {extraBusinesses > 0 && (
                              <span
                                className="text-xs text-slate-500"
                                title={t("ownerUsersPage.linkedBusinesses", { count: user._count.businessMemberships })}
                              >
                                +{extraBusinesses}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {user.platformRole ? (
                          <span className={cn("badge", ROLE_BADGE[user.platformRole] ?? "badge-neutral")}>
                            {PLATFORM_ROLE_LABELS[user.platformRole] ?? t("ownerUsersPage.otherRole")}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {user.twoFaEnabled ? (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <Shield className="w-3.5 h-3.5" /> {t("ownerUsersPage.twoFaOn")}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="table-cell text-sm text-slate-700 whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td
                        className="table-cell text-sm text-slate-700 whitespace-nowrap"
                        title={lastSeen ? new Date(lastSeen).toLocaleString(locale) : undefined}
                      >
                        {relativeDay(lastSeen, t, locale)}
                      </td>
                      <td className="table-cell">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            user.activityScore > 0 ? "text-slate-900" : "text-slate-500"
                          )}
                          title={t("ownerUsersPage.scoreTitle")}
                        >
                          {user.activityScore}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={cn("badge", user.isActive ? "badge-success" : "badge-danger")}>
                          {user.isActive ? t("ownerUsersPage.status.active") : t("ownerUsersPage.status.blocked")}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Link
                            href={`/owner/users/${user.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                          >
                            {t("ownerUsersPage.details")}
                          </Link>
                          {user.isActive ? (
                            <button
                              onClick={() => setBlockTarget(user)}
                              disabled={toggleMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              <UserX className="w-3.5 h-3.5" /> {t("ownerUsersPage.block")}
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleMutation.mutate({ id: user.id, isActive: true })}
                              disabled={toggleMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> {t("ownerUsersPage.unblock")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t("ownerUsersPage.pagination.pageOf", { page, totalPages })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                {t("ownerUsersPage.pagination.prev")}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                {t("ownerUsersPage.pagination.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Block confirmation */}
      {blockTarget && (
        <BlockUserModal
          user={blockTarget}
          pending={toggleMutation.isPending}
          onClose={() => setBlockTarget(null)}
          onConfirm={() => toggleMutation.mutate({ id: blockTarget.id, isActive: false })}
        />
      )}

      {/* Create User Modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            toast.success(t("ownerUsersPage.toasts.created"));
            queryClient.invalidateQueries({ queryKey: ["owner", "users"] });
          }}
        />
      )}
    </div>
  );
}

function BlockUserModal({
  user,
  pending,
  onClose,
  onConfirm,
}: {
  user: { name: string; email: string };
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("owner");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  return (
    <div className="modal-overlay" onClick={pending ? undefined : onClose}>
      <div className="modal-backdrop" />
      <div
        className="modal-content max-w-md p-5"
        role="dialog"
        aria-modal="true"
        aria-label={t("ownerUsersPage.blockModal.dialogAria")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{t("ownerUsersPage.blockModal.title", { name: user.name || user.email })}</h2>
            <p className="text-xs text-slate-500 mt-0.5 break-all" dir="ltr" style={{ textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
              {user.email}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-700">
          {t("ownerUsersPage.blockModal.body")}
        </p>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={pending} className="btn-secondary flex-1 disabled:opacity-40">
            {tc("actions.cancel")}
          </button>
          <button onClick={onConfirm} disabled={pending} className="btn-danger flex-1 justify-center disabled:opacity-40">
            {pending ? t("ownerUsersPage.blockModal.blocking") : t("ownerUsersPage.blockModal.blockUser")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("owner");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [platformRole, setPlatformRole] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          platformRole: platformRole || null,
        }),
      }),
    onSuccess: () => onCreated(),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{t("ownerUsersPage.createModal.title")}</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg" aria-label={tc("actions.close")} title={tc("actions.close")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">{t("ownerUsersPage.createModal.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder={t("ownerUsersPage.createModal.namePlaceholder")}
            />
          </div>
          <div>
            <label className="label">{t("ownerUsersPage.createModal.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="label">{t("ownerUsersPage.createModal.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder={t("ownerUsersPage.createModal.passwordPlaceholder")}
            />
          </div>
          <div>
            <label className="label">{t("ownerUsersPage.createModal.platformRole")}</label>
            <select value={platformRole} onChange={(e) => setPlatformRole(e.target.value)} className="input w-full">
              <option value="">{t("ownerUsersPage.createModal.noPlatformRole")}</option>
              {Object.entries(PLATFORM_ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {mutation.error && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 text-red-700 text-xs">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">
            {tc("actions.cancel")}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || !email.trim() || !password || password.length < 8 || mutation.isPending}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {mutation.isPending ? t("ownerUsersPage.createModal.creating") : t("ownerUsersPage.createModal.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
