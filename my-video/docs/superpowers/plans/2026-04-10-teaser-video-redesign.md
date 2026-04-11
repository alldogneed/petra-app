# Petra Teaser Video Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 31-second `PetraTeaserVideowebsite` Remotion composition with a 90-second version featuring 4 focused pain-point scenes, each with a 4-second readable pain-text phase followed by a slow UI demo.

**Architecture:** 8 scenes in `<Series>` inside `TeaserVideo.tsx`. Each content scene (450 frames) opens with 120 frames of pure dark-background pain text, then crossfades into the UI demo. A shared `TeaserPainPhase` component handles the pain animation. UI animations inside each scene use `uiFrame = frame - 120` so they start cleanly after the pain phase.

**Tech Stack:** Remotion 4.x, React 19, TypeScript 5.x

---

## File Map

| Action | File |
|--------|------|
| Create | `src/components/teaser/TeaserPainPhase.tsx` |
| Create | `src/scenes/teaser/TeaserHookScene.tsx` |
| Create | `src/scenes/teaser/TeaserLogoSceneV2.tsx` |
| Create | `src/scenes/teaser/TeaserLeadsSceneV2.tsx` |
| Create | `src/scenes/teaser/TeaserBoardingSceneV2.tsx` |
| Create | `src/scenes/teaser/TeaserBookingSceneV2.tsx` |
| Create | `src/scenes/teaser/TeaserRemindersScene.tsx` |
| Create | `src/scenes/teaser/TeaserUSPScene.tsx` |
| Create | `src/scenes/teaser/TeaserCTASceneV2.tsx` |
| Modify | `src/TeaserVideo.tsx` |
| Modify | `src/Root.tsx` |

**Keep unchanged:** All existing teaser scene files (`TeaserChaosScene`, `TeaserCRMScene`, etc.) — old compositions remain untouched.

**Frame map:**
```
Scene 1 TeaserHookScene:        240 frames  (8s)
Scene 2 TeaserLogoSceneV2:      150 frames  (5s)
Scene 3 TeaserLeadsSceneV2:     450 frames (15s)
Scene 4 TeaserBoardingSceneV2:  450 frames (15s)
Scene 5 TeaserBookingSceneV2:   450 frames (15s)
Scene 6 TeaserRemindersScene:   450 frames (15s)
Scene 7 TeaserUSPScene:         270 frames  (9s)
Scene 8 TeaserCTASceneV2:       240 frames  (8s)
Total:                         2700 frames (90s)
```

**Verify command (run after each task):**
```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

**Dev server (for visual verification at end):**
```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm run dev
```
Then open `http://localhost:3000` → select `PetraTeaserVideowebsite`.

---

### Task 1: TeaserPainPhase shared component

**Files:**
- Create: `src/components/teaser/TeaserPainPhase.tsx`

Full-screen dark panel (frames 0–120). Red accent bar, main text slides in from bottom, sub text fades in, both fade out at frames 105–120.

- [ ] **Step 1: Create the file**

```tsx
// src/components/teaser/TeaserPainPhase.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface TeaserPainPhaseProps {
  mainText: string;
  subText: string;
  subTextColor?: string;
}

export const TeaserPainPhase: React.FC<TeaserPainPhaseProps> = ({
  mainText,
  subText,
  subTextColor = "#94a3b8",
}) => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 15, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mainOpacity = interpolate(frame, [10, 30, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mainY = interpolate(frame, [10, 35], [18, 0], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [35, 55, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (bgOpacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        opacity: bgOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        zIndex: 100,
      }}
    >
      <div style={{ width: 52, height: 3, background: "#ef4444", borderRadius: 2, marginBottom: 20 }} />
      <div
        style={{
          opacity: mainOpacity,
          transform: `translateY(${mainY}px)`,
          fontSize: 44,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 760,
          marginBottom: 16,
        }}
      >
        {mainText}
      </div>
      <div
        style={{
          opacity: subOpacity,
          fontSize: 22,
          fontWeight: 600,
          color: subTextColor,
          textAlign: "center",
          maxWidth: 640,
        }}
      >
        {subText}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

Expected: No errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/components/teaser/TeaserPainPhase.tsx && git commit -m "feat(teaser-v2): add TeaserPainPhase shared component"
```

---

### Task 2: TeaserHookScene.tsx (240 frames = 8s)

**Files:**
- Create: `src/scenes/teaser/TeaserHookScene.tsx`

Two staggered lines on dark background. "לנהל עסק עם בע״ח" slides in first, then "זה כאוס" in red with a slow pulse. Scene fades out at frames 210–240.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserHookScene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

export const TeaserHookScene: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(
    frame,
    [0, 20, 210, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const line1Opacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });
  const line1X = interpolate(frame, [15, 42], [30, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const line2X = interpolate(frame, [45, 72], [30, 0], { extrapolateRight: "clamp" });

  const pulse = 1 + interpolate(
    frame,
    [90, 150, 210],
    [0, 0.03, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          width: 52, height: 3, background: "#ef4444",
          borderRadius: 2, marginBottom: 22, opacity: line1Opacity,
        }}
      />
      <div
        style={{
          opacity: line1Opacity,
          transform: `translateX(${line1X}px)`,
          fontSize: 48,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        לנהל עסק עם בע״ח
      </div>
      <div
        style={{
          opacity: line2Opacity,
          transform: `translateX(${line2X}px) scale(${pulse})`,
          fontSize: 68,
          fontWeight: 900,
          color: "#ef4444",
          textAlign: "center",
          textShadow: "0 0 40px rgba(239,68,68,0.4)",
        }}
      >
        זה כאוס
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserHookScene.tsx && git commit -m "feat(teaser-v2): add TeaserHookScene (240 frames)"
```

---

### Task 3: TeaserLogoSceneV2.tsx (150 frames = 5s)

**Files:**
- Create: `src/scenes/teaser/TeaserLogoSceneV2.tsx`

Dark background (not orange gradient). Logo in a dark circle with orange glow ring. "PETRA" text. "יש דרך אחרת" subtitle in muted gray.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserLogoSceneV2.tsx
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

export const TeaserLogoSceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({ frame: frame - 8, fps, config: { damping: 160 } });
  const textOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [32, 48], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "rgba(234,88,12,0.15)",
            border: "2px solid rgba(234,88,12,0.4)",
            boxShadow: "0 0 40px rgba(234,88,12,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Img
            src={staticFile("petra-icon.png")}
            style={{ width: 62, height: 62, objectFit: "contain" }}
          />
        </div>
        <div style={{ opacity: textOpacity, fontSize: 32, fontWeight: 900, color: "white", letterSpacing: 4 }}>
          PETRA
        </div>
        <div style={{ opacity: subtitleOpacity, fontSize: 20, fontWeight: 600, color: "#94a3b8" }}>
          יש דרך אחרת
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserLogoSceneV2.tsx && git commit -m "feat(teaser-v2): add TeaserLogoSceneV2 (dark bg, 150 frames)"
```

---

### Task 4: TeaserLeadsSceneV2.tsx (450 frames = 15s)

**Files:**
- Create: `src/scenes/teaser/TeaserLeadsSceneV2.tsx`

Pain phase 0–120, then leads kanban UI. `uiFrame = Math.max(0, frame - 120)` drives all UI animations. Column/card delays are all relative to `uiFrame`.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserLeadsSceneV2.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { TeaserPainPhase } from "../../components/teaser/TeaserPainPhase";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";
import { HighlightBox } from "../HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;
const PAIN_FRAMES = 120;

const COLUMNS = [
  {
    label: "ליד חדש", color: "#ef4444", bg: "#fef2f2", delay: 12,
    cards: [
      { name: "ענבל כהן", service: "אילוף גורים", overdue: false },
      { name: "מיכל אברהם", service: "חרדת נטישה", overdue: true },
    ],
  },
  {
    label: "נוצר קשר", color: "#3b82f6", bg: "#eff6ff", delay: 26,
    cards: [
      { name: "עמית שפירא", service: "אילוף גורים", overdue: false },
      { name: "נמרוד בן-דוד", service: "שיעור הגנה", overdue: false },
    ],
  },
  {
    label: "סגור", color: "#22c55e", bg: "#f0fdf4", delay: 40,
    cards: [
      { name: "שירה אברמוב", service: "אילוף גורים", overdue: false },
    ],
  },
];

export const TeaserLeadsSceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiFrame = Math.max(0, frame - PAIN_FRAMES);
  const painVisible = frame <= 120;

  const uiOpacity = interpolate(frame, [112, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerOpacity = interpolate(uiFrame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(uiFrame, [5, 22], [0, 3.5], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: uiFrame - 8, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.14]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
          <PetraSidebar width={SIDEBAR_W} activeLabel="מערכת מכירות" />
        </div>

        <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "84% 42%", width: "100%", height: "100%" }}>

            <div style={{
              background: "white", borderBottom: "1px solid #e2e8f0",
              padding: "0 24px", height: 52,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: headerOpacity, flexShrink: 0,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לידים</div>
              <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
                + ליד חדש
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", gap: 12, padding: "16px 24px", alignItems: "flex-start" }}>
              {COLUMNS.map((col) => {
                const colP = spring({ frame: uiFrame - col.delay, fps, config: { damping: 200 } });
                const colY = interpolate(colP, [0, 1], [18, 0]);
                const colOpacity = interpolate(uiFrame, [col.delay, col.delay + 12], [0, 1], { extrapolateRight: "clamp" });

                return (
                  <div key={col.label} style={{ flex: 1, opacity: colOpacity, transform: `translateY(${colY}px)`, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      background: "white", borderRadius: 8, padding: "8px 12px",
                      border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 7,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1 }}>{col.label}</span>
                      <span style={{ background: col.bg, color: col.color, borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                        {col.cards.length}
                      </span>
                    </div>

                    {col.cards.map((card, ci) => {
                      const cardDelay = col.delay + 15 + ci * 12;
                      const cardP = spring({ frame: uiFrame - cardDelay, fps, config: { damping: 200 } });
                      const cardY = interpolate(cardP, [0, 1], [14, 0]);
                      const cardOpacity = interpolate(uiFrame, [cardDelay, cardDelay + 10], [0, 1], { extrapolateRight: "clamp" });

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
                            display: "inline-block", border: "1px solid #fed7aa",
                          }}>
                            {card.service}
                          </div>
                          {card.overdue && (
                            <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>לא קיבל מענה</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cursor: appears at absolute frame 260, clicks at 290 */}
        <CursorAnimation
          startX={640} startY={460}
          endX={940} endY={175}
          appearAt={260}
          clickAt={290}
        />

        {/* BenefitTag appears at absolute frame 280 */}
        <BenefitTag text="כל ליד מתועד ועוקב אוטומטית" appearAt={280} />
      </div>

      {/* HighlightBox: first card in ליד חדש column — adjust x/y after preview if needed */}
      <HighlightBox x={660} y={130} width={250} height={82} startFrame={265} endFrame={390} borderRadius={8} />

      {painVisible && (
        <TeaserPainPhase
          mainText="לידים שנעלמים בין הצ׳אטים"
          subText="כמה פניות השבוע לא קיבלו מענה?"
        />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserLeadsSceneV2.tsx && git commit -m "feat(teaser-v2): add TeaserLeadsSceneV2 (450 frames, pain+kanban)"
```

---

### Task 5: TeaserBoardingSceneV2.tsx (450 frames = 15s)

**Files:**
- Create: `src/scenes/teaser/TeaserBoardingSceneV2.tsx`

Pain phase then boarding room map. All room/stay delays are relative to `uiFrame`.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserBoardingSceneV2.tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { TeaserPainPhase } from "../../components/teaser/TeaserPainPhase";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";
import { HighlightBox } from "../HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const PAIN_FRAMES = 120;

const ROOMS = [
  {
    id: "1", name: "חדר 1 — VIP", type: "סוויט", price: 220,
    status: "occupied", delay: 12,
    stays: [
      { pet: "קיירה", owner: "ענבל כהן", type: "checkedin", date: "יציאה: 9.4" },
      { pet: "מקס", owner: "יוסי גולן", type: "checkedin", date: "יציאה: 10.4" },
    ],
  },
  {
    id: "2", name: "חדר 2", type: "רגיל", price: 150,
    status: "mixed", delay: 26,
    stays: [
      { pet: "לונה", owner: "עמית שפירא", type: "checkedin", date: "יציאה: 8.4" },
      { pet: "נובה", owner: "אורלי מזרחי", type: "reserved", date: "כניסה: 11.4" },
    ],
  },
  {
    id: "3", name: "חדר 3", type: "רגיל", price: 150,
    status: "available", delay: 40,
    stays: [],
  },
];

const STAY_STYLE = {
  checkedin: { bg: "#FFF7ED", border: "#FDBA74", dotColor: "#f97316", dateColor: "#ea580c" },
  reserved:  { bg: "#F5F3FF", border: "#C4B5FD", dotColor: "#a855f7", dateColor: "#7c3aed" },
};

const ROOM_STATUS = {
  occupied:  { barColor: "#f97316", badgeBg: "#fff7ed", badgeColor: "#ea580c", badgeText: "תפוס" },
  mixed:     { barColor: "#f97316", badgeBg: "#fff7ed", badgeColor: "#ea580c", badgeText: "תפוס" },
  available: { barColor: "#22c55e", badgeBg: "#f0fdf4", badgeColor: "#16a34a", badgeText: "פנוי" },
};

export const TeaserBoardingSceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiFrame = Math.max(0, frame - PAIN_FRAMES);
  const painVisible = frame <= 120;

  const uiOpacity = interpolate(frame, [112, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerOpacity = interpolate(uiFrame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(uiFrame, [5, 22], [0, 3.5], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: uiFrame - 8, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.18]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
          <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
        </div>

        <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "82% 52%", width: "100%", height: "100%" }}>

            <div style={{
              background: "white", borderBottom: "1px solid #e2e8f0",
              padding: "0 24px", height: 52,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: headerOpacity, flexShrink: 0,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>פנסיון</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>לוח חדרים</span>
                <div style={{
                  background: "#f0fdf4", border: "1px solid #86efac",
                  borderRadius: 8, padding: "4px 10px",
                  fontSize: 11, fontWeight: 700, color: "#16a34a",
                }}>
                  2/3 חדרים תפוסים
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, padding: "18px 24px" }}>
              {ROOMS.map((room) => {
                const cardP = spring({ frame: uiFrame - room.delay, fps, config: { damping: 200 } });
                const cardY = interpolate(cardP, [0, 1], [16, 0]);
                const cardOpacity = interpolate(uiFrame, [room.delay, room.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                const st = ROOM_STATUS[room.status as keyof typeof ROOM_STATUS];

                return (
                  <div key={room.id} style={{
                    background: "white", borderRadius: 12,
                    border: "1px solid #e2e8f0", overflow: "hidden",
                    opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ height: 5, background: st.barColor }} />
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 2, border: `2px solid ${st.barColor}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 3, height: 3, borderRadius: "50%", background: st.barColor }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{room.name}</span>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: st.badgeBg, color: st.badgeColor,
                          borderRadius: 99, padding: "2px 7px",
                          border: `1px solid ${st.barColor}22`,
                        }}>
                          {st.badgeText}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 9, color: "#94a3b8" }}>
                        <span>{room.stays.length}/2</span>
                        <span style={{ background: "#f1f5f9", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>{room.type}</span>
                        <span style={{ marginRight: "auto", color: "#ea580c", fontWeight: 700 }}>₪{room.price}/לילה</span>
                      </div>

                      {room.stays.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {room.stays.map((stay, si) => {
                            const sStyle = STAY_STYLE[stay.type as keyof typeof STAY_STYLE];
                            const stayDelay = room.delay + 14 + si * 8;
                            const stayOpacity = interpolate(uiFrame, [stayDelay, stayDelay + 10], [0, 1], { extrapolateRight: "clamp" });
                            const stayP = spring({ frame: uiFrame - stayDelay, fps, config: { damping: 200 } });
                            const stayY = interpolate(stayP, [0, 1], [8, 0]);

                            return (
                              <div key={si} style={{
                                background: sStyle.bg,
                                border: `1px solid ${sStyle.border}`,
                                borderRadius: 8, padding: "7px 8px",
                                opacity: stayOpacity,
                                transform: `translateY(${stayY}px)`,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: sStyle.dotColor, flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stay.pet}</div>
                                    <div style={{ fontSize: 9, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stay.owner}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 9, fontWeight: 600, color: sStyle.dateColor }}>{stay.date}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {room.stays.length === 0 && (
                        <div style={{
                          textAlign: "center", padding: "14px 0",
                          opacity: interpolate(uiFrame, [room.delay + 12, room.delay + 24], [0, 1], { extrapolateRight: "clamp" }),
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", background: "#f0fdf4",
                            margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
                          </div>
                          <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>פנוי לאורחים</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cursor: appears at absolute frame 260, clicks at 290 */}
        <CursorAnimation
          startX={640} startY={480}
          endX={870} endY={270}
          appearAt={260}
          clickAt={290}
        />

        <BenefitTag text="מפת חדרים בזמן אמת" appearAt={285} />
      </div>

      {/* HighlightBox on Room 1 (rightmost in RTL) — adjust after preview if needed */}
      <HighlightBox x={700} y={88} width={320} height={230} startFrame={268} endFrame={400} borderRadius={12} />

      {painVisible && (
        <TeaserPainPhase
          mainText="איזה כלב באיזה חדר?"
          subText="אל תסמוך על הזיכרון"
        />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserBoardingSceneV2.tsx && git commit -m "feat(teaser-v2): add TeaserBoardingSceneV2 (450 frames, pain+room-map)"
```

---

### Task 6: TeaserBookingSceneV2.tsx (450 frames = 15s)

**Files:**
- Create: `src/scenes/teaser/TeaserBookingSceneV2.tsx`

Pain phase then 2-phase booking flow (service → time slot → confirm → checkmark). Sub-text of pain is red. All `uiFrame` constants below are relative to the UI phase start (frame 120).

```
CLICK_SERVICE_UFRAME = 100   → absolute frame 220
PHASE2_START_UFRAME  = 108   → absolute frame 228
CLICK_SLOT_UFRAME    = 160   → absolute frame 280
CHECK_UFRAME         = 168   → absolute frame 288
Cursor 1 appears at absolute frame 150, clicks at 220
Cursor 2 appears at absolute frame 234, clicks at 280
BenefitTag at absolute frame 298
```

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserBookingSceneV2.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TeaserPainPhase } from "../../components/teaser/TeaserPainPhase";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";
import { HighlightBox } from "../HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const BRAND = "#f97316";
const PAIN_FRAMES = 120;

const CLICK_SERVICE_UFRAME = 100;
const PHASE2_START_UFRAME = 108;
const CLICK_SLOT_UFRAME = 160;
const CHECK_UFRAME = 168;

const SERVICES = [
  { label: "טיפוח מלא", duration: "90 דקות", price: "₪180", color: "#ea580c", colorBg: "rgba(234,88,12,0.10)", delay: 16 },
  { label: "אמבטיה ותספורת", duration: "60 דקות", price: "₪140", color: "#3b82f6", colorBg: "rgba(59,130,246,0.10)", delay: 24 },
  { label: "קיצוץ ציפורניים", duration: "20 דקות", price: "₪50", color: "#8b5cf6", colorBg: "rgba(139,92,246,0.10)", delay: 32 },
];

const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
const SELECTED_SLOT = 3;

export const TeaserBookingSceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiFrame = Math.max(0, frame - PAIN_FRAMES);
  const painVisible = frame <= 120;

  const uiOpacity = interpolate(frame, [112, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerOpacity = interpolate(uiFrame, [4, 18], [0, 1], { extrapolateRight: "clamp" });

  const phase1Opacity = interpolate(uiFrame, [CLICK_SERVICE_UFRAME, CLICK_SERVICE_UFRAME + 10], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const phase2Opacity = interpolate(uiFrame, [PHASE2_START_UFRAME, PHASE2_START_UFRAME + 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const serviceSelectP = interpolate(uiFrame, [CLICK_SERVICE_UFRAME - 4, CLICK_SERVICE_UFRAME + 6], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const isServiceSelected = serviceSelectP > 0.5;

  const progressBarWidth = interpolate(
    uiFrame,
    [PHASE2_START_UFRAME, PHASE2_START_UFRAME + 12],
    [33, 66],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const showPhase2Label = phase2Opacity > 0.5;

  const zoomP = spring({ frame: uiFrame - 6, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.10]);

  const btnScale = interpolate(
    uiFrame,
    [CLICK_SLOT_UFRAME, CLICK_SLOT_UFRAME + 4, CLICK_SLOT_UFRAME + 10],
    [1, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const checkOpacity = interpolate(uiFrame, [CHECK_UFRAME, CHECK_UFRAME + 10], [0, 1], { extrapolateRight: "clamp" });
  const checkScale = spring({ frame: uiFrame - CHECK_UFRAME, fps, config: { damping: 160, stiffness: 280 } });
  const checkCircleScale = spring({ frame: uiFrame - CHECK_UFRAME - 4, fps, config: { damping: 200, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 44%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>

            <div style={{
              width: "100%", background: "white",
              borderBottom: "1px solid #e2e8f0",
              padding: "0 32px", height: 52,
              display: "flex", alignItems: "center", gap: 10,
              opacity: headerOpacity, flexShrink: 0,
            }}>
              <Img src={staticFile("petra-icon.png")} style={{ width: 26, height: 26 }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>מרכז טיפוח הכלב המאושר</span>
            </div>

            <div style={{
              width: "100%", background: "white",
              borderBottom: "1px solid #f1f5f9",
              padding: "8px 32px 0", opacity: headerOpacity, flexShrink: 0,
            }}>
              <div style={{ height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                <div style={{ height: "100%", width: `${progressBarWidth}%`, background: BRAND, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, paddingBottom: 7 }}>
                {showPhase2Label ? "שלב 2 מתוך 3: בחר מועד" : "שלב 1 מתוך 3: בחר שירות"}
              </div>
            </div>

            <div style={{ width: 520, marginTop: 14, position: "relative", height: 400 }}>

              {/* Phase 1: service selection */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: phase1Opacity }}>
                <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 22px" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>בחר שירות</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SERVICES.map((svc, i) => {
                      const p = spring({ frame: uiFrame - svc.delay, fps, config: { damping: 200 } });
                      const y = interpolate(p, [0, 1], [10, 0]);
                      const svcOpacity = interpolate(uiFrame, [svc.delay, svc.delay + 10], [0, 1], { extrapolateRight: "clamp" });
                      const selected = i === 0 && isServiceSelected;

                      return (
                        <div key={svc.label} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "11px 14px", borderRadius: 12,
                          border: `2px solid ${selected ? "#FDBA74" : "#e2e8f0"}`,
                          background: selected ? "#FFF7ED" : "white",
                          boxShadow: selected ? "0 0 0 1px #fed7aa" : "none",
                          opacity: svcOpacity, transform: `translateY(${y}px)`,
                        }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            background: selected ? "rgba(234,88,12,0.12)" : svc.colorBg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", background: selected ? ORANGE : svc.color }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{svc.label}</div>
                            <div style={{ marginTop: 3 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 4, padding: "1px 6px" }}>{svc.duration}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: selected ? ORANGE : "#0f172a" }}>{svc.price}</span>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M5 3.5L9 7L5 10.5" stroke={selected ? ORANGE : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Phase 2: time slot + confirm */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: phase2Opacity }}>
                <div style={{
                  background: "#FFF7ED", borderRadius: 12, border: "1px solid #FED7AA",
                  padding: "9px 16px", marginBottom: 10,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  opacity: interpolate(uiFrame, [PHASE2_START_UFRAME, PHASE2_START_UFRAME + 12], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>טיפוח מלא</span>
                    <span style={{ fontSize: 10, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 4, padding: "1px 6px" }}>90 דקות</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>₪180</span>
                </div>

                <div style={{
                  background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 22px",
                  opacity: interpolate(uiFrame, [PHASE2_START_UFRAME + 2, PHASE2_START_UFRAME + 14], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>בחר שעה</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>יום שני, 7 באפריל</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {SLOTS.map((slot, i) => {
                      const slotDelay = PHASE2_START_UFRAME + 10 + i * 6;
                      const slotOpacity = interpolate(uiFrame, [slotDelay, slotDelay + 8], [0, 1], { extrapolateRight: "clamp" });
                      const slotP = spring({ frame: uiFrame - slotDelay, fps, config: { damping: 200 } });
                      const slotY = interpolate(slotP, [0, 1], [8, 0]);
                      const isSelected = i === SELECTED_SLOT && uiFrame >= CLICK_SLOT_UFRAME - 2;

                      return (
                        <div key={slot} style={{
                          padding: "11px 8px", borderRadius: 10, textAlign: "center",
                          fontSize: 14, fontWeight: 700,
                          border: `2px solid ${isSelected ? BRAND : "#e2e8f0"}`,
                          background: isSelected ? BRAND : "white",
                          color: isSelected ? "white" : "#475569",
                          boxShadow: isSelected ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
                          opacity: slotOpacity, transform: `translateY(${slotY}px)`,
                        }}>
                          {slot}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{
                  marginTop: 12, background: ORANGE, borderRadius: 12,
                  padding: "13px", textAlign: "center",
                  fontSize: 15, fontWeight: 800, color: "white",
                  transform: `scale(${btnScale})`,
                  boxShadow: "0 4px 20px rgba(234,88,12,0.4)",
                  opacity: interpolate(uiFrame, [PHASE2_START_UFRAME + 22, PHASE2_START_UFRAME + 34], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  אשר הזמנה
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Checkmark overlay */}
        {checkOpacity > 0.02 && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `rgba(8,12,20,${checkOpacity * 0.55})`,
            zIndex: 85,
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: checkOpacity, transform: `scale(${checkScale})` }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "#dcfce7", border: "3px solid #86efac",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: `scale(${checkCircleScale})`,
                boxShadow: "0 0 32px rgba(34,197,94,0.4)",
              }}>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <path d="M10 22 L18 32 L34 14" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>ההזמנה אושרה!</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>אישור נשלח ב-WhatsApp ✓</div>
            </div>
          </div>
        )}

        {/* Cursor 1: moves to first service, clicks */}
        <div style={{ opacity: phase1Opacity }}>
          <CursorAnimation
            startX={780} startY={200}
            endX={620} endY={332}
            appearAt={150}
            clickAt={PAIN_FRAMES + CLICK_SERVICE_UFRAME}
          />
        </div>

        {/* Cursor 2: moves to 10:30 slot, clicks */}
        <div style={{ opacity: phase2Opacity }}>
          <CursorAnimation
            startX={560} startY={300}
            endX={486} endY={508}
            appearAt={PAIN_FRAMES + PHASE2_START_UFRAME + 6}
            clickAt={PAIN_FRAMES + CLICK_SLOT_UFRAME}
          />
        </div>

        <BenefitTag text="הלקוח מזמין לבד — 24/7" appearAt={298} />
      </div>

      {/* HighlightBox: confirm button area — adjust after preview */}
      <HighlightBox x={370} y={390} width={540} height={65} startFrame={450} endFrame={555} borderRadius={12} />

      {painVisible && (
        <TeaserPainPhase
          mainText="הלקוח התקשר. היית עסוק."
          subText="הוא הזמין אצל המתחרה"
          subTextColor="#ef4444"
        />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserBookingSceneV2.tsx && git commit -m "feat(teaser-v2): add TeaserBookingSceneV2 (450 frames, pain+booking-flow)"
```

---

### Task 7: TeaserRemindersScene.tsx (450 frames = 15s)

**Files:**
- Create: `src/scenes/teaser/TeaserRemindersScene.tsx`

Brand new scene. Pain phase then Settings → הודעות tab: WhatsApp toggle ON + reminder timing buttons. Cursor clicks "48 שעות" button at absolute frame 210. Layout mirrors `SettingsMessagesScene` (right col = WA cards, left col = templates).

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserRemindersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { TeaserPainPhase } from "../../components/teaser/TeaserPainPhase";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";
import { HighlightBox } from "../HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;
const PAIN_FRAMES = 120;
const CLICK_HOURS_FRAME = 210; // absolute frame when cursor clicks "48 שעות"

const TABS = ["פרטי העסק", "הזמנות", "פנסיון", "תשלומים", "צוות", "הודעות", "נתונים"];

export const TeaserRemindersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiFrame = Math.max(0, frame - PAIN_FRAMES);
  const painVisible = frame <= 120;

  const uiOpacity = interpolate(frame, [112, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerOpacity = interpolate(uiFrame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(uiFrame, [5, 22], [0, 3.5], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: uiFrame - 8, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.08]);

  const waCardOpacity = interpolate(uiFrame, [12, 28], [0, 1], { extrapolateRight: "clamp" });
  const timingCardOpacity = interpolate(uiFrame, [22, 38], [0, 1], { extrapolateRight: "clamp" });
  const templatesCardOpacity = interpolate(uiFrame, [18, 34], [0, 1], { extrapolateRight: "clamp" });

  // "48 שעות" becomes selected after cursor clicks
  const is48Selected = frame >= CLICK_HOURS_FRAME + 4;

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
          <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />
        </div>

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 28px", height: 58,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700 }}>
              שמור שינויים
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            display: "flex", padding: "0 28px", opacity: headerOpacity,
          }}>
            {TABS.map((tab) => (
              <div key={tab} style={{
                padding: "12px 14px 10px",
                fontSize: 12,
                fontWeight: tab === "הודעות" ? 700 : 500,
                color: tab === "הודעות" ? ORANGE : "#64748b",
                borderBottom: tab === "הודעות" ? `2px solid ${ORANGE}` : "2px solid transparent",
                whiteSpace: "nowrap",
              }}>
                {tab}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>
            <div style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: "700px 200px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}>

              {/* Right col: WhatsApp + timing */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* WhatsApp toggle */}
                <div style={{
                  background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                  padding: "18px 22px", opacity: waCardOpacity,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>פעיל</span>
                      <div style={{ width: 32, height: 18, borderRadius: 99, background: "#22c55e", position: "relative" }}>
                        <div style={{ position: "absolute", top: 2, left: 16, width: 14, height: 14, borderRadius: "50%", background: "white" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>תזכורות ב-WhatsApp</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                    שליחת תזכורות אוטומטיות ללקוחות לפני תורים ואירועים.
                  </div>
                </div>

                {/* Reminder timing */}
                <div style={{
                  background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                  padding: "18px 22px", opacity: timingCardOpacity,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>זמן שליחת תזכורת</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["24 שעות", "48 שעות", "72 שעות"].map((h, i) => {
                      const isSelected = i === 1 && is48Selected;
                      return (
                        <div key={h} style={{
                          padding: "7px 12px", borderRadius: 7,
                          background: isSelected ? ORANGE : "white",
                          border: `1px solid ${isSelected ? ORANGE : "#e2e8f0"}`,
                          fontSize: 11, fontWeight: 700,
                          color: isSelected ? "white" : "#64748b",
                        }}>
                          {h}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Left col: message templates */}
              <div style={{
                background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                padding: "20px 22px", opacity: templatesCardOpacity,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>תבניות הודעות</div>
                {[
                  { name: "תזכורת לתור", trigger: "48 שעות לפני תור", active: true },
                  { name: "אישור הזמנה", trigger: "בעת יצירת הזמנה", active: true },
                  { name: "צ׳ק-אאוט מפנסיון", trigger: "ביום הצ׳ק-אאוט", active: true },
                  { name: "הודעת ברוכים הבאים", trigger: "לאחר הוספת לקוח", active: false },
                ].map((t, i) => {
                  const tOpacity = interpolate(uiFrame, [28 + i * 8, 42 + i * 8], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div key={t.name} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 8,
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                      marginBottom: 8, opacity: tOpacity,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 16, borderRadius: 99,
                          background: t.active ? "#22c55e" : "#e2e8f0",
                          position: "relative", flexShrink: 0,
                        }}>
                          <div style={{
                            position: "absolute", top: 2,
                            left: t.active ? 14 : 2,
                            width: 12, height: 12, borderRadius: "50%", background: "white",
                          }} />
                        </div>
                      </div>
                      <div style={{ flex: 1, marginRight: 12, textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.trigger}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Cursor: moves to "48 שעות" button and clicks */}
        <CursorAnimation
          startX={615} startY={250}
          endX={700} endY={255}
          appearAt={188}
          clickAt={CLICK_HOURS_FRAME}
        />

        <BenefitTag text="תזכורת אוטומטית לכל תור" appearAt={275} />
      </div>

      {/* HighlightBox: WA + timing cards (right col) — adjust after preview */}
      <HighlightBox x={545} y={122} width={497} height={178} startFrame={248} endFrame={400} borderRadius={12} />

      {painVisible && (
        <TeaserPainPhase
          mainText="ביטול ברגע האחרון?"
          subText="כי שכחו. ואתה לא הזכרת."
        />
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserRemindersScene.tsx && git commit -m "feat(teaser-v2): add TeaserRemindersScene (450 frames, pain+WhatsApp-settings)"
```

---

### Task 8: TeaserUSPScene.tsx (270 frames = 9s)

**Files:**
- Create: `src/scenes/teaser/TeaserUSPScene.tsx`

Three lines stagger in over 10 seconds. "המערכת היחידה" (white), "שנבנתה מהשטח" (orange), "עם אנשים שמכירים בע״ח" (muted gray). No cursor, no UI.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserUSPScene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

export const TeaserUSPScene: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const line1Opacity = interpolate(frame, [22, 45], [0, 1], { extrapolateRight: "clamp" });
  const line1Y = interpolate(frame, [22, 48], [16, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [60, 82], [0, 1], { extrapolateRight: "clamp" });
  const line2Y = interpolate(frame, [60, 85], [16, 0], { extrapolateRight: "clamp" });

  const line3Opacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });
  const line3Y = interpolate(frame, [100, 122], [12, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          width: 52, height: 3, background: "#ea580c",
          borderRadius: 2, marginBottom: 28, opacity: line1Opacity,
        }}
      />
      <div
        style={{
          opacity: line1Opacity,
          transform: `translateY(${line1Y}px)`,
          fontSize: 50,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        המערכת היחידה
      </div>
      <div
        style={{
          opacity: line2Opacity,
          transform: `translateY(${line2Y}px)`,
          fontSize: 50,
          fontWeight: 900,
          color: "#ea580c",
          textAlign: "center",
          textShadow: "0 0 40px rgba(234,88,12,0.3)",
          marginBottom: 20,
        }}
      >
        שנבנתה מהשטח
      </div>
      <div
        style={{
          opacity: line3Opacity,
          transform: `translateY(${line3Y}px)`,
          fontSize: 24,
          fontWeight: 600,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        עם אנשים שמכירים בע״ח
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserUSPScene.tsx && git commit -m "feat(teaser-v2): add TeaserUSPScene (270 frames)"
```

---

### Task 9: TeaserCTASceneV2.tsx (240 frames = 8s)

**Files:**
- Create: `src/scenes/teaser/TeaserCTASceneV2.tsx`

Dark background. Logo → "נסו חינם עכשיו" (white, with slow pulse) → "ללא מגבלת זמן" (green) → "petra-app.com" (muted). Gentle fade out at frames 210–240.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/teaser/TeaserCTASceneV2.tsx
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

export const TeaserCTASceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(
    frame,
    [0, 20, 210, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 160 } });

  const ctaOpacity = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" });
  const ctaY = interpolate(
    spring({ frame: frame - 45, fps, config: { damping: 200 } }),
    [0, 1], [18, 0]
  );

  const subOpacity = interpolate(frame, [70, 88], [0, 1], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [95, 112], [0, 1], { extrapolateRight: "clamp" });

  // Slow heartbeat pulse on main CTA text
  const pulse = 1 + interpolate(frame % 60, [0, 30, 60], [0, 0.012, 0]);

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: sceneOpacity,
      }}
    >
      {/* Subtle orange radial glow */}
      <div style={{
        position: "absolute",
        top: "10%", left: "50%",
        transform: "translateX(-50%)",
        width: 600, height: 400,
        background: "radial-gradient(ellipse, rgba(234,88,12,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(234,88,12,0.15)",
          border: "2px solid rgba(234,88,12,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(234,88,12,0.2)",
        }}>
          <Img
            src={staticFile("petra-icon.png")}
            style={{ width: 52, height: 52, objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Main CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px) scale(${pulse})`,
          fontSize: 52,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          textShadow: "0 3px 24px rgba(0,0,0,0.3)",
          lineHeight: 1.15,
          marginBottom: 14,
        }}
      >
        נסו חינם עכשיו
      </div>

      {/* Sub CTA — green */}
      <div
        style={{
          opacity: subOpacity,
          fontSize: 22,
          fontWeight: 700,
          color: "#22c55e",
          marginBottom: 18,
          textShadow: "0 0 20px rgba(34,197,94,0.25)",
        }}
      >
        ללא מגבלת זמן
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlOpacity,
          fontSize: 16,
          fontWeight: 600,
          color: "#94a3b8",
          letterSpacing: 1,
        }}
      >
        petra-app.com
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/scenes/teaser/TeaserCTASceneV2.tsx && git commit -m "feat(teaser-v2): add TeaserCTASceneV2 (dark bg, 240 frames)"
```

---

### Task 10: Wire TeaserVideo.tsx + update Root.tsx

**Files:**
- Modify: `src/TeaserVideo.tsx`
- Modify: `src/Root.tsx`

Replace the old 930-frame composition with the new 2700-frame version using all new scenes.

- [ ] **Step 1: Replace the entire content of src/TeaserVideo.tsx**

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
import { TeaserHookScene } from "./scenes/teaser/TeaserHookScene";
import { TeaserLogoSceneV2 } from "./scenes/teaser/TeaserLogoSceneV2";
import { TeaserLeadsSceneV2 } from "./scenes/teaser/TeaserLeadsSceneV2";
import { TeaserBoardingSceneV2 } from "./scenes/teaser/TeaserBoardingSceneV2";
import { TeaserBookingSceneV2 } from "./scenes/teaser/TeaserBookingSceneV2";
import { TeaserRemindersScene } from "./scenes/teaser/TeaserRemindersScene";
import { TeaserUSPScene } from "./scenes/teaser/TeaserUSPScene";
import { TeaserCTASceneV2 } from "./scenes/teaser/TeaserCTASceneV2";

// Frame counts (30fps):
// Scene 1 hook:       240f  (8s)
// Scene 2 logo:       150f  (5s)
// Scene 3 leads:      450f (15s)
// Scene 4 boarding:   450f (15s)
// Scene 5 booking:    450f (15s)
// Scene 6 reminders:  450f (15s)
// Scene 7 usp:        270f  (9s)
// Scene 8 cta:        240f  (8s)
// Total:             2700f (90s)

export const TeaserVideo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("teaser-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps, durationInFrames],
            [0, 0.18, 0.18, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />

      <Series>
        <Series.Sequence durationInFrames={240}>
          <TeaserHookScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150}>
          <TeaserLogoSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserLeadsSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserBoardingSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserBookingSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserRemindersScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={270}>
          <TeaserUSPScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={240}>
          <TeaserCTASceneV2 />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Update Root.tsx — change durationInFrames from 930 to 2700**

In `src/Root.tsx`, find this block:
```tsx
      <Composition
        id="PetraTeaserVideowebsite"
        component={TeaserVideo}
        durationInFrames={930}
        fps={30}
        width={1280}
        height={720}
      />
```

Replace with:
```tsx
      <Composition
        id="PetraTeaserVideowebsite"
        component={TeaserVideo}
        durationInFrames={2700}
        fps={30}
        width={1280}
        height={720}
      />
```

- [ ] **Step 3: TypeScript check — must pass cleanly**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Visual verification in Remotion Studio**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm run dev
```

Open `http://localhost:3000`, select `PetraTeaserVideowebsite`. Verify:

| Frame range | Expected |
|-------------|----------|
| 0–240 | Dark bg. "לנהל עסק עם בע״ח" slides in white, "זה כאוס" in red with pulse |
| 240–390 | Dark bg. Logo circle (orange glow ring) → "PETRA" → "יש דרך אחרת" (gray) |
| 390–510 | Dark bg. "לידים שנעלמים בין הצ׳אטים" (white), sub-line gray |
| 510–840 | Leads kanban UI crossfades in. Cursor clicks lead card. Green BenefitTag appears |
| 840–960 | Dark bg. "איזה כלב באיזה חדר?" pain text |
| 960–1290 | Boarding room map. Cursor clicks Room 1. Green BenefitTag |
| 1290–1410 | Dark bg. "הלקוח התקשר. היית עסוק." + "הוא הזמין אצל המתחרה" (red) |
| 1410–1740 | Booking flow. Cursor selects service → time slot → checkmark appears |
| 1740–1860 | Dark bg. "ביטול ברגע האחרון?" + "כי שכחו. ואתה לא הזכרת." |
| 1860–2190 | Settings Messages tab. WhatsApp toggle ON. Cursor clicks "48 שעות". Green BenefitTag |
| 2190–2460 | Dark bg. "המערכת היחידה" → "שנבנתה מהשטח" (orange) → "עם אנשים שמכירים בע״ח" (gray) |
| 2460–2700 | Dark bg. Logo → "נסו חינם עכשיו" → "ללא מגבלת זמן" (green) → "petra-app.com" → fade |

- [ ] **Step 5: Commit**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && git add src/TeaserVideo.tsx src/Root.tsx && git commit -m "feat(teaser-v2): wire all 8 scenes to TeaserVideo, 2700 frames (90s)"
```
