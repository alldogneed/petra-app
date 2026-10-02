"use client";
/**
 * Bulk WhatsApp — a sequential queue: each click opens ONE wa.me chat (a direct user gesture,
 * so the browser never blocks it as a popup) and advances to the next recipient.
 * `{שם}` in the message is replaced with each customer's first name.
 */
import { useMemo, useState } from "react";
import { Check, MessageCircle, SkipForward, X } from "lucide-react";
import { toWhatsAppPhone } from "@/lib/utils";
import { personalizeMessage } from "@/lib/customer-filters";
import type { EnhancedCustomer } from "./types";

type RowState = "pending" | "sent" | "skipped";

export function BulkWhatsAppModal({
  customers,
  onClose,
}: {
  customers: EnhancedCustomer[];
  onClose: () => void;
}) {
  const recipients = useMemo(
    () => customers.filter((c) => c.phone && c.phone.replace(/\D/g, "").length >= 9),
    [customers]
  );
  const invalidCount = customers.length - recipients.length;
  const [message, setMessage] = useState("שלום {שם}, ");
  const [state, setState] = useState<Record<string, RowState>>({});
  const nextIndex = recipients.findIndex((c) => !state[c.id] || state[c.id] === "pending");
  const next = nextIndex >= 0 ? recipients[nextIndex] : null;
  const doneCount = recipients.filter((c) => state[c.id] === "sent" || state[c.id] === "skipped").length;

  const linkFor = (c: EnhancedCustomer) =>
    `https://wa.me/${toWhatsAppPhone(c.phone)}?text=${encodeURIComponent(personalizeMessage(message, c.name))}`;

  const openFor = (c: EnhancedCustomer) => {
    window.open(linkFor(c), "_blank", "noopener,noreferrer");
    setState((s) => ({ ...s, [c.id]: "sent" }));
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content max-w-md w-full mx-4 flex flex-col max-h-[85vh]" role="dialog" aria-modal="true" aria-labelledby="bulk-wa-title">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 id="bulk-wa-title" className="text-lg font-bold text-slate-900">שליחת הודעה בוואטסאפ</h2>
            <p className="text-xs text-petra-muted mt-0.5">
              {recipients.length} נמענים{invalidCount > 0 ? ` · ${invalidCount} ללא מספר תקין` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="סגור" className="btn-ghost w-8 h-8 p-0 flex items-center justify-center rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="label" htmlFor="bulk-wa-msg">תוכן ההודעה</label>
            <textarea
              id="bulk-wa-msg"
              className="input resize-none"
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="שלום {שם}! רצינו להזמין אותך לתור הבא שלך... 🐾"
            />
            <p className="text-xs text-petra-muted mt-1">
              <span className="font-mono bg-slate-100 px-1 rounded">{"{שם}"}</span> יוחלף בשם הפרטי של כל לקוח.
              כל לחיצה פותחת שיחה אחת בוואטסאפ שלך — שלחו ולחצו שוב לנמען הבא.
            </p>
          </div>

          <ul className="space-y-1.5">
            {recipients.map((c, i) => {
              const st = state[c.id] ?? "pending";
              return (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                    i === nextIndex ? "border-green-300 bg-green-50" : "border-slate-100"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-petra-text truncate">{c.name}</p>
                    <p className="text-xs text-petra-muted" dir="ltr">{c.phone}</p>
                  </div>
                  {st === "sent" && <span className="text-[11px] text-green-700 flex items-center gap-1"><Check className="w-3 h-3" />נפתח</span>}
                  {st === "skipped" && <span className="text-[11px] text-slate-400">דולג</span>}
                  <button
                    type="button"
                    className="text-[11px] text-[#25D366] hover:underline flex-shrink-0"
                    onClick={() => openFor(c)}
                    disabled={!message.trim()}
                  >
                    {st === "sent" ? "שוב" : "פתח"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-5 border-t border-slate-100 flex-shrink-0 space-y-2">
          {next ? (
            <div className="flex gap-2">
              <button
                onClick={() => openFor(next)}
                disabled={!message.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-2 min-w-0"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">שלח ל-{next.name}</span>
                <span className="flex-shrink-0">({nextIndex + 1}/{recipients.length})</span>
              </button>
              <button
                type="button"
                className="btn-secondary flex items-center gap-1"
                title="דלג על נמען זה"
                onClick={() => setState((s) => ({ ...s, [next.id]: "skipped" }))}
              >
                <SkipForward className="w-4 h-4" />
                דלג
              </button>
            </div>
          ) : (
            <button onClick={onClose} className="btn-primary w-full">
              סיום ({doneCount}/{recipients.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
