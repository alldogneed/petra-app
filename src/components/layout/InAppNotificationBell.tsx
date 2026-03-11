"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BellRing, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "כרגע";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export function InAppNotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery<{ notifications: UserNotification[]; unreadCount: number }>({
    queryKey: ["user-notifications"],
    queryFn: () => fetch("/api/user-notifications").then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/user-notifications/${id}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/user-notifications/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  if (notifications.length === 0 && unreadCount === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="התראות אישיות"
      >
        <BellRing className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-petra-text">עדכונים</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
              >
                <Check className="w-3 h-3" />
                סמן הכל כנקרא
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-slate-400">אין עדכונים חדשים</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markRead.mutate(n.id);
                    if (n.actionUrl) { router.push(n.actionUrl); setOpen(false); }
                  }}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0 transition-colors cursor-pointer",
                    n.isRead ? "hover:bg-slate-50/60" : "bg-amber-50/30 hover:bg-amber-50/60"
                  )}
                >
                  {/* Unread dot */}
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", n.isRead ? "bg-slate-200" : "bg-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[13px] leading-snug", n.isRead ? "text-slate-600" : "text-petra-text font-semibold")}>
                      {n.title}
                    </p>
                    <p className="text-[12px] text-petra-muted mt-0.5 leading-snug">{n.message}</p>
                    <span className="text-[11px] text-slate-400 mt-1 block">{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
