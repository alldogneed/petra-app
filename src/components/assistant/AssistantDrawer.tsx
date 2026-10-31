"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LifeBuoy, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { resolveAssistantScreen, suggestionsForPath } from "@/lib/assistant/screens";
import {
  ASSISTANT_MAX_CONVERSATION_MESSAGES,
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_NOTE_CHARS,
} from "@/lib/assistant/limits";
import { AssistantMarkdown } from "./AssistantMarkdown";

interface ChatMessage {
  /** Local key. */
  key: number;
  role: "user" | "assistant";
  content: string;
  /** Server id of a saved assistant answer — present once it can be rated. */
  serverId?: string;
  rating?: 1 | -1;
  failed?: boolean;
}

interface AssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the help center (FAQ / what's new / contact form). */
  onOpenHelpCenter: () => void;
}

/** Petra AI — the support chat drawer. Kept mounted so the chat survives closing it. */
export function AssistantDrawer({ open, onOpenChange, onOpenHelpCenter }: AssistantDrawerProps) {
  const t = useTranslations("help.assistantDrawer");
  const GENERIC_ERROR = t("genericError");
  const pathname = usePathname() ?? "";
  const screen = resolveAssistantScreen(pathname);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateSending, setEscalateSending] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const nextKey = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, escalating, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const conversationFull = messages.length >= ASSISTANT_MAX_CONVERSATION_MESSAGES;

  function patchMessage(key: number, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) {
    setMessages((prev) => prev.map((m) => (m.key === key ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)));
  }

  function startNewConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setStreaming(false);
    setEscalating(false);
    setEscalateNote("");
    setEscalated(false);
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming || conversationFull) return;

    const userKey = nextKey.current++;
    const answerKey = nextKey.current++;
    setMessages((prev) => [
      ...prev,
      { key: userKey, role: "user", content: question },
      { key: answerKey, role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const fail = (message: string) => patchMessage(answerKey, { content: message, failed: true });

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, screen: pathname, conversationId: conversationId ?? undefined }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        fail(data?.error || GENERIC_ERROR);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; text?: string; conversationId?: string; messageId?: string; message?: string };
          if (event.type === "meta" && event.conversationId) setConversationId(event.conversationId);
          else if (event.type === "delta" && event.text) {
            const delta = event.text;
            patchMessage(answerKey, (m) => ({ content: m.content + delta }));
          } else if (event.type === "done") {
            finished = true;
            patchMessage(answerKey, { serverId: event.messageId });
          } else if (event.type === "error") {
            finished = true;
            fail(event.message || GENERIC_ERROR);
          }
        }
      }
      // Stream ended without a result (connection dropped mid-answer).
      if (!finished) patchMessage(answerKey, (m) => (m.content ? {} : { content: GENERIC_ERROR, failed: true }));
    } catch {
      if (!controller.signal.aborted) fail(GENERIC_ERROR);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }

  async function rate(message: ChatMessage, rating: 1 | -1) {
    if (!message.serverId) return;
    const next = message.rating === rating ? undefined : rating;
    patchMessage(message.key, { rating: next });
    const res = await fetch("/api/assistant/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: message.serverId, rating: next ?? 0 }),
    }).catch(() => null);
    if (!res?.ok) {
      patchMessage(message.key, { rating: message.rating });
      toast.error(t("ratingFailed"));
    }
  }

  async function escalate() {
    if (escalateSending) return;
    setEscalateSending(true);
    try {
      const res = await fetch("/api/assistant/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          screen: pathname,
          note: escalateNote.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || t("escalateFailed"));
        return;
      }
      setEscalated(true);
      setEscalating(false);
      setEscalateNote("");
      toast.success(t("escalateSent"));
    } catch {
      toast.error(t("escalateFailed"));
    } finally {
      setEscalateSending(false);
    }
  }

  const hasChat = messages.length > 0;
  const noteRequired = !hasChat;
  const canEscalate = !escalateSending && (!noteRequired || escalateNote.trim().length >= 10);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/30 no-print" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 sm:inset-y-0 sm:start-auto sm:end-0 sm:w-[420px] z-50 flex flex-col bg-white shadow-2xl sm:border-s border-petra-border focus:outline-none no-print"
        >
          {/* Header — the X is always visible: on mobile there is no ESC key and no backdrop to tap */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-petra-border">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold text-petra-text leading-tight">Petra AI</Dialog.Title>
              <p className="text-xs text-petra-muted truncate">
                {screen ? t("helpOnScreen", { screen: screen.name }) : t("helpGeneral")}
              </p>
            </div>
            {hasChat && (
              <button type="button" onClick={startNewConversation} className="btn-ghost px-2" aria-label={t("newConversation")} title={t("newConversation")}>
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <Dialog.Close className="btn-ghost px-2" aria-label={t("close")}>
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
            {!hasChat && (
              <div className="space-y-4">
                <p className="text-sm text-petra-text leading-relaxed">
                  {t("welcome")}
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-petra-muted">{t("suggestionsTitle")}</p>
                  {suggestionsForPath(pathname).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="block w-full text-start text-sm px-3.5 py-2.5 rounded-xl border border-petra-border bg-white hover:border-brand-300 hover:bg-brand-50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.key} className="flex justify-start">
                  <div dir="auto" className="max-w-[85%] rounded-2xl rounded-ss-md bg-brand-500 text-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.key} className="flex flex-col items-end gap-1">
                  <div
                    dir="auto"
                    className={cn(
                      "max-w-[92%] rounded-2xl rounded-se-md px-3.5 py-2.5 break-words",
                      message.failed ? "bg-red-50 text-red-700 border border-red-100" : "bg-slate-100 text-petra-text"
                    )}
                  >
                    {message.content ? (
                      <AssistantMarkdown content={message.content} onNavigate={() => onOpenChange(false)} />
                    ) : (
                      <span className="flex gap-1 py-1.5" role="status" aria-label={t("typing")}>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
                      </span>
                    )}
                  </div>
                  {message.serverId && (
                    <div className="flex items-center gap-1 pe-1">
                      <button
                        type="button"
                        onClick={() => rate(message, 1)}
                        aria-label={t("helpful")}
                        aria-pressed={message.rating === 1}
                        className={cn("p-1.5 rounded-lg transition-colors", message.rating === 1 ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-petra-text hover:bg-slate-100")}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rate(message, -1)}
                        aria-label={t("notHelpful")}
                        aria-pressed={message.rating === -1}
                        className={cn("p-1.5 rounded-lg transition-colors", message.rating === -1 ? "text-red-600 bg-red-50" : "text-slate-400 hover:text-petra-text hover:bg-slate-100")}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {escalated && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3.5 py-2.5">
                {t("escalatedNotice")}
              </p>
            )}

            {escalating && (
              <div className="card p-3.5 space-y-2.5">
                <p className="text-sm font-semibold text-petra-text">{t("talkToHuman")}</p>
                <p className="text-xs text-petra-muted leading-relaxed">
                  {hasChat
                    ? t("escalateWithChat")
                    : t("escalateNoChat")}
                </p>
                <textarea
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  maxLength={ASSISTANT_MAX_NOTE_CHARS}
                  rows={3}
                  placeholder={hasChat ? t("notePlaceholderOptional") : t("notePlaceholderRequired")}
                  className="input resize-none"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={escalate} disabled={!canEscalate} className="btn-primary">
                    {escalateSending ? t("sending") : t("submitEscalation")}
                  </button>
                  <button type="button" onClick={() => setEscalating(false)} className="btn-ghost">
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-petra-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
            {conversationFull ? (
              <button type="button" onClick={startNewConversation} className="btn-secondary w-full justify-center">
                <RotateCcw className="w-4 h-4" />
                {t("conversationFull")}
              </button>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
                  rows={1}
                  placeholder={t("inputPlaceholder")}
                  aria-label={t("inputAriaLabel")}
                  className="input resize-none max-h-32"
                />
                <button type="submit" disabled={!input.trim() || streaming} className="btn-primary px-3" aria-label={t("send")}>
                  <Send className="w-4 h-4 -scale-x-100 ltr:scale-x-100" />
                </button>
              </form>
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEscalating(true)}
                disabled={escalated || escalating}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-petra-muted hover:text-petra-text disabled:opacity-50 disabled:hover:text-petra-muted"
              >
                <UserRound className="w-3.5 h-3.5" />
                {t("talkToHuman")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenHelpCenter();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-petra-muted hover:text-petra-text"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                {t("helpCenter")}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 text-center">{t("disclaimer")}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
