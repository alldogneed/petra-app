"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, CheckCircle2 } from "lucide-react";

import { TOTAL_STEPS, getStepConfig, buildOnboardingUrl } from "@/lib/onboarding-state";
import { trackOnboardingEvent, secondsBetween } from "@/lib/onboarding-analytics";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({
  step,
  total,
  onExit,
}: {
  step: number;
  total: number;
  onExit: () => void;
}) {
  const pct = (step / total) * 100;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] bg-white border-b border-petra-border shadow-sm"
      style={{ direction: "rtl" }}
    >
      <div className="flex items-center h-14 px-4 max-w-5xl mx-auto gap-3">
        <span className="text-sm font-semibold text-petra-text whitespace-nowrap">
          שלב {step} מתוך {total}
        </span>
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
            }}
          />
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-petra-muted hover:text-petra-text transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50 shrink-0"
        >
          <span className="hidden sm:inline">יציאה מהדרכה</span>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Spotlight({
  targetSelector,
  tooltipText,
  tooltipPosition,
}: {
  targetSelector: string;
  tooltipText: string;
  tooltipPosition: "top" | "bottom" | "left" | "right";
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  const measure = useCallback(() => {
    const el = document.querySelector(targetSelector);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [targetSelector]);

  useEffect(() => {
    // Poll for the element (it may not mount immediately after navigation)
    let attempts = 0;
    const poll = () => {
      measure();
      const el = document.querySelector(targetSelector);
      if (!el && attempts < 30) {
        attempts++;
        rafRef.current = requestAnimationFrame(poll);
      }
    };
    rafRef.current = requestAnimationFrame(poll);

    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure, targetSelector]);

  if (!rect) return null;

  const PAD = 8;
  const hl: React.CSSProperties = {
    position: "fixed",
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: 14,
    boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
    zIndex: 65,
    pointerEvents: "none",
    border: "2px solid rgba(249,115,22,0.7)",
  };

  // Tooltip placement
  const tt: React.CSSProperties = {
    position: "fixed",
    zIndex: 66,
    maxWidth: 280,
    direction: "rtl",
  };
  const GAP = 12;
  switch (tooltipPosition) {
    case "bottom":
      tt.top = rect.bottom + PAD + GAP;
      tt.left = rect.left + rect.width / 2;
      tt.transform = "translateX(-50%)";
      break;
    case "top":
      tt.bottom = window.innerHeight - rect.top + PAD + GAP;
      tt.left = rect.left + rect.width / 2;
      tt.transform = "translateX(-50%)";
      break;
    case "left":
      tt.top = rect.top + rect.height / 2;
      tt.right = window.innerWidth - rect.left + PAD + GAP;
      tt.transform = "translateY(-50%)";
      break;
    case "right":
      tt.top = rect.top + rect.height / 2;
      tt.left = rect.right + PAD + GAP;
      tt.transform = "translateY(-50%)";
      break;
  }
  // Viewport clamp
  if (typeof tt.left === "number") {
    tt.left = Math.max(16, Math.min(tt.left, window.innerWidth - 296));
  }

  return (
    <>
      <div style={hl}>
        {/* Pulse ring */}
        <div
          className="absolute inset-0 rounded-xl animate-pulse-soft"
          style={{ boxShadow: "0 0 0 6px rgba(249,115,22,0.25)" }}
        />
      </div>
      <div style={tt} className="animate-slide-up">
        <div className="bg-white rounded-2xl shadow-modal border border-petra-border px-4 py-3">
          <p className="text-sm font-medium text-petra-text leading-relaxed">
            {tooltipText}
          </p>
        </div>
      </div>
    </>
  );
}

function SuccessToast({
  msg,
  onDone,
}: {
  msg: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] animate-slide-up"
      style={{ direction: "rtl" }}
    >
      <div className="bg-white rounded-2xl shadow-modal border border-emerald-100 px-5 py-3.5 flex items-center gap-3 min-w-[260px]">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 text-lg">
          🎉
        </div>
        <p className="text-sm font-medium text-petra-text leading-snug">{msg}</p>
      </div>
    </div>
  );
}

function SkipModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay z-[90]">
      <div className="modal-backdrop" onClick={onCancel} />
      <div
        className="modal-content max-w-sm p-6 text-center animate-scale-in"
        style={{ direction: "rtl" }}
      >
        <p className="text-base font-semibold text-petra-text mb-2">
          בטוח שתרצה לדלג?
        </p>
        <p className="text-sm text-petra-muted mb-6">
          אפשר לחזור לזה אחר כך מתפריט ההגדרות.
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

function EnableRemindersModal({
  onEnabled,
  onSkip,
  loading,
}: {
  onEnabled: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  return (
    <div className="modal-overlay z-[80]">
      <div className="modal-backdrop" />
      <div
        className="modal-content max-w-sm p-6 text-center animate-scale-in"
        style={{ direction: "rtl" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)",
            boxShadow: "0 6px 24px rgba(139,92,246,0.3)",
          }}
        >
          <span className="text-3xl">🔔</span>
        </div>
        <h3 className="text-lg font-bold text-petra-text mb-2">
          תזכורות אוטומטיות
        </h3>
        <p className="text-sm text-petra-muted mb-6 leading-relaxed">
          פטרה יכולה לשלוח תזכורת אוטומטית 48 שעות לפני השירות.
          <br />
          רוצה להפעיל?
        </p>
        <button
          onClick={onEnabled}
          disabled={loading}
          className="btn-primary w-full justify-center py-3 text-base mb-3"
        >
          {loading ? "מפעיל..." : "הפעל תזכורות"}
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-petra-muted hover:text-petra-text transition-colors"
        >
          דלג לעכשיו
        </button>
      </div>
    </div>
  );
}

function CompletionModal({ onDone }: { onDone: () => void }) {
  const checks = ["לקוח נוסף", "כלב נוסף", "תור נקבע", "תזכורת הופעלה"];
  return (
    <div className="modal-overlay z-[80]">
      <div className="modal-backdrop" />
      <div
        className="modal-content max-w-md p-8 text-center animate-scale-in"
        style={{ direction: "rtl" }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
            boxShadow: "0 8px 32px rgba(16,185,129,0.3)",
          }}
        >
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-petra-text mb-2">
          העסק שלך כבר נראה אחרת.
        </h2>
        <p className="text-sm text-petra-muted mb-6 leading-relaxed">
          בעלי עסקים בתחום הכלבים עובדים קשה.
          <br />
          פטרה כאן כדי להוריד ממך עומס.
        </p>
        <div className="space-y-2.5 mb-8 text-right max-w-xs mx-auto">
          {checks.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-medium text-emerald-800">{c}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onDone}
          className="btn-primary text-base py-3 px-8 inline-flex"
        >
          המשך לדשבורד
        </button>
      </div>
    </div>
  );
}

// ─── Main OnboardingOverlay ───────────────────────────────────────────────────

interface OnboardingOverlayProps {
  children: ReactNode;
}

type Phase =
  | "spotlight"
  | "success"
  | "reminders"
  | "completion"
  | "done";

export function OnboardingOverlay({ children }: OnboardingOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOnboarding = searchParams.get("onboarding") === "1";
  const stepParam = parseInt(searchParams.get("step") ?? "0", 10);

  const [phase, setPhase] = useState<Phase>("spotlight");
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const startedAtRef = useRef<string>("");

  const stepConfig = getStepConfig(stepParam);

  // Load startedAt from server
  useEffect(() => {
    if (!isOnboarding) return;
    fetch("/api/onboarding/progress")
      .then((r) => r.json())
      .then((p) => {
        if (p?.startedAt) startedAtRef.current = p.startedAt;
      })
      .catch(() => {});
  }, [isOnboarding]);

  // Reset phase when step or route changes
  useEffect(() => {
    setPhase("spotlight");
  }, [stepParam, pathname]);

  async function updateProgress(data: Record<string, unknown>) {
    await fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // ─── Step completion handlers ─────────────────────────────────────────────

  // Called by actual page components via a custom event
  useEffect(() => {
    if (!isOnboarding) return;

    function handleStepDone(e: Event) {
      const detail = (e as CustomEvent<{ step: number; customerId?: string; petId?: string }> ).detail;
      if (detail.step !== stepParam) return;

      const now = new Date().toISOString();
      const config = getStepConfig(detail.step);

      trackOnboardingEvent("onboarding_step_completed", { step_number: detail.step });

      if (detail.step === 1) {
        trackOnboardingEvent("time_to_first_customer", {
          seconds: secondsBetween(startedAtRef.current, now),
        });
        // Save customerId so step 2 can resume on reload
        updateProgress({
          stepCompleted1: true,
          currentStep: 2,
          lastCustomerId: detail.customerId,
        });
        setSuccessMsg(config?.successMessage ?? "");
        setPhase("success");

        // After toast, go to customer profile for step 2
        setTimeout(() => {
          setPhase("spotlight");
          router.push(buildOnboardingUrl(2, detail.customerId));
        }, 2900);
      } else if (detail.step === 2) {
        updateProgress({ stepCompleted2: true, currentStep: 3 });
        setSuccessMsg(config?.successMessage ?? "");
        setPhase("success");

        setTimeout(() => {
          setPhase("spotlight");
          router.push(buildOnboardingUrl(3));
        }, 2900);
      } else if (detail.step === 3) {
        trackOnboardingEvent("time_to_first_booking", {
          seconds: secondsBetween(startedAtRef.current, now),
        });
        updateProgress({ stepCompleted3: true, currentStep: 4 });
        setSuccessMsg(config?.successMessage ?? "");
        setPhase("success");

        setTimeout(() => {
          setPhase("reminders");
          router.push(buildOnboardingUrl(4));
        }, 2900);
      }
    }

    window.addEventListener("onboarding:step-done", handleStepDone);
    return () => window.removeEventListener("onboarding:step-done", handleStepDone);
  }, [isOnboarding, stepParam, router]);

  // ─── Skip / Exit ───────────────────────────────────────────────────────────

  const handleSkipConfirm = useCallback(async () => {
    trackOnboardingEvent("onboarding_skipped");
    await updateProgress({ skipped: true });
    router.push("/dashboard");
  }, [router]);

  // ─── Step 4: enable reminders ──────────────────────────────────────────────

  const handleRemindersEnabled = useCallback(async () => {
    setSavingReminders(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remindersEnabled: true, remindersLeadHours: 48 }),
      });
      trackOnboardingEvent("reminders_enabled");
      updateProgress({ stepCompleted4: true, completedAt: new Date().toISOString() });
      trackOnboardingEvent("onboarding_completed");
      setPhase("completion");
    } finally {
      setSavingReminders(false);
    }
  }, []);

  const handleRemindersSkip = useCallback(() => {
    updateProgress({ stepCompleted4: true, completedAt: new Date().toISOString() });
    trackOnboardingEvent("onboarding_completed");
    setPhase("completion");
  }, []);

  const handleCompletionDone = useCallback(() => {
    setPhase("done");
    router.push("/dashboard");
  }, [router]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!isOnboarding || !stepConfig || phase === "done") {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Progress bar (fixed top, above topbar) */}
      <ProgressBar
        step={stepParam}
        total={TOTAL_STEPS}
        onExit={() => setShowSkipModal(true)}
      />

      {/* Spotlight coachmark */}
      {phase === "spotlight" && (
        <Spotlight
          targetSelector={stepConfig.targetSelector}
          tooltipText={stepConfig.tooltipText}
          tooltipPosition={stepConfig.tooltipPosition}
        />
      )}

      {/* Success toast (auto-dismisses) */}
      {phase === "success" && (
        <SuccessToast
          msg={successMsg}
          onDone={() => {}} // transition handled by setTimeout above
        />
      )}

      {/* Step 4 modals */}
      {phase === "reminders" && (
        <EnableRemindersModal
          onEnabled={handleRemindersEnabled}
          onSkip={handleRemindersSkip}
          loading={savingReminders}
        />
      )}

      {phase === "completion" && (
        <CompletionModal onDone={handleCompletionDone} />
      )}

      {/* Exit confirmation */}
      {showSkipModal && (
        <SkipModal
          onConfirm={handleSkipConfirm}
          onCancel={() => setShowSkipModal(false)}
        />
      )}
    </>
  );
}

/**
 * Fire this from any page component when the user completes the current step.
 * Example: dispatchOnboardingStepDone(1, customer.id)
 */
export function dispatchOnboardingStepDone(
  step: number,
  customerId?: string,
  petId?: string
) {
  window.dispatchEvent(
    new CustomEvent("onboarding:step-done", {
      detail: { step, customerId, petId },
    })
  );
}
