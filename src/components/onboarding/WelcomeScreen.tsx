"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface WelcomeScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeScreen({ onStart, onSkip }: WelcomeScreenProps) {
  const t = useTranslations("onboarding.welcomeScreen");
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-petra-bg">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Logo */}
        <div
          className="w-20 h-20 rounded-3xl overflow-hidden mx-auto mb-8"
          style={{ boxShadow: "0 8px 32px rgba(249,115,22,0.3)" }}
        >
          <Image src="/logo.svg" alt="Petra" width={80} height={80} className="w-full h-full object-cover" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-petra-text mb-3">
          {t("title")}
        </h1>

        {/* Subtitle */}
        <p className="text-base text-petra-muted leading-relaxed mb-10 max-w-sm mx-auto">
          {t("subtitleLine1")}
          <br />
          {t("subtitleLine2")}
        </p>

        {/* Primary CTA */}
        <button
          onClick={onStart}
          className="btn-primary w-full max-w-xs mx-auto text-base py-3 mb-4"
        >
          {t("start")}
        </button>

        {/* Skip */}
        <button
          onClick={onSkip}
          className="text-sm text-petra-muted hover:text-petra-text transition-colors"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
