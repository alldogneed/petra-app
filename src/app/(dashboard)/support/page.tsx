"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowRight, LifeBuoy, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { StatusBadge, TicketThread, formatTicketDate, type TicketEvent } from "@/components/support/TicketThread";
import { SUPPORT_REPLY_MAX } from "@/lib/support-tickets";

interface TicketRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastStaffReplyAt: string | null;
  customerUnread: boolean;
  openedByMe: boolean;
  openedBy: string | null;
}

interface TicketDetail {
  id: string;
  title: string;
  description: string;
  pageUrl: string | null;
  status: string;
  createdAt: string;
  openedByMe: boolean;
  openedBy: string | null;
  canReply: boolean;
  events: TicketEvent[];
}

async function fetchJSON<T>(url: string, errorFallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || errorFallback);
  return data as T;
}

export default function SupportPage() {
  return (
    <Suspense fallback={<PetraLoader />}>
      <SupportScreen />
    </Suspense>
  );
}

function SupportScreen() {
  const t = useTranslations("help.supportPage");
  const { locale, timezone } = useBusinessLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("ticket");
  const [composing, setComposing] = useState(false);

  const { data, isLoading } = useQuery<{ tickets: TicketRow[]; unreadCount: number }>({
    queryKey: ["support-tickets"],
    queryFn: () => fetchJSON("/api/support/tickets", t("genericError")),
  });
  const tickets = data?.tickets ?? [];

  const select = (id: string | null) => {
    setComposing(false);
    router.replace(id ? `/support?ticket=${id}` : "/support", { scroll: false });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="page-title">{t("title")}</h1>
            <p className="text-sm text-slate-500">{t("subtitle")}</p>
          </div>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => { setComposing(true); router.replace("/support", { scroll: false }); }}>
          <Plus className="w-4 h-4" />
          {t("newTicket")}
        </button>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : (
        <div className="grid md:grid-cols-[300px_1fr] gap-4 items-start">
          {/* List — hidden on phones while a ticket is open */}
          <div className={cn("card p-2", (selectedId || composing) && "hidden md:block")}>
            {tickets.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                <LifeBuoy className="w-8 h-8 mx-auto mb-2 opacity-40" />
                {t("empty")}
              </div>
            ) : (
              <ul className="space-y-1">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      onClick={() => select(ticket.id)}
                      className={cn(
                        "w-full text-start rounded-xl px-3 py-2.5 transition-colors",
                        selectedId === ticket.id ? "bg-orange-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("text-sm text-slate-800 line-clamp-2", ticket.customerUnread && ticket.openedByMe && "font-bold")}>
                          {ticket.customerUnread && ticket.openedByMe && <span className="inline-block w-2 h-2 rounded-full bg-orange-500 me-1.5 align-middle" />}
                          {ticket.title}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {formatTicketDate(ticket.createdAt, { locale, timezone })}
                        {!ticket.openedByMe && ticket.openedBy ? ` · ${ticket.openedBy}` : ""}
                        {ticket.customerUnread && ticket.openedByMe ? t("newReplySuffix") : ""}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn(!(selectedId || composing) && "hidden md:block")}>
            {composing ? (
              <NewTicketForm onBack={() => setComposing(false)} onCreated={(id) => select(id)} />
            ) : selectedId ? (
              <TicketPane id={selectedId} onBack={() => select(null)} />
            ) : (
              <div className="card p-10 text-center text-slate-400 text-sm">{t("selectPrompt")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TicketPane({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslations("help.supportPage");
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const { data: ticket, isLoading, error } = useQuery<TicketDetail>({
    queryKey: ["support-ticket", id],
    queryFn: () => fetchJSON(`/api/support/tickets/${id}`, t("genericError")),
  });

  // Opening the ticket marks the reply as read on the server → refresh the list dot.
  const loadedId = ticket?.id;
  useEffect(() => {
    if (loadedId) qc.invalidateQueries({ queryKey: ["support-tickets"] });
  }, [loadedId, qc]);

  const send = useMutation({
    mutationFn: () =>
      fetchJSON<{ reopened: boolean }>(`/api/support/tickets/${id}/messages`, t("genericError"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      }),
    onSuccess: (r) => {
      setReply("");
      toast.success(r.reopened ? t("pane.sentReopened") : t("pane.sent"));
      qc.invalidateQueries({ queryKey: ["support-ticket", id] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="card"><PetraLoader variant="inline" /></div>;
  if (error || !ticket) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        {t("pane.notFound")}
        <button className="block mx-auto mt-3 text-orange-600" onClick={onBack}>{t("pane.backToList")}</button>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5">
      <button className="md:hidden flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
        <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
        {t("pane.allTickets")}
      </button>
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="font-bold text-slate-800 leading-snug">{ticket.title}</h2>
        <StatusBadge status={ticket.status} />
      </div>

      <TicketThread
        viewer="customer"
        description={ticket.description}
        pageUrl={ticket.pageUrl}
        createdAt={ticket.createdAt}
        openedBy={ticket.openedByMe ? null : ticket.openedBy}
        events={ticket.events}
      />

      {ticket.canReply && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <textarea
            className="input min-h-[96px] resize-y"
            placeholder={ticket.status === "resolved" ? t("pane.reopenPlaceholder") : t("pane.replyPlaceholder")}
            value={reply}
            maxLength={SUPPORT_REPLY_MAX}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button
              className="btn-primary flex items-center gap-1.5"
              disabled={reply.trim().length < 2 || send.isPending}
              onClick={() => send.mutate()}
            >
              <Send className="w-4 h-4" />
              {send.isPending ? t("pane.sending") : t("pane.send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewTicketForm({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations("help.supportPage");
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () =>
      fetchJSON<{ id: string }>("/api/support/report", t("genericError"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, pageUrl: window.location.href }),
      }),
    onSuccess: (r) => {
      toast.success(t("form.created"));
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      onCreated(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <button className="md:hidden flex items-center gap-1 text-sm text-slate-500" onClick={onBack}>
        <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
        {t("form.allTickets")}
      </button>
      <h2 className="font-bold text-slate-800">{t("form.title")}</h2>
      <div>
        <label className="label">{t("form.subject")}</label>
        <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={t("form.subjectPlaceholder")} />
      </div>
      <div>
        <label className="label">{t("form.details")}</label>
        <textarea
          className="input min-h-[140px] resize-y"
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("form.detailsPlaceholder")}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onBack}>{t("form.cancel")}</button>
        <button
          className="btn-primary"
          disabled={title.trim().length < 3 || description.trim().length < 10 || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? t("form.sending") : t("form.submit")}
        </button>
      </div>
    </div>
  );
}
