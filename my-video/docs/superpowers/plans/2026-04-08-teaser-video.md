# Petra Teaser Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 30-second Remotion marketing teaser video (`PetraTeaserVideo`) that shows pain-point overlays → Petra app screens → CTA, with no voiceover.

**Architecture:** Fixed 900-frame (30s @ 30fps) composition with 8 `Series.Sequence` scenes. Each app scene uses two shared components: `PainOverlay` (dark text overlay that fades out after 45 frames) and `BenefitTag` (green pill that slides in after the pain fades). No audio config file — scenes have fixed durations. Background music from `public/bg-music.mp3`.

**Tech Stack:** Remotion 4.x, React, TypeScript. All styling via inline styles (no Tailwind — this is a Remotion project). RTL Hebrew text throughout.

---

## Environment Note

All commands must be run from `my-video/` directory with Node in PATH:
```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
```

To verify in Remotion Studio after each task:
```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
npx remotion studio
# Open http://localhost:3000 — select PetraTeaserVideo composition
```

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/teaser/PainOverlay.tsx` | Create | Reusable pain text overlay — dark bg + ✗ text, fades out at frame 45 |
| `src/components/teaser/BenefitTag.tsx` | Create | Reusable green pill benefit badge — slides up from below |
| `src/scenes/teaser/TeaserChaosScene.tsx` | Create | Scene 1: black bg + 2 red pain lines (0–2s) |
| `src/scenes/teaser/TeaserLogoScene.tsx` | Create | Scene 2: orange bg + Petra logo bridge (2–4s) |
| `src/scenes/teaser/TeaserCRMScene.tsx` | Create | Scene 3: simplified CRM kanban + overlay (4–9s) |
| `src/scenes/teaser/TeaserCalendarScene.tsx` | Create | Scene 4: weekly calendar mock + overlay (9–14s) |
| `src/scenes/teaser/TeaserBoardingScene.tsx` | Create | Scene 5: boarding room grid + overlay (14–19s) |
| `src/scenes/teaser/TeaserOrdersScene.tsx` | Create | Scene 6: order payment modal + overlay (19–24s) |
| `src/scenes/teaser/TeaserBookingScene.tsx` | Create | Scene 7: online booking page + overlay (24–28s) |
| `src/scenes/teaser/TeaserCTAScene.tsx` | Create | Scene 8: CTA orange screen (28–30s) |
| `src/TeaserVideo.tsx` | Create | Root composition — Series of 8 scenes + bg music |
| `src/Root.tsx` | Modify | Register `PetraTeaserVideo` composition |

---

## Task 1: Shared Component — PainOverlay

**Files:**
- Create: `src/components/teaser/PainOverlay.tsx`

This component renders on top of any app scene. For the first 45 frames it shows a dark semi-transparent overlay with the pain text. Then it fades out, revealing the app screen underneath.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/components/teaser
```

- [ ] **Step 2: Write PainOverlay.tsx**

```tsx
// src/components/teaser/PainOverlay.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface PainOverlayProps {
  text: string;         // e.g. "לידים נופלים בין הכסאות"
  fadeOutStart?: number; // frame when fade-out begins (default: 35)
  fadeOutEnd?: number;   // frame when fully gone (default: 50)
}

export const PainOverlay: React.FC<PainOverlayProps> = ({
  text,
  fadeOutStart = 35,
  fadeOutEnd = 50,
}) => {
  const frame = useCurrentFrame();

  const overlayOpacity = interpolate(
    frame,
    [0, 8, fadeOutStart, fadeOutEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const textScale = interpolate(
    frame,
    [0, 12],
    [0.92, 1],
    { extrapolateRight: "clamp" }
  );

  if (overlayOpacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: "rgba(10, 14, 23, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: overlayOpacity,
        zIndex: 100,
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      <div
        style={{
          transform: `scale(${textScale})`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: "#ef4444",
            lineHeight: 1,
          }}
        >
          ✗
        </span>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.3,
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: no errors for the new file (other pre-existing errors are fine to ignore).

- [ ] **Step 4: Commit**

```bash
git add src/components/teaser/PainOverlay.tsx
git commit -m "feat(teaser): add PainOverlay shared component"
```

---

## Task 2: Shared Component — BenefitTag

**Files:**
- Create: `src/components/teaser/BenefitTag.tsx`

A green pill badge that slides up into position after the pain overlay fades. Positioned bottom-right of the scene.

- [ ] **Step 1: Write BenefitTag.tsx**

```tsx
// src/components/teaser/BenefitTag.tsx
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface BenefitTagProps {
  text: string;      // e.g. "כל ליד במקום אחד"
  appearAt?: number; // frame when slide-in begins (default: 55)
}

export const BenefitTag: React.FC<BenefitTagProps> = ({
  text,
  appearAt = 55,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - appearAt,
    fps,
    config: { damping: 180, stiffness: 200 },
  });

  const y = interpolate(progress, [0, 1], [20, 0]);
  const opacity = interpolate(frame, [appearAt, appearAt + 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left: 32,
        opacity,
        transform: `translateY(${y}px)`,
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      <div
        style={{
          background: "#dcfce7",
          border: "1.5px solid #86efac",
          borderRadius: 99,
          padding: "8px 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 16px rgba(22,163,74,0.2)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>✓</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>
          {text}
        </span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/teaser/BenefitTag.tsx
git commit -m "feat(teaser): add BenefitTag shared component"
```

---

## Task 3: TeaserChaosScene — Opening Pain Lines

**Files:**
- Create: `src/scenes/teaser/TeaserChaosScene.tsx`

Scene 1 (0–2s, 60 frames). Black background. Two red pain lines cut in one after the other. No sidebar.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/scenes/teaser
```

- [ ] **Step 2: Write TeaserChaosScene.tsx**

```tsx
// src/scenes/teaser/TeaserChaosScene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const LINES = [
  "לידים נופלים בין הכסאות",
  "תורים נשכחים ברגע האחרון",
];

export const TeaserChaosScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Line 1: frames 0–28
  const line1Opacity = interpolate(frame, [0, 6, 24, 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Line 2: frames 25–60
  const line2Opacity = interpolate(frame, [25, 32, 56, 60], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacities = [line1Opacity, line2Opacity];

  return (
    <AbsoluteFill
      style={{
        background: "#080c14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        gap: 0,
      }}
    >
      {LINES.map((line, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            opacity: opacities[i],
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#ef4444",
            }}
          >
            ✗
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "white",
              textShadow: "0 0 30px rgba(239,68,68,0.4)",
            }}
          >
            {line}
          </span>
        </div>
      ))}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/teaser/TeaserChaosScene.tsx
git commit -m "feat(teaser): add TeaserChaosScene"
```

---

## Task 4: TeaserLogoScene — Logo Bridge

**Files:**
- Create: `src/scenes/teaser/TeaserLogoScene.tsx`

Scene 2 (2–4s, 60 frames). Solid orange background. Petra logo + PETRA text + "הפתרון כאן" subtitle. Fast entrance, holds, fades out.

- [ ] **Step 1: Write TeaserLogoScene.tsx**

```tsx
// src/scenes/teaser/TeaserLogoScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

export const TeaserLogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const logoScale = spring({ frame: frame - 2, fps, config: { damping: 160 } });

  const textOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity,
      }}
    >
      {/* Logo + brand */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Img
          src={staticFile("petra-icon.png")}
          style={{ width: 80, height: 80, objectFit: "contain" }}
        />
        <div
          style={{
            opacity: textOpacity,
            fontSize: 32,
            fontWeight: 900,
            color: "white",
            letterSpacing: 4,
          }}
        >
          PETRA
        </div>
        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 18,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          הפתרון כאן
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserLogoScene.tsx
git commit -m "feat(teaser): add TeaserLogoScene"
```

---

## Task 5: TeaserCRMScene — Leads Kanban

**Files:**
- Create: `src/scenes/teaser/TeaserCRMScene.tsx`

Scene 3 (4–9s, 150 frames). Simplified 3-column kanban. PainOverlay fades out at frames 35–50. BenefitTag appears at frame 65. Uses `PetraSidebar` with `activeLabel="מערכת מכירות"`.

- [ ] **Step 1: Write TeaserCRMScene.tsx**

```tsx
// src/scenes/teaser/TeaserCRMScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const COLUMNS = [
  {
    label: "ליד חדש",
    color: "#ef4444",
    bg: "#fef2f2",
    delay: 55,
    cards: [
      { name: "ענבל כהן", service: "אילוף גורים", overdue: false },
      { name: "מיכל אברהם", service: "חרדת נטישה", overdue: true },
    ],
  },
  {
    label: "נוצר קשר",
    color: "#3b82f6",
    bg: "#eff6ff",
    delay: 70,
    cards: [
      { name: "עמית שפירא", service: "אילוף גורים", overdue: false },
      { name: "נמרוד בן-דוד", service: "שיעור הגנה", overdue: false },
    ],
  },
  {
    label: "סגור",
    color: "#22c55e",
    bg: "#f0fdf4",
    delay: 85,
    cards: [
      { name: "שירה אברמוב", service: "אילוף גורים", overdue: false },
    ],
  },
];

export const TeaserCRMScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="מערכת מכירות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לידים</div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
          }}>
            + ליד חדש
          </div>
        </div>

        {/* Kanban columns */}
        <div style={{ flex: 1, display: "flex", gap: 12, padding: "16px 24px", alignItems: "flex-start" }}>
          {COLUMNS.map((col) => {
            const colP = spring({ frame: frame - col.delay, fps, config: { damping: 200 } });
            const colY = interpolate(colP, [0, 1], [18, 0]);
            const colOpacity = interpolate(frame, [col.delay, col.delay + 12], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div key={col.label} style={{
                flex: 1, opacity: colOpacity, transform: `translateY(${colY}px)`,
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {/* Column header */}
                <div style={{
                  background: "white", borderRadius: 8, padding: "8px 12px",
                  border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1 }}>{col.label}</span>
                  <span style={{
                    background: col.bg, color: col.color, borderRadius: 99,
                    padding: "1px 7px", fontSize: 10, fontWeight: 700,
                  }}>
                    {col.cards.length}
                  </span>
                </div>

                {/* Cards */}
                {col.cards.map((card, ci) => {
                  const cardDelay = col.delay + 15 + ci * 12;
                  const cardP = spring({ frame: frame - cardDelay, fps, config: { damping: 200 } });
                  const cardY = interpolate(cardP, [0, 1], [14, 0]);
                  const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div key={card.name} style={{
                      background: "white", borderRadius: 8,
                      border: "1px solid #e8edf2",
                      borderRight: `3px solid ${col.color}`,
                      padding: "10px 12px",
                      opacity: cardOpacity,
                      transform: `translateY(${cardY}px)`,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{card.name}</div>
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        background: "#fff7ed", color: ORANGE,
                        borderRadius: 4, padding: "2px 6px",
                        display: "inline-block",
                        border: "1px solid #fed7aa",
                      }}>
                        {card.service}
                      </div>
                      {card.overdue && (
                        <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>
                          לא קיבל מענה
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pain overlay — fades out by frame 50 */}
      <PainOverlay text="לידים נופלים בין הכסאות" fadeOutStart={35} fadeOutEnd={52} />

      {/* Benefit tag — appears at frame 65 */}
      <BenefitTag text="כל ליד במקום אחד" appearAt={68} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserCRMScene.tsx
git commit -m "feat(teaser): add TeaserCRMScene"
```

---

## Task 6: TeaserCalendarScene — Appointments Calendar

**Files:**
- Create: `src/scenes/teaser/TeaserCalendarScene.tsx`

Scene 4 (9–14s, 150 frames). Weekly calendar grid. 4 columns (days), appointment cards animate in. Uses `PetraSidebar` with `activeLabel="יומן"`.

- [ ] **Step 1: Write TeaserCalendarScene.tsx**

```tsx
// src/scenes/teaser/TeaserCalendarScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const DAYS = ["ראשון 6.4", "שני 7.4", "שלישי 8.4", "רביעי 9.4"];

const APPTS = [
  { day: 0, time: "09:00", name: "ענבל כהן", service: "אילוף גורים", color: "#ea580c", delay: 62 },
  { day: 0, time: "11:00", name: "מיכל לוי", service: "טיפוח", color: "#8b5cf6", delay: 74 },
  { day: 1, time: "10:00", name: "יוסי גולן", service: "שיעור הגנה", color: "#ea580c", delay: 80 },
  { day: 2, time: "09:30", name: "שירה כהן", service: "אילוף גורים", color: "#ea580c", delay: 88 },
  { day: 2, time: "14:00", name: "עמית בן-דוד", service: "אילוף גורים", color: "#ea580c", delay: 96 },
  { day: 3, time: "11:00", name: "נויה אביב", service: "פנסיון", color: "#0891b2", delay: 104 },
];

export const TeaserCalendarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const gridOpacity = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="יומן" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>יומן תורים</div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
          }}>
            + תור חדש
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", opacity: gridOpacity }}>
          {/* Day headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1, padding: "0 16px", background: "white",
            borderBottom: "1px solid #e2e8f0",
          }}>
            {DAYS.map((day) => (
              <div key={day} style={{
                padding: "10px 12px", fontSize: 12, fontWeight: 700,
                color: "#0f172a", textAlign: "center",
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div style={{
            flex: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1, padding: "8px 16px", alignItems: "start",
          }}>
            {DAYS.map((day, dayIdx) => (
              <div key={day} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
                {APPTS.filter((a) => a.day === dayIdx).map((appt) => {
                  const p = spring({ frame: frame - appt.delay, fps, config: { damping: 200 } });
                  const y = interpolate(p, [0, 1], [14, 0]);
                  const apptOpacity = interpolate(frame, [appt.delay, appt.delay + 10], [0, 1], { extrapolateRight: "clamp" });

                  return (
                    <div key={appt.name} style={{
                      background: "white", borderRadius: 8,
                      borderRight: `3px solid ${appt.color}`,
                      border: "1px solid #e2e8f0",
                      borderRightWidth: 3,
                      borderRightColor: appt.color,
                      padding: "8px 10px",
                      opacity: apptOpacity,
                      transform: `translateY(${y}px)`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{appt.time}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{appt.name}</div>
                      <div style={{ fontSize: 10, color: appt.color, fontWeight: 600, marginTop: 2 }}>{appt.service}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PainOverlay text="תורים נשכחים ברגע האחרון" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="תזכורות WhatsApp אוטומטיות" appearAt={68} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserCalendarScene.tsx
git commit -m "feat(teaser): add TeaserCalendarScene"
```

---

## Task 7: TeaserBoardingScene — Boarding Room Grid

**Files:**
- Create: `src/scenes/teaser/TeaserBoardingScene.tsx`

Scene 5 (14–19s, 150 frames). Visual room grid (3×3 rooms). Each room shows dog name + check-in date. Uses `PetraSidebar` with `activeLabel="פנסיון"`.

- [ ] **Step 1: Write TeaserBoardingScene.tsx**

```tsx
// src/scenes/teaser/TeaserBoardingScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const ROOMS = [
  { id: "A1", dog: "קיירה", owner: "ענבל כהן", checkIn: "6.4", checkOut: "9.4", occupied: true, delay: 55 },
  { id: "A2", dog: "מקס", owner: "יוסי גולן", checkIn: "7.4", checkOut: "10.4", occupied: true, delay: 62 },
  { id: "A3", dog: "", owner: "", checkIn: "", checkOut: "", occupied: false, delay: 68 },
  { id: "B1", dog: "לונה", owner: "עמית שפירא", checkIn: "5.4", checkOut: "8.4", occupied: true, delay: 74 },
  { id: "B2", dog: "נובה", owner: "אורלי מזרחי", checkIn: "6.4", checkOut: "11.4", occupied: true, delay: 80 },
  { id: "B3", dog: "בוני", owner: "לואי מנסור", checkIn: "8.4", checkOut: "12.4", occupied: true, delay: 86 },
  { id: "C1", dog: "", owner: "", checkIn: "", checkOut: "", occupied: false, delay: 92 },
  { id: "C2", dog: "רוקי", owner: "מיכל אברהם", checkIn: "7.4", checkOut: "9.4", occupied: true, delay: 98 },
  { id: "C3", dog: "לילה", owner: "שירה אברמוב", checkIn: "8.4", checkOut: "13.4", occupied: true, delay: 104 },
];

export const TeaserBoardingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח פנסיון</div>
          <div style={{
            background: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 8, padding: "5px 12px",
            fontSize: 11, fontWeight: 700, color: "#16a34a",
          }}>
            7/9 חדרים תפוסים
          </div>
        </div>

        {/* Room grid */}
        <div style={{
          flex: 1, display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10, padding: "16px 24px",
        }}>
          {ROOMS.map((room) => {
            const p = spring({ frame: frame - room.delay, fps, config: { damping: 200 } });
            const scale = interpolate(p, [0, 1], [0.88, 1]);
            const roomOpacity = interpolate(frame, [room.delay, room.delay + 12], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div key={room.id} style={{
                background: room.occupied ? "white" : "#f8fafc",
                borderRadius: 12,
                border: `1.5px solid ${room.occupied ? "#e2e8f0" : "#e2e8f0"}`,
                borderTop: `3px solid ${room.occupied ? ORANGE : "#e2e8f0"}`,
                padding: "12px 14px",
                opacity: roomOpacity,
                transform: `scale(${scale})`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>חדר {room.id}</span>
                  {room.occupied && (
                    <span style={{
                      fontSize: 9, background: "#fff7ed", color: ORANGE,
                      borderRadius: 4, padding: "1px 5px", fontWeight: 700,
                    }}>
                      תפוס
                    </span>
                  )}
                  {!room.occupied && (
                    <span style={{
                      fontSize: 9, background: "#f0fdf4", color: "#16a34a",
                      borderRadius: 4, padding: "1px 5px", fontWeight: 700,
                    }}>
                      פנוי
                    </span>
                  )}
                </div>
                {room.occupied ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{room.dog}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{room.owner}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>
                      {room.checkIn} – {room.checkOut}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 500, marginTop: 4 }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PainOverlay text="מי בא? מי יצא? איזה חדר?" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="לוח פנסיון בזמן אמת" appearAt={68} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserBoardingScene.tsx
git commit -m "feat(teaser): add TeaserBoardingScene"
```

---

## Task 8: TeaserOrdersScene — Orders + Payment

**Files:**
- Create: `src/scenes/teaser/TeaserOrdersScene.tsx`

Scene 6 (19–24s, 150 frames). Order summary modal with line items and payment confirmation. Uses `PetraSidebar` with `activeLabel="פיננסים"`.

- [ ] **Step 1: Write TeaserOrdersScene.tsx**

```tsx
// src/scenes/teaser/TeaserOrdersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const ITEMS = [
  { label: "לינה פנסיון", sub: "3 לילות × ₪150", total: "₪450", delay: 75 },
  { label: "אילוף גורים", sub: "מנוי חודשי", total: "₪350", delay: 90 },
  { label: "טיפוח", sub: "חיתוך + אמבטיה", total: "₪120", delay: 105 },
];

export const TeaserOrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalProgress = spring({ frame: frame - 52, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.93, 1]);
  const modalOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });

  const paidOpacity = interpolate(frame, [118, 130], [0, 1], { extrapolateRight: "clamp" });
  const paidScale = spring({ frame: frame - 118, fps, config: { damping: 160, stiffness: 280 } });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,23,42,0.35)",
        opacity: modalOpacity,
      }}>
        <div style={{
          background: "white", borderRadius: 20,
          padding: "28px 32px", width: 480,
          transform: `scale(${modalScale})`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          direction: "rtl",
          position: "relative",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>
            הזמנה חדשה — ענבל כהן
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {ITEMS.map((item) => {
              const p = spring({ frame: frame - item.delay, fps, config: { damping: 200 } });
              const y = interpolate(p, [0, 1], [12, 0]);
              const itemOpacity = interpolate(frame, [item.delay, item.delay + 10], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  opacity: itemOpacity, transform: `translateY(${y}px)`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: ORANGE }}>{item.total}</div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: "1.5px solid #f1f5f9", paddingTop: 14, marginBottom: 16,
            opacity: interpolate(frame, [110, 120], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>סה"כ לתשלום</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>₪920</span>
          </div>

          {/* Paid badge */}
          <div style={{
            opacity: paidOpacity,
            transform: `scale(${paidScale})`,
            background: "#dcfce7", border: "1.5px solid #86efac",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>✓</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>שולם בהצלחה</span>
            <span style={{ fontSize: 11, color: "#16a34a", marginRight: "auto" }}>חשבונית נשלחה בWhatsApp</span>
          </div>
        </div>
      </div>

      <PainOverlay text="מי שילם? מי חייב?" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="הזמנה + חשבונית בלחיצה" appearAt={68} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserOrdersScene.tsx
git commit -m "feat(teaser): add TeaserOrdersScene"
```

---

## Task 9: TeaserBookingScene — Online Booking Page

**Files:**
- Create: `src/scenes/teaser/TeaserBookingScene.tsx`

Scene 7 (24–28s, 120 frames). Public-facing online booking page — customer view, not admin. No sidebar. Shows service selection + time slot picker.

- [ ] **Step 1: Write TeaserBookingScene.tsx**

```tsx
// src/scenes/teaser/TeaserBookingScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

const SERVICES = [
  { label: "אילוף גורים", price: "₪350/חודש", selected: false, delay: 58 },
  { label: "פנסיון", price: "₪150/לילה", selected: true, delay: 66 },
  { label: "טיפוח", price: "₪120", selected: false, delay: 74 },
];

const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30"];

export const TeaserBookingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [50, 62], [0, 1], { extrapolateRight: "clamp" });
  const slotsOpacity = interpolate(frame, [80, 92], [0, 1], { extrapolateRight: "clamp" });
  const btnOpacity = interpolate(frame, [95, 108], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      {/* Public booking page — no sidebar */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center",
      }}>
        {/* Top bar */}
        <div style={{
          width: "100%", background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 32px", height: 56,
          display: "flex", alignItems: "center",
          gap: 10, opacity: headerOpacity,
        }}>
          <Img src={staticFile("petra-icon.png")} style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>הזמנה אונליין — כלבית הכלב המאושר</span>
        </div>

        {/* Content */}
        <div style={{
          width: 520, marginTop: 24,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Service selection */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", padding: "20px 24px",
            opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>בחר שירות</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SERVICES.map((svc) => {
                const p = spring({ frame: frame - svc.delay, fps, config: { damping: 200 } });
                const y = interpolate(p, [0, 1], [10, 0]);
                const svcOpacity = interpolate(frame, [svc.delay, svc.delay + 10], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div key={svc.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10,
                    border: `2px solid ${svc.selected ? ORANGE : "#e2e8f0"}`,
                    background: svc.selected ? "#fff7ed" : "white",
                    opacity: svcOpacity, transform: `translateY(${y}px)`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${svc.selected ? ORANGE : "#cbd5e1"}`,
                        background: svc.selected ? ORANGE : "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {svc.selected && <div style={{ width: 6, height: 6, background: "white", borderRadius: "50%" }} />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{svc.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{svc.price}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", padding: "20px 24px",
            opacity: slotsOpacity,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>בחר שעה — יום שני 7.4</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SLOTS.map((slot, i) => (
                <div key={slot} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: i === 2 ? ORANGE : "#f1f5f9",
                  color: i === 2 ? "white" : "#475569",
                  border: `1px solid ${i === 2 ? ORANGE : "#e2e8f0"}`,
                }}>
                  {slot}
                </div>
              ))}
            </div>
          </div>

          {/* Book button */}
          <div style={{
            background: ORANGE, borderRadius: 12,
            padding: "14px", textAlign: "center",
            fontSize: 16, fontWeight: 800, color: "white",
            opacity: btnOpacity,
            boxShadow: "0 4px 20px rgba(234,88,12,0.4)",
          }}>
            אשר הזמנה
          </div>
        </div>
      </div>

      <PainOverlay text="הלקוחות מחכים לאישור ידני" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="הזמנות אונליין 24/7" appearAt={68} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserBookingScene.tsx
git commit -m "feat(teaser): add TeaserBookingScene"
```

---

## Task 10: TeaserCTAScene — Call to Action

**Files:**
- Create: `src/scenes/teaser/TeaserCTAScene.tsx`

Scene 8 (28–30s, 60 frames). Orange background, large bold CTA text, subtle pulse on the main line, Petra logo, website URL.

- [ ] **Step 1: Write TeaserCTAScene.tsx**

```tsx
// src/scenes/teaser/TeaserCTAScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

export const TeaserCTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({ frame: frame - 2, fps, config: { damping: 160 } });

  const mainTextOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });
  const mainTextY = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 200 } }),
    [0, 1], [24, 0]
  );

  const subOpacity = interpolate(frame, [20, 32], [0, 1], { extrapolateRight: "clamp" });

  // Pulse effect on main text
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.02, 1]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(145deg, #ea580c 0%, #c2410c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: fadeIn,
        gap: 0,
      }}
    >
      {/* Background shine */}
      <div style={{
        position: "absolute",
        top: "10%", left: "50%",
        transform: "translateX(-50%)",
        width: 600, height: 400,
        background: "radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{
        transform: `scale(${logoScale})`,
        marginBottom: 20,
      }}>
        <Img
          src={staticFile("petra-icon.png")}
          style={{ width: 64, height: 64, objectFit: "contain" }}
        />
      </div>

      {/* Main CTA */}
      <div style={{
        opacity: mainTextOpacity,
        transform: `translateY(${mainTextY}px) scale(${pulse})`,
        fontSize: 52,
        fontWeight: 900,
        color: "white",
        textAlign: "center",
        textShadow: "0 3px 20px rgba(0,0,0,0.2)",
        marginBottom: 14,
        lineHeight: 1.15,
      }}>
        נסו פטרה חינם
      </div>

      {/* Subtitle */}
      <div style={{
        opacity: subOpacity,
        fontSize: 20,
        color: "rgba(255,255,255,0.85)",
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        petra-app.com
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/teaser/TeaserCTAScene.tsx
git commit -m "feat(teaser): add TeaserCTAScene"
```

---

## Task 11: TeaserVideo.tsx — Root Composition

**Files:**
- Create: `src/TeaserVideo.tsx`

Assembles all 8 scenes into a 900-frame Series. No voiceover, no calculateMetadata needed — fixed duration. Background music at low volume.

- [ ] **Step 1: Write TeaserVideo.tsx**

```tsx
// src/TeaserVideo.tsx
import {
  AbsoluteFill,
  Audio,
  Series,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { TeaserChaosScene } from "./scenes/teaser/TeaserChaosScene";
import { TeaserLogoScene } from "./scenes/teaser/TeaserLogoScene";
import { TeaserCRMScene } from "./scenes/teaser/TeaserCRMScene";
import { TeaserCalendarScene } from "./scenes/teaser/TeaserCalendarScene";
import { TeaserBoardingScene } from "./scenes/teaser/TeaserBoardingScene";
import { TeaserOrdersScene } from "./scenes/teaser/TeaserOrdersScene";
import { TeaserBookingScene } from "./scenes/teaser/TeaserBookingScene";
import { TeaserCTAScene } from "./scenes/teaser/TeaserCTAScene";

// Frame counts (30fps):
// Scene 1 chaos:    60f  (2s)
// Scene 2 logo:     60f  (2s)
// Scene 3 CRM:     150f  (5s)
// Scene 4 calendar:150f  (5s)
// Scene 5 boarding:150f  (5s)
// Scene 6 orders:  150f  (5s)
// Scene 7 booking: 120f  (4s)
// Scene 8 CTA:      60f  (2s)
// Total:           900f (30s)

export const TeaserVideo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Background music — low volume, fades out last 1s */}
      <Audio
        src={staticFile("bg-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps, durationInFrames],
            [0, 0.12, 0.12, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />

      <Series>
        <Series.Sequence durationInFrames={60}>
          <TeaserChaosScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={60}>
          <TeaserLogoScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserCRMScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserCalendarScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserBoardingScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserOrdersScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={120} premountFor={fps}>
          <TeaserBookingScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={60}>
          <TeaserCTAScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/TeaserVideo.tsx
git commit -m "feat(teaser): add TeaserVideo root composition"
```

---

## Task 12: Register in Root.tsx

**Files:**
- Modify: `src/Root.tsx`

Add the `PetraTeaserVideo` composition. No defaultProps needed — no dynamic durations.

- [ ] **Step 1: Add import to Root.tsx**

At the top of `src/Root.tsx`, after the existing imports, add:

```tsx
import { TeaserVideo } from "./TeaserVideo";
```

- [ ] **Step 2: Add composition inside `RemotionRoot`**

Inside the `<>` fragment in `RemotionRoot`, after the `PetraOrdersTutorial` composition, add:

```tsx
<Composition
  id="PetraTeaserVideo"
  component={TeaserVideo}
  durationInFrames={900}
  fps={30}
  width={1280}
  height={720}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Launch Remotion Studio and verify**

```bash
export PATH="/Users/or-rabinovich/local/node/bin:$PATH"
npx remotion studio
```

Open `http://localhost:3000`. You should see `PetraTeaserVideo` in the composition list. Click it and scrub through all 900 frames to verify:
- Frames 0–60: black bg, 2 red pain lines
- Frames 60–120: orange bg, Petra logo
- Frames 120–270: CRM kanban, pain overlay fades out, green badge appears
- Frames 270–420: calendar, same pattern
- Frames 420–570: boarding rooms grid
- Frames 570–720: orders modal + payment confirmed badge
- Frames 720–840: online booking page
- Frames 840–900: orange CTA screen

- [ ] **Step 5: Commit**

```bash
git add src/Root.tsx
git commit -m "feat(teaser): register PetraTeaserVideo composition in Root"
```
