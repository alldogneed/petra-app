# Dashboard Tutorial Renovation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovate the existing `DashboardTutorial` to match the visual language of the newer Petra tutorial series — same 6 scenes, new scene files, new voiceover config, sidebar added to all UI scenes, bg-music added, registered as new `PetraDashboardTutorial` composition alongside the unchanged old one.

**Architecture:** New scene files (`Dashboard*Scene.tsx`) are created alongside existing ones (backward compatible). `DashboardTutorial.tsx` gains new exports (`DashboardTutorialProps`, `calculateDashboardMetadata`, `PetraDashboardTutorial`). `Root.tsx` gets a new `PetraDashboardTutorial` composition. Progressive uncomment strategy: Task 3 creates the composition shell with all scene imports commented; Tasks 4–9 each create a scene file and uncomment its block.

**Tech Stack:** Remotion 4.x, TypeScript, Google Gemini TTS (gemini-2.5-flash-preview-tts, Aoede voice), PCM→WAV conversion

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `voiceover-dashboard-config.ts` | 6 scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-dashboard.ts` | Gemini TTS generator for dashboard WAVs |
| Modify | `src/DashboardTutorial.tsx` | Add `PetraDashboardTutorial` + new exports (keep old `DashboardTutorial` intact) |
| Modify | `src/Root.tsx` | Add `PetraDashboardTutorial` composition |
| Create | `src/scenes/DashboardIntroScene.tsx` | Dark intro scene (pattern: TasksIntroScene) |
| Create | `src/scenes/DashboardStatsScene.tsx` | Stat cards UI scene with PetraSidebar |
| Create | `src/scenes/DashboardAppointmentsScene.tsx` | Appointments UI scene with PetraSidebar |
| Create | `src/scenes/DashboardOrdersScene.tsx` | Orders table UI scene with PetraSidebar |
| Create | `src/scenes/DashboardChecklistScene.tsx` | Setup checklist UI scene with PetraSidebar |
| Create | `src/scenes/DashboardOutroScene.tsx` | Dark outro scene (pattern: TasksOutroScene) |
| Output | `public/voiceover/dashboard-*.wav` | Generated audio files (6 WAVs) |

---

### Task 1: Voiceover Config

**Files:**
- Create: `voiceover-dashboard-config.ts`

- [ ] **Step 1: Create the config file**

```typescript
// voiceover-dashboard-config.ts
export const DASHBOARD_SCENES = [
  {
    id: "dashboard-intro",
    text: "ברוכים הבאים לדשבורד של פטרה — מרכז הניהול של העסק שלכם. בסקירה אחת תראו הכנסות, תורים, לקוחות, ותשלומים ממתינים.",
    defaultDurationSec: 12,
  },
  {
    id: "dashboard-stats",
    text: "בראש הדשבורד ארבע כרטיסיות נותנות מבט-על על העסק — הכנסות החודש, תורים להיום, לקוחות פעילים, ותשלומים שממתינים לגביה. הכל מתעדכן בזמן אמת.",
    defaultDurationSec: 15,
  },
  {
    id: "dashboard-appointments",
    text: "מתחת לכרטיסיות תראו את התורים הקרובים. לחצו על כפתור הוואטסאפ לשליחת תזכורת ישירות ללקוח — או הפעילו תזכורות אוטומטיות שיוצאות עשרים וארבע עד ארבעים ושמונה שעות לפני כל תור.",
    defaultDurationSec: 15,
  },
  {
    id: "dashboard-orders",
    text: "בסעיף ההזמנות האחרונות תוכלו לראות מה שולם ומה ממתין לגביה. לחצו על שורה כדי לנווט להזמנה — ומשם לשלוח דרישת תשלום ישירות בוואטסאפ.",
    defaultDurationSec: 13,
  },
  {
    id: "dashboard-checklist",
    text: "הצ'קליסט מוביל אתכם שלב אחרי שלב בהגדרת העסק — משירותים ולקוחות ועד לתזכורות אוטומטיות. כל שלב שמסיימים מסתמן ירוק.",
    defaultDurationSec: 13,
  },
  {
    id: "dashboard-outro",
    text: "הדשבורד של פטרה — כל מה שצריך לנהל את העסק, במקום אחד. התחילו עכשיו בחינם.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add voiceover-dashboard-config.ts
git commit -m "feat(dashboard): add voiceover-dashboard-config"
```

---

### Task 2: Voiceover Generator

**Files:**
- Create: `generate-voiceover-dashboard.ts`
- Output: `public/voiceover/dashboard-*.wav`

- [ ] **Step 1: Create the generator script**

```typescript
// generate-voiceover-dashboard.ts
/**
 * Generates Hebrew voiceover for the Dashboard tutorial using Google Gemini 2.5 TTS.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover-dashboard.ts
 *
 * Output: public/voiceover/dashboard-{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { DASHBOARD_SCENES } from "./voiceover-dashboard-config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MODEL = "gemini-2.5-flash-preview-tts";
const VOICE = "Aoede";
const OUTPUT_DIR = "public/voiceover";

const HEBREW_PREFIX =
  "דבר בעברית ישראלית טבעית ורהוטה. קצב דיבור רגיל לחלוטין — לא מהיר ולא איטי, כמו שיחה יומיומית מקצועית. הגייה ברורה, ניקוד נכון, ללא הפסקות מיותרות. הטקסט:\n\n";

function pcmToWav(pcm: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

async function generateScene(sceneId: string, text: string, apiKey: string): Promise<void> {
  console.log(`🎙  ${sceneId}: "${text.slice(0, 55)}..."`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: HEBREW_PREFIX + text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini TTS error [${sceneId}] ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{ content: { parts: Array<{ inlineData: { data: string; mimeType: string } }> } }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);

  const part = data.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) throw new Error(`No audio data returned for scene "${sceneId}"`);

  const pcm = Buffer.from(part.inlineData.data, "base64");
  const wav = pcmToWav(pcm);
  const outPath = `${OUTPUT_DIR}/${sceneId}.wav`;
  writeFileSync(outPath, wav);

  const durationSec = (pcm.length / (24000 * 2)).toFixed(1);
  console.log(`    ✅ ${outPath} — ${durationSec}s (${(wav.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    console.error("❌  Missing GEMINI_KEY");
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover-dashboard.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📦 Petra Dashboard Tutorial Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < DASHBOARD_SCENES.length; i++) {
    const scene = DASHBOARD_SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    if (i < DASHBOARD_SCENES.length - 1) {
      const next = DASHBOARD_SCENES[i + 1];
      if (!existsSync(`${OUTPUT_DIR}/${next.id}.wav`)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! WAVs saved to public/voiceover/dashboard-*.wav`);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
```

- [ ] **Step 2: Run the generator**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-dashboard.ts
```

Expected: 6 WAV files printed as `✅ public/voiceover/dashboard-*.wav`. If rate-limited, the 22s sleeps are built in.

- [ ] **Step 3: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add generate-voiceover-dashboard.ts public/voiceover/dashboard-intro.wav public/voiceover/dashboard-stats.wav public/voiceover/dashboard-appointments.wav public/voiceover/dashboard-orders.wav public/voiceover/dashboard-checklist.wav public/voiceover/dashboard-outro.wav
git commit -m "feat(dashboard): add voiceover generator + generated WAVs"
```

---

### Task 3: DashboardTutorial.tsx shell + Root.tsx composition

**Files:**
- Modify: `src/DashboardTutorial.tsx` (append new exports — do NOT touch existing exports)
- Modify: `src/Root.tsx` (add PetraDashboardTutorial composition)

- [ ] **Step 1: Read both files before editing**

Read `src/DashboardTutorial.tsx` and `src/Root.tsx` before making any edits.

- [ ] **Step 2: Update imports in DashboardTutorial.tsx**

Add `interpolate` to the existing remotion import line. Find:
```typescript
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Series,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
```

Replace with:
```typescript
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Series,
  Sequence,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
```

- [ ] **Step 3: Append new exports to DashboardTutorial.tsx**

After the last line of the file (after the closing `};` of `DashboardTutorial`), append:

```typescript

// ─── PetraDashboardTutorial (renovated, v2) ───────────────────────────────
import { DASHBOARD_SCENES } from "../voiceover-dashboard-config";

// Scene imports — uncommented as tasks complete:
// import { DashboardIntroScene } from "./scenes/DashboardIntroScene";
// import { DashboardStatsScene } from "./scenes/DashboardStatsScene";
// import { DashboardAppointmentsScene } from "./scenes/DashboardAppointmentsScene";
// import { DashboardOrdersScene } from "./scenes/DashboardOrdersScene";
// import { DashboardChecklistScene } from "./scenes/DashboardChecklistScene";
// import { DashboardOutroScene } from "./scenes/DashboardOutroScene";

export type DashboardTutorialProps = {
  sceneDurationsFrames: number[];
};

const DASHBOARD_AUDIO_FILES = DASHBOARD_SCENES.map((s) => `voiceover/${s.id}.wav`);
const DASHBOARD_DEFAULT_FRAMES = DASHBOARD_SCENES.map((s) => s.defaultDurationSec * FPS);

export const calculateDashboardMetadata: CalculateMetadataFunction<DashboardTutorialProps> =
  async () => {
    const durationsFrames = await Promise.all(
      DASHBOARD_AUDIO_FILES.map(async (file, i) => {
        try {
          const durationSec = await getAudioDuration(staticFile(file));
          return Math.ceil((durationSec + 0.5) * FPS);
        } catch {
          return DASHBOARD_DEFAULT_FRAMES[i];
        }
      })
    );
    return {
      durationInFrames: durationsFrames.reduce((sum, d) => sum + d, 0),
      props: { sceneDurationsFrames: durationsFrames },
    };
  };

export const PetraDashboardTutorial: React.FC<DashboardTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [
    intro = 360,
    stats = 450,
    appointments = 450,
    orders = 390,
    checklist = 390,
    outro = 300,
  ] = sceneDurationsFrames;

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("bg-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps * 2, durationInFrames],
            [0, 0.13, 0.13, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      <Series>
        {/* Scene sequences — uncommented as tasks complete: */}
        {/*
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <DashboardIntroScene />
          <SceneAudio file="voiceover/dashboard-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={stats} premountFor={fps}>
          <DashboardStatsScene />
          <SceneAudio file="voiceover/dashboard-stats.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={appointments} premountFor={fps}>
          <DashboardAppointmentsScene />
          <SceneAudio file="voiceover/dashboard-appointments.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={orders} premountFor={fps}>
          <DashboardOrdersScene />
          <SceneAudio file="voiceover/dashboard-orders.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={checklist} premountFor={fps}>
          <DashboardChecklistScene />
          <SceneAudio file="voiceover/dashboard-checklist.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <DashboardOutroScene />
          <SceneAudio file="voiceover/dashboard-outro.wav" />
        </Series.Sequence>
        */}
      </Series>
    </AbsoluteFill>
  );
};
```

Note: `SceneAudio` and `FPS` are already defined in the existing file above — no need to redefine.

- [ ] **Step 4: Add PetraDashboardTutorial to Root.tsx**

In `src/Root.tsx`:

Add import after the existing booking imports (around line 53):
```typescript
import {
  PetraDashboardTutorial,
  DashboardTutorialProps,
  calculateDashboardMetadata,
} from "./DashboardTutorial";
import { DASHBOARD_SCENES } from "../voiceover-dashboard-config";
```

Add defaultProps constant after `bookingDefaultProps` (around line 79):
```typescript
const dashboardDefaultProps: DashboardTutorialProps = {
  sceneDurationsFrames: DASHBOARD_SCENES.map((s) => s.defaultDurationSec * FPS),
};
```

Add composition before the closing `</>` of RemotionRoot (after the PetraBookingTutorial block):
```tsx
<Composition
  id="PetraDashboardTutorial"
  component={PetraDashboardTutorial}
  calculateMetadata={calculateDashboardMetadata}
  durationInFrames={
    DASHBOARD_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
  }
  fps={FPS}
  width={1280}
  height={720}
  defaultProps={dashboardDefaultProps}
/>
```

- [ ] **Step 5: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/DashboardTutorial.tsx src/Root.tsx
git commit -m "feat(dashboard): add PetraDashboardTutorial shell + Root composition"
```

---

### Task 4: DashboardIntroScene

**Files:**
- Create: `src/scenes/DashboardIntroScene.tsx`
- Modify: `src/DashboardTutorial.tsx` (uncomment intro import + Series.Sequence)

- [ ] **Step 1: Create DashboardIntroScene.tsx**

Pattern: identical to `TasksIntroScene.tsx` — dark bg, PETRA icon+text, badge, title, subtitle.

```typescript
// src/scenes/DashboardIntroScene.tsx
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

export const DashboardIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const badgeOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  const titleProgress = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });

  const subtitleProgress = spring({ frame: frame - 48, fps, config: { damping: 200 } });
  const subtitleY = interpolate(subtitleProgress, [0, 1], [20, 0]);
  const subtitleOpacity = interpolate(frame, [48, 62], [0, 1], { extrapolateRight: "clamp" });

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0c1422 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: "25%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 500,
        background: `radial-gradient(ellipse, rgba(234,88,12,${0.1 + pulse * 0.05}) 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${10 + i * 11}%`, left: `${3 + i * 12}%`,
          width: i % 2 === 0 ? 4 : 2, height: i % 2 === 0 ? 4 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.15)",
        }} />
      ))}

      {/* Logo */}
      <div style={{
        transform: `scale(${logoScale})`,
        marginBottom: 24,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
          PETRA
        </span>
      </div>

      {/* Badge */}
      <div style={{
        opacity: badgeOpacity,
        background: "rgba(234,88,12,0.15)",
        border: "1px solid rgba(234,88,12,0.5)",
        borderRadius: 99, padding: "5px 16px",
        marginBottom: 20,
        color: "#fb923c", fontSize: 13, fontWeight: 600,
      }}>
        מדריך מהיר
      </div>

      {/* Title */}
      <h1 style={{
        color: "white", fontSize: 60, fontWeight: 800,
        margin: 0, marginBottom: 18,
        textAlign: "center",
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        lineHeight: 1.15,
        textShadow: "0 2px 20px rgba(234,88,12,0.3)",
      }}>
        לוח הבקרה
      </h1>

      {/* Subtitle */}
      <p style={{
        color: "#94a3b8", fontSize: 20,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity,
        transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        כל מה שצריך לנהל את העסק — במקום אחד
      </p>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment DashboardIntroScene in DashboardTutorial.tsx**

In `src/DashboardTutorial.tsx`, find and uncomment the intro import and its Series.Sequence block:

Replace `// import { DashboardIntroScene } from "./scenes/DashboardIntroScene";` with:
```typescript
import { DashboardIntroScene } from "./scenes/DashboardIntroScene";
```

Replace the commented intro Sequence (inside the `/* ... */` block) — pull it out of the JSX comment:
```tsx
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <DashboardIntroScene />
          <SceneAudio file="voiceover/dashboard-intro.wav" />
        </Series.Sequence>
```
Leave the remaining 5 Sequences still inside the `/* ... */` comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/DashboardIntroScene.tsx src/DashboardTutorial.tsx
git commit -m "feat(dashboard): add DashboardIntroScene"
```

---

### Task 5: DashboardStatsScene

**Files:**
- Create: `src/scenes/DashboardStatsScene.tsx`
- Modify: `src/DashboardTutorial.tsx` (uncomment stats block)

- [ ] **Step 1: Create DashboardStatsScene.tsx**

Layout: `#f1f5f9` bg, PetraSidebar right (210px), content area left. White header bar (52px). 4 stat cards in 2×2 grid, staggered spring slide-up with number counter. Orange callout at bottom.

```typescript
// src/scenes/DashboardStatsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const STATS = [
  { value: 12450, label: "הכנסות החודש", sub: "היום: ₪680", color: ORANGE, format: "currency" },
  { value: 6,     label: "תורים היום",   sub: "הבא: 10:30", color: "#2563eb", format: "number" },
  { value: 48,    label: "לקוחות פעילים", sub: "+3 החודש",  color: "#16a34a", format: "number" },
  { value: 3,     label: "תשלומים ממתינים", sub: "סה״כ ₪1,230", color: "#d97706", format: "number" },
];

export const DashboardStatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const calloutP = spring({ frame: frame - 220, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [20, 0]);
  const calloutOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח הבקרה</div>
        </div>

        {/* Stat cards 2×2 grid */}
        <div style={{
          padding: "20px 24px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
        }}>
          {STATS.map((stat, i) => {
            const startFrame = 20 + i * 30;
            const cardP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
            const cardY = interpolate(cardP, [0, 1], [30, 0]);
            const cardOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

            const counterProgress = interpolate(
              frame,
              [startFrame + 10, startFrame + 55],
              [0, 1],
              { extrapolateRight: "clamp" }
            );
            const currentValue = Math.round(counterProgress * stat.value);
            const displayValue = stat.format === "currency"
              ? `₪${currentValue.toLocaleString()}`
              : String(currentValue);

            return (
              <div key={stat.label} style={{
                background: "white", borderRadius: 16,
                border: `1px solid #e2e8f0`,
                padding: "20px 20px 16px",
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                borderTop: `3px solid ${stat.color}`,
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginBottom: 4 }}>
                  {displayValue}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Callout */}
        <div style={{
          margin: "0 24px",
          background: "rgba(234,88,12,0.07)",
          border: "1px solid rgba(234,88,12,0.25)",
          borderRadius: 12, padding: "14px 18px",
          opacity: calloutOpacity,
          transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
            הנתונים מתעדכנים בזמן אמת — כל תשלום ותור מתווסף אוטומטית
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment stats block in DashboardTutorial.tsx**

The current file has a `/* ... */` JSX comment containing all 5 remaining Sequences. Pull out the stats Sequence from inside the comment (keep the others still commented). After uncommenting, the Series should have `DashboardIntroScene` and `DashboardStatsScene` Sequences active, with the remaining 4 still commented.

Uncomment the import: `import { DashboardStatsScene } from "./scenes/DashboardStatsScene";`

Add the active Sequence block after the intro Sequence:
```tsx
        <Series.Sequence durationInFrames={stats} premountFor={fps}>
          <DashboardStatsScene />
          <SceneAudio file="voiceover/dashboard-stats.wav" />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/DashboardStatsScene.tsx src/DashboardTutorial.tsx
git commit -m "feat(dashboard): add DashboardStatsScene"
```

---

### Task 6: DashboardAppointmentsScene

**Files:**
- Create: `src/scenes/DashboardAppointmentsScene.tsx`
- Modify: `src/DashboardTutorial.tsx` (uncomment appointments block)

- [ ] **Step 1: Create DashboardAppointmentsScene.tsx**

Layout: `#f1f5f9` bg, PetraSidebar, white header. Section heading "תורים קרובים" with orange left-border accent. 4 appointment rows slide in from right (staggered). Green WhatsApp callout at bottom.

```typescript
// src/scenes/DashboardAppointmentsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const APPOINTMENTS = [
  { time: "09:00", pet: "מקס (לברדור)",  service: "אילוף בסיסי",    owner: "דני כהן" },
  { time: "10:30", pet: "בלה (פינצ'ר)",  service: "טיפוח ועיצוב",   owner: "שרה לוי" },
  { time: "14:00", pet: "רקי (האסקי)",   service: "אילוף מתקדם",    owner: "מיכל ברנשטיין" },
  { time: "16:30", pet: "קפה (שפניה)",   service: "בדיקת בריאות",   owner: "דוד אברהם" },
];

export const DashboardAppointmentsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const calloutOpacity = interpolate(frame, [260, 280], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 260, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח הבקרה</div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Section heading */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
            opacity: headerOpacity,
          }}>
            <div style={{ width: 4, height: 20, background: ORANGE, borderRadius: 2 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>תורים קרובים</div>
          </div>

          {/* Appointments list */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", overflow: "hidden",
            marginBottom: 20,
          }}>
            {APPOINTMENTS.map((appt, i) => {
              const startFrame = 25 + i * 40;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-40, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={appt.time} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  borderBottom: i < APPOINTMENTS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}>
                  {/* Time */}
                  <div style={{
                    background: "rgba(234,88,12,0.08)", borderRadius: 8,
                    padding: "5px 10px", fontSize: 13, fontWeight: 800, color: ORANGE,
                    flexShrink: 0, minWidth: 52, textAlign: "center",
                  }}>
                    {appt.time}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{appt.pet}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{appt.service} · {appt.owner}</div>
                  </div>
                  {/* WhatsApp button */}
                  <div style={{
                    background: "#22c55e", borderRadius: 8,
                    padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "white",
                    flexShrink: 0,
                  }}>
                    💬
                  </div>
                </div>
              );
            })}
          </div>

          {/* WhatsApp callout */}
          <div style={{
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 12, padding: "14px 18px",
            opacity: calloutOpacity,
            transform: `translateY(${calloutY}px)`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
              תזכורות WhatsApp אוטומטיות — פטרה שולחת תזכורת ללקוח 24–48 שעות לפני התור
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment appointments block in DashboardTutorial.tsx**

Uncomment the import: `import { DashboardAppointmentsScene } from "./scenes/DashboardAppointmentsScene";`

Add active Sequence after the stats Sequence:
```tsx
        <Series.Sequence durationInFrames={appointments} premountFor={fps}>
          <DashboardAppointmentsScene />
          <SceneAudio file="voiceover/dashboard-appointments.wav" />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/DashboardAppointmentsScene.tsx src/DashboardTutorial.tsx
git commit -m "feat(dashboard): add DashboardAppointmentsScene"
```

---

### Task 7: DashboardOrdersScene

**Files:**
- Create: `src/scenes/DashboardOrdersScene.tsx`
- Modify: `src/DashboardTutorial.tsx` (uncomment orders block)

- [ ] **Step 1: Create DashboardOrdersScene.tsx**

Layout: `#f1f5f9` bg, PetraSidebar, white header. Section heading "הזמנות אחרונות" + "לכל ההזמנות ←" link. White card table with 5 rows sliding from right. Summary callout.

```typescript
// src/scenes/DashboardOrdersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const ORDERS = [
  { customer: "דני כהן / מקס",          date: "היום",  service: "אילוף בסיסי ×4",     amount: "₪480",    paid: true },
  { customer: "שרה לוי / בלה",           date: "אתמול", service: "טיפוח ועיצוב",       amount: "₪180",    paid: false },
  { customer: "מיכל ברנשטיין / רקי",     date: "23/03", service: "חבילת אילוף מלאה",  amount: "₪1,200",  paid: true },
  { customer: "דוד אברהם / קפה",         date: "21/03", service: "פנסיון 3 לילות",    amount: "₪360",    paid: false },
  { customer: "יוסי מזרחי / לונה",       date: "18/03", service: "בדיקת בריאות",      amount: "₪220",    paid: true },
];

export const DashboardOrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const calloutOpacity = interpolate(frame, [250, 270], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח הבקרה</div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Section heading */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>הזמנות אחרונות</div>
            <div style={{ fontSize: 12, color: ORANGE, fontWeight: 700 }}>לכל ההזמנות ←</div>
          </div>

          {/* Orders table card */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", overflow: "hidden",
            marginBottom: 16,
          }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 0.8fr 2fr 0.8fr 0.9fr",
              padding: "10px 18px", background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              opacity: headerOpacity,
            }}>
              {["לקוח / חיה", "תאריך", "שירות", "סכום", "סטטוס"].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</div>
              ))}
            </div>

            {/* Order rows */}
            {ORDERS.map((order, i) => {
              const startFrame = 25 + i * 30;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-40, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={order.customer} style={{
                  display: "grid", gridTemplateColumns: "2fr 0.8fr 2fr 0.8fr 0.9fr",
                  alignItems: "center", padding: "11px 18px",
                  borderBottom: i < ORDERS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{order.customer}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{order.date}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{order.service}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{order.amount}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: order.paid ? "#16a34a" : "#d97706",
                    background: order.paid ? "rgba(22,163,74,0.08)" : "rgba(217,119,6,0.08)",
                    borderRadius: 99, padding: "3px 8px", display: "inline-block",
                  }}>
                    {order.paid ? "✓ שולם" : "⏳ ממתין"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary callout */}
          <div style={{
            display: "flex", gap: 24, alignItems: "center",
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "12px 18px",
            opacity: calloutOpacity,
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>שולם החודש</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>₪2,440</div>
            </div>
            <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>ממתין לגביה</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#d97706" }}>₪540</div>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", flex: 1, textAlign: "left" }}>
              שלחו דרישת תשלום ישירות בוואטסאפ
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment orders block in DashboardTutorial.tsx**

Uncomment the import: `import { DashboardOrdersScene } from "./scenes/DashboardOrdersScene";`

Add active Sequence after the appointments Sequence:
```tsx
        <Series.Sequence durationInFrames={orders} premountFor={fps}>
          <DashboardOrdersScene />
          <SceneAudio file="voiceover/dashboard-orders.wav" />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/DashboardOrdersScene.tsx src/DashboardTutorial.tsx
git commit -m "feat(dashboard): add DashboardOrdersScene"
```

---

### Task 8: DashboardChecklistScene

**Files:**
- Create: `src/scenes/DashboardChecklistScene.tsx`
- Modify: `src/DashboardTutorial.tsx` (uncomment checklist block)

- [ ] **Step 1: Create DashboardChecklistScene.tsx**

Layout: `#f1f5f9` bg, PetraSidebar, white header. Section heading "צ'קליסט הקמה" with progress bar and "X/7 הושלמו" counter. 7 items slide in from right (staggered); first 4 are completed (green bg, green checkmark), last 3 are pending (white bg, gray circle).

```typescript
// src/scenes/DashboardChecklistScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const CHECKLIST_ITEMS = [
  { label: "הגדרת פרטי העסק",        done: true },
  { label: "הוספת שירות ראשון",       done: true },
  { label: "הוספת לקוח ראשון",        done: true },
  { label: "קביעת תור ראשון",         done: true },
  { label: "יצירת הזמנה",             done: false },
  { label: "הגדרת חוזה לדוגמה",      done: false },
  { label: "הפעלת תזכורות WhatsApp", done: false },
];

const COMPLETED_COUNT = CHECKLIST_ITEMS.filter((i) => i.done).length;

export const DashboardChecklistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  // Progress bar fills from 0 → (4/7) as items arrive
  const progressWidth = interpolate(
    frame,
    [20, 20 + 6 * 35 + 30],
    [0, COMPLETED_COUNT / CHECKLIST_ITEMS.length],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח הבקרה</div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Section heading + counter */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>צ'קליסט הקמה</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              {COMPLETED_COUNT}/{CHECKLIST_ITEMS.length} הושלמו
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 8, background: "#e2e8f0", borderRadius: 99,
            marginBottom: 16, overflow: "hidden",
            opacity: headerOpacity,
          }}>
            <div style={{
              height: "100%", borderRadius: 99,
              width: `${progressWidth * 100}%`,
              background: "linear-gradient(90deg, #ea580c, #16a34a)",
              transition: "width 0.1s",
            }} />
          </div>

          {/* Checklist items */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {CHECKLIST_ITEMS.map((item, i) => {
              const startFrame = 20 + i * 35;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-40, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

              const checkP = spring({ frame: frame - startFrame - 5, fps, config: { damping: 200 } });
              const checkScale = interpolate(checkP, [0, 1], [0.5, 1]);

              return (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "13px 18px",
                  borderBottom: i < CHECKLIST_ITEMS.length - 1 ? "1px solid #f1f5f9" : "none",
                  background: item.done ? "rgba(22,163,74,0.04)" : "white",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}>
                  {/* Check icon */}
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: item.done ? "#16a34a" : "white",
                    border: item.done ? "none" : "2px solid #cbd5e1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    transform: `scale(${item.done ? checkScale : 1})`,
                  }}>
                    {item.done && (
                      <span style={{ color: "white", fontSize: 12, fontWeight: 800 }}>✓</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: item.done ? 600 : 500,
                    color: item.done ? "#166534" : "#475569",
                    textDecoration: item.done ? "none" : "none",
                  }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment checklist block in DashboardTutorial.tsx**

Uncomment the import: `import { DashboardChecklistScene } from "./scenes/DashboardChecklistScene";`

Add active Sequence after the orders Sequence:
```tsx
        <Series.Sequence durationInFrames={checklist} premountFor={fps}>
          <DashboardChecklistScene />
          <SceneAudio file="voiceover/dashboard-checklist.wav" />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/DashboardChecklistScene.tsx src/DashboardTutorial.tsx
git commit -m "feat(dashboard): add DashboardChecklistScene"
```

---

### Task 9: DashboardOutroScene

**Files:**
- Create: `src/scenes/DashboardOutroScene.tsx`
- Modify: `src/DashboardTutorial.tsx` (uncomment outro block — final uncomment, removes the `/* */` JSX comment entirely)

- [ ] **Step 1: Create DashboardOutroScene.tsx**

Pattern: identical to `TasksOutroScene.tsx` — dark bg, PETRA icon (80px), title, tagline, 3 benefit pills, orange CTA, URL.

```typescript
// src/scenes/DashboardOutroScene.tsx
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
const ORANGE = "#ea580c";

const BENEFITS = [
  { text: "מבט-על על העסק" },
  { text: "תזכורות אוטומטיות" },
  { text: "ניהול תשלומים" },
];

export const DashboardOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const titleP = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const titleY = interpolate(titleP, [0, 1], [30, 0]);
  const titleOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });

  const ctaP = spring({ frame: frame - 80, fps, config: { damping: 200 } });
  const ctaScale = interpolate(ctaP, [0, 1], [0.6, 1]);
  const ctaOpacity = interpolate(frame, [80, 96], [0, 1], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [100, 116], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
      padding: "0 80px",
    }}>
      {/* Stars */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, marginBottom: 28 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 80, height: 80, objectFit: "contain" }} />
      </div>

      {/* Title */}
      <h1 style={{
        color: "white", fontSize: 44, fontWeight: 800,
        margin: 0, marginBottom: 8, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.2,
      }}>
        הדשבורד של פטרה
      </h1>
      <p style={{
        color: "white", fontSize: 20, fontWeight: 700,
        margin: 0, marginBottom: 32, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
      }}>
        כל מה שצריך לנהל את העסק, במקום אחד
      </p>

      {/* Benefits */}
      <div style={{ display: "flex", gap: 12, marginBottom: 36, justifyContent: "center" }}>
        {BENEFITS.map((b, i) => {
          const bOpacity = interpolate(frame, [50 + i * 10, 62 + i * 10], [0, 1], { extrapolateRight: "clamp" });
          const bP = spring({ frame: frame - 50 - i * 10, fps, config: { damping: 200 } });
          const bScale = interpolate(bP, [0, 1], [0.8, 1]);
          return (
            <div key={b.text} style={{
              opacity: bOpacity, transform: `scale(${bScale})`,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "12px 16px",
            }}>
              <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{b.text}</span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{
        background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
        borderRadius: 16, padding: "16px 48px",
        opacity: ctaOpacity, transform: `scale(${ctaScale})`,
        boxShadow: "0 8px 32px rgba(234,88,12,0.45)",
        display: "flex", alignItems: "center", gap: 12,
        direction: "rtl",
      }}>
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>התחילו עכשיו בחינם</span>
        <span style={{ color: "white", fontSize: 20 }}>←</span>
      </div>

      {/* URL */}
      <div style={{ marginTop: 18, opacity: urlOpacity }}>
        <span style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>petra-app.com</span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment outro block in DashboardTutorial.tsx — final cleanup**

Uncomment the import: `import { DashboardOutroScene } from "./scenes/DashboardOutroScene";`

The `<Series>` currently has 5 active Sequences + a `{/* ... */}` JSX comment containing only the outro Sequence. Remove the JSX comment entirely and add the outro Sequence as an active block:

```tsx
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <DashboardOutroScene />
          <SceneAudio file="voiceover/dashboard-outro.wav" />
        </Series.Sequence>
```

All 6 Sequences should now be active with no remaining commented code.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/DashboardOutroScene.tsx src/DashboardTutorial.tsx
git commit -m "feat(dashboard): add DashboardOutroScene — all 6 scenes active"
```

---

### Task 10: Final Integration Check

**Files:** No new files — verification only.

- [ ] **Step 1: TypeScript clean build**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Verify all 6 WAV files exist**

```bash
ls -la $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video/public/voiceover/dashboard-'*.wav
```

Expected: 6 files — `dashboard-intro.wav`, `dashboard-stats.wav`, `dashboard-appointments.wav`, `dashboard-orders.wav`, `dashboard-checklist.wav`, `dashboard-outro.wav`.

- [ ] **Step 3: Verify Root.tsx exports PetraDashboardTutorial**

```bash
grep "PetraDashboardTutorial" $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video/src/Root.tsx'
```

Expected: lines for `import`, `dashboardDefaultProps`, and `<Composition id="PetraDashboardTutorial"`.

- [ ] **Step 4: Verify old DashboardTutorial still intact**

```bash
grep "export const DashboardTutorial" $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video/src/DashboardTutorial.tsx'
```

Expected: `export const DashboardTutorial: React.FC<TutorialProps>` present.

- [ ] **Step 5: Final commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add -A
git commit -m "feat(dashboard): complete PetraDashboardTutorial renovation"
```
