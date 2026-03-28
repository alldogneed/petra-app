"use client";

import { useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** The exact text the user must type to confirm (e.g. customer name) */
  confirmText: string;
  /** Optional extra description */
  description?: string;
  loading?: boolean;
}

/**
 * Double-confirmation modal for destructive actions (owner role).
 * Requires the user to type `confirmText` exactly before the delete button activates.
 * Prevents accidental deletion of critical data.
 */
export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  confirmText,
  description,
  loading = false,
}: ConfirmDeleteModalProps) {
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const isMatch = typed.trim() === confirmText.trim();

  const handleClose = () => {
    setTyped("");
    onClose();
  };

  const handleConfirm = () => {
    if (!isMatch) return;
    onConfirm();
  };

  return (
    <div className="modal-overlay" dir="rtl">
      <div className="modal-content max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{title}</h2>
              <p className="text-xs text-red-600 font-medium">פעולה בלתי הפיכה</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">{description}</p>
        )}

        {/* Confirmation input */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700 mb-2">
            להמשך, הקלד את הטקסט הבא בדיוק:
          </p>
          <p className="font-mono font-bold text-red-800 bg-white border border-red-300 rounded-lg px-3 py-2 text-sm mb-3 select-all">
            {confirmText}
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onPaste={(e) => e.preventDefault()} // must type, not paste
            placeholder="הקלד כאן..."
            className={cn(
              "w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors",
              isMatch
                ? "border-green-400 bg-green-50 text-green-800"
                : "border-slate-300 bg-white text-slate-800 focus:border-red-400"
            )}
            autoFocus
          />
          {typed.length > 0 && !isMatch && (
            <p className="text-xs text-red-500 mt-1">הטקסט אינו תואם</p>
          )}
          {isMatch && (
            <p className="text-xs text-green-600 mt-1 font-medium">✓ אושר</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!isMatch || loading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              isMatch && !loading
                ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <Trash2 className="w-4 h-4" />
            {loading ? "מוחק..." : "מחק לצמיתות"}
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
