"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button (disconnect / delete / discard). */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lightweight confirmation modal — replaces window.confirm() (unstyled, LTR,
 * blocked in some in-app browsers). For irreversible deletes that need the
 * user to type a name, use ConfirmDeleteModal instead.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        className="modal-content max-w-sm w-full"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              danger ? "bg-red-100" : "bg-amber-100",
            )}>
              <AlertTriangle className={cn("w-5 h-5", danger ? "text-red-600" : "text-amber-600")} />
            </div>
            <h2 id="confirm-dialog-title" className="text-base font-bold text-petra-text">{title}</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="text-petra-muted hover:text-petra-text" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>
        {description && <div className="text-sm text-petra-muted mb-5 leading-relaxed">{description}</div>}
        <div className="flex gap-2 justify-end">
          <button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(danger ? "btn-danger" : "btn-primary", "flex items-center gap-1.5")}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
