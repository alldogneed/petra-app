"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BellRing, Check, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: string;
  actionUrl: string | null;
  actionLabel: string | null;
  isRead: boolean;
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

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

export function InAppNotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery<{ messages: SystemMessage[]; unreadCount: number }>({
    queryKey: ["system-messages"],
    queryFn: () => fetch("/api/system-messages").then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/system-messages/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-messages"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/system-messages/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-messages"] }),
  });

  const dismissAll = useMutation({
    mutationFn: () =>
      fetch("/api/system-messages/delete-all", { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["system-messages"] });
      const prev = queryClient.getQueryData(["system-messages"]);
      queryClient.setQueryData(["system-messages"], { messages: [], unreadCount: 0 });
      return { prev };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["system-messages"], ctx.prev);
    },
    onSuccess: () => setOpen(false),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/system-messages/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["system-messages"] });
      const prev = queryClient.getQueryData<{ messages: SystemMessage[]; unreadCount: number }>(["system-messages"]);
      queryClient.setQueryData(["system-messages"], (old: { messages: SystemMessage[]; unreadCount: number } | undefined) => {
        if (!old) return old;
        const removed = old.messages.find((m) => m.id === id);
        return {
          messages: old.messages.filter((m) => m.id !== id),
          unreadCount: removed && !removed.isRead ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
        };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["system-messages"], ctx.prev);
    },
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

  const messages = data?.messages ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  if (messages.length === 0 && unreadCount === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="הודעות מפטרה"
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
            <div>
              <h3 className="text-sm font-bold text-petra-text">הודעות מפטרה</h3>
              <p className="text-[11px] text-petra-muted mt-0.5">עדכונים ממנהלי המערכת</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => dismissAll.mutate()}
                disabled={dismissAll.isPending}
                className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
              >
                <Check className="w-3 h-3" />
                קראתי הכל
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-slate-400">אין הודעות חדשות</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "group flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0 transition-colors",
                    m.isRead ? "hover:bg-slate-50/60" : "bg-amber-50/30 hover:bg-amber-50/60"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", m.isRead ? "bg-slate-200" : "bg-amber-500")} />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (!m.isRead) markRead.mutate(m.id);
                      if (m.actionUrl) { router.push(m.actionUrl); setOpen(false); }
                    }}
                  >
                    <p className={cn("text-[13px] leading-snug", m.isRead ? "text-slate-600" : "text-petra-text font-semibold")}>
                      {m.title}
                    </p>
                    <p className="text-[12px] text-petra-muted mt-0.5 leading-snug">{m.content}</p>
                    {m.actionUrl && m.actionLabel && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-brand-600 font-medium">
                        <ExternalLink className="w-3 h-3" />
                        {m.actionLabel}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 mt-1 block">{timeAgo(m.createdAt)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss.mutate(m.id); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 mt-0.5"
                    title="הסר"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
