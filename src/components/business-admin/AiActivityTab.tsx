"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { Bot, RefreshCw, Loader2, KeyRound, Zap } from "lucide-react";
import { relativeTime, useBusinessAdminFormat } from "./shared";

interface AiActivityItem {
  id: string;
  createdAt: string;
  toolName: string;
  status: string;
  resultSummary: string | null;
  errorMessage: string | null;
  connection: {
    id: string;
    name: string;
    createdByName: string | null;
    oauth: boolean;
  };
}

interface AiConnectionOption {
  id: string;
  name: string;
  revoked: boolean;
}

interface AiActivityPage {
  items: AiActivityItem[];
  nextCursor: string | null;
  connections?: AiConnectionOption[];
}

const STATUS_META: Record<string, { className: string }> = {
  success: { className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  error: { className: "bg-red-50 text-red-700 border-red-200" },
  denied: { className: "bg-amber-50 text-amber-800 border-amber-200" },
};

const STATUS_OPTIONS = ["", "success", "error", "denied"];

async function fetchPage(url: string, fallbackError: string): Promise<AiActivityPage> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || fallbackError);
  return json as AiActivityPage;
}

export function AiActivityTab() {
  const t = useTranslations("businessAdmin.aiActivityTab");
  const { formatTs } = useBusinessAdminFormat();
  const [connectionId, setConnectionId] = useState("");
  const [status, setStatus] = useState("");

  const filterParams = new URLSearchParams();
  if (connectionId) filterParams.set("connectionId", connectionId);
  if (status) filterParams.set("status", status);
  const filterKey = filterParams.toString();

  const { data, isLoading, isError, error, refetch, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<AiActivityPage>({
      queryKey: ["ba-ai-activity", filterKey],
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) => {
        const p = new URLSearchParams(filterKey);
        p.set("take", "50");
        if (pageParam) p.set("cursor", String(pageParam));
        return fetchPage(`/api/business-admin/ai-activity?${p}`, t("errors.loadData"));
      },
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

  const items = data?.pages.flatMap((pg) => pg.items) ?? [];
  const connections = data?.pages[0]?.connections ?? [];
  const noConnections = !!data && connections.length === 0;
  const hasFilters = !!connectionId || !!status;

  if (isLoading) {
    return (
      <div className="card">
        <PetraLoader variant="inline" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-10 text-center text-sm text-red-600">
        {error instanceof Error ? error.message : t("errors.loadAi")}
      </div>
    );
  }

  if (noConnections) {
    return (
      <div className="card p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
          <Bot className="w-6 h-6 text-slate-500" />
        </div>
        <p className="font-semibold text-slate-800">{t("empty.noConnectionsTitle")}</p>
        <p className="text-sm text-petra-muted">
          {t("empty.noConnectionsBody")}
        </p>
        <Link href="/settings?tab=ai-agents" className="btn-primary inline-flex text-sm px-4 py-2">
          {t("empty.connectCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="label">{t("filters.connection")}</label>
          <select className="input py-2 text-sm w-full" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            <option value="">{t("filters.allConnections")}</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.revoked ? t("filters.revokedSuffix") : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label className="label">{t("filters.status")}</label>
          <select className="input py-2 text-sm w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? t(`status.${value}`) : t("filters.allStatuses")}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost text-sm flex items-center justify-center gap-1.5 px-3 py-2"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {t("actions.refresh")}
        </button>
      </div>

      <p className="text-xs text-petra-muted">{t("rangeNote")}</p>

      {/* Feed */}
      <div className="card overflow-hidden">
        {!items.length ? (
          <div className="p-10 text-center text-sm text-petra-muted">
            {hasFilters ? t("empty.noMatch") : t("empty.none")}
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((it) => {
              const meta = {
                label: STATUS_META[it.status] ? t(`status.${it.status}`) : it.status,
                className: STATUS_META[it.status]?.className ?? "bg-slate-50 text-slate-700 border-slate-200",
              };
              const detail = it.errorMessage ?? it.resultSummary;
              return (
                <li key={it.id} className="px-4 py-3 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code
                        dir="ltr"
                        className="font-mono text-xs bg-slate-100 text-slate-800 rounded-md px-1.5 py-0.5 break-all"
                      >
                        {it.toolName}
                      </code>
                      <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    {detail && (
                      <p className={`text-xs break-words ${it.errorMessage ? "text-red-600" : "text-slate-600"}`}>
                        {detail}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-petra-muted">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        {it.connection.oauth ? (
                          <Zap className="w-3 h-3 flex-shrink-0" />
                        ) : (
                          <KeyRound className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{it.connection.name}</span>
                      </span>
                      {it.connection.createdByName && <span>{t("createdBy", { name: it.connection.createdByName })}</span>}
                    </div>
                  </div>
                  <span
                    className="text-xs text-petra-muted flex-shrink-0 whitespace-nowrap"
                    title={formatTs(it.createdAt)}
                  >
                    {relativeTime(it.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {hasNextPage && (
          <div className="p-3 border-t border-slate-100 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="btn-ghost text-sm px-4 py-2 inline-flex items-center gap-1.5"
            >
              {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t("actions.loadMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
