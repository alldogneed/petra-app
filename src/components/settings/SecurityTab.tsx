"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Monitor, Smartphone, Tablet, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface SessionItem {
  id: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  rememberMe: boolean;
  isCurrent: boolean;
}

function osIcon(os: string) {
  if (os === "iOS" || os === "Android") return Smartphone;
  if (os === "iPadOS") return Tablet;
  return Monitor;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "כעת";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `לפני ${weeks} שבועות`;
  const months = Math.floor(days / 30);
  return `לפני ${months} חודשים`;
}

export function SecurityTab() {
  const queryClient = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const { data, isLoading } = useQuery<{ sessions: SessionItem[]; currentSessionId: string }>({
    queryKey: ["account-sessions"],
    queryFn: () => fetch("/api/account/sessions").then((r) => r.json()),
  });

  const revokeOne = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/account/sessions/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("fail");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-sessions"] });
      toast.success("הסשן נותק");
    },
    onError: () => toast.error("שגיאה בניתוק"),
  });

  const revokeOthers = useMutation({
    mutationFn: () =>
      fetch("/api/account/sessions/revoke-others", { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("fail");
        return r.json();
      }),
    onSuccess: (resp: { revokedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["account-sessions"] });
      setConfirmRevokeAll(false);
      toast.success(`נותקו ${resp.revokedCount} סשנים`);
    },
    onError: () => toast.error("שגיאה בניתוק כללי"),
  });

  const sessions = data?.sessions ?? [];
  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-petra-text">אבטחה וסשנים פעילים</h2>
            <p className="text-sm text-petra-muted mt-1 leading-relaxed">
              רשימת המכשירים והדפדפנים שבהם אתה מחובר כעת. אם אתה רואה סשן שלא זיהית — נתק אותו מיד ושנה סיסמה.
            </p>
          </div>
        </div>

        {/* Revoke others button */}
        {otherCount > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {!confirmRevokeAll ? (
              <button
                type="button"
                onClick={() => setConfirmRevokeAll(true)}
                className="btn-secondary"
              >
                <AlertTriangle className="w-4 h-4" />
                התנתק מכל שאר המכשירים ({otherCount})
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-900 flex-1">
                  הפעולה תנתק {otherCount} סשנים אחרים. המכשיר הנוכחי יישאר מחובר.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmRevokeAll(false)}
                  className="text-sm text-amber-900 hover:underline"
                  disabled={revokeOthers.isPending}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={() => revokeOthers.mutate()}
                  disabled={revokeOthers.isPending}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {revokeOthers.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  אישור ניתוק
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sessions list */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-petra-text">סשנים פעילים</h3>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-petra-muted" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-petra-muted">לא נמצאו סשנים פעילים</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => {
              const Icon = osIcon(s.os);
              return (
                <li key={s.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-petra-text text-sm">
                        {s.browser} · {s.os}
                      </span>
                      {s.isCurrent && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          המכשיר הזה
                        </span>
                      )}
                      {s.rememberMe && (
                        <span className="text-[11px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          30 יום
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-petra-muted mt-1 flex items-center gap-2 flex-wrap">
                      {s.ipAddress && <span>IP: {s.ipAddress}</span>}
                      <span>•</span>
                      <span>פעילות אחרונה: {formatRelative(s.lastSeenAt)}</span>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => revokeOne.mutate(s.id)}
                      disabled={revokeOne.isPending}
                      className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                      title="נתק סשן זה"
                    >
                      <X className="w-4 h-4" />
                      נתק
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-petra-muted leading-relaxed px-1">
        <p>
          כל התחברות למערכת יוצרת סשן חדש. עם סימון &quot;זכור אותי&quot; הסשן שומר על החיבור למשך 30 יום מכל פעילות אחרונה.
        </p>
        <p className="mt-1">
          Petra שולחת התראה במייל בכל פעם שמתחברים ממכשיר או מערכת הפעלה חדשים, כדי שתוכל לזהות גישה לא מורשית מיד.
        </p>
      </div>
    </div>
  );
}
