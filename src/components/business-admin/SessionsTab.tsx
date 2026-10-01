"use client";

import { useQuery } from "@tanstack/react-query";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { SessionEntry, ROLE_LABELS, ROLE_COLORS, relativeTime, formatTs, parseDevice, isOnline, Avatar } from "./shared";

export function SessionsTab({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<SessionEntry[]>({
    queryKey: ["ba-sessions"],
    queryFn: () => fetch("/api/business-admin/sessions").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-petra-muted">
          סשנים פעילים מתרענן כל 30 שניות
        </p>
        <button
          onClick={() => refetch()}
          className="btn-ghost text-sm flex items-center gap-1.5 px-3"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          רענן
        </button>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : !data?.length ? (
        <div className="card p-10 text-center">
          <WifiOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-petra-muted">אין סשנים פעילים כרגע</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-petra-muted">
                <th className="text-right px-4 py-3 font-medium">משתמש</th>
                <th className="text-right px-4 py-3 font-medium">תפקיד</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                  מכשיר
                </th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
                  IP
                </th>
                <th className="text-right px-4 py-3 font-medium">נראה לאחרונה</th>
                <th className="text-right px-4 py-3 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {data.map((session) => {
                const online = isOnline(session.lastSeenAt);
                const isMySession = session.userId === currentUserId;
                return (
                  <tr
                    key={session.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={session.user.name}
                          url={session.user.avatarUrl}
                          size={8}
                        />
                        <div>
                          <p className="font-medium text-slate-800">
                            {session.user.name}
                            {isMySession && (
                              <span className="text-xs text-petra-muted font-normal">
                                {" "}
                                (אתה)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-petra-muted">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ROLE_COLORS[session.businessRole] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ROLE_LABELS[session.businessRole] ?? session.businessRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-petra-muted hidden md:table-cell">
                      {parseDevice(session.userAgent)}
                    </td>
                    <td className="px-4 py-3 text-petra-muted text-xs hidden lg:table-cell">
                      {session.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-petra-muted whitespace-nowrap">
                      <span title={formatTs(session.lastSeenAt)}>
                        {relativeTime(session.lastSeenAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          online
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {online ? (
                          <>
                            <Wifi className="w-3 h-3" />
                            מחובר
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            לא פעיל
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
