"use client";

import { AlertCircle, CheckCircle, Clock, Lock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_STATUS_LABELS, type SupportTicketStatus } from "@/lib/support-tickets";

export interface TicketEvent {
  id: string;
  type: string;
  authorType: string;
  authorName: string | null;
  body: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
}

export const STATUS_META: Record<SupportTicketStatus, { label: string; color: string; icon: React.ElementType; iconColor: string }> = {
  open: { label: SUPPORT_STATUS_LABELS.open, color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle, iconColor: "text-red-500" },
  in_progress: { label: SUPPORT_STATUS_LABELS.in_progress, color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, iconColor: "text-amber-500" },
  resolved: { label: SUPPORT_STATUS_LABELS.resolved, color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle, iconColor: "text-emerald-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as SupportTicketStatus] ?? STATUS_META.open;
  return <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap", meta.color)}>{meta.label}</span>;
}

export function formatTicketDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabel = (s: string | null) => (s ? SUPPORT_STATUS_LABELS[s as SupportTicketStatus] ?? s : "");

/**
 * The whole handling history of a ticket, oldest first. The original message is the
 * ticket's description (the "created" event has no body). `viewer` decides wording:
 * the customer sees "את/ה" and "צוות פטרה"; staff see names and internal notes.
 */
export function TicketThread({
  description,
  pageUrl,
  createdAt,
  openedBy,
  events,
  viewer,
}: {
  description: string;
  pageUrl?: string | null;
  createdAt: string;
  openedBy: string | null;
  events: TicketEvent[];
  viewer: "customer" | "staff";
}) {
  const customerName = viewer === "customer" ? "את/ה" : openedBy || "הלקוח";
  return (
    <ol className="space-y-3">
      <li>
        <Bubble side="customer" author={`${customerName} · פתיחת הפנייה`} at={createdAt}>
          {description}
          {pageUrl && (
            <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 break-all" dir="ltr">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {pageUrl}
            </span>
          )}
        </Bubble>
      </li>
      {events.map((e) => {
        if (e.type === "created") return null;
        if (e.type === "status_change") {
          const who = e.authorType === "system" ? "המערכת" : viewer === "customer" ? "צוות פטרה" : e.authorName || "צוות";
          return (
            <li key={e.id} className="flex items-center gap-2 text-xs text-slate-400 px-1">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-center">
                {`${who} שינה סטטוס ${e.fromStatus ? `מ"${statusLabel(e.fromStatus)}" ` : ""}ל"${statusLabel(e.toStatus)}" · ${formatTicketDate(e.createdAt)}`}
              </span>
              <span className="h-px flex-1 bg-slate-100" />
            </li>
          );
        }
        const internal = e.type === "internal_note";
        const fromCustomer = e.authorType === "customer";
        const author = fromCustomer
          ? viewer === "customer" ? "את/ה" : e.authorName || customerName
          : viewer === "customer" ? "צוות פטרה" : e.authorName || "צוות פטרה";
        return (
          <li key={e.id}>
            <Bubble side={fromCustomer ? "customer" : internal ? "internal" : "staff"} author={internal ? `${author} · הערה פנימית` : author} at={e.createdAt}>
              {e.body}
            </Bubble>
          </li>
        );
      })}
    </ol>
  );
}

function Bubble({ side, author, at, children }: { side: "customer" | "staff" | "internal"; author: string; at: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex", side === "customer" ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 py-3 border",
          side === "customer" && "bg-slate-50 border-slate-100 rounded-tr-sm",
          side === "staff" && "bg-orange-50 border-orange-100 rounded-tl-sm",
          side === "internal" && "bg-yellow-50 border-dashed border-yellow-300 rounded-tl-sm"
        )}
      >
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 flex-wrap">
          {side === "internal" && <Lock className="w-3 h-3" />}
          <span className="font-semibold text-slate-700">{author}</span>
          <span>· {formatTicketDate(at)}</span>
        </div>
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{children}</div>
      </div>
    </div>
  );
}
