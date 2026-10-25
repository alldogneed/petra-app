"use client";

/**
 * AllDog only — the lead's WhatsApp conversation with the bot, inside LeadTreatmentModal.
 * Renders nothing unless GET /api/leads/[id]/whatsapp-bot returns a conversation
 * (other businesses / leads without a bot chat get 404 → hidden).
 * The rep can answer through the bot number (24h window) or hand the chat back to the bot.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Send, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { autoMessageLabel } from "@/lib/alldog/missed-call-labels";

interface BotConversationView {
  id: string;
  status: "active" | "handoff" | "stopped" | string;
  canReply: boolean;
  lastInboundAt: string | null;
  autoResumeAt: string | null;
  messages: Array<{ id: string; role: string; kind: string; text: string; createdAt: string }>;
}

const timeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

async function loadConversation(leadId: string): Promise<BotConversationView | null> {
  const res = await fetch(`/api/leads/${leadId}/whatsapp-bot`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error("load failed");
  return (await res.json()).conversation as BotConversationView;
}

async function post(leadId: string, body: Record<string, unknown>): Promise<BotConversationView> {
  const res = await fetch(`/api/leads/${leadId}/whatsapp-bot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "שגיאה");
  return data.conversation as BotConversationView;
}

export function AllDogBotChat({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const perms = usePermissions();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const key = ["lead", leadId, "whatsapp-bot"];

  const { data: conv } = useQuery({
    queryKey: key,
    queryFn: () => loadConversation(leadId),
    retry: false,
    refetchInterval: (q) => (q.state.data ? 20_000 : false),
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [conv?.messages.length]);

  const send = useMutation({
    mutationFn: () => post(leadId, { action: "send", text }),
    onSuccess: (c) => {
      qc.setQueryData(key, c);
      setText("");
      toast.success("נשלח בוואטסאפ");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resume = useMutation({
    mutationFn: () => post(leadId, { action: "resume" }),
    onSuccess: (c) => {
      qc.setQueryData(key, c);
      toast.success("השיחה חזרה לבוט");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!conv) return null;

  const statusLine =
    conv.status === "handoff"
      ? `אצל נציגה${conv.autoResumeAt ? ` · חוזר לבוט אוטומטית ${timeFmt.format(new Date(conv.autoResumeAt))}` : ""}`
      : conv.status === "stopped"
        ? "הלקוח ביקש להפסיק"
        : "הבוט עונה";

  return (
    <div className="px-6 py-5 border-b border-[#F1F5F9]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">וואטסאפ עם הבוט</div>
          <div
            className={cn(
              "mt-0.5 text-sm font-semibold",
              conv.status === "handoff" ? "text-orange-600" : conv.status === "stopped" ? "text-slate-400" : "text-emerald-600"
            )}
          >
            {statusLine}
          </div>
        </div>
        {conv.status === "handoff" && (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={resume.isPending}
            onClick={() => resume.mutate()}
          >
            <Bot className="w-3.5 h-3.5" /> החזר לבוט
          </button>
        )}
      </div>

      <div ref={listRef} className="mt-3 max-h-72 overflow-y-auto space-y-1.5 rounded-xl bg-slate-50 p-3" data-no-pull-refresh>
        {conv.messages.length === 0 && <div className="text-xs text-slate-400">אין הודעות</div>}
        {conv.messages.map((m) => {
          const mine = m.role !== "user";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words",
                  m.role === "user" && "bg-white border border-slate-200 text-slate-800",
                  m.role === "assistant" && "bg-emerald-50 text-slate-800",
                  m.role === "human" && "bg-orange-50 text-slate-800"
                )}
              >
                {m.role !== "user" && (
                  <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    {m.role === "human" ? <UserRound className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    {m.role === "human" ? "נציגה" : autoMessageLabel(m.kind) ?? "בוט"}
                  </div>
                )}
                {m.kind === "voice" ? `🎤 ${m.text}` : m.text}
                <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">{timeFmt.format(new Date(m.createdAt))}</div>
              </div>
            </div>
          );
        })}
      </div>

      {perms.canSendMessages && conv.status !== "stopped" && (
        conv.canReply ? (
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim() && !send.isPending) send.mutate();
            }}
          >
            <textarea
              className="input min-h-[42px] flex-1 resize-y text-sm"
              rows={2}
              maxLength={2000}
              placeholder="תשובה ללקוח (נשלחת מהמספר של הבוט, והבוט עוצר)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={!text.trim() || send.isPending} aria-label="שלח">
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="mt-3 text-xs text-slate-500">
            {conv.lastInboundAt
              ? "עברו 24 שעות מההודעה האחרונה של הלקוח, אז וואטסאפ לא מאפשר לשלוח טקסט. אפשר להתקשר."
              : "הלקוח עוד לא ענה – אפשר להתקשר אליו"}
          </div>
        )
      )}
    </div>
  );
}
