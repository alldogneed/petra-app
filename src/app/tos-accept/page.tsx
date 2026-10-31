"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckSquare, Square, ShieldCheck } from "lucide-react";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";

// Legal text lives in messages (auth.tosAcceptPage.sections.<id>.{title,items.p1…pN}).
const TOS_SECTIONS: { id: string; items: number }[] = [
  { id: "intro", items: 4 },
  { id: "definitions", items: 5 },
  { id: "registration", items: 4 },
  { id: "acceptableUse", items: 5 },
  { id: "license", items: 4 },
  { id: "payments", items: 7 },
  { id: "dataRetention", items: 3 },
  { id: "privacy", items: 3 },
  { id: "liability", items: 3 },
  { id: "indemnity", items: 1 },
  { id: "termination", items: 3 },
  { id: "changes", items: 2 },
  { id: "jurisdiction", items: 3 },
  { id: "forceMajeure", items: 1 },
];

export default function TosAcceptPage() {
  const router = useRouter();
  const t = useTranslations("auth.tosAcceptPage");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!accepted) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tos/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: CURRENT_TOS_VERSION }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || t("errors.saveFailed"));
        return;
      }
      router.push("/dashboard");
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-petra-bg flex flex-col items-center py-10 px-4" dir={cfg.dir}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
            <Image src="/logo.svg" alt="Petra" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-petra-text">{t("title")}</h1>
          <p className="text-sm text-petra-muted mt-1">{t("subtitle")}</p>
        </div>

        {/* ToS Content */}
        <div className="card p-6 mb-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-brand-500" />
            <p className="text-sm text-petra-muted">
              {t("welcome")}
            </p>
          </div>

          {TOS_SECTIONS.map((section) => (
            <div key={section.id}>
              <h3 className="font-bold text-petra-text mb-2">{t(`sections.${section.id}.title`)}</h3>
              <ul className="space-y-1">
                {Array.from({ length: section.items }, (_, i) => (
                  <li key={i} className="text-sm text-petra-muted leading-relaxed">
                    {t(`sections.${section.id}.items.p${i + 1}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Acceptance Card */}
        <div className="card p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Checkbox */}
          <button
            type="button"
            onClick={() => setAccepted(!accepted)}
            className="flex items-start gap-3 w-full text-start group"
          >
            <div className="mt-0.5 flex-shrink-0">
              {accepted ? (
                <CheckSquare className="w-5 h-5 text-brand-500" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-500" />
              )}
            </div>
            <span className="text-sm text-petra-text leading-relaxed">
              {t.rich("consent", { b: (chunks) => <strong>{chunks}</strong> })}
            </span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-pulse">{t("saving")}</span>
            ) : (
              t("accept")
            )}
          </button>

          <p className="text-xs text-petra-muted text-center">
            {t("evidenceNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
