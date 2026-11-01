"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Plus, X, ChevronDown, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchJSON, cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { TIER_LABELS } from "@/lib/platform-labels";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";

type TenantsT = ReturnType<typeof useTranslations<"owner.ownerTenantsPage">>;

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  status: string;
  createdAt: string;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  owner: { id: string; name: string; email: string; lastLoginAt: string | null } | null;
  isTest: boolean;
  _count: { members: number };
}

interface TenantsResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
  includeTest: boolean;
  testCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "badge-success",
  suspended: "badge-danger",
  closed: "badge-neutral",
};

const VALID_STATUSES = ["active", "suspended", "closed"];

/** dd.MM.yy */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

/** Relative time ("3 days ago"); "never" when null. */
function relativeHe(iso: string | null, tr: TenantsT): string {
  if (!iso) return tr("relative.never");
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tr("relative.justNow");
  if (minutes < 60) return minutes === 1 ? tr("relative.minute") : tr("relative.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? tr("relative.hour") : hours === 2 ? tr("relative.twoHours") : tr("relative.hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return tr("relative.yesterday");
  if (days === 2) return tr("relative.twoDays");
  if (days < 30) return tr("relative.days", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? tr("relative.month") : months === 2 ? tr("relative.twoMonths") : tr("relative.months", { count: months });
  const years = Math.floor(days / 365) || 1;
  return years === 1 ? tr("relative.year") : years === 2 ? tr("relative.twoYears") : tr("relative.years", { count: years });
}

/** Secondary line under the tier badge: paid-until or trial-until. */
function subscriptionLine(t: Tenant, tr: TenantsT): string | null {
  if (t.subscriptionStatus === "active" && t.subscriptionEndsAt) {
    return tr("subscriptionUntil", { date: shortDate(t.subscriptionEndsAt) });
  }
  if (t.trialEndsAt && new Date(t.trialEndsAt).getTime() > Date.now()) {
    return tr("trialUntil", { date: shortDate(t.trialEndsAt) });
  }
  return null;
}

// Labels: owner.ownerTenantsPage.tiers.<value>; price = monthly amount (platform price list)
const TIERS = [
  { value: "free",        price: 0   },
  { value: "basic",       price: 99  },
  { value: "pro",         price: 199 },
  { value: "service_dog", price: 229 },
  { value: "groomer",     price: 169 },
];

export default function TenantsPage() {
  return (
    <Suspense fallback={<PetraLoader />}>
      <TenantsPageInner />
    </Suspense>
  );
}

function TenantsPageInner() {
  const t = useTranslations("owner.ownerTenantsPage");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    VALID_STATUSES.includes(initialStatus) ? initialStatus : ""
  );
  const [includeTest, setIncludeTest] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery<TenantsResponse>({
    queryKey: ["owner", "tenants", { search, statusFilter, tierFilter, page, includeTest }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (tierFilter) params.set("tier", tierFilter);
      if (includeTest) params.set("includeTest", "1");
      return fetchJSON(`/api/owner/tenants?${params}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (tenant: Tenant) =>
      fetchJSON(`/api/owner/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: tenant.status === "active" ? "suspended" : "active" }),
      }),
    onSuccess: (_res, tenant) => {
      queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] });
      toast.success(tenant.status === "active" ? t("toasts.suspended", { name: tenant.name }) : t("toasts.activated", { name: tenant.name }));
      setSuspendTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.actionFailed")),
  });

  const tenants = data?.tenants ?? [];
  const total = data?.total ?? 0;
  const hiddenTestCount = !includeTest ? data?.testCount ?? 0 : 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("total", { total })}
            {hiddenTestCount > 0 && (
              <span className="text-slate-500">{t("hiddenTest", { count: hiddenTestCount })}</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t("newTenant")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input w-full ps-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">{t("filters.allStatuses")}</option>
          <option value="active">{t("statuses.active")}</option>
          <option value="suspended">{t("statuses.suspended")}</option>
          <option value="closed">{t("statuses.closed")}</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">{t("filters.allTiers")}</option>
          {TIERS.map((tier) => (
            <option key={tier.value} value={tier.value}>{t(`tiers.${tier.value}`)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => { setIncludeTest(e.target.checked); setPage(1); }}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
          />
          {t("filters.showTest")}
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
          {t("loadError", { message: (error as Error).message })}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header-cell">{t("columns.business")}</th>
                <th className="table-header-cell">{t("columns.owner")}</th>
                <th className="table-header-cell">{t("columns.lastLogin")}</th>
                <th className="table-header-cell">{t("columns.subscription")}</th>
                <th className="table-header-cell">{t("columns.members")}</th>
                <th className="table-header-cell">{t("columns.status")}</th>
                <th className="table-header-cell">{t("columns.created")}</th>
                <th className="table-header-cell">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <Link
                          href={`/owner/tenants/${tenant.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                        >
                          {tenant.name}
                        </Link>
                        {tenant.isTest && (
                          <span className="badge badge-neutral ms-2">{t("testBadge")}</span>
                        )}
                        {tenant.email && (
                          <div className="text-xs text-slate-500">{tenant.email}</div>
                        )}
                        {tenant.phone && (
                          <div className="text-xs text-slate-500" dir="ltr">{tenant.phone}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    {tenant.owner ? (
                      <div>
                        <Link
                          href={`/owner/users/${tenant.owner.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-orange-600 transition-colors"
                        >
                          {tenant.owner.name || tenant.owner.email}
                        </Link>
                        <div className="text-xs text-slate-500">{tenant.owner.email}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">{t("noOwner")}</span>
                    )}
                  </td>
                  <td
                    className="table-cell text-sm text-slate-700 whitespace-nowrap"
                    title={tenant.owner?.lastLoginAt ? new Date(tenant.owner.lastLoginAt).toLocaleString(locale) : undefined}
                  >
                    {tenant.owner ? relativeHe(tenant.owner.lastLoginAt, t) : "—"}
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-neutral">{TIER_LABELS[tenant.tier] ?? tenant.tier}</span>
                    {subscriptionLine(tenant, t) && (
                      <div className="text-xs text-slate-500 mt-1 whitespace-nowrap">{subscriptionLine(tenant, t)}</div>
                    )}
                  </td>
                  <td className="table-cell text-sm text-slate-600">
                    {tenant._count.members}
                  </td>
                  <td className="table-cell">
                    <span className={cn("badge", STATUS_BADGE[tenant.status] ?? "badge-neutral")}>
                      {t.has(`statuses.${tenant.status}`) ? t(`statuses.${tenant.status}`) : tenant.status}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-500">
                    {new Date(tenant.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() =>
                        tenant.status === "active" ? setSuspendTarget(tenant) : toggleMutation.mutate(tenant)
                      }
                      disabled={toggleMutation.isPending || tenant.status === "closed"}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40",
                        tenant.status === "active"
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      )}
                    >
                      {tenant.status === "active" ? t("rowActions.suspend") : t("rowActions.activate")}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500 text-sm">
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t("pagination.pageOf", { page, totalPages })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                {t("pagination.prev")}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suspend confirmation */}
      {suspendTarget && (
        <div
          className="modal-overlay"
          onClick={() => !toggleMutation.isPending && setSuspendTarget(null)}
        >
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-tenant-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 id="suspend-tenant-title" className="text-lg font-bold text-slate-900">
                  {t("suspendModal.title", { name: suspendTarget.name })}
                </h2>
                <p className="text-sm text-slate-700 mt-1">
                  {t("suspendModal.body", { count: suspendTarget._count.members })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setSuspendTarget(null)}
                disabled={toggleMutation.isPending}
                className="btn-secondary flex-1 disabled:opacity-40"
              >
                {tc("actions.cancel")}
              </button>
              <button
                onClick={() => toggleMutation.mutate(suspendTarget)}
                disabled={toggleMutation.isPending}
                className="btn-danger flex-1 disabled:opacity-40"
              >
                {toggleMutation.isPending ? t("suspendModal.suspending") : t("suspendModal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={(ownerEmail) => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["owner", "tenants"] });
            if (ownerEmail) {
              alert(t("createdAlert", { email: ownerEmail }));
            }
          }}
        />
      )}
    </div>
  );
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ownerEmail?: string) => void }) {
  const t = useTranslations("owner.ownerTenantsPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tier, setTier] = useState("basic");
  const [showOwner, setShowOwner] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/owner/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          tier,
          ownerName: showOwner && ownerName ? ownerName : undefined,
          ownerEmail: showOwner && ownerEmail ? ownerEmail : undefined,
          ownerPassword: showOwner && ownerPassword ? ownerPassword : undefined,
        }),
      }),
    onSuccess: (data: unknown) => {
      const result = data as { business: unknown; owner: { email: string } | null };
      onCreated(result.owner?.email);
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{t("createModal.title")}</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg" aria-label={tc("actions.close")} title={tc("actions.close")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">{t("createModal.nameLabel")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder={t("createModal.namePlaceholder")}
            />
          </div>
          <div>
            <label className="label">{t("createModal.emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="label">{t("createModal.phoneLabel")}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input w-full"
              dir="ltr"
              placeholder="050-1234567"
            />
          </div>
          <div>
            <label className="label">{t("createModal.tierLabel")}</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="input w-full">
              {TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {t("createModal.tierOption", { label: t(`tiers.${tier.value}`), price: `${currencySymbol({ locale, currency })}${tier.price}` })}
                </option>
              ))}
            </select>
          </div>

          {/* Owner section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOwner((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span>{t("createModal.addOwner")}</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showOwner && "rotate-180")} />
            </button>
            {showOwner && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-500">{t("createModal.ownerHint")}</p>
                <div>
                  <label className="label">{t("createModal.ownerNameLabel")}</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="input w-full"
                    placeholder={t("createModal.ownerNamePlaceholder")}
                  />
                </div>
                <div>
                  <label className="label">{t("createModal.ownerEmailLabel")}</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="input w-full"
                    dir="ltr"
                    placeholder="owner@example.com"
                  />
                </div>
                <div>
                  <label className="label">{t("createModal.passwordLabel")}</label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="input w-full"
                    dir="ltr"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {mutation.error && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 text-red-600 text-xs">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">
            {tc("actions.cancel")}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {mutation.isPending ? t("createModal.creating") : t("createModal.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
