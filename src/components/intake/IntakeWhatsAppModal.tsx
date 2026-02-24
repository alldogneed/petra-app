"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Link2, Check, Loader2, Phone, ExternalLink } from "lucide-react";

interface IntakeWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerPhone: string;
  dogId?: string;
}

interface IntakeCreateResponse {
  id: string;
  token: string;
  intakeLink: string;
  whatsappUrl: string;
  messageText: string;
  expiresAt: string;
}

export function IntakeWhatsAppModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerPhone,
  dogId,
}: IntakeWhatsAppModalProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(customerPhone);
  const [messageOverride, setMessageOverride] = useState("");
  const [created, setCreated] = useState<IntakeCreateResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Create intake form + get link/whatsapp URL
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          dogId,
          phone,
          messageOverride: messageOverride || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create intake form");
      return res.json() as Promise<IntakeCreateResponse>;
    },
    onSuccess: (data) => {
      setCreated(data);
    },
  });

  // Mark as SENT
  const markSentMutation = useMutation({
    mutationFn: async (intakeFormId: string) => {
      await fetch("/api/intake/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeFormId, deliveryChannel: "WHATSAPP_DEEPLINK" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake-status", customerId] });
    },
  });

  const handleSendWhatsApp = async () => {
    let data = created;
    if (!data) {
      data = await createMutation.mutateAsync();
    }
    if (!data) return;

    // Open WhatsApp deep link in new tab
    window.open(data.whatsappUrl, "_blank");

    // Mark as sent
    markSentMutation.mutate(data.id);
    showToast("נפתח וואטסאפ לשליחה");
  };

  const handleCopyLink = async () => {
    let data = created;
    if (!data) {
      data = await createMutation.mutateAsync();
    }
    if (!data) return;

    try {
      await navigator.clipboard.writeText(data.intakeLink);
      showToast("הקישור הועתק");
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = data.intakeLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToast("הקישור הועתק");
    }
  };

  const handleClose = () => {
    setCreated(null);
    setMessageOverride("");
    setPhone(customerPhone);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text">שליחת טופס בוואטסאפ</h2>
            <p className="text-sm text-petra-muted mt-0.5">שלח טופס קליטה ללקוח</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer name (readonly) */}
          <div>
            <label className="label">שם לקוח</label>
            <div className="input bg-slate-50 text-slate-600 cursor-not-allowed">
              {customerName}
            </div>
          </div>

          {/* Phone (editable) */}
          <div>
            <label className="label">מספר טלפון *</label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pr-10"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
              />
            </div>
            <p className="text-xs text-petra-muted mt-1">פורמט ישראלי, ניתן גם +972</p>
          </div>

          {/* Message preview (editable) */}
          <div>
            <label className="label">תצוגה מקדימה של ההודעה</label>
            <textarea
              className="input min-h-[120px] resize-none text-sm leading-relaxed"
              value={messageOverride || `היי ${customerName}, כאן [שם העסק] 👋\nכדי שנתכונן בצורה הכי טובה, אשמח שתמלא/י בקישור את פרטי הכלב והבריאות שלו (דקה-שתיים):\n[קישור הטופס]\nתודה!`}
              onChange={(e) => setMessageOverride(e.target.value)}
              dir="rtl"
            />
            <p className="text-xs text-petra-muted mt-1">הקישור יוכנס אוטומטית</p>
          </div>

          {/* Link preview (if created) */}
          {created && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-xs font-medium text-emerald-700 mb-1">קישור נוצר:</p>
              <p className="text-xs text-emerald-600 break-all" dir="ltr">{created.intakeLink}</p>
              <p className="text-xs text-emerald-500 mt-1">
                בתוקף עד: {new Date(created.expiresAt).toLocaleDateString("he-IL")}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSendWhatsApp}
            disabled={!phone.trim() || createMutation.isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            שלח בוואטסאפ
          </button>
          <button
            onClick={handleCopyLink}
            disabled={!phone.trim() || createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-petra-text border border-petra-border rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Link2 className="w-4 h-4" />
            העתק קישור
          </button>
          <button onClick={handleClose} className="btn-ghost text-sm">
            ביטול
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 animate-slide-up">
            <Check className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
