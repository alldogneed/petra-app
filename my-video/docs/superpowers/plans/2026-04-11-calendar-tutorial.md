# Calendar Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `PetraCalendarTutorial` — a 6-scene Remotion composition showcasing Petra's calendar: weekly view, appointment booking, recurring appointments, and availability management.

**Architecture:** New scene files (`Calendar*Scene.tsx`) + `CalendarTutorial.tsx` composition registered in `Root.tsx`. Progressive uncomment strategy: Task 3 creates the shell with all scene imports commented; Tasks 4–9 each create a scene file and uncomment its block. Voiceover WAVs generated via Gemini TTS.

**Tech Stack:** Remotion 4.x, TypeScript, Google Gemini TTS (gemini-2.5-flash-preview-tts, Aoede voice), PCM→WAV conversion

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `voiceover-calendar-config.ts` | 6 scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-calendar.ts` | Gemini TTS generator for calendar WAVs |
| Create | `src/CalendarTutorial.tsx` | Main composition — bg-music + 6 scenes |
| Modify | `src/Root.tsx` | Register `PetraCalendarTutorial` composition |
| Create | `src/scenes/CalendarIntroScene.tsx` | Scene 1: dark intro |
| Create | `src/scenes/CalendarWeekScene.tsx` | Scene 2: weekly view with appointment blocks |
| Create | `src/scenes/CalendarAddScene.tsx` | Scene 3: add-appointment modal |
| Create | `src/scenes/CalendarRecurringScene.tsx` | Scene 4: recurring toggle + frequency dropdown |
| Create | `src/scenes/CalendarAvailabilityScene.tsx` | Scene 5: working hours + block time |
| Create | `src/scenes/CalendarOutroScene.tsx` | Scene 6: dark outro |
| Output | `public/voiceover/calendar-*.wav` | 6 generated audio files |

---

### Task 1: Voiceover Config

**Files:**
- Create: `voiceover-calendar-config.ts`

- [ ] **Step 1: Create the config file**

Write this exact content to `/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video/voiceover-calendar-config.ts`:

```typescript
// voiceover-calendar-config.ts
export const CALENDAR_SCENES = [
  {
    id: "calendar-intro",
    text: "יומן פטרה — כל התורים שלכם, בתצוגה ברורה, עם ניהול זמן מלא.",
    defaultDurationSec: 10,
  },
  {
    id: "calendar-week",
    text: "בתצוגה השבועית תראו את כל התורים — לפי שירות, לקוח ושעה. עוברים בין יום, שבוע וחודש בלחיצה.",
    defaultDurationSec: 12,
  },
  {
    id: "calendar-add",
    text: "הוספת תור לוקחת שניות — בּוֹחֲרִים לקוח, שירות, ותאריך. הוא מופיע מיד ביומן.",
    defaultDurationSec: 11,
  },
  {
    id: "calendar-recurring",
    text: "תורים חוזרים? מַפְעִילִים את האפשרות וּבוֹחֲרִים תדירות — השאר קורה אוטומטית.",
    defaultDurationSec: 11,
  },
  {
    id: "calendar-availability",
    text: "בהגדרות הזמינות קוֹבְעִים שעות פעילות לכל יום — ואפשר לחסום ימי חופשה בקלות.",
    defaultDurationSec: 12,
  },
  {
    id: "calendar-outro",
    text: "יומן פטרה — הזמן שלכם, בשליטה שלכם.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add voiceover-calendar-config.ts
git commit -m "feat(calendar): add voiceover-calendar-config"
```

---

### Task 2: Voiceover Generator + WAVs

**Files:**
- Create: `generate-voiceover-calendar.ts`
- Output: `public/voiceover/calendar-*.wav`

- [ ] **Step 1: Create the generator script**

Write this exact content to `/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video/generate-voiceover-calendar.ts`:

```typescript
// generate-voiceover-calendar.ts
/**
 * Generates Hebrew voiceover for the Calendar tutorial using Google Gemini 2.5 TTS.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover-calendar.ts
 *
 * Output: public/voiceover/calendar-{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { CALENDAR_SCENES } from "./voiceover-calendar-config.js";

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
  console.log(`🎙  ${sceneId}: "${text.slice(0, 60)}..."`);

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
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover-calendar.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📦 Petra Calendar Tutorial Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < CALENDAR_SCENES.length; i++) {
    const scene = CALENDAR_SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    if (i < CALENDAR_SCENES.length - 1) {
      const next = CALENDAR_SCENES[i + 1];
      if (!existsSync(`${OUTPUT_DIR}/${next.id}.wav`)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! WAVs saved to public/voiceover/calendar-*.wav`);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
```

- [ ] **Step 2: Run the generator** (~2 minutes due to rate-limit waits)

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && GEMINI_KEY=AIzaSyDBAhFuy7WG0w82BpwdcojUShgB_jfKrzA PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-calendar.ts
```

Expected: 6 lines with `✅ public/voiceover/calendar-*.wav`

- [ ] **Step 3: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add generate-voiceover-calendar.ts public/voiceover/calendar-intro.wav public/voiceover/calendar-week.wav public/voiceover/calendar-add.wav public/voiceover/calendar-recurring.wav public/voiceover/calendar-availability.wav public/voiceover/calendar-outro.wav
git commit -m "feat(calendar): add voiceover generator + generated WAVs"
```

---

### Task 3: CalendarTutorial.tsx shell + Root.tsx

**Files:**
- Create: `src/CalendarTutorial.tsx`
- Modify: `src/Root.tsx`

- [ ] **Step 1: Create `src/CalendarTutorial.tsx` shell**

All scene imports are commented. A placeholder sequence covers full duration so TypeScript compiles cleanly.

```typescript
// src/CalendarTutorial.tsx
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
import { getAudioDuration } from "./get-audio-duration";
// import { CalendarIntroScene } from "./scenes/CalendarIntroScene";
// import { CalendarWeekScene } from "./scenes/CalendarWeekScene";
// import { CalendarAddScene } from "./scenes/CalendarAddScene";
// import { CalendarRecurringScene } from "./scenes/CalendarRecurringScene";
// import { CalendarAvailabilityScene } from "./scenes/CalendarAvailabilityScene";
// import { CalendarOutroScene } from "./scenes/CalendarOutroScene";
import { CALENDAR_SCENES } from "../voiceover-calendar-config";

export type CalendarTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = CALENDAR_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = CALENDAR_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateCalendarMetadata: CalculateMetadataFunction<CalendarTutorialProps> =
  async () => {
    const durationsFrames = await Promise.all(
      AUDIO_FILES.map(async (file, i) => {
        try {
          const durationSec = await getAudioDuration(staticFile(file));
          return Math.ceil((durationSec + 0.5) * FPS);
        } catch {
          return DEFAULT_DURATIONS_FRAMES[i];
        }
      })
    );
    return {
      durationInFrames: durationsFrames.reduce((sum, d) => sum + d, 0),
      props: { sceneDurationsFrames: durationsFrames },
    };
  };

export const PetraCalendarTutorial: React.FC<CalendarTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalFrames = durationInFrames;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [intro, week, add, recurring, availability, outro] = sceneDurationsFrames;

  return (
    <AbsoluteFill>
      {/* Background music — fades in over 1s, fades out over last 2s */}
      <Audio
        src={staticFile("bg-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, totalFrames - fps * 2, totalFrames],
            [0, 0.13, 0.13, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      <Series>
        <Series.Sequence durationInFrames={intro + week + add + recurring + availability + outro}>
          {/* placeholder — scenes will be wired in Task 9 */}
          <AbsoluteFill style={{ background: "#0f172a" }} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Add `PetraCalendarTutorial` to `src/Root.tsx`**

Read `src/Root.tsx`. Add near the top imports (after existing tutorial imports):

```typescript
import { PetraCalendarTutorial, CalendarTutorialProps, calculateCalendarMetadata } from "./CalendarTutorial";
import { CALENDAR_SCENES } from "../voiceover-calendar-config";
```

Add near the other `defaultProps` constants (look for the `FPS = 30` constant and other `*defaultProps` variables):

```typescript
const calendarDefaultProps: CalendarTutorialProps = {
  sceneDurationsFrames: CALENDAR_SCENES.map((s) => s.defaultDurationSec * FPS),
};
```

Add inside the `<>` or `<Compositions>` element, alongside the other `<Composition>` entries:

```tsx
<Composition
  id="PetraCalendarTutorial"
  component={PetraCalendarTutorial}
  calculateMetadata={calculateCalendarMetadata}
  durationInFrames={CALENDAR_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS}
  fps={FPS}
  width={1280}
  height={720}
  defaultProps={calendarDefaultProps}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -30
```

Expected: Only pre-existing errors (TeaserVideoLong/Short unused imports). Zero new errors.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/CalendarTutorial.tsx src/Root.tsx
git commit -m "feat(calendar): add CalendarTutorial shell + Root registration"
```

---

### Task 4: CalendarIntroScene.tsx

**Files:**
- Create: `src/scenes/CalendarIntroScene.tsx`
- Modify: `src/CalendarTutorial.tsx`

- [ ] **Step 1: Create `src/scenes/CalendarIntroScene.tsx`**

```typescript
// src/scenes/CalendarIntroScene.tsx
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

export const CalendarIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const badgeOpacity = interpolate(frame, [25, 38], [0, 1], { extrapolateRight: "clamp" });

  const titleP = spring({ frame: frame - 35, fps, config: { damping: 200 } });
  const titleY = interpolate(titleP, [0, 1], [30, 0]);
  const titleOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });

  const subtitleP = spring({ frame: frame - 50, fps, config: { damping: 200 } });
  const subtitleY = interpolate(subtitleP, [0, 1], [20, 0]);
  const subtitleOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
      padding: "0 80px",
    }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      <div style={{
        position: "absolute",
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(234,88,12,${0.06 + pulse * 0.03}) 0%, transparent 70%)`,
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      }} />

      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 56, height: 56, objectFit: "contain" }} />
        <span style={{ color: "white", fontSize: 28, fontWeight: 800, letterSpacing: 3 }}>PETRA</span>
      </div>

      <div style={{
        opacity: badgeOpacity,
        background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
        borderRadius: 20, padding: "6px 18px", marginBottom: 20,
      }}>
        <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>מדריך מהיר</span>
      </div>

      <h1 style={{
        color: "white", fontSize: 60, fontWeight: 800,
        margin: 0, marginBottom: 14, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.2,
      }}>
        יומן פטרה
      </h1>

      <p style={{
        color: "#94a3b8", fontSize: 20, fontWeight: 400,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        כל התורים, החזרות והזמינות — במקום אחד
      </p>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment import and wire Scene 1 in `src/CalendarTutorial.tsx`**

Uncomment:
```typescript
import { CalendarIntroScene } from "./scenes/CalendarIntroScene";
```

Replace the single placeholder `Series.Sequence` with:

```tsx
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <CalendarIntroScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-intro.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={week + add + recurring + availability + outro}>
          {/* placeholder for scenes 2–6 */}
          <AbsoluteFill style={{ background: "#f1f5f9" }} />
        </Series.Sequence>
      </Series>
```

Also remove the `eslint-disable` comment on the destructuring line — `intro` is now used; the others remain unused for now (keep the comment only if TS complains).

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -30
```

Expected: Only pre-existing errors.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/CalendarIntroScene.tsx src/CalendarTutorial.tsx
git commit -m "feat(calendar): add CalendarIntroScene"
```

---

### Task 5: CalendarWeekScene.tsx

**Files:**
- Create: `src/scenes/CalendarWeekScene.tsx`
- Modify: `src/CalendarTutorial.tsx`

- [ ] **Step 1: Create `src/scenes/CalendarWeekScene.tsx`**

```typescript
// src/scenes/CalendarWeekScene.tsx
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

const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const APPOINTMENTS = [
  { day: 0, startSlot: 1, color: ORANGE,    label: "אילוף", customer: "דנה לוי",   time: "09:00" },
  { day: 1, startSlot: 3, color: "#22c55e",  label: "גרומינג", customer: "יוסי כהן", time: "10:30" },
  { day: 2, startSlot: 7, color: "#3b82f6",  label: "אילוף", customer: "מירי לוי",  time: "14:00" },
  { day: 3, startSlot: 1, color: ORANGE,    label: "אילוף", customer: "רון אבן",    time: "09:00" },
  { day: 4, startSlot: 4, color: "#22c55e",  label: "גרומינג", customer: "שרה גל",  time: "11:00" },
];

const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

export const CalendarWeekScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const headerY = interpolate(headerP, [0, 1], [-16, 0]);
  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const calloutOpacity = interpolate(frame, [200, 216], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 200, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [14, 0]);

  const VIEW_TABS = ["יום", "שבוע", "חודש", "סדר יום"];

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="יומן" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header bar */}
        <div style={{
          height: 52, background: "white",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: 12,
          opacity: headerOpacity, transform: `translateY(${headerY}px)`,
        }}>
          {/* Nav arrows + date */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: 18, color: "#64748b", cursor: "pointer" }}>›</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>13–19 אפריל 2026</span>
            <span style={{ fontSize: 18, color: "#64748b", cursor: "pointer" }}>‹</span>
          </div>

          {/* View tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {VIEW_TABS.map((tab) => (
              <div key={tab} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: tab === "שבוע" ? ORANGE : "transparent",
                color: tab === "שבוע" ? "white" : "#64748b",
              }}>{tab}</div>
            ))}
          </div>

          {/* Add button */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 20, fontWeight: 400,
          }}>+</div>
        </div>

        {/* Calendar grid */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Day headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)",
            borderBottom: "1px solid #e2e8f0", background: "white",
          }}>
            <div />
            {DAY_LABELS.map((d, i) => (
              <div key={d} style={{
                padding: "8px 4px", textAlign: "center",
                fontSize: 12, fontWeight: 600,
                color: i === 6 ? "#cbd5e1" : "#64748b",
                borderRight: "1px solid #f1f5f9",
              }}>{d}</div>
            ))}
          </div>

          {/* Time grid */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {TIME_SLOTS.map((time, rowIdx) => (
              <div key={time} style={{
                display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)",
                borderBottom: "1px solid #f1f5f9",
                height: 44,
              }}>
                <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 6px", textAlign: "left" }}>{time}</div>
                {DAY_LABELS.map((_, colIdx) => (
                  <div key={colIdx} style={{
                    borderRight: "1px solid #f1f5f9",
                    background: colIdx === 6 ? "#fafafa" : "white",
                    position: "relative",
                  }}>
                    {/* Render appointment block if it starts at this slot/day */}
                    {APPOINTMENTS.filter(a => a.day === colIdx && a.startSlot === rowIdx).map((appt, ai) => {
                      const apptDelay = 25 + (appt.day * 8) + (ai * 5);
                      const apptOpacity = interpolate(frame, [apptDelay, apptDelay + 12], [0, 1], { extrapolateRight: "clamp" });
                      const apptP = spring({ frame: frame - apptDelay, fps, config: { damping: 180 } });
                      const apptY = interpolate(apptP, [0, 1], [8, 0]);
                      return (
                        <div key={ai} style={{
                          position: "absolute", inset: "2px 2px",
                          background: `${appt.color}20`,
                          border: `1.5px solid ${appt.color}`,
                          borderRadius: 6,
                          padding: "2px 5px",
                          opacity: apptOpacity,
                          transform: `translateY(${apptY}px)`,
                          overflow: "hidden",
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: appt.color }}>{appt.time} {appt.label}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{appt.customer}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Orange callout */}
        <div style={{
          margin: "0 16px 14px",
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12, padding: "11px 16px",
          opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            4 תצוגות — יום, שבוע, חודש, וסדר יום
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment import and wire Scene 2 in `src/CalendarTutorial.tsx`**

Uncomment:
```typescript
import { CalendarWeekScene } from "./scenes/CalendarWeekScene";
```

Split the placeholder for scenes 2–6:

```tsx
        <Series.Sequence durationInFrames={week} premountFor={fps}>
          <CalendarWeekScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-week.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={add + recurring + availability + outro}>
          {/* placeholder for scenes 3–6 */}
          <AbsoluteFill style={{ background: "#f1f5f9" }} />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/CalendarWeekScene.tsx src/CalendarTutorial.tsx
git commit -m "feat(calendar): add CalendarWeekScene"
```

---

### Task 6: CalendarAddScene.tsx

**Files:**
- Create: `src/scenes/CalendarAddScene.tsx`
- Modify: `src/CalendarTutorial.tsx`

- [ ] **Step 1: Create `src/scenes/CalendarAddScene.tsx`**

```typescript
// src/scenes/CalendarAddScene.tsx
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

const FIELDS = [
  { label: "לקוח", value: "דנה לוי" },
  { label: "שירות", value: "אילוף — 60 דק׳", highlight: true },
  { label: "תאריך", value: "14.04.2026" },
  { label: "שעה", value: "09:00" },
  { label: "הערות", value: "שיעור ראשון" },
];

export const CalendarAddScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Backdrop
  const backdropOpacity = interpolate(frame, [8, 22], [0, 0.4], { extrapolateRight: "clamp" });

  // Modal springs in
  const modalP = spring({ frame: frame - 18, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalP, [0, 1], [0.88, 1]);
  const modalOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });

  // New appointment block appears in background after "save"
  const newApptOpacity = interpolate(frame, [230, 248], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="יומן" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        overflow: "hidden",
      }}>
        {/* Calendar week background (simplified) */}
        <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.6 }} />

        {/* New appointment block appearing after save */}
        <div style={{
          position: "absolute",
          top: 110, right: 230,
          width: 120, padding: "6px 10px",
          background: `${ORANGE}20`,
          border: `1.5px solid ${ORANGE}`,
          borderRadius: 6,
          opacity: newApptOpacity,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE }}>09:00 אילוף</div>
          <div style={{ fontSize: 10, color: "#475569" }}>דנה לוי</div>
        </div>

        {/* Backdrop */}
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${backdropOpacity})`,
          zIndex: 2,
        }} />

        {/* Modal */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          zIndex: 3,
          background: "white",
          borderRadius: 18,
          padding: "28px 28px 24px",
          width: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          direction: "rtl",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>הוסף תור</div>

          {FIELDS.map((f, i) => {
            const delay = 28 + i * 10;
            const fOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={f.label} style={{ marginBottom: 12, opacity: fOpacity }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                <div style={{
                  border: f.highlight ? `2px solid ${ORANGE}` : "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "9px 13px",
                  background: f.highlight ? "rgba(234,88,12,0.04)" : "#fafafa",
                  fontSize: 14,
                  color: f.highlight ? ORANGE : "#0f172a",
                  fontWeight: f.highlight ? 700 : 400,
                }}>
                  {f.value}
                </div>
              </div>
            );
          })}

          <div style={{
            marginTop: 18,
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            borderRadius: 12, padding: "13px 0",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(234,88,12,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>שמור</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment import and wire Scene 3 in `src/CalendarTutorial.tsx`**

Uncomment:
```typescript
import { CalendarAddScene } from "./scenes/CalendarAddScene";
```

Split the placeholder for scenes 3–6:

```tsx
        <Series.Sequence durationInFrames={add} premountFor={fps}>
          <CalendarAddScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-add.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={recurring + availability + outro}>
          {/* placeholder for scenes 4–6 */}
          <AbsoluteFill style={{ background: "#f1f5f9" }} />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/CalendarAddScene.tsx src/CalendarTutorial.tsx
git commit -m "feat(calendar): add CalendarAddScene"
```

---

### Task 7: CalendarRecurringScene.tsx

**Files:**
- Create: `src/scenes/CalendarRecurringScene.tsx`
- Modify: `src/CalendarTutorial.tsx`

- [ ] **Step 1: Create `src/scenes/CalendarRecurringScene.tsx`**

```typescript
// src/scenes/CalendarRecurringScene.tsx
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

const FREQ_OPTIONS = [
  { label: "כל שבוע", selected: true },
  { label: "כל שבועיים", selected: false },
  { label: "כל חודש", selected: false },
];

export const CalendarRecurringScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const backdropOpacity = interpolate(frame, [5, 18], [0, 0.4], { extrapolateRight: "clamp" });

  const modalP = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalP, [0, 1], [0.92, 1]);
  const modalOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" });

  // Toggle animates to ON
  const toggleP = spring({ frame: frame - 55, fps, config: { damping: 200 } });
  const toggleX = interpolate(toggleP, [0, 1], [0, 18]);
  const toggleBg = interpolate(toggleP, [0, 1], [0, 1]);

  // Dropdown expands
  const dropdownP = spring({ frame: frame - 75, fps, config: { damping: 180 } });
  const dropdownHeight = interpolate(dropdownP, [0, 1], [0, 108]);
  const dropdownOpacity = interpolate(frame, [75, 90], [0, 1], { extrapolateRight: "clamp" });

  // Callout
  const calloutOpacity = interpolate(frame, [200, 216], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 200, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [14, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="יומן" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.6 }} />

        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${backdropOpacity})`,
          zIndex: 2,
        }} />

        {/* Modal */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          zIndex: 3,
          background: "white",
          borderRadius: 18,
          padding: "28px 28px 24px",
          width: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          direction: "rtl",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>הוסף תור</div>

          {/* Static fields (already filled) */}
          {[
            { label: "לקוח", value: "דנה לוי" },
            { label: "שירות", value: "אילוף — 60 דק׳" },
            { label: "תאריך", value: "14.04.2026" },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
              <div style={{
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                padding: "8px 12px", background: "#fafafa",
                fontSize: 13, color: "#0f172a",
              }}>{f.value}</div>
            </div>
          ))}

          {/* Recurring toggle row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 14, marginBottom: 10,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>חוזר</span>
            {/* Toggle pill */}
            <div style={{
              width: 44, height: 24, borderRadius: 12,
              background: toggleBg > 0.5 ? ORANGE : "#e2e8f0",
              position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute",
                top: 3, right: 3,
                width: 18, height: 18, borderRadius: "50%",
                background: "white",
                transform: `translateX(-${toggleX}px)`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              }} />
            </div>
          </div>

          {/* Frequency dropdown */}
          <div style={{
            height: dropdownHeight,
            overflow: "hidden",
            opacity: dropdownOpacity,
            marginBottom: 8,
          }}>
            <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              {FREQ_OPTIONS.map((opt, i) => (
                <div key={opt.label} style={{
                  padding: "10px 14px",
                  background: opt.selected ? "rgba(234,88,12,0.06)" : "white",
                  borderBottom: i < FREQ_OPTIONS.length - 1 ? "1px solid #f1f5f9" : "none",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, fontWeight: opt.selected ? 700 : 400, color: opt.selected ? ORANGE : "#475569" }}>{opt.label}</span>
                  {opt.selected && <span style={{ color: ORANGE, fontSize: 14 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            borderRadius: 12, padding: "12px 0",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(234,88,12,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>שמור</span>
          </div>
        </div>

        {/* Callout below modal area */}
        <div style={{
          position: "absolute",
          bottom: 24, left: 24, right: 24,
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12, padding: "12px 18px",
          opacity: calloutOpacity,
          transform: `translateY(${calloutY}px)`,
          zIndex: 4,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            קבעו סדרת תורים בבת אחת — שבועי, דו-שבועי, או חודשי
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment import and wire Scene 4 in `src/CalendarTutorial.tsx`**

Uncomment:
```typescript
import { CalendarRecurringScene } from "./scenes/CalendarRecurringScene";
```

Split the placeholder for scenes 4–6:

```tsx
        <Series.Sequence durationInFrames={recurring} premountFor={fps}>
          <CalendarRecurringScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-recurring.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={availability + outro}>
          {/* placeholder for scenes 5–6 */}
          <AbsoluteFill style={{ background: "#f1f5f9" }} />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/CalendarRecurringScene.tsx src/CalendarTutorial.tsx
git commit -m "feat(calendar): add CalendarRecurringScene"
```

---

### Task 8: CalendarAvailabilityScene.tsx

**Files:**
- Create: `src/scenes/CalendarAvailabilityScene.tsx`
- Modify: `src/CalendarTutorial.tsx`

- [ ] **Step 1: Create `src/scenes/CalendarAvailabilityScene.tsx`**

```typescript
// src/scenes/CalendarAvailabilityScene.tsx
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

const DAYS = [
  { name: "ראשון", open: "09:00", close: "18:00", active: true },
  { name: "שני",   open: "09:00", close: "18:00", active: true },
  { name: "שלישי", open: "09:00", close: "18:00", active: true },
  { name: "רביעי", open: "09:00", close: "18:00", active: true },
  { name: "חמישי", open: "09:00", close: "17:00", active: true },
  { name: "שישי",  open: "09:00", close: "13:00", active: true },
  { name: "שבת",   open: "—",     close: "—",     active: false },
];

export const CalendarAvailabilityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const headerY = interpolate(headerP, [0, 1], [-16, 0]);
  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const sectionOpacity = interpolate(frame, [18, 30], [0, 1], { extrapolateRight: "clamp" });

  // Block form slides in
  const blockP = spring({ frame: frame - 160, fps, config: { damping: 180 } });
  const blockY = interpolate(blockP, [0, 1], [24, 0]);
  const blockOpacity = interpolate(frame, [160, 178], [0, 1], { extrapolateRight: "clamp" });

  // Callout
  const calloutOpacity = interpolate(frame, [260, 276], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 260, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [14, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="הגדרות" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          height: 52, background: "white",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center",
          padding: "0 24px",
          opacity: headerOpacity, transform: `translateY(${headerY}px)`,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>זמינות</span>
        </div>

        <div style={{ flex: 1, padding: "20px 24px", overflow: "hidden", display: "flex", gap: 20 }}>
          {/* Left: working hours */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 12, opacity: sectionOpacity, textTransform: "uppercase", letterSpacing: 1 }}>
              שעות פעילות
            </div>
            <div style={{
              background: "white", borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}>
              {DAYS.map((day, i) => {
                const rowDelay = 28 + i * 12;
                const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 12], [0, 1], { extrapolateRight: "clamp" });
                const rowP = spring({ frame: frame - rowDelay, fps, config: { damping: 200 } });
                const rowY = interpolate(rowP, [0, 1], [8, 0]);
                return (
                  <div key={day.name} style={{
                    display: "flex", alignItems: "center",
                    padding: "11px 16px",
                    borderBottom: i < DAYS.length - 1 ? "1px solid #f1f5f9" : "none",
                    opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                    direction: "rtl",
                  }}>
                    <span style={{ width: 56, fontSize: 13, fontWeight: 600, color: day.active ? "#0f172a" : "#94a3b8" }}>{day.name}</span>
                    {day.active ? (
                      <>
                        <div style={{
                          border: "1.5px solid #e2e8f0", borderRadius: 8,
                          padding: "4px 10px", fontSize: 13, color: "#0f172a",
                          background: "#fafafa", marginLeft: "auto",
                        }}>{day.open}</div>
                        <span style={{ margin: "0 8px", color: "#94a3b8", fontSize: 12 }}>עד</span>
                        <div style={{
                          border: "1.5px solid #e2e8f0", borderRadius: 8,
                          padding: "4px 10px", fontSize: 13, color: "#0f172a",
                          background: "#fafafa",
                        }}>{day.close}</div>
                      </>
                    ) : (
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>סגור</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: block time */}
          <div style={{
            width: 240,
            opacity: blockOpacity,
            transform: `translateY(${blockY}px)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              חסימת זמן
            </div>
            <div style={{
              background: "white", borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              padding: "16px",
              direction: "rtl",
            }}>
              {[
                { label: "מ", value: "20.04.2026  09:00" },
                { label: "עד", value: "25.04.2026  18:00" },
                { label: "סיבה", value: "חופשה" },
              ].map((f) => (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
                  <div style={{
                    border: "1.5px solid #e2e8f0", borderRadius: 8,
                    padding: "7px 10px", fontSize: 13, color: "#0f172a", background: "#fafafa",
                  }}>{f.value}</div>
                </div>
              ))}
              <div style={{
                marginTop: 12,
                background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
                borderRadius: 10, padding: "10px 0",
                textAlign: "center",
              }}>
                <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>הוסף חסימה</span>
              </div>
            </div>
          </div>
        </div>

        {/* Orange callout */}
        <div style={{
          margin: "0 24px 16px",
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12, padding: "11px 16px",
          opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            חסמו ימי חופשה — הלקוחות לא יוכלו להזמין בזמן זה
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment import and wire Scene 5 in `src/CalendarTutorial.tsx`**

Uncomment:
```typescript
import { CalendarAvailabilityScene } from "./scenes/CalendarAvailabilityScene";
```

Split the placeholder for scenes 5–6:

```tsx
        <Series.Sequence durationInFrames={availability} premountFor={fps}>
          <CalendarAvailabilityScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-availability.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro}>
          {/* placeholder for scene 6 */}
          <AbsoluteFill style={{ background: "#0f172a" }} />
        </Series.Sequence>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/CalendarAvailabilityScene.tsx src/CalendarTutorial.tsx
git commit -m "feat(calendar): add CalendarAvailabilityScene"
```

---

### Task 9: CalendarOutroScene.tsx + Final Wiring

**Files:**
- Create: `src/scenes/CalendarOutroScene.tsx`
- Modify: `src/CalendarTutorial.tsx`

- [ ] **Step 1: Create `src/scenes/CalendarOutroScene.tsx`**

```typescript
// src/scenes/CalendarOutroScene.tsx
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
  { text: "4 תצוגות יומן" },
  { text: "תורים חוזרים" },
  { text: "ניהול זמינות" },
];

export const CalendarOutroScene: React.FC = () => {
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
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, marginBottom: 28 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 80, height: 80, objectFit: "contain" }} />
      </div>

      <h1 style={{
        color: "white", fontSize: 44, fontWeight: 800,
        margin: 0, marginBottom: 8, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.2,
      }}>
        יומן פטרה
      </h1>
      <p style={{
        color: "white", fontSize: 20, fontWeight: 700,
        margin: 0, marginBottom: 32, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
      }}>
        הזמן שלכם, בשליטה שלכם
      </p>

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

      <div style={{
        background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
        borderRadius: 16, padding: "16px 48px",
        opacity: ctaOpacity, transform: `scale(${ctaScale})`,
        boxShadow: "0 8px 32px rgba(234,88,12,0.45)",
        display: "flex", alignItems: "center", gap: 12,
        direction: "rtl",
      }}>
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>נסו עכשיו</span>
        <span style={{ color: "white", fontSize: 20 }}>←</span>
      </div>

      <div style={{ marginTop: 18, opacity: urlOpacity }}>
        <span style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>petra-app.com</span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Final wiring of `src/CalendarTutorial.tsx`**

Uncomment:
```typescript
import { CalendarOutroScene } from "./scenes/CalendarOutroScene";
```

Replace the final `outro` placeholder with:

```tsx
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <CalendarOutroScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-outro.wav")} /></Sequence>
        </Series.Sequence>
```

Remove the `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment from the destructuring line — all 6 variables are now used.

The final `Series` block must have exactly 6 `Series.Sequence` entries: intro, week, add, recurring, availability, outro.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | head -40
```

Expected: Only pre-existing errors (TeaserVideoLong/Short). Zero new errors. If new errors appear, fix them before committing.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/CalendarOutroScene.tsx src/CalendarTutorial.tsx
git commit -m "feat(calendar): add CalendarOutroScene + wire all scenes"
```

---

## Self-Review

**Spec coverage:**
- ✅ Scene 1 intro — Task 4
- ✅ Scene 2 weekly view with appointment blocks + callout — Task 5
- ✅ Scene 3 add appointment modal — Task 6
- ✅ Scene 4 recurring toggle + dropdown — Task 7
- ✅ Scene 5 working hours table + block time form — Task 8
- ✅ Scene 6 outro + 3 benefit pills + CTA — Task 9
- ✅ voiceover config + generator + WAVs — Tasks 1–2
- ✅ Root.tsx registration — Task 3
- ✅ activeLabel "יומן" on scenes 2–4, "הגדרות" on scene 5

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:** `CalendarTutorialProps`, `calculateCalendarMetadata`, `PetraCalendarTutorial` — all consistent across Tasks 3 and 9. `CALENDAR_SCENES` used in both Task 1 (definition) and Task 3 (consumption). `[intro, week, add, recurring, availability, outro]` destructuring matches the 6 scenes in Task 9 wiring.
