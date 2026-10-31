"use client";

import { useState } from "react";
import { X, MessageCircle, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";

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
  const t = useTranslations("customers.whatsAppComposeModal");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    if (!customerPhone) { setError(t("noPhone")); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("sendError"));
        setSending(false);
        return;
      }
      if (data.stub) {
        toast.success(t("loggedStub"));
      } else {
        toast.success(t("sentSuccess"));
      }
      onSent();
    } catch {
      setError(t("sendError"));
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
              <h2 className="text-base font-bold text-petra-text">{t("title")}</h2>
              <p className="text-xs text-petra-muted">{customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t("messageLabel")}</label>
            <textarea
              className="input resize-none"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("placeholder", { name: customerName })}
              maxLength={1500}
              dir={cfg.dir}
              autoFocus
            />
            <p className="text-xs text-petra-muted mt-1 text-end">{message.length}/1500</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">{tc("actions.cancel")}</button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> {sending ? t("sending") : t("send")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
