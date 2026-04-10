# Petra Booking Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 7-scene Hebrew Remotion tutorial video for Petra's online booking feature (~108s total).

**Architecture:** Follows identical structure to TasksTutorial/SettingsTutorial — voiceover config → generator script → scene components → main composition → Root registration. Customer-facing scenes (2, 3) have no sidebar (full 1280px width). Business-facing scenes (4, 5) use the existing PetraSidebar and SettingsTabsBar components. Notification and dark scenes (1, 6, 7) use no sidebar.

**Tech Stack:** Remotion 4.x, React, TypeScript, Google Gemini 2.5 TTS, `tsx` (Node 22 with `--strip-types`), existing `CursorOverlay`, `PetraSidebar`, `SettingsTabsBar` components.

---

## File Map

| Action | Path |
|--------|------|
| Create | `voiceover-booking-config.ts` |
| Create | `generate-voiceover-booking.ts` |
| Create | `src/BookingTutorial.tsx` |
| Modify | `src/Root.tsx` |
| Create | `src/scenes/BookingIntroScene.tsx` |
| Create | `src/scenes/BookingCustomerFlowScene.tsx` |
| Create | `src/scenes/BookingCustomerDetailsScene.tsx` |
| Create | `src/scenes/BookingSetupScene.tsx` |
| Create | `src/scenes/BookingLinkScene.tsx` |
| Create | `src/scenes/BookingNotificationsScene.tsx` |
| Create | `src/scenes/BookingOutroScene.tsx` |
| Output | `public/voiceover/booking-intro.wav` |
| Output | `public/voiceover/booking-customer-flow.wav` |
| Output | `public/voiceover/booking-customer-details.wav` |
| Output | `public/voiceover/booking-setup.wav` |
| Output | `public/voiceover/booking-link.wav` |
| Output | `public/voiceover/booking-notifications.wav` |
| Output | `public/voiceover/booking-outro.wav` |

---

## Task 1: Voiceover Config

**Files:**
- Create: `voiceover-booking-config.ts`

- [ ] **Step 1: Create voiceover config**

```typescript
// voiceover-booking-config.ts
export const BOOKING_SCENES = [
  {
    id: "booking-intro",
    text: "הלקוחות שולחים הודעת וואטסאפ לקבוע תור — אתם עונים, מתאמים, ומאשרים. ועוד אחד. ועוד אחד. עם הזמנות אונליין של פטרה, הלקוח קובע לבד — עשרים וארבע שבע, בלי לחכות לתשובה.",
    defaultDurationSec: 14,
  },
  {
    id: "booking-customer-flow",
    text: "הלקוח נכנס לעמוד ההזמנה, בוחר את השירות שמתאים לו, בוחר תאריך מהיומן — ורואה את השעות הפנויות בלבד. בחירה אחת, ומגיעים לשלב הפרטים.",
    defaultDurationSec: 18,
  },
  {
    id: "booking-customer-details",
    text: "הלקוח ממלא שם וטלפון, בוחר את הכלב שלו — ומגיע למסך האישור עם סיכום ההזמנה. לחיצה אחת — ותור נקבע.",
    defaultDurationSec: 18,
  },
  {
    id: "booking-setup",
    text: "בהגדרות, תוכלו לקבוע שעות פתיחה לכל יום בשבוע — ולחסום תאריכים ספציפיים לחגים ולחופשות. הלקוחות יראו רק את הזמנים הפנויים באמת.",
    defaultDurationSec: 18,
  },
  {
    id: "booking-link",
    text: "לכל עסק יש לינק ייחודי להזמנות. תעתיקו אותו ותשתפו — בביו אינסטגרם, בחתימת וואטסאפ, בדף הפייסבוק. כל לחיצה מביאה לקוח ישירות לעמוד ההזמנה שלכם.",
    defaultDurationSec: 14,
  },
  {
    id: "booking-notifications",
    text: "ברגע שהלקוח אישר — אתם מקבלים הודעת וואטסאפ עם כל הפרטים, ואירוע נוצר אוטומטית ב-Google Calendar. אין צורך לרשום דבר בעצמכם.",
    defaultDurationSec: 16,
  },
  {
    id: "booking-outro",
    text: "הזמנות אונליין של פטרה — פחות תיאום, יותר זמן לעסק. התחילו בחינם.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add voiceover-booking-config.ts
git commit -m "feat(booking-tutorial): add voiceover config for 7 scenes"
```

---

## Task 2: Voiceover Generator Script

**Files:**
- Create: `generate-voiceover-booking.ts`

- [ ] **Step 1: Create generator script**

```typescript
/**
 * Generates Hebrew voiceover for the Booking tutorial using Google Gemini 2.5 TTS.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover-booking.ts
 *
 * Output: public/voiceover/booking-{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { BOOKING_SCENES } from "./voiceover-booking-config.js";

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
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover-booking.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📦 Petra Booking Tutorial Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < BOOKING_SCENES.length; i++) {
    const scene = BOOKING_SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    if (i < BOOKING_SCENES.length - 1) {
      const next = BOOKING_SCENES[i + 1];
      if (!existsSync(`${OUTPUT_DIR}/${next.id}.wav`)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! WAVs saved to public/voiceover/booking-*.wav`);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
```

- [ ] **Step 2: Run the generator** (requires GEMINI_KEY)

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
GEMINI_KEY=YOUR_KEY_HERE PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-booking.ts
```

Expected: 7 WAV files created in `public/voiceover/booking-*.wav`. Each line shows ✅ with duration in seconds.

- [ ] **Step 3: Commit**

```bash
git add generate-voiceover-booking.ts public/voiceover/booking-*.wav
git commit -m "feat(booking-tutorial): add voiceover generator + generated WAVs"
```

---

## Task 3: Main Composition + Root Registration

**Files:**
- Create: `src/BookingTutorial.tsx`
- Modify: `src/Root.tsx`

- [ ] **Step 1: Create BookingTutorial.tsx**

```typescript
// src/BookingTutorial.tsx
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
import { BookingIntroScene } from "./scenes/BookingIntroScene";
import { BookingCustomerFlowScene } from "./scenes/BookingCustomerFlowScene";
import { BookingCustomerDetailsScene } from "./scenes/BookingCustomerDetailsScene";
import { BookingSetupScene } from "./scenes/BookingSetupScene";
import { BookingLinkScene } from "./scenes/BookingLinkScene";
import { BookingNotificationsScene } from "./scenes/BookingNotificationsScene";
import { BookingOutroScene } from "./scenes/BookingOutroScene";
import { BOOKING_SCENES } from "../voiceover-booking-config";

export type BookingTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = BOOKING_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = BOOKING_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateBookingMetadata: CalculateMetadataFunction<BookingTutorialProps> =
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

const SceneAudio: React.FC<{ file: string }> = ({ file }) => (
  <Sequence layout="none">
    <Audio src={staticFile(file)} />
  </Sequence>
);

export const BookingTutorial: React.FC<BookingTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, customerFlow, customerDetails, setup, link, notifications, outro] =
    sceneDurationsFrames;

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
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <BookingIntroScene />
          <SceneAudio file="voiceover/booking-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={customerFlow} premountFor={fps}>
          <BookingCustomerFlowScene />
          <SceneAudio file="voiceover/booking-customer-flow.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={customerDetails} premountFor={fps}>
          <BookingCustomerDetailsScene />
          <SceneAudio file="voiceover/booking-customer-details.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={setup} premountFor={fps}>
          <BookingSetupScene />
          <SceneAudio file="voiceover/booking-setup.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={link} premountFor={fps}>
          <BookingLinkScene />
          <SceneAudio file="voiceover/booking-link.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={notifications} premountFor={fps}>
          <BookingNotificationsScene />
          <SceneAudio file="voiceover/booking-notifications.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <BookingOutroScene />
          <SceneAudio file="voiceover/booking-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Register in Root.tsx** — add after the `PetraTasksTutorial` composition block (before the closing `</>`):

```typescript
// Add these imports at the top of src/Root.tsx alongside the other imports:
import {
  BookingTutorial,
  BookingTutorialProps,
  calculateBookingMetadata,
} from "./BookingTutorial";
import { BOOKING_SCENES } from "../voiceover-booking-config";

// Add this constant alongside the other defaultProps constants:
const bookingDefaultProps: BookingTutorialProps = {
  sceneDurationsFrames: BOOKING_SCENES.map((s) => s.defaultDurationSec * FPS),
};

// Add this Composition inside RemotionRoot's return, after PetraTasksTutorial:
<Composition
  id="PetraBookingTutorial"
  component={BookingTutorial}
  calculateMetadata={calculateBookingMetadata}
  durationInFrames={
    BOOKING_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
  }
  fps={FPS}
  width={1280}
  height={720}
  defaultProps={bookingDefaultProps}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors. (Scene files don't exist yet — comment out the 7 scene imports in BookingTutorial.tsx temporarily if needed, then restore after scenes are built.)

- [ ] **Step 4: Commit**

```bash
git add src/BookingTutorial.tsx src/Root.tsx
git commit -m "feat(booking-tutorial): add main composition and Root registration"
```

---

## Task 4: BookingIntroScene

**Files:**
- Create: `src/scenes/BookingIntroScene.tsx`

This is a dark intro scene matching the Tasks/Settings intro pattern. Three text lines slide in staggered, then cross-fade to an "הזמנות אונליין" badge screen.

- [ ] **Step 1: Create BookingIntroScene.tsx**

```typescript
// src/scenes/BookingIntroScene.tsx
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

// Phase 1: 0-130 — chaos lines slide in
// Phase 2: 130-end — badge + subtitle (cross-fade)
const PHASE2_START = 130;

export const BookingIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);

  // Phase 1 lines (slide in from right in RTL direction = slide in from left in CSS)
  const line1P = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const line1X = interpolate(line1P, [0, 1], [-60, 0]);
  const line1Opacity = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });

  const line2P = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const line2X = interpolate(line2P, [0, 1], [-60, 0]);
  const line2Opacity = interpolate(frame, [30, 44], [0, 1], { extrapolateRight: "clamp" });

  const line3P = spring({ frame: frame - 55, fps, config: { damping: 200 } });
  const line3X = interpolate(line3P, [0, 1], [-60, 0]);
  const line3Opacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });

  // Cross-fade between phase 1 and phase 2
  const phase1Opacity = interpolate(frame, [PHASE2_START - 15, PHASE2_START], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phase2Opacity = interpolate(frame, [PHASE2_START - 5, PHASE2_START + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 2 elements
  const badgeP = spring({ frame: frame - PHASE2_START, fps, config: { damping: 200 } });
  const badgeScale = interpolate(badgeP, [0, 1], [0.8, 1]);
  const subtitleOpacity = interpolate(frame, [PHASE2_START + 20, PHASE2_START + 35], [0, 1], { extrapolateRight: "clamp" });

  // Logo bottom-right
  const logoOpacity = interpolate(frame, [PHASE2_START + 25, PHASE2_START + 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0c1422 100%)",
      fontFamily: FONT,
      direction: "rtl",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: "25%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 500,
        background: `radial-gradient(ellipse, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 65%)`,
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

      {/* Phase 1 — Chaos lines */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, opacity: phase1Opacity,
      }}>
        <div style={{
          color: "white", fontSize: 44, fontWeight: 800,
          opacity: line1Opacity, transform: `translateX(${line1X}px)`,
          textAlign: "center",
        }}>
          הלקוח שולח הודעה
        </div>
        <div style={{
          color: "#94a3b8", fontSize: 28, fontWeight: 600,
          opacity: line2Opacity, transform: `translateX(${line2X}px)`,
          textAlign: "center",
        }}>
          אתם עונים, מתאמים, ומאשרים...
        </div>
        <div style={{
          color: "#ef4444", fontSize: 28, fontWeight: 700,
          opacity: line3Opacity, transform: `translateX(${line3X}px)`,
          textAlign: "center",
        }}>
          ועוד אחד. ועוד אחד.
        </div>
      </div>

      {/* Phase 2 — Solution badge */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, opacity: phase2Opacity,
      }}>
        <div style={{
          transform: `scale(${badgeScale})`,
          background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
          borderRadius: 16, padding: "14px 36px",
          boxShadow: "0 8px 32px rgba(234,88,12,0.4)",
        }}>
          <span style={{ color: "white", fontSize: 36, fontWeight: 800 }}>הזמנות אונליין</span>
        </div>
        <div style={{
          color: "#94a3b8", fontSize: 22, fontWeight: 600,
          opacity: subtitleOpacity, textAlign: "center",
        }}>
          לקוחות קובעים לבד — עשרים וארבע שבע
        </div>
      </div>

      {/* Petra logo bottom-right */}
      <div style={{
        position: "absolute", bottom: 28, left: 32,
        display: "flex", alignItems: "center", gap: 8,
        opacity: logoOpacity,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600 }}>PETRA</span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingIntroScene.tsx
git commit -m "feat(booking-tutorial): add BookingIntroScene (dark intro, chaos→badge)"
```

---

## Task 5: BookingCustomerFlowScene

**Files:**
- Create: `src/scenes/BookingCustomerFlowScene.tsx`

No sidebar. Full 1280×720. White background. Shows public booking page: header, step indicator, service cards, calendar, time slots. Cursor interacts with all three areas.

- [ ] **Step 1: Create BookingCustomerFlowScene.tsx**

```typescript
// src/scenes/BookingCustomerFlowScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

// Timeline (18s = 540 frames)
// 0-70:  service cards visible, cursor selects "טיפול ורחצה"
// 70-200: calendar fades in, cursor selects date
// 200-360: time slots visible, cursor clicks "11:00"
// 360-540: hold selected state

const CARD_CLICK    = 70;   // "טיפול ורחצה" selected
const CAL_VISIBLE   = 80;   // calendar section fades in
const DATE_CLICK    = 190;  // date selected
const SLOTS_VISIBLE = 210;  // time slots fade in
const SLOT_CLICK    = 290;  // "11:00" selected

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,          x: 640,  y: 360 },
  { frame: 50,         x: 400,  y: 300 },
  { frame: CARD_CLICK, x: 280,  y: 280, action: "click" },
  { frame: 100,        x: 640,  y: 420 },
  { frame: DATE_CLICK, x: 700,  y: 440, action: "click" },
  { frame: 230,        x: 400,  y: 560 },
  { frame: SLOT_CLICK, x: 340,  y: 560, action: "click" },
];

const SERVICES = [
  { name: "טיפול ורחצה",  price: "₪150", duration: "45 דקות", icon: "✂️" },
  { name: "פנסיון יומי",  price: "₪120", duration: "ביום",    icon: "🏠" },
  { name: "אילוף פרטי",   price: "₪250", duration: "60 דקות", icon: "🐾" },
  { name: "הליכה",        price: "₪80",  duration: "30 דקות", icon: "🦮" },
];

const CALENDAR_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
// 5-week grid for May 2026: first day Sun=3 (0-indexed), so offset 3
const AVAILABLE_DATES = [5, 6, 7, 11, 12, 13, 14, 18, 19, 20, 21, 25, 26, 27, 28];
const SELECTED_DATE = 11;
const CAL_OFFSET = 4; // May 1 falls on Friday (5th column 0-indexed), adjust as needed
// Simplified: 5 rows × 7 cols, starting from col 4 for May 1
const CAL_DATES: (number | null)[] = [
  null, null, null, null, 1, 2, 3,
  4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31,
];

const TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "16:00"];
const BUSY_SLOTS = ["10:00"];

export const BookingCustomerFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const serviceSelected = frame >= CARD_CLICK;
  const dateSelected = frame >= DATE_CLICK;
  const slotSelected = frame >= SLOT_CLICK;

  const calOpacity = interpolate(frame, [CAL_VISIBLE, CAL_VISIBLE + 20], [0, 1], { extrapolateRight: "clamp" });
  const slotsOpacity = interpolate(frame, [SLOTS_VISIBLE, SLOTS_VISIBLE + 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "white",
      fontFamily: FONT,
      direction: "rtl",
      opacity,
    }}>
      {/* Orange top border */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ORANGE }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 4, left: 0, right: 0, height: 56,
        background: "white", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>פנסיון כלבים שמח</span>
        <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", borderRadius: 6, padding: "3px 10px" }}>מופעל ע״י Petra</span>
      </div>

      {/* Step indicator */}
      <div style={{
        position: "absolute", top: 60, left: 0, right: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        borderBottom: "1px solid #f1f5f9",
      }}>
        {[1, 2, 3].map((step) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: step === 1 ? ORANGE : "#e2e8f0",
              color: step === 1 ? "white" : "#94a3b8",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{step}</div>
            {step < 3 && <div style={{ width: 40, height: 2, background: "#e2e8f0" }} />}
          </div>
        ))}
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>שלב 1 מתוך 3</span>
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", top: 104, left: 0, right: 0, bottom: 0, overflowY: "hidden", padding: "20px 80px" }}>

        {/* Service cards */}
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>בחר שירות</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          {SERVICES.map((svc, i) => {
            const isSelected = serviceSelected && svc.name === "טיפול ורחצה";
            const cardP = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 200 } });
            const cardOpacity = interpolate(frame, [10 + i * 8, 22 + i * 8], [0, 1], { extrapolateRight: "clamp" });
            const cardY = interpolate(cardP, [0, 1], [12, 0]);
            return (
              <div key={svc.name} style={{
                background: isSelected ? "rgba(234,88,12,0.06)" : "white",
                border: `2px solid ${isSelected ? ORANGE : "#e2e8f0"}`,
                borderRadius: 12, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
                opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 28 }}>{svc.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{svc.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{svc.duration} · {svc.price}</div>
                </div>
                {isSelected && (
                  <div style={{ marginRight: "auto", color: ORANGE, fontSize: 18, fontWeight: 800 }}>✓</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar */}
        <div style={{ opacity: calOpacity }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>בחר תאריך — מאי 2026</div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fafafa", display: "inline-block", marginBottom: 20 }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: 4, marginBottom: 8 }}>
              {CALENDAR_DAYS.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{d}</div>
              ))}
            </div>
            {/* Date grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: 4 }}>
              {CAL_DATES.map((date, i) => {
                if (!date) return <div key={i} />;
                const isAvail = AVAILABLE_DATES.includes(date);
                const isSel = dateSelected && date === SELECTED_DATE;
                return (
                  <div key={i} style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isSel ? ORANGE : isAvail ? "rgba(234,88,12,0.1)" : "transparent",
                    color: isSel ? "white" : isAvail ? ORANGE : "#cbd5e1",
                    fontSize: 12, fontWeight: isSel || isAvail ? 700 : 400,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: isAvail ? "pointer" : "default",
                  }}>
                    {date}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Time slots */}
        <div style={{ opacity: slotsOpacity }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>בחר שעה</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TIME_SLOTS.map((slot) => {
              const isBusy = BUSY_SLOTS.includes(slot);
              const isSel = slotSelected && slot === "11:00";
              return (
                <div key={slot} style={{
                  padding: "10px 20px", borderRadius: 10,
                  border: `2px solid ${isSel ? ORANGE : isBusy ? "#e2e8f0" : "#e2e8f0"}`,
                  background: isSel ? ORANGE : isBusy ? "#f8fafc" : "white",
                  color: isSel ? "white" : isBusy ? "#cbd5e1" : "#0f172a",
                  fontSize: 14, fontWeight: 700,
                  textDecoration: isBusy ? "line-through" : "none",
                  cursor: isBusy ? "default" : "pointer",
                }}>
                  {slot}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingCustomerFlowScene.tsx
git commit -m "feat(booking-tutorial): add BookingCustomerFlowScene (service+date+time)"
```

---

## Task 6: BookingCustomerDetailsScene

**Files:**
- Create: `src/scenes/BookingCustomerDetailsScene.tsx`

No sidebar. Shows: customer form with typewriter, dog card selection, confirm screen, done screen.

- [ ] **Step 1: Create BookingCustomerDetailsScene.tsx**

```typescript
// src/scenes/BookingCustomerDetailsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

// Timeline (18s = 540 frames)
const DOG_CLICK     = 180;  // dog card checkbox clicked
const CONFIRM_START = 230;  // confirm screen fades in
const CONFIRM_CLICK = 340;  // "אשר הזמנה" clicked
const DONE_START    = 355;  // done screen fades in

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,            x: 640, y: 360 },
  { frame: 25,           x: 640, y: 260 },
  { frame: 35,           x: 640, y: 260, action: "click" },
  { frame: 160,          x: 400, y: 420 },
  { frame: DOG_CLICK,    x: 390, y: 420, action: "click" },
  { frame: 310,          x: 640, y: 560 },
  { frame: CONFIRM_CLICK,x: 640, y: 560, action: "click" },
];

// Typewriter for name: frame 35-110 (75 frames = 2.5s for 8 chars)
const NAME_FULL = "ענבל כהן";
const PHONE_FULL = "054-321-1234";

function typewriter(full: string, startFrame: number, fps: number, frame: number): string {
  const charsPerSec = 4;
  const elapsed = Math.max(0, frame - startFrame) / fps;
  const charsVisible = Math.floor(elapsed * charsPerSec * fps / fps * charsPerSec);
  return full.slice(0, Math.min(charsVisible, full.length));
}

export const BookingCustomerDetailsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const nameText = typewriter(NAME_FULL, 35, fps, frame);
  const phoneText = typewriter(PHONE_FULL, 110, fps, frame);

  const dogChecked = frame >= DOG_CLICK;

  const confirmOpacity = interpolate(frame, [CONFIRM_START, CONFIRM_START + 20], [0, 1], { extrapolateRight: "clamp" });
  const confirmP = spring({ frame: frame - CONFIRM_START, fps, config: { damping: 200 } });
  const confirmY = interpolate(confirmP, [0, 1], [20, 0]);

  const formOpacity = interpolate(frame, [CONFIRM_START - 10, CONFIRM_START + 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const doneOpacity = interpolate(frame, [DONE_START, DONE_START + 20], [0, 1], { extrapolateRight: "clamp" });
  const doneP = spring({ frame: frame - DONE_START, fps, config: { damping: 200 } });
  const doneScale = interpolate(doneP, [0, 1], [0.7, 1]);

  return (
    <AbsoluteFill style={{
      background: "white",
      fontFamily: FONT,
      direction: "rtl",
      opacity,
    }}>
      {/* Orange top border */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ORANGE }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 4, left: 0, right: 0, height: 56,
        background: "white", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>פנסיון כלבים שמח</span>
      </div>

      {/* Step indicator — step 2 */}
      <div style={{
        position: "absolute", top: 60, left: 0, right: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        borderBottom: "1px solid #f1f5f9",
      }}>
        {[1, 2, 3].map((step) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: step <= 2 ? ORANGE : "#e2e8f0",
              color: step <= 2 ? "white" : "#94a3b8",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {step === 1 ? "✓" : step}
            </div>
            {step < 3 && <div style={{ width: 40, height: 2, background: step < 2 ? ORANGE : "#e2e8f0" }} />}
          </div>
        ))}
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>שלב 2 מתוך 3</span>
      </div>

      {/* Customer form */}
      {frame < DONE_START && (
        <div style={{
          position: "absolute", top: 104, left: 0, right: 0, bottom: 0,
          padding: "24px 80px", opacity: formOpacity,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>פרטים אישיים</div>

          {/* Name field */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>שם מלא</div>
            <div style={{
              border: `2px solid ${nameText ? ORANGE : "#e2e8f0"}`,
              borderRadius: 10, padding: "10px 14px",
              fontSize: 15, color: "#0f172a", minHeight: 42,
              background: "white", display: "flex", alignItems: "center",
            }}>
              {nameText}
              {nameText.length < NAME_FULL.length && <span style={{ opacity: 0.5 }}>|</span>}
            </div>
          </div>

          {/* Phone field */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>טלפון</div>
            <div style={{
              border: `2px solid ${phoneText ? ORANGE : "#e2e8f0"}`,
              borderRadius: 10, padding: "10px 14px",
              fontSize: 15, color: "#0f172a", minHeight: 42,
              background: "white", display: "flex", alignItems: "center",
            }}>
              {phoneText}
            </div>
          </div>

          {/* Dog section */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>הכלבים שלך</div>
          <div style={{
            border: `2px solid ${dogChecked ? ORANGE : "#e2e8f0"}`,
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
            background: dogChecked ? "rgba(234,88,12,0.04)" : "white",
            marginBottom: 12,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6,
              border: `2px solid ${dogChecked ? ORANGE : "#cbd5e1"}`,
              background: dogChecked ? ORANGE : "white",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {dogChecked && <span style={{ color: "white", fontSize: 13, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>מקס</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>לברדור · ♂</div>
            </div>
          </div>
          <div style={{
            border: "1.5px dashed #e2e8f0", borderRadius: 10,
            padding: "10px 14px", color: "#64748b", fontSize: 13, fontWeight: 600,
            cursor: "pointer", textAlign: "center",
          }}>
            + כלב חדש
          </div>
        </div>
      )}

      {/* Confirm screen */}
      {frame >= CONFIRM_START && frame < DONE_START && (
        <div style={{
          position: "absolute", top: 104, left: 0, right: 0, bottom: 0,
          padding: "24px 80px",
          opacity: confirmOpacity, transform: `translateY(${confirmY}px)`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>אישור הזמנה</div>

          {/* Summary card */}
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 16,
            padding: "20px 24px", background: "#fafafa", marginBottom: 20,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "שירות",    value: "טיפול ורחצה" },
                { label: "תאריך",    value: "11.05.2026" },
                { label: "שעה",      value: "11:00 – 11:45" },
                { label: "כלב",      value: "מקס (לברדור)" },
                { label: "מחיר",     value: "₪150" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 20, textAlign: "center" }}>
            ניתן לבטל עד 24 שעות לפני התור
          </div>

          {/* CTA button */}
          <div style={{
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            borderRadius: 14, padding: "15px",
            textAlign: "center", cursor: "pointer",
            boxShadow: "0 6px 24px rgba(234,88,12,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 16, fontWeight: 800 }}>אשר הזמנה</span>
          </div>
        </div>
      )}

      {/* Done screen */}
      {frame >= DONE_START && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, background: "white",
          opacity: doneOpacity, transform: `scale(${doneScale})`,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "#dcfce7",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 40 }}>✅</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>תורך נקבע!</div>
          <div style={{ fontSize: 16, color: "#64748b" }}>נשמח לראות אותך ב-11.05 בשעה 11:00</div>
        </div>
      )}

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingCustomerDetailsScene.tsx
git commit -m "feat(booking-tutorial): add BookingCustomerDetailsScene (form+dog+confirm+done)"
```

---

## Task 7: BookingSetupScene

**Files:**
- Create: `src/scenes/BookingSetupScene.tsx`

Full Petra app with sidebar. "הגדרות" active. Settings page, "הזמנות" tab. Weekly schedule rows + Saturday toggle off + blocked dates + modal.

- [ ] **Step 1: Create BookingSetupScene.tsx**

```typescript
// src/scenes/BookingSetupScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { SettingsTabsBar } from "./SettingsTabsBar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// Timeline (18s = 540 frames)
const SAT_TOGGLE   = 190;  // שבת toggle clicked (shows it's off)
const BLOCK_CLICK  = 290;  // "+ הוסף חסימה" clicked
const MODAL_OPEN   = 305;  // modal appears
const SAVE_CLICK   = 410;  // "שמור" clicked
const MODAL_CLOSE  = 425;  // modal closes
const BLOCK_ADDED  = 440;  // new block appears in list

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,          x: 600,  y: 300 },
  { frame: 60,         x: 920,  y: 53  },
  { frame: 70,         x: 920,  y: 53,  action: "click" },
  { frame: 150,        x: 500,  y: 328 },
  { frame: SAT_TOGGLE, x: 490,  y: 328, action: "click" },
  { frame: 250,        x: 200,  y: 478 },
  { frame: BLOCK_CLICK,x: 200,  y: 478, action: "click" },
  { frame: 390,        x: 640,  y: 510 },
  { frame: SAVE_CLICK, x: 640,  y: 510, action: "click" },
];

const WEEK_DAYS = [
  { name: "ראשון", hours: "09:00–18:00", on: true },
  { name: "שני",   hours: "09:00–18:00", on: true },
  { name: "שלישי", hours: "09:00–18:00", on: true },
  { name: "רביעי", hours: "09:00–18:00", on: true },
  { name: "חמישי", hours: "09:00–18:00", on: true },
  { name: "שישי",  hours: "09:00–14:00", on: true },
  { name: "שבת",   hours: "סגור",        on: false },
];

export const BookingSetupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const satOn = frame < SAT_TOGGLE; // Saturday starts as on, gets toggled off
  const modalOpacity = interpolate(frame, [MODAL_OPEN, MODAL_OPEN + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    * interpolate(frame, [MODAL_CLOSE, MODAL_CLOSE + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const modalP = spring({ frame: frame - MODAL_OPEN, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalP, [0, 1], [0.93, 1]);
  const newBlockOpacity = interpolate(frame, [BLOCK_ADDED, BLOCK_ADDED + 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</div>
        </div>

        {/* Tab bar */}
        <div style={{ opacity: headerOpacity }}>
          <SettingsTabsBar activeTab="הזמנות" />
        </div>

        {/* Content */}
        <div style={{ padding: "20px 28px", opacity: headerOpacity }}>

          {/* Section: Weekly hours */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>שעות פתיחה</div>
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
            overflow: "hidden", marginBottom: 24,
          }}>
            {WEEK_DAYS.map((day, i) => {
              const rowOpacity = interpolate(frame, [12 + i * 7, 22 + i * 7], [0, 1], { extrapolateRight: "clamp" });
              const isSat = day.name === "שבת";
              const isOn = isSat ? satOn : day.on;
              return (
                <div key={day.name} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "12px 18px",
                  borderBottom: i < WEEK_DAYS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                }}>
                  {/* Toggle */}
                  <div style={{
                    width: 36, height: 20, borderRadius: 99,
                    background: isOn ? ORANGE : "#cbd5e1",
                    position: "relative", flexShrink: 0, cursor: "pointer",
                    transition: "background 0.2s",
                  }}>
                    <div style={{
                      position: "absolute", top: 2,
                      left: isOn ? 18 : 2,
                      width: 16, height: 16, borderRadius: "50%", background: "white",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", width: 52 }}>{day.name}</span>
                  <span style={{ fontSize: 12, color: isOn ? "#64748b" : "#cbd5e1", flex: 1 }}>
                    {isOn ? day.hours : "סגור"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Section: Blocked dates */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>חסימת תאריכים</div>
            <div style={{
              background: ORANGE, color: "white", borderRadius: 8,
              padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              + הוסף חסימה
            </div>
          </div>
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}>
            {/* Existing block */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
              borderBottom: frame >= BLOCK_ADDED ? "1px solid #f1f5f9" : "none",
              opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" }),
            }}>
              <span style={{ fontSize: 18 }}>🚫</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>25.04–28.04</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>חופשת פסח</div>
              </div>
            </div>
            {/* New block added after save */}
            {frame >= BLOCK_ADDED && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                opacity: newBlockOpacity,
              }}>
                <span style={{ fontSize: 18 }}>🚫</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>01.05–02.05</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>יום העצמאות</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add block modal */}
      {modalOpacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${modalOpacity * 0.4})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 80,
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: "24px 28px", width: 400,
            transform: `scale(${modalScale})`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            direction: "rtl",
            opacity: modalOpacity,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>חסימת תאריכים</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>מתאריך</div>
                <div style={{ border: "2px solid #3b82f6", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>01.05.2026</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>עד תאריך</div>
                <div style={{ border: "2px solid #3b82f6", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>02.05.2026</div>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>סיבה (אופציונלי)</div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0f172a" }}>יום העצמאות</div>
            </div>
            <div style={{
              background: ORANGE, color: "white", borderRadius: 10, padding: "11px",
              textAlign: "center", fontSize: 14, fontWeight: 800, cursor: "pointer",
            }}>
              שמור
            </div>
          </div>
        </div>
      )}

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingSetupScene.tsx
git commit -m "feat(booking-tutorial): add BookingSetupScene (hours+blocked dates+modal)"
```

---

## Task 8: BookingLinkScene

**Files:**
- Create: `src/scenes/BookingLinkScene.tsx`

Same settings layout. Shows booking link section: URL box + copy button + 3 social sharing cards slide in.

- [ ] **Step 1: Create BookingLinkScene.tsx**

```typescript
// src/scenes/BookingLinkScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { SettingsTabsBar } from "./SettingsTabsBar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// Timeline (14s = 420 frames)
const COPY_CLICK   = 80;   // "העתק" button clicked
const COPIED_END   = 110;  // "הועתק!" flash ends
const CARD1_START  = 130;  // Instagram card slides in
const CARD2_START  = 160;  // WhatsApp card slides in
const CARD3_START  = 190;  // Facebook card slides in

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,         x: 600, y: 300 },
  { frame: 50,        x: 500, y: 300 },
  { frame: COPY_CLICK,x: 180, y: 300, action: "click" },
];

const SHARE_CARDS = [
  { icon: "📸", name: "אינסטגרם",  sub: "שמרו בביו",        color: "#e1306c", start: CARD1_START },
  { icon: "💬", name: "וואטסאפ",   sub: "הוסיפו לחתימה",   color: "#25D366", start: CARD2_START },
  { icon: "📘", name: "פייסבוק",   sub: "פרסמו בדף",        color: "#1877F2", start: CARD3_START },
];

export const BookingLinkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const copied = frame >= COPY_CLICK && frame < COPIED_END;
  const copiedOpacity = interpolate(frame, [COPY_CLICK, COPY_CLICK + 8, COPIED_END - 8, COPIED_END], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <SettingsTabsBar activeTab="הזמנות" />
        </div>

        {/* Link section */}
        <div style={{ padding: "20px 28px", opacity: headerOpacity }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>הלינק שלך להזמנות</div>
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
            padding: "16px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            marginBottom: 32,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: ORANGE,
              fontFamily: "monospace", flex: 1, direction: "ltr", textAlign: "left",
            }}>
              petra-app.com/book/happy-dog-boarding
            </span>
            <div style={{
              background: copied ? "#22c55e" : ORANGE,
              color: "white", borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              position: "relative",
            }}>
              {copied ? "הועתק! ✓" : "העתק"}
              {copied && (
                <div style={{
                  position: "absolute", top: -30, right: "50%",
                  transform: "translateX(50%)",
                  background: "#22c55e", color: "white",
                  borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700,
                  opacity: copiedOpacity, whiteSpace: "nowrap",
                }}>
                  הועתק ללוח ✓
                </div>
              )}
            </div>
          </div>

          {/* Share cards */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>שתפו את הלינק</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {SHARE_CARDS.map((card) => {
              const cardP = spring({ frame: frame - card.start, fps, config: { damping: 200 } });
              const cardX = interpolate(cardP, [0, 1], [40, 0]);
              const cardOpacity = interpolate(frame, [card.start, card.start + 15], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={card.name} style={{
                  background: "white", borderRadius: 14, padding: "18px 22px",
                  border: "1px solid #e2e8f0",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  width: 160,
                  opacity: cardOpacity, transform: `translateX(${cardX}px)`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <span style={{ fontSize: 36 }}>{card.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: card.color }}>{card.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>{card.sub}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingLinkScene.tsx
git commit -m "feat(booking-tutorial): add BookingLinkScene (link copy + social sharing cards)"
```

---

## Task 9: BookingNotificationsScene

**Files:**
- Create: `src/scenes/BookingNotificationsScene.tsx`

Dark background (no sidebar). WhatsApp card + Google Calendar card slide in from right, staggered by 20 frames.

- [ ] **Step 1: Create BookingNotificationsScene.tsx**

```typescript
// src/scenes/BookingNotificationsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

// Timeline (16s = 480 frames)
const WA_SLIDE_START  = 20;
const CAL_SLIDE_START = 60;

export const BookingNotificationsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  // WhatsApp card
  const waP = spring({ frame: frame - WA_SLIDE_START, fps, config: { damping: 160, stiffness: 120 } });
  const waX = interpolate(waP, [0, 1], [80, 0]);
  const waOpacity = interpolate(frame, [WA_SLIDE_START, WA_SLIDE_START + 12], [0, 1], { extrapolateRight: "clamp" });
  const waGlow = interpolate(frame, [WA_SLIDE_START + 12, WA_SLIDE_START + 35, WA_SLIDE_START + 50], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Calendar card
  const calP = spring({ frame: frame - CAL_SLIDE_START, fps, config: { damping: 160, stiffness: 120 } });
  const calX = interpolate(calP, [0, 1], [80, 0]);
  const calOpacity = interpolate(frame, [CAL_SLIDE_START, CAL_SLIDE_START + 12], [0, 1], { extrapolateRight: "clamp" });
  const calGlow = interpolate(frame, [CAL_SLIDE_START + 12, CAL_SLIDE_START + 35, CAL_SLIDE_START + 50], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.06 + pulse * 0.03}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      fontFamily: FONT,
      direction: "rtl",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
    }}>
      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      {/* WhatsApp card */}
      <div style={{
        background: "white",
        borderRadius: 20,
        overflow: "hidden",
        width: 440,
        opacity: waOpacity,
        transform: `translateX(${waX}px)`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.35), 0 0 0 ${waGlow * 3}px rgba(37,211,102,${waGlow * 0.4})`,
      }}>
        {/* Header */}
        <div style={{
          background: "#25D366",
          padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>💬</span>
          <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>פטרה 🐾</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginRight: "auto" }}>עכשיו</span>
        </div>
        {/* Body */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>📅 הזמנה חדשה!</div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
            ענבל כהן — טיפול ורחצה<br />
            מקס (לברדור)<br />
            11.05 · 11:00
          </div>
        </div>
      </div>

      {/* Google Calendar card */}
      <div style={{
        background: "white",
        borderRadius: 20,
        overflow: "hidden",
        width: 440,
        opacity: calOpacity,
        transform: `translateX(${calX}px)`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.35), 0 0 0 ${calGlow * 3}px rgba(66,133,244,${calGlow * 0.4})`,
      }}>
        {/* Header */}
        <div style={{
          background: "#4285F4",
          padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>📆</span>
          <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>Google Calendar</span>
        </div>
        {/* Body */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>טיפול ורחצה — ענבל כהן</div>
          <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>11 מאי, 11:00–11:45</div>
          <div style={{
            display: "inline-block",
            background: "#e8f0fe", color: "#1967d2",
            borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700,
          }}>
            נוצר אוטומטית ע״י פטרה
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingNotificationsScene.tsx
git commit -m "feat(booking-tutorial): add BookingNotificationsScene (WhatsApp + GCal cards)"
```

---

## Task 10: BookingOutroScene

**Files:**
- Create: `src/scenes/BookingOutroScene.tsx`

Dark outro matching TasksOutroScene pattern. Two headline lines + Petra logo + CTA.

- [ ] **Step 1: Create BookingOutroScene.tsx**

```typescript
// src/scenes/BookingOutroScene.tsx
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

export const BookingOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const line1P = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const line1Y = interpolate(line1P, [0, 1], [30, 0]);
  const line1Opacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });

  const line2P = spring({ frame: frame - 42, fps, config: { damping: 200 } });
  const line2Y = interpolate(line2P, [0, 1], [30, 0]);
  const line2Opacity = interpolate(frame, [42, 58], [0, 1], { extrapolateRight: "clamp" });

  const ctaP = spring({ frame: frame - 70, fps, config: { damping: 200 } });
  const ctaScale = interpolate(ctaP, [0, 1], [0.6, 1]);
  const ctaOpacity = interpolate(frame, [70, 86], [0, 1], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [90, 106], [0, 1], { extrapolateRight: "clamp" });

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

      {/* Petra logo */}
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, marginBottom: 28 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 80, height: 80, objectFit: "contain" }} />
      </div>

      {/* Line 1 — white */}
      <div style={{
        color: "white", fontSize: 48, fontWeight: 800, textAlign: "center",
        opacity: line1Opacity, transform: `translateY(${line1Y}px)`,
        marginBottom: 8,
      }}>
        פחות תיאום
      </div>

      {/* Line 2 — orange */}
      <div style={{
        color: ORANGE, fontSize: 48, fontWeight: 800, textAlign: "center",
        opacity: line2Opacity, transform: `translateY(${line2Y}px)`,
        marginBottom: 40,
        textShadow: "0 0 30px rgba(234,88,12,0.5)",
      }}>
        יותר זמן לעסק
      </div>

      {/* CTA */}
      <div style={{
        background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
        borderRadius: 16, padding: "16px 48px",
        opacity: ctaOpacity, transform: `scale(${ctaScale})`,
        boxShadow: "0 8px 32px rgba(234,88,12,0.45)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>התחילו בחינם</span>
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

- [ ] **Step 2: TypeScript check**

```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BookingOutroScene.tsx
git commit -m "feat(booking-tutorial): add BookingOutroScene (dark outro with CTA)"
```

---

## Task 11: Final Integration Check

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Verify Remotion Studio shows PetraBookingTutorial**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx remotion studio --port 3001
```

Open `http://localhost:3001` in browser. Verify `PetraBookingTutorial` appears in the composition list. Preview each of the 7 scenes. Check:
- Scene 1: dark background, chaos lines → badge cross-fade
- Scene 2: white booking page, service cards, calendar, time slots all appear with cursor
- Scene 3: form typewriter, dog selection, confirm screen, done screen with checkmark
- Scene 4: sidebar + settings tabs, weekly schedule, Saturday toggle off, modal opens
- Scene 5: link section with URL, copy flash, 3 social cards slide in
- Scene 6: dark background, WhatsApp card + Google Calendar card slide in with glow
- Scene 7: dark outro, "פחות תיאום" / "יותר זמן לעסק" lines, CTA

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(booking-tutorial): complete all 7 scenes — ready for voiceover sync"
```

---

## Typewriter Helper Note

The `typewriter()` function in `BookingCustomerDetailsScene.tsx` uses a simple characters-per-second model. Adjust `charsPerSec` (currently `4`) to control how fast the text appears. The name field starts at frame 35, phone at frame 110. These values should be adjusted after listening to the generated voiceover.

## Cursor Timing Note

All cursor waypoint frame numbers are estimates based on the default scene durations. After generating voiceovers and hearing the actual audio timing, the `CURSOR_WAYPOINTS` arrays and phase constants (e.g., `CARD_CLICK`, `SAT_TOGGLE`, etc.) in each scene should be adjusted to match when the voiceover mentions each action. Use Python's `wave` module to detect silence boundaries — the same technique used for the Tasks tutorial.
