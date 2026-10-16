"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, LifeBuoy, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";
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

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "שגיאה");
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("ticket");
  const [composing, setComposing] = useState(false);

  const { data, isLoading } = useQuery<{ tickets: TicketRow[]; unreadCount: number }>({
    queryKey: ["support-tickets"],
    queryFn: () => fetchJSON("/api/support/tickets"),
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
            <h1 className="page-title">הפניות שלי</h1>
            <p className="text-sm text-slate-500">כל הפניות לצוות פטרה, התשובות וכל היסטוריית הטיפול</p>
          </div>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => { setComposing(true); router.replace("/support", { scroll: false }); }}>
          <Plus className="w-4 h-4" />
          פנייה חדשה
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
                עוד לא פתחת פניות
              </div>
            ) : (
              <ul className="space-y-1">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => select(t.id)}
                      className={cn(
                        "w-full text-right rounded-xl px-3 py-2.5 transition-colors",
                        selectedId === t.id ? "bg-orange-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("text-sm text-slate-800 line-clamp-2", t.customerUnread && t.openedByMe && "font-bold")}>
                          {t.customerUnread && t.openedByMe && <span className="inline-block w-2 h-2 rounded-full bg-orange-500 ml-1.5 align-middle" />}
                          {t.title}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {formatTicketDate(t.createdAt)}
                        {!t.openedByMe && t.openedBy ? ` · ${t.openedBy}` : ""}
                        {t.customerUnread && t.openedByMe ? " · תשובה חדשה" : ""}
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
              <div className="card p-10 text-center text-slate-400 text-sm">בחרו פנייה כדי לראות את התשובות ואת היסטוריית הטיפול</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TicketPane({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const { data: ticket, isLoading, error } = useQuery<TicketDetail>({
    queryKey: ["support-ticket", id],
    queryFn: () => fetchJSON(`/api/support/tickets/${id}`),
  });

  // Opening the ticket marks the reply as read on the server → refresh the list dot.
  const loadedId = ticket?.id;
  useEffect(() => {
    if (loadedId) qc.invalidateQueries({ queryKey: ["support-tickets"] });
  }, [loadedId, qc]);

  const send = useMutation({
    mutationFn: () =>
      fetchJSON<{ reopened: boolean }>(`/api/support/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      }),
    onSuccess: (r) => {
      setReply("");
      toast.success(r.reopened ? "ההודעה נשלחה והפנייה נפתחה מחדש" : "ההודעה נשלחה לצוות פטרה");
      qc.invalidateQueries({ queryKey: ["support-ticket", id] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="card"><PetraLoader variant="inline" /></div>;
  if (error || !ticket) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        הפנייה לא נמצאה
        <button className="block mx-auto mt-3 text-orange-600" onClick={onBack}>חזרה לרשימה</button>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5">
      <button className="md:hidden flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
        <ArrowRight className="w-4 h-4" />
        כל הפניות
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
            placeholder={ticket.status === "resolved" ? "עדיין לא מסתדר? כתבו כאן והפנייה תיפתח מחדש" : "כתבו תגובה לצוות פטרה…"}
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
              {send.isPending ? "שולח…" : "שליחה"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewTicketForm({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () =>
      fetchJSON<{ id: string }>("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, pageUrl: window.location.href }),
      }),
    onSuccess: (r) => {
      toast.success("הפנייה נשלחה — נחזור אליך בהקדם 🙏");
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      onCreated(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <button className="md:hidden flex items-center gap-1 text-sm text-slate-500" onClick={onBack}>
        <ArrowRight className="w-4 h-4" />
        כל הפניות
      </button>
      <h2 className="font-bold text-slate-800">פנייה חדשה לצוות פטרה</h2>
      <div>
        <label className="label">נושא</label>
        <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="במשפט אחד — מה קרה?" />
      </div>
      <div>
        <label className="label">פירוט</label>
        <textarea
          className="input min-h-[140px] resize-y"
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="מה ניסית לעשות, מה קרה בפועל, ובאיזה מסך"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onBack}>ביטול</button>
        <button
          className="btn-primary"
          disabled={title.trim().length < 3 || description.trim().length < 10 || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "שולח…" : "שליחת הפנייה"}
        </button>
      </div>
    </div>
  );
}
