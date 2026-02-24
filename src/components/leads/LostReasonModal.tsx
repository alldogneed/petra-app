"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { LOST_REASON_CODES } from "@/lib/constants";

interface LostReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, reasonText: string | null) => void;
  isPending: boolean;
}

export default function LostReasonModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: LostReasonModalProps) {
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");

  if (!isOpen) return null;

  const isValid =
    reasonCode !== "" &&
    (reasonCode !== "OTHER" || reasonText.trim().length > 0);

  const handleConfirm = () => {
    if (!isValid || isPending) return;
    onConfirm(reasonCode, reasonCode === "OTHER" ? reasonText.trim() : null);
  };

  const handleClose = () => {
    if (isPending) return;
    setReasonCode("");
    setReasonText("");
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-petra-text">
              סימון ליד כאבוד
            </h2>
            <p className="text-sm text-petra-muted mt-0.5">
              בחר סיבת אובדן לדיווח
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">סיבה *</label>
            <select
              className="input"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
            >
              <option value="">בחר סיבה...</option>
              {LOST_REASON_CODES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {reasonCode === "OTHER" && (
            <div className="animate-fade-in">
              <label className="label">פרט בקצרה... *</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="סיבת האובדן..."
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleConfirm}
            disabled={!isValid || isPending}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#EF4444" }}
          >
            {isPending ? "שומר..." : "אישור"}
          </button>
          <button onClick={handleClose} className="btn-secondary">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
