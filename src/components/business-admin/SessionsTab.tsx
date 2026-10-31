"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { Clock, Wifi, WifiOff, RefreshCw, LogOut, Monitor, ShieldAlert } from "lucide-react";
import { SessionEntry, ROLE_COLORS, isOnline, Avatar, useBusinessAdminFormat } from "./shared";

/** GET /api/business-admin/sessions row (server adds device/isCurrent/isNewDevice). */
type SessionRow = SessionEntry & { device: string; isCurrent: boolean; isNewDevice: boolean; canRevoke: boolean };

async function jsonOrThrow(r: Response, fallback: string) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || fallback);
  return d;
}

export function SessionsTab({ currentUserId }: { currentUserId: string }) {
  const t = useTranslations("businessAdmin.sessionsTab");
  const fmt = useBusinessAdminFormat();
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery<SessionRow[]>({
    queryKey: ["ba-sessions"],
    queryFn: () => fetch("/api/business-admin/sessions").then((r) => jsonOrThrow(r, t("errors.load"))),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ba-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["ba-team"] });
  };

  const revokeOne = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/business-admin/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, t("errors.revokeOne"))
      ),
    onSuccess: () => { toast.success(t("toasts.revokedOne")); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeAll = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/business-admin/sessions?userId=${encodeURIComponent(userId)}`, { method: "DELETE" }).then((r) =>
        jsonOrThrow(r, t("errors.revokeAll"))
      ) as Promise<{ revoked: number }>,
    onSuccess: (d) => { toast.success(d.revoked ? t("toasts.revokedAll", { count: d.revoked }) : t("toasts.noneToRevoke")); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    for (const s of Array.isArray(data) ? data : []) {
      const list = map.get(s.userId) ?? [];
      list.push(s);
      map.set(s.userId, list);
    }
    // current user first, then by most recent activity (server already sorts by lastSeenAt)
    return [...map.values()].sort((a, b) =>
      a[0].userId === currentUserId ? -1 : b[0].userId === currentUserId ? 1 : 0
    );
  }, [data, currentUserId]);

  const busy = revokeOne.isPending || revokeAll.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-petra-muted">{t("header")}</p>
        <button
          onClick={() => refetch()}
          className="btn-ghost text-sm flex items-center gap-1.5 px-3"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : groups.length === 0 ? (
        <div className="card p-10 text-center">
          <WifiOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-petra-muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((sessions) => {
            const first = sessions[0];
            const isMe = first.userId === currentUserId;
            const canRevokeAll = !isMe && first.canRevoke;
            return (
              <div key={first.userId} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <Avatar name={first.user.name} url={first.user.avatarUrl} size={8} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">
                      {first.user.name}
                      {isMe && <span className="text-xs text-petra-muted font-normal">{t("you")}</span>}
                    </p>
                    <p className="text-xs text-petra-muted truncate" dir="ltr" style={{ textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
                      {first.user.email}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ROLE_COLORS[first.businessRole] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {fmt.roleLabel(first.businessRole)}
                  </span>
                  {canRevokeAll && (
                    <button
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-red-600"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(t("confirm.revokeAll", { name: first.user.name }))) {
                          revokeAll.mutate(first.userId);
                        }
                      }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {t("revokeAll")}
                    </button>
                  )}
                </div>

                <ul className="divide-y divide-slate-50">
                  {sessions.map((s) => {
                    const online = isOnline(s.lastSeenAt);
                    const canRevoke = s.canRevoke;
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
                        <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700">{s.device}</span>
                        {s.isCurrent && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {t("badges.thisDevice")}
                          </span>
                        )}
                        {s.isNewDevice && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
                            title={t("badges.newDeviceTitle")}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            {t("badges.newDevice")}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            online ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {online ? <Wifi className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {online ? t("status.online") : t("status.inactive")}
                        </span>
                        <span className="text-xs text-petra-muted whitespace-nowrap" title={fmt.formatTs(s.lastSeenAt)}>
                          {t("lastSeen", { when: fmt.relativeTime(s.lastSeenAt) })}
                        </span>
                        <span className="text-xs text-petra-muted whitespace-nowrap hidden sm:inline" title={fmt.formatTs(s.createdAt)}>
                          {t("connected", { when: fmt.relativeTime(s.createdAt) })}
                        </span>
                        {s.ipAddress && (
                          <span className="text-xs text-petra-muted hidden lg:inline" dir="ltr">
                            {s.ipAddress}
                          </span>
                        )}
                        {canRevoke && (
                          <button
                            className="ms-auto text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-2.5 py-1 flex items-center gap-1"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(t("confirm.revokeOne", { name: s.user.name, device: s.device }))) {
                                revokeOne.mutate(s.id);
                              }
                            }}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            {t("revokeOne")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
