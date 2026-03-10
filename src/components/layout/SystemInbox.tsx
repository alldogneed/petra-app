"use client";

import { Mail, X, Trash2, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bell, Trophy, Info, CheckCircle } from "lucide-react";

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bell,
  AlertCircle,
  Trophy,
  Info,
  CheckCircle,
};

function getTypeColor(type: string) {
  switch (type) {
    case "success":
      return { bg: "bg-green-50", border: "border-green-200", icon: "text-green-600" };
    case "warning":
      return { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600" };
    case "error":
      return { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600" };
    default:
      return { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600" };
  }
}

export function SystemInbox() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery<SystemMessage[]>({
    queryKey: ["systemMessages"],
    queryFn: async () => {
      const r = await fetch("/api/system-messages");
      if (!r.ok) return [];
      const data = await r.json();
      // API returns { messages, unreadCount }
      if (data && Array.isArray(data.messages)) return data.messages;
      if (Array.isArray(data)) return data;
      return [];
    },
    refetchInterval: 60_000,
  });

  const unreadCount = messages.filter((m) => !m.isRead).length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/system-messages/${id}/read`, { method: "PATCH" });
      refetch();
    } catch { /* silently ignore read-mark failures */ }
  };

  const deleteMessage = async (id: string) => {
    try {
      await fetch(`/api/system-messages/${id}`, { method: "DELETE" });
      refetch();
    } catch { /* silently ignore delete failures */ }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-150"
        aria-label="דואר נכנס"
      >
        <Mail className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 left-1 min-w-[16px] h-4 px-0.5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: "#3B82F6", lineHeight: 1 }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-11 w-96 max-w-[calc(100vw-1rem)] rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50"
          style={{ background: "#fff" }}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <p className="text-[14px] font-semibold text-slate-800">דואר נכנס</p>
              {unreadCount > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {unreadCount} הודעות חדשות
                </p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[450px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Mail className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">אין הודעות</p>
              </div>
            ) : (
              messages.map((msg) => {
                const colors = getTypeColor(msg.type);
                const IconComponent = msg.icon && ICON_MAP[msg.icon];
                const isExpired = msg.expiresAt && new Date(msg.expiresAt) < new Date();

                return (
                  <div
                    key={msg.id}
                    className={`px-4 py-3 border-b border-slate-100 transition-colors cursor-default ${
                      msg.isRead ? "bg-white" : "bg-slate-50"
                    } hover:bg-slate-100`}
                    onClick={() => !msg.isRead && markAsRead(msg.id)}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      {IconComponent && (
                        <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] font-semibold truncate ${msg.isRead ? "text-slate-700" : "text-slate-900"}`}>
                            {msg.title}
                          </p>
                          {!msg.isRead && (
                            <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">
                          {msg.content}
                        </p>

                        {/* Timestamp */}
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          {new Date(msg.createdAt).toLocaleDateString("he-IL", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>

                        {/* Action button */}
                        {msg.actionUrl && !isExpired && (
                          <a
                            href={msg.actionUrl}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(false);
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors"
                          >
                            {msg.actionLabel || "בצע פעולה"}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMessage(msg.id);
                        }}
                        className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                        aria-label="מחק הודעה"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
