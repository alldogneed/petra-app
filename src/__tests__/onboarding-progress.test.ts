/**
 * Tests for onboarding progress logic.
 * Tests the business logic of step progression and idempotency.
 */

interface OnboardingProgress {
  currentStep: number;
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4: boolean;
  skipped: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Pure function that computes the resume phase from progress + profile state.
 * This mirrors the logic in OnboardingPage's useEffect.
 */
function computeResumePhase(
  progress: OnboardingProgress,
  hasProfile: boolean
):
  | "dashboard"
  | "welcome"
  | "personalization"
  | "step1"
  | "step2"
  | "step3"
  | "completion"
  | "what_next" {
  if (progress.completedAt || progress.skipped) return "dashboard";
  if (!progress.startedAt) return "welcome";
  if (!hasProfile) return "personalization";
  if (!progress.stepCompleted1) return "step1";
  if (!progress.stepCompleted2) return "step2";
  if (!progress.stepCompleted3) return "step3";
  if (!progress.stepCompleted4) return "completion";
  return "what_next";
}

/**
 * Pure function that merges an update into existing progress,
 * enforcing idempotency (never un-completes a step).
 */
function applyProgressUpdate(
  existing: OnboardingProgress,
  update: Partial<OnboardingProgress>
): OnboardingProgress {
  return {
    ...existing,
    currentStep:
      typeof update.currentStep === "number"
        ? update.currentStep
        : existing.currentStep,
    stepCompleted1: update.stepCompleted1 === true || existing.stepCompleted1,
    stepCompleted2: update.stepCompleted2 === true || existing.stepCompleted2,
    stepCompleted3: update.stepCompleted3 === true || existing.stepCompleted3,
    stepCompleted4: update.stepCompleted4 === true || existing.stepCompleted4,
    skipped: update.skipped === true || existing.skipped,
    startedAt: existing.startedAt || update.startedAt || null,
    completedAt: update.completedAt || existing.completedAt,
  };
}

describe("computeResumePhase", () => {
  const freshProgress: OnboardingProgress = {
    currentStep: 0,
    stepCompleted1: false,
    stepCompleted2: false,
    stepCompleted3: false,
    stepCompleted4: false,
    skipped: false,
    startedAt: null,
    completedAt: null,
  };

  it("returns 'welcome' for brand new user", () => {
    expect(computeResumePhase(freshProgress, false)).toBe("welcome");
  });

  it("returns 'dashboard' if skipped", () => {
    const progress = { ...freshProgress, skipped: true };
    expect(computeResumePhase(progress, false)).toBe("dashboard");
  });

  it("returns 'dashboard' if completed", () => {
    const progress = {
      ...freshProgress,
      completedAt: "2026-02-19T10:00:00.000Z",
    };
    expect(computeResumePhase(progress, false)).toBe("dashboard");
  });

  it("returns 'personalization' if started but no profile", () => {
    const progress = {
      ...freshProgress,
      startedAt: "2026-02-19T10:00:00.000Z",
    };
    expect(computeResumePhase(progress, false)).toBe("personalization");
  });

  it("returns 'step1' if profile exists but step1 not done", () => {
    const progress = {
      ...freshProgress,
      startedAt: "2026-02-19T10:00:00.000Z",
    };
    expect(computeResumePhase(progress, true)).toBe("step1");
  });

  it("returns 'step2' if step1 done", () => {
    const progress = {
      ...freshProgress,
      startedAt: "2026-02-19T10:00:00.000Z",
      stepCompleted1: true,
    };
    expect(computeResumePhase(progress, true)).toBe("step2");
  });

  it("returns 'step3' if step1+step2 done", () => {
    const progress = {
      ...freshProgress,
      startedAt: "2026-02-19T10:00:00.000Z",
      stepCompleted1: true,
      stepCompleted2: true,
    };
    expect(computeResumePhase(progress, true)).toBe("step3");
  });

  it("returns 'completion' if steps 1-3 done", () => {
    const progress = {
      ...freshProgress,
      startedAt: "2026-02-19T10:00:00.000Z",
      stepCompleted1: true,
      stepCompleted2: true,
      stepCompleted3: true,
    };
    expect(computeResumePhase(progress, true)).toBe("completion");
  });

  it("returns 'what_next' if all 4 steps done but no completedAt", () => {
    const progress = {
      ...freshProgress,
      startedAt: "2026-02-19T10:00:00.000Z",
      stepCompleted1: true,
      stepCompleted2: true,
      stepCompleted3: true,
      stepCompleted4: true,
    };
    expect(computeResumePhase(progress, true)).toBe("what_next");
  });
});

describe("applyProgressUpdate (idempotency)", () => {
  const completedProgress: OnboardingProgress = {
    currentStep: 2,
    stepCompleted1: true,
    stepCompleted2: false,
    stepCompleted3: false,
    stepCompleted4: false,
    skipped: false,
    startedAt: "2026-02-19T10:00:00.000Z",
    completedAt: null,
  };

  it("never un-completes a step", () => {
    const result = applyProgressUpdate(completedProgress, {
      stepCompleted1: false,
    } as unknown as Partial<OnboardingProgress>);
    expect(result.stepCompleted1).toBe(true);
  });

  it("completes a new step", () => {
    const result = applyProgressUpdate(completedProgress, {
      stepCompleted2: true,
    });
    expect(result.stepCompleted2).toBe(true);
    expect(result.stepCompleted1).toBe(true); // unchanged
  });

  it("preserves startedAt on subsequent updates", () => {
    const result = applyProgressUpdate(completedProgress, {
      startedAt: "2026-02-20T10:00:00.000Z",
    });
    // Should keep the original startedAt
    expect(result.startedAt).toBe("2026-02-19T10:00:00.000Z");
  });

  it("sets startedAt when not previously set", () => {
    const fresh: OnboardingProgress = {
      ...completedProgress,
      startedAt: null,
    };
    const result = applyProgressUpdate(fresh, {
      startedAt: "2026-02-19T10:00:00.000Z",
    });
    expect(result.startedAt).toBe("2026-02-19T10:00:00.000Z");
  });

  it("never un-skips", () => {
    const skippedProgress = { ...completedProgress, skipped: true };
    const result = applyProgressUpdate(skippedProgress, {
      skipped: false,
    } as unknown as Partial<OnboardingProgress>);
    expect(result.skipped).toBe(true);
  });

  it("updates currentStep", () => {
    const result = applyProgressUpdate(completedProgress, { currentStep: 3 });
    expect(result.currentStep).toBe(3);
  });
});
