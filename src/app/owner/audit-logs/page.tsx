"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, RefreshCw } from "lucide-react";
import { fetchJSON, cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { AUDIT_ACTION_LABELS, TARGET_TYPE_LABELS, auditActionLabel } from "@/lib/platform-labels";
import { ACTIVITY_ACTIONS as A, DELETE_ACTIONS, actionLabel } from "@/lib/activity-actions";

type TabKey = "admin" | "activity";

const TABS: { key: TabKey; label: string }[] = [
  { key: "admin", label: "פעולות אדמין" },
  { key: "activity", label: "פעילות משתמשים" },
];

/* ───────────────────────── Tab 1 — admin audit log ───────────────────────── */

interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  ipAddress: string | null;
  actorPlatformRole: string | null;
  metadataJson: string;
  actor: { id: string; name: string | null; email: string } | null;
}

interface AuditLogsResponse {
  logs: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
}

const AUDIT_PAGE_SIZE = 50;

const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label }));

function auditBadgeClass(action: string): string {
  if (/(FAILURE|FAILED|BLOCKED|DELETED|SUSPENDED|CLOSED|DEACTIVATED|REVOKED)/.test(action) && !action.includes("UNBLOCKED")) {
    return "badge-danger";
  }
  if (/(SUCCESS|ACTIVATED|UNBLOCKED|VERIFIED|ENROLLED|REACTIVATED)/.test(action)) return "badge-success";
  if (/(IMPERSONATION|SUPER_ADMIN|ROLE_CHANGED|EXPORT)/.test(action)) return "badge-warning";
  if (/(CREATED|ONBOARDED|INVITED|LINKED)/.test(action)) return "badge-brand";
  return "badge-neutral";
}

function targetHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "business") return `/owner/tenants/${encodeURIComponent(id)}`;
  if (type === "user") return `/owner/users/${encodeURIComponent(id)}`;
  return null;
}

function AuditTarget({ log }: { log: AuditLogRow }) {
  if (!log.targetType) return <span className="text-slate-500">—</span>;
  const typeLabel = TARGET_TYPE_LABELS[log.targetType] ?? "יעד אחר";

  if (log.targetName) {
    const href = targetHref(log.targetType, log.targetId);
    return (
      <div>
        {href ? (
          <Link href={href} className="font-medium text-brand-600 hover:underline">
            {log.targetName}
          </Link>
        ) : (
          <span className="font-medium text-slate-700">{log.targetName}</span>
        )}
        <div className="text-slate-500">{typeLabel}</div>
      </div>
    );
  }

  // Only business/user targets are resolved to a name by the API — for those a missing name means deleted.
  const resolvable = log.targetType === "business" || log.targetType === "user";
  return (
    <span className="text-slate-500">
      {typeLabel}
      {resolvable && log.targetId ? " (נמחק)" : ""}
    </span>
  );
}

function AdminActionsTab() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<AuditLogsResponse>({
    queryKey: ["owner", "audit-logs", { action, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(AUDIT_PAGE_SIZE) });
      if (action) params.set("action", action);
      return fetchJSON(`/api/owner/audit-logs?${params}`);
    },
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / AUDIT_PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label htmlFor="audit-action-filter" className="sr-only">
          סינון לפי פעולה
        </label>
        <select
          id="audit-action-filter"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="input w-full sm:w-64"
        >
          <option value="">כל הפעולות</option>
          {AUDIT_ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {data && <span className="text-sm text-slate-500">{total.toLocaleString("he-IL")} אירועים</span>}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          שגיאה בטעינת יומן הפעולות: {(error as Error).message}
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {action ? "לא נמצאו אירועים מסוג זה. נסו לבחור פעולה אחרת." : "עדיין לא נרשמו פעולות אדמין."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header-cell">זמן</th>
                  <th className="table-header-cell">פעולה</th>
                  <th className="table-header-cell">מבצע</th>
                  <th className="table-header-cell">יעד</th>
                  <th className="table-header-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("he-IL")}
                    </td>
                    <td className="table-cell">
                      <span className={cn("badge whitespace-nowrap", auditBadgeClass(log.action))} title={log.action}>
                        {auditActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="table-cell text-xs">
                      {log.actor ? (
                        <div>
                          <div className="font-medium text-slate-700">{log.actor.name || log.actor.email}</div>
                          {log.actor.name && (
                            <div className="text-slate-500" dir="ltr" style={{ textAlign: "right" }}>
                              {log.actor.email}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">מערכת</span>
                      )}
                    </td>
                    <td className="table-cell text-xs">
                      <AuditTarget log={log} />
                    </td>
                    <td className="table-cell text-xs text-slate-500 font-mono whitespace-nowrap" dir="ltr">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              עמוד {page} מתוך {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                הקודם
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="btn-ghost text-xs px-3 py-1 disabled:opacity-40"
              >
                הבא
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Tab 2 — user activity feed ───────────────────────── */

interface FeedItem {
  id: string;
  userName: string;
  action: string;
  createdAt: string;
  businessId: string | null;
  businessName: string | null;
}

const ACTIVITY_CATEGORIES: { key: string; label: string; actions: string[] }[] = [
  { key: "all", label: "הכל", actions: [] },
  { key: "logins", label: "כניסות", actions: [A.LOGIN] },
  {
    key: "customers",
    label: "לקוחות",
    actions: [
      A.CREATE_CUSTOMER, A.UPDATE_CUSTOMER, A.DELETE_CUSTOMER, A.MERGE_CUSTOMER,
      A.BULK_UPDATE_CUSTOMERS, A.EXPORT_CUSTOMERS, A.DELETE_IMPORT_BATCH,
    ],
  },
  { key: "pets", label: "חיות מחמד", actions: [A.ADD_PET, A.DELETE_PET] },
  {
    key: "appointments",
    label: "תורים",
    actions: [
      A.CREATE_APPOINTMENT, A.UPDATE_APPOINTMENT, A.COMPLETE_APPOINTMENT,
      A.CANCEL_APPOINTMENT, A.DELETE_APPOINTMENT,
    ],
  },
  {
    key: "payments",
    label: "תשלומים",
    actions: [A.CREATE_PAYMENT, A.UPDATE_PAYMENT, A.CANCEL_PAYMENT, A.REFUND_PAYMENT, A.DELETE_PAYMENT],
  },
  {
    key: "leads",
    label: "לידים",
    actions: [A.CREATE_LEAD, A.UPDATE_LEAD, A.CLOSE_LEAD_WON, A.CLOSE_LEAD_LOST, A.DELETE_LEAD],
  },
  { key: "orders", label: "הזמנות", actions: [A.CREATE_ORDER, A.CANCEL_ORDER, A.DELETE_ORDER] },
  { key: "tasks", label: "משימות", actions: [A.CREATE_TASK, A.COMPLETE_TASK, A.CANCEL_TASK, A.DELETE_TASK] },
  {
    key: "boarding",
    label: "פנסיון",
    actions: [A.CREATE_BOARDING_STAY, A.CHECKIN_BOARDING, A.CHECKOUT_BOARDING, A.DELETE_BOARDING],
  },
  {
    key: "team",
    label: "צוות ואבטחה",
    actions: [
      A.INVITE_MEMBER, A.UPDATE_MEMBER_ROLE, A.UPDATE_MEMBER_PERMISSIONS, A.DEACTIVATE_MEMBER,
      A.ACTIVATE_MEMBER, A.REVOKE_SESSION, A.UPDATE_SECURITY_ALERTS, A.CHANGE_BUSINESS_PHONE,
      A.CANCEL_SUBSCRIPTION,
    ],
  },
];

function isDestructive(action: string): boolean {
  return DELETE_ACTIONS.has(action) || action.startsWith("DELETE_");
}

function relativeTime(date: string): string {
  const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שע׳`;
  return `לפני ${Math.floor(diffHr / 24)} ימים`;
}

function UserActivityTab() {
  const [category, setCategory] = useState("all");
  const actions = ACTIVITY_CATEGORIES.find((c) => c.key === category)?.actions ?? [];

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery<FeedItem[]>({
    queryKey: ["owner", "activity-feed", category],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (actions.length) params.set("action", actions.join(","));
      return fetchJSON(`/api/admin/feed?${params}`);
    },
    refetchInterval: 30_000,
  });

  const feed = Array.isArray(data) ? data : [];
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                category === c.key
                  ? "bg-brand-50 border-brand-200 text-brand-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {lastUpdated ? `עודכן ${lastUpdated}` : "מתעדכן כל 30 שניות"}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="רענן"
            title="רענן"
            className="btn-ghost p-2 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          שגיאה בטעינת הפעילות: {(error as Error).message}
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <PetraLoader />
        ) : feed.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {category === "all"
              ? "עדיין לא נרשמה פעילות של משתמשים."
              : "אין פעילות בקטגוריה הזו. נסו קטגוריה אחרת."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {feed.map((item) => {
              const destructive = isDestructive(item.action);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "px-4 py-3 flex items-start gap-3",
                    destructive ? "bg-red-50/60" : "hover:bg-slate-50"
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                      destructive ? "bg-red-500" : "bg-slate-300"
                    )}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 break-words">
                      <span className="font-medium text-slate-900">{item.userName}</span>{" "}
                      <span title={item.action}>{actionLabel(item.action)}</span>
                      {destructive && <span className="badge badge-danger ms-2">מחיקה</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                      {item.businessId ? (
                        <Link
                          href={`/owner/tenants/${encodeURIComponent(item.businessId)}`}
                          className="text-brand-600 hover:underline"
                        >
                          {item.businessName ?? "עסק (נמחק)"}
                        </Link>
                      ) : (
                        <span>ללא עסק</span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden />
                        {relativeTime(item.createdAt)}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleString("he-IL")}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {feed.length >= 100 && (
        <p className="text-xs text-slate-500 mt-2">מוצגות 100 הפעולות האחרונות.</p>
      )}
    </div>
  );
}

/* ───────────────────────── Page shell ───────────────────────── */

function AuditLogsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: TabKey = searchParams.get("tab") === "activity" ? "activity" : "admin";

  const setTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">יומן פעולות</h1>
          <p className="text-sm text-slate-500 mt-1">
            {tab === "admin"
              ? "פעולות ניהול ואבטחה שבוצעו בפלטפורמה"
              : "מה משתמשי העסקים עושים במערכת, מתעדכן אוטומטית"}
          </p>
        </div>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              tab === t.key
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "admin" ? <AdminActionsTab /> : <UserActivityTab />}
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<PetraLoader />}>
      <AuditLogsContent />
    </Suspense>
  );
}
