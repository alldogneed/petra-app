"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("onboarding.skipConfirmModal");
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-content max-w-sm p-6 text-center animate-scale-in">
        <p className="text-base font-semibold text-petra-text mb-2">
          {t("title")}
        </p>
        <p className="text-sm text-petra-muted mb-6">
          {t("body")}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="btn-secondary flex-1">
            {t("back")}
          </button>
          <button onClick={onConfirm} className="btn-danger flex-1">
            {t("skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
