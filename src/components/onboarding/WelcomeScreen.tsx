"use client";

interface WelcomeScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeScreen({ onStart, onSkip }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-petra-bg">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Logo */}
        <div
          className="w-20 h-20 rounded-3xl overflow-hidden mx-auto mb-8"
          style={{ boxShadow: "0 8px 32px rgba(249,115,22,0.3)" }}
        >
          <img src="/logo.svg" alt="Petra" className="w-full h-full object-cover" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-petra-text mb-3">
          ברוך הבא לפטרה 👋
        </h1>

        {/* Subtitle */}
        <p className="text-base text-petra-muted leading-relaxed mb-10 max-w-sm mx-auto">
          בוא נסדר לך את העסק תוך כמה דקות.
          <br />
          בלי בלגן, בלי אקסלים, בלי תזכורות ידניות.
        </p>

        {/* Primary CTA */}
        <button
          onClick={onStart}
          className="btn-primary w-full max-w-xs mx-auto text-base py-3 mb-4"
        >
          בוא נתחיל
        </button>

        {/* Skip */}
        <button
          onClick={onSkip}
          className="text-sm text-petra-muted hover:text-petra-text transition-colors"
        >
          דלג
        </button>
      </div>
    </div>
  );
}
