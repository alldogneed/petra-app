"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { useState } from "react";
import { IntakeWhatsAppModal } from "./IntakeWhatsAppModal";

interface IntakeStatus {
  customerId: string;
  customerName: string;
  customerPhone: string;
  hasMissingDetails: boolean;
  noDogs: boolean;
  missingHealth: boolean;
  missingBehavior: boolean;
  pendingForm: { id: string; status: string; createdAt: string } | null;
}

/**
 * Banner shown on customer profile page when dog details are missing.
 * Shows prompt to send intake form via WhatsApp.
 */
export function IntakeBanner({ customerId }: { customerId: string }) {
  const [showModal, setShowModal] = useState(false);

  const { data: status } = useQuery<IntakeStatus>({
    queryKey: ["intake-status", customerId],
    queryFn: async () => {
      const r = await fetch(`/api/customers/${customerId}/intake-status`);
      if (!r.ok) throw new Error("Failed to fetch intake status");
      return r.json();
    },
  });

  if (!status?.hasMissingDetails) return null;

  // If there's already a pending/sent form, show different message
  const hasPending = status.pendingForm && ["DRAFT", "SENT", "OPENED"].includes(status.pendingForm.status);

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            חסרים פרטים על הכלב — שלח ללקוח טופס מילוי מהיר.
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            {status.noDogs && "לא נרשם כלב. "}
            {status.missingHealth && "חסרים פרטי בריאות. "}
            {status.missingBehavior && "חסר שאלון התנהגות. "}
            {hasPending && " (טופס כבר נשלח — ניתן לשלוח שוב)"}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            שלח בוואטסאפ
          </button>
        </div>
      </div>

      <IntakeWhatsAppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        customerId={status.customerId}
        customerName={status.customerName}
        customerPhone={status.customerPhone}
      />
    </>
  );
}
