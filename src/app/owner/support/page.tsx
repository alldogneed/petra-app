"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { LifeBuoy, ArrowRight, Send, Lock, Timer, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { STATUS_META, StatusBadge, TicketThread, formatTicketDate, type TicketEvent } from "@/components/support/TicketThread";
import { SUPPORT_REPLY_MAX, SUPPORT_SLA_HOURS, waitingLabel, type SupportTicketStatus } from "@/lib/support-tickets";

interface TicketRow {
  id: string;
  title: string;
  description: string;
  status: SupportTicketStatus;
  createdAt: string;
  waitingSince: string | null;
  overdue: boolean;
  lastStaffReplyAt: string | null;
  business: { id: string; name: string };
  user: { id: string; email: string; name: string | null };
  _count: { events: number };
}

interface TicketDetail {
  id: string;
  title: string;
  description: string;
  pageUrl: string | null;
  status: SupportTicketStatus;
  createdAt: string;
  waitingSince: string | null;
  overdue: boolean;
  firstResponseAt: string | null;
  customerUnread: boolean;
  business: { id: string; name: string; phone: string | null };
  user: { id: string; email: string; name: string | null };
  events: TicketEvent[];
}

const STATUS_TABS: { key: "" | SupportTicketStatus; labelKey: string }[] = [
  { key: "", labelKey: "tabs.all" },
  { key: "open", labelKey: "tabs.open" },
  { key: "in_progress", labelKey: "tabs.inProgress" },
  { key: "resolved", labelKey: "tabs.resolved" },
];

async function fetchJSON<T>(url: string, errorFallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || errorFallback);
  return data as T;
}

export default function OwnerSupportPage() {
  return (
    <Suspense fallback={<PetraLoader />}>
      <OwnerSupport />
    </Suspense>
  );
}

function OwnerSupport() {
  const t = useTranslations("owner.ownerSupportPage");
  const { locale, timezone, cfg } = useBusinessLocale();
  const router = useRouter();
  const selectedId = useSearchParams().get("ticket");
  const [statusFilter, setStatusFilter] = useState<"" | SupportTicketStatus>("");

  const { data, isLoading } = useQuery<{
    tickets: TicketRow[];
    counts: Record<SupportTicketStatus, number>;
    awaiting: { total: number; overdue: number };
  }>({
    queryKey: ["owner-support", statusFilter],
    queryFn: () => fetchJSON(`/api/owner/support${statusFilter ? `?status=${statusFilter}` : ""}`, t("errors.generic")),
    refetchInterval: 60_000,
  });

  const tickets = data?.tickets ?? [];
  const counts = data?.counts ?? { open: 0, in_progress: 0, resolved: 0 };
  const select = (id: string | null) => router.replace(id ? `/owner/support?ticket=${id}` : "/owner/support", { scroll: false });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto" dir={cfg.dir}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="page-title">{t("header.title")}</h1>
          <p className="text-sm text-slate-500">
            {t("header.counts", { open: counts.open, inProgress: counts.in_progress, resolved: counts.resolved })}
          </p>
        </div>
      </div>

      {data && data.awaiting.total > 0 && (
        <div className={cn(
          "mb-4 rounded-xl border px-4 py-3 text-sm flex items-center gap-2",
          data.awaiting.overdue > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
        )}>
          <Timer className="w-4 h-4 shrink-0" />
          {t("awaiting.total", { count: data.awaiting.total })}
          {data.awaiting.overdue > 0 && t("awaiting.overdue", { count: data.awaiting.overdue, hours: SUPPORT_SLA_HOURS })}
        </div>
      )}

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all",
              statusFilter === tab.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : (
        <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
          <div className={cn("space-y-2", selectedId && "hidden lg:block")}>
            {tickets.length === 0 ? (
              <div className="card text-center py-14 text-slate-400">
                <LifeBuoy className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>{t("list.empty")}</p>
              </div>
            ) : (
              tickets.map((tk) => {
                const meta = STATUS_META[tk.status];
                const Icon = meta.icon;
                return (
                  <button
                    key={tk.id}
                    onClick={() => select(tk.id)}
                    className={cn(
                      "w-full text-start card p-4 transition-colors hover:border-orange-200",
                      selectedId === tk.id && "border-orange-300 ring-1 ring-orange-200"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", meta.iconColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-800 text-sm line-clamp-2">{tk.title}</span>
                          <StatusBadge status={tk.status} />
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {tk.business.name} · {formatTicketDate(tk.createdAt, { locale, timezone })}
                        </div>
                        {tk.waitingSince ? (
                          <div className={cn("text-xs mt-1.5 font-medium flex items-center gap-1", tk.overdue ? "text-red-600" : "text-amber-600")}>
                            <Timer className="w-3.5 h-3.5" />
                            {t("list.waiting", { waiting: waitingLabel(new Date(tk.waitingSince)) })}
                          </div>
                        ) : tk.status !== "resolved" ? (
                          <div className="text-xs mt-1.5 text-slate-400">{t("list.answered")}</div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className={cn(!selectedId && "hidden lg:block")}>
            {selectedId ? (
              <StaffTicketPane id={selectedId} onBack={() => select(null)} />
            ) : (
              <div className="card p-10 text-center text-slate-400 text-sm">{t("list.selectPrompt")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffTicketPane({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslations("owner.ownerSupportPage");
  const { locale, timezone } = useBusinessLocale();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  const { data: ticket, isLoading, error } = useQuery<TicketDetail>({
    queryKey: ["owner-support-ticket", id],
    queryFn: () => fetchJSON(`/api/owner/support/${id}`, t("errors.generic")),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["owner-support-ticket", id] });
    qc.invalidateQueries({ queryKey: ["owner-support"] });
    qc.invalidateQueries({ queryKey: ["owner-support-summary"] });
  };

  const send = useMutation({
    mutationFn: (status: SupportTicketStatus | null) =>
      fetchJSON<{ status: string; emailSent: boolean | null }>(`/api/owner/support/${id}/messages`, t("errors.generic"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, internal, status }),
      }),
    onSuccess: (r) => {
      setBody("");
      if (internal) toast.success(t("toasts.noteSaved"));
      else if (r.emailSent === false) toast.warning(t("toasts.emailNotSent"));
      else toast.success(t("toasts.replySent"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: (status: SupportTicketStatus) =>
      fetchJSON(`/api/owner/support/${id}`, t("errors.generic"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success(t("toasts.statusUpdated"));
      refresh();
    },
    onError: () => toast.error(t("errors.updateFailed")),
  });

  if (isLoading) return <div className="card"><PetraLoader variant="inline" /></div>;
  if (error || !ticket) return <div className="card p-8 text-center text-sm text-slate-500">{t("detail.notFound")}</div>;

  const canSend = body.trim().length >= 2 && !send.isPending;

  return (
    <div className="card p-4 sm:p-5">
      <button className="lg:hidden flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
        <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
        {t("detail.back")}
      </button>

      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-slate-800 leading-snug">{ticket.title}</h2>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        <Link href={`/owner/tenants/${ticket.business.id}`} className="text-orange-600 hover:underline">{ticket.business.name}</Link>
        <span>{ticket.user.name ?? ""}</span>
        <a href={`mailto:${ticket.user.email}`} dir="ltr" className="flex items-center gap-1 hover:text-slate-700">
          <Mail className="w-3 h-3" />{ticket.user.email}
        </a>
        {ticket.firstResponseAt && <span>{t("detail.firstResponse", { date: formatTicketDate(ticket.firstResponseAt, { locale, timezone }) })}</span>}
        {ticket.customerUnread && <span className="text-amber-600">{t("detail.customerUnread")}</span>}
      </div>
      {ticket.waitingSince && (
        <div className={cn("mt-2 text-xs font-medium flex items-center gap-1", ticket.overdue ? "text-red-600" : "text-amber-600")}>
          <Timer className="w-3.5 h-3.5" />
          {t("detail.waitingOnUs", { waiting: waitingLabel(new Date(ticket.waitingSince)) })}
        </div>
      )}

      <div className="mt-4">
        <TicketThread
          viewer="staff"
          description={ticket.description}
          pageUrl={ticket.pageUrl}
          createdAt={ticket.createdAt}
          openedBy={ticket.user.name ?? ticket.user.email}
          events={ticket.events}
        />
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-2 w-fit">
          <button
            className={cn("px-3 py-1.5 text-xs rounded-md font-medium", !internal ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}
            onClick={() => setInternal(false)}
          >
            {t("composer.replyTab")}
          </button>
          <button
            className={cn("px-3 py-1.5 text-xs rounded-md font-medium flex items-center gap-1", internal ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}
            onClick={() => setInternal(true)}
          >
            <Lock className="w-3 h-3" />
            {t("composer.internalTab")}
          </button>
        </div>
        <textarea
          className={cn("input min-h-[110px] resize-y", internal && "bg-yellow-50 border-yellow-200")}
          placeholder={internal ? t("composer.internalPlaceholder") : t("composer.replyPlaceholder")}
          value={body}
          maxLength={SUPPORT_REPLY_MAX}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap justify-end gap-2 mt-2">
          {internal ? (
            <button className="btn-secondary" disabled={!canSend} onClick={() => send.mutate(null)}>
              {send.isPending ? t("composer.saving") : t("composer.saveNote")}
            </button>
          ) : (
            <>
              {ticket.status !== "resolved" && (
                <button className="btn-secondary" disabled={!canSend} onClick={() => send.mutate("resolved")}>
                  {t("composer.sendAndClose")}
                </button>
              )}
              <button className="btn-primary flex items-center gap-1.5" disabled={!canSend} onClick={() => send.mutate(null)}>
                <Send className="w-4 h-4" />
                {send.isPending ? t("composer.sending") : t("composer.send")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4 flex-wrap border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400 self-center">{t("status.changeLabel")}</span>
        {ticket.status !== "open" && (
          <button className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium" onClick={() => patch.mutate("open")}>
            {t("status.markOpen")}
          </button>
        )}
        {ticket.status !== "in_progress" && (
          <button className="px-3 py-1.5 text-xs rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 font-medium" onClick={() => patch.mutate("in_progress")}>
            {t("status.markInProgress")}
          </button>
        )}
        {ticket.status !== "resolved" && (
          <button className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-medium" onClick={() => patch.mutate("resolved")}>
            {t("status.markResolved")}
          </button>
        )}
      </div>
    </div>
  );
}
