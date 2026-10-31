"use client";

import { Bell, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface EnableRemindersStepProps {
  open: boolean;
  onEnabled: () => void;
  loading?: boolean;
}

export function EnableRemindersStep({
  open,
  onEnabled,
  loading,
}: EnableRemindersStepProps) {
  const t = useTranslations("onboarding.enableRemindersStep");
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" />
      <div className="modal-content max-w-sm p-6 text-center animate-scale-in">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)",
            boxShadow: "0 6px 24px rgba(139,92,246,0.3)",
          }}
        >
          <Bell className="w-8 h-8 text-white" />
        </div>

        <h3 className="text-lg font-bold text-petra-text mb-2">
          {t("title")}
        </h3>

        <p className="text-sm text-petra-muted mb-6 leading-relaxed">
          {t("bodyLine1")}
          <br />
          {t("bodyLine2")}
        </p>

        {/* Lead time info */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-petra-muted">
          <Clock className="w-3.5 h-3.5" />
          <span>{t("leadTime")}</span>
        </div>

        <button
          onClick={onEnabled}
          disabled={loading}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {loading ? t("enabling") : t("enable")}
        </button>
      </div>
    </div>
  );
}
