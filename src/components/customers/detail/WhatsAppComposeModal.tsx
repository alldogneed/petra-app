"use client";

import { useState } from "react";
import { X, MessageCircle, AlertTriangle, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppUrl } from "@/lib/utils";

/**
 * Manual WhatsApp to a customer.
 * Primary: open the text in the business's OWN WhatsApp (always delivered).
 * Secondary: send from Petra's number — Meta delivers free text only when the customer
 * wrote to that number in the last 24h; the route waits for Meta's answer and returns
 * a clear error when it was rejected (never "sent" for a failed message).
 */
export function WhatsAppComposeModal({
  customerId,
  customerName,
  customerPhone,
  onClose,
  onSent,
}: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = message.trim();
  const ownUrl = customerPhone && text ? buildWhatsAppUrl(customerPhone, text) : null;

  function logOwnSend() {
    // Timeline only — the message itself goes from the business's own WhatsApp.
    fetch(`/api/customers/${customerId}/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, via: "own" }),
      keepalive: true,
    })
      .then(() => onSent())
      .catch(() => {});
  }

  async function handleSendViaPetra() {
    if (!text) return;
    if (!customerPhone) { setError("אין מספר טלפון ללקוח"); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בשליחה");
        setSending(false);
        return;
      }
      if (data.stub) {
        toast.success("ההודעה תועדה (WhatsApp לא מחובר — שליחה בפועל בהמתנה לאימות)");
      } else if (data.delivery === "unknown") {
        toast.success("ההודעה נשלחה, עדיין אין אישור מסירה מוואטסאפ");
      } else {
        toast.success("ההודעה נשלחה בהצלחה");
      }
      onSent();
    } catch {
      setError("שגיאה בשליחה");
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-petra-text">שליחת WhatsApp</h2>
              <p className="text-xs text-petra-muted">{customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">הודעה</label>
            <textarea
              className="input resize-none"
              rows={5}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setError(null); }}
              placeholder={`שלום ${customerName}, ...`}
              maxLength={1500}
              dir="rtl"
              autoFocus
            />
            <p className="text-xs text-petra-muted mt-1 text-left">{message.length}/1500</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {ownUrl && (
                <a
                  href={ownUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={logOwnSend}
                  className="inline-flex items-center gap-1.5 text-green-700 font-semibold hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> פתח בוואטסאפ שלי
                </a>
              )}
            </div>
          )}

          <div className="space-y-2">
            {ownUrl ? (
              <a
                href={ownUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={logOwnSend}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> פתח בוואטסאפ שלי
              </a>
            ) : (
              <button disabled className="btn-primary w-full flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" /> פתח בוואטסאפ שלי
              </button>
            )}
            <button
              onClick={handleSendViaPetra}
              disabled={!text || sending}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {sending ? "שולח ומחכה לאישור מוואטסאפ..." : "שלח מהמספר של פטרה"}
            </button>
            <p className="text-[11px] text-petra-muted leading-relaxed">
              &quot;פתח בוואטסאפ שלי&quot; תמיד מגיע ללקוח. שליחה מהמספר של פטרה נמסרת רק אם הלקוח כתב למספר הזה ב-24 השעות האחרונות.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
