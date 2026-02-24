"use client";

interface SkipConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SkipConfirmModal({
  open,
  onConfirm,
  onCancel,
}: SkipConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-sm p-6 text-center animate-scale-in">
        <p className="text-base font-semibold text-petra-text mb-2">
          בטוח שתרצה לדלג?
        </p>
        <p className="text-sm text-petra-muted mb-6">
          אפשר לחזור לזה אחר כך.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="btn-secondary flex-1">
            חזרה
          </button>
          <button onClick={onConfirm} className="btn-danger flex-1">
            דלג
          </button>
        </div>
      </div>
    </div>
  );
}
