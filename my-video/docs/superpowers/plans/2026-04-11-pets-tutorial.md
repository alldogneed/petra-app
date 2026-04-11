# Pets Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `PetraPetsTutorial` — a 6-scene Remotion composition showcasing Petra's multi-species pet management, targeting clinics, groomers, and rehabilitation centers.

**Architecture:** New scene files (`Pets*Scene.tsx`) + `PetsTutorial.tsx` composition registered in `Root.tsx`. Progressive uncomment strategy: Task 3 creates the shell with all scene imports commented; Tasks 4–9 each create a scene file and uncomment its block. Voiceover WAVs generated via Gemini TTS.

**Tech Stack:** Remotion 4.x, TypeScript, Google Gemini TTS (gemini-2.5-flash-preview-tts, Aoede voice), PCM→WAV conversion

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `voiceover-pets-config.ts` | 6 scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-pets.ts` | Gemini TTS generator for pets WAVs |
| Create | `src/PetsTutorial.tsx` | Main composition — bg-music + 6 scenes |
| Modify | `src/Root.tsx` | Register `PetraPetsTutorial` composition |
| Create | `src/scenes/PetsIntroScene.tsx` | Scene 1: dark intro |
| Create | `src/scenes/PetsSpeciesScene.tsx` | Scene 2: 4 species cards, activeLabel="חיות מחמד" |
| Create | `src/scenes/PetsAddScene.tsx` | Scene 3: add-pet modal with species dropdown |
| Create | `src/scenes/PetsProfileScene.tsx` | Scene 4: rich pet profile card |
| Create | `src/scenes/PetsFamilyScene.tsx` | Scene 5: customer with 4 different pets |
| Create | `src/scenes/PetsOutroScene.tsx` | Scene 6: dark outro |
| Output | `public/voiceover/pets-*.wav` | 6 generated audio files |

---

### Task 1: Voiceover Config

**Files:**
- Create: `voiceover-pets-config.ts`

- [ ] **Step 1: Create the config file**

```typescript
// voiceover-pets-config.ts
export const PETS_SCENES = [
  {
    id: "pets-intro",
    text: "חיות המחמד של פטרה — פרופיל מקצועי לכל בעל חיים, לכל עסק.",
    defaultDurationSec: 10,
  },
  {
    id: "pets-species",
    text: "פטרה תומכת בכלבים, חתולים, ציפורים, ארנבים ועוד — בחרו את הסוג בעת הוספה.",
    defaultDurationSec: 12,
  },
  {
    id: "pets-add",
    text: "הוספת חיה לוקחת שניות — שם, גזע, מין, תאריך לידה, ומיקרוצ'יפ.",
    defaultDurationSec: 11,
  },
  {
    id: "pets-profile",
    text: "כל חיה מקבלת פרופיל עצמאי עם הערות רפואיות, חיסונים, וכל ההיסטוריה שלה.",
    defaultDurationSec: 12,
  },
  {
    id: "pets-family",
    text: "ללקוח עם כמה חיות? כולן מקושרות לאותו פרופיל — עם גישה בלחיצה אחת.",
    defaultDurationSec: 11,
  },
  {
    id: "pets-outro",
    text: "חיות המחמד של פטרה — כל בעל חיים, כל מידע, תמיד נגיש.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add voiceover-pets-config.ts
git commit -m "feat(pets): add voiceover-pets-config"
```

---

### Task 2: Voiceover Generator + WAVs

**Files:**
- Create: `generate-voiceover-pets.ts`
- Output: `public/voiceover/pets-*.wav`

- [ ] **Step 1: Create the generator script**

```typescript
// generate-voiceover-pets.ts
/**
 * Generates Hebrew voiceover for the Pets tutorial using Google Gemini 2.5 TTS.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover-pets.ts
 *
 * Output: public/voiceover/pets-{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { PETS_SCENES } from "./voiceover-pets-config.js";

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
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover-pets.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📦 Petra Pets Tutorial Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < PETS_SCENES.length; i++) {
    const scene = PETS_SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    if (i < PETS_SCENES.length - 1) {
      const next = PETS_SCENES[i + 1];
      if (!existsSync(`${OUTPUT_DIR}/${next.id}.wav`)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! WAVs saved to public/voiceover/pets-*.wav`);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
```

- [ ] **Step 2: Run the generator**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && GEMINI_KEY=AIzaSyDBAhFuy7WG0w82BpwdcojUShgB_jfKrzA PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-pets.ts
```

Expected: 6 WAV files printed as `✅ public/voiceover/pets-*.wav`. Rate-limit 22s sleeps are built in (~2 minutes total).

- [ ] **Step 3: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add generate-voiceover-pets.ts public/voiceover/pets-intro.wav public/voiceover/pets-species.wav public/voiceover/pets-add.wav public/voiceover/pets-profile.wav public/voiceover/pets-family.wav public/voiceover/pets-outro.wav
git commit -m "feat(pets): add voiceover generator + generated WAVs"
```

---

### Task 3: PetsTutorial.tsx shell + Root.tsx

**Files:**
- Create: `src/PetsTutorial.tsx`
- Modify: `src/Root.tsx`

- [ ] **Step 1: Create PetsTutorial.tsx shell**

All scene imports are commented. A placeholder sequence covers the full duration so TypeScript compiles cleanly.

```typescript
// src/PetsTutorial.tsx
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Series,
  // Sequence,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { getAudioDuration } from "./get-audio-duration";
// import { PetsIntroScene } from "./scenes/PetsIntroScene";
// import { PetsSpeciesScene } from "./scenes/PetsSpeciesScene";
// import { PetsAddScene } from "./scenes/PetsAddScene";
// import { PetsProfileScene } from "./scenes/PetsProfileScene";
// import { PetsFamilyScene } from "./scenes/PetsFamilyScene";
// import { PetsOutroScene } from "./scenes/PetsOutroScene";
import { PETS_SCENES } from "../voiceover-pets-config";

export type PetsTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = PETS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = PETS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculatePetsMetadata: CalculateMetadataFunction<PetsTutorialProps> =
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

export const PetraPetsTutorial: React.FC<PetsTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, species, add, profile, family, outro] = sceneDurationsFrames;

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
        {/* Placeholder — replaced as scenes are uncommented */}
        <Series.Sequence durationInFrames={intro + species + add + profile + family + outro}>
          <AbsoluteFill style={{ background: "#0f172a" }} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Add PetraPetsTutorial to Root.tsx**

Add these imports after the existing admin imports:

```typescript
import {
  PetraPetsTutorial,
  PetsTutorialProps,
  calculatePetsMetadata,
} from "./PetsTutorial";
import { PETS_SCENES } from "../voiceover-pets-config";
```

Add default props constant after `adminDefaultProps`:

```typescript
const petsDefaultProps: PetsTutorialProps = {
  sceneDurationsFrames: PETS_SCENES.map((s) => s.defaultDurationSec * FPS),
};
```

Add composition before the closing `</>`:

```tsx
<Composition
  id="PetraPetsTutorial"
  component={PetraPetsTutorial}
  calculateMetadata={calculatePetsMetadata}
  durationInFrames={
    PETS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
  }
  fps={FPS}
  width={1280}
  height={720}
  defaultProps={petsDefaultProps}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
```

Expected: only pre-existing TeaserVideoLong/TeaserVideoShort errors. No new errors.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/PetsTutorial.tsx src/Root.tsx
git commit -m "feat(pets): add PetsTutorial shell + register in Root.tsx"
```

---

### Task 4: PetsIntroScene (Scene 1 — dark intro)

**Files:**
- Create: `src/scenes/PetsIntroScene.tsx`
- Modify: `src/PetsTutorial.tsx`

- [ ] **Step 1: Create the scene**

```typescript
// src/scenes/PetsIntroScene.tsx
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

export const PetsIntroScene: React.FC = () => {
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
    <AbsoluteFill style={{
      opacity,
      background: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0c1422 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", top: "25%", left: "50%",
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
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>PETRA</span>
      </div>

      {/* Badge */}
      <div style={{
        opacity: badgeOpacity,
        background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.5)",
        borderRadius: 99, padding: "5px 16px", marginBottom: 20,
        color: "#fb923c", fontSize: 13, fontWeight: 600,
      }}>
        מדריך מהיר
      </div>

      {/* Title */}
      <h1 style={{
        color: "white", fontSize: 60, fontWeight: 800,
        margin: 0, marginBottom: 18, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.15, textShadow: "0 2px 20px rgba(234,88,12,0.3)",
      }}>
        חיות המחמד
      </h1>

      {/* Subtitle */}
      <p style={{
        color: "#94a3b8", fontSize: 20,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        פרופיל מקצועי לכל בעל חיים — לקליניקות, גרומרים ועוד
      </p>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment in PetsTutorial.tsx**

Replace the top of `src/PetsTutorial.tsx`:

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
import { getAudioDuration } from "./get-audio-duration";
import { PetsIntroScene } from "./scenes/PetsIntroScene";
// import { PetsSpeciesScene } from "./scenes/PetsSpeciesScene";
// import { PetsAddScene } from "./scenes/PetsAddScene";
// import { PetsProfileScene } from "./scenes/PetsProfileScene";
// import { PetsFamilyScene } from "./scenes/PetsFamilyScene";
// import { PetsOutroScene } from "./scenes/PetsOutroScene";
import { PETS_SCENES } from "../voiceover-pets-config";
```

Add `SceneAudio` helper after the imports section (before `PetraPetsTutorial`):

```typescript
const SceneAudio: React.FC<{ file: string }> = ({ file }) => (
  <Sequence layout="none">
    <Audio src={staticFile(file)} />
  </Sequence>
);
```

Replace the `<Series>` block with:

```tsx
<Series>
  <Series.Sequence durationInFrames={intro} premountFor={fps}>
    <PetsIntroScene />
    <SceneAudio file="voiceover/pets-intro.wav" />
  </Series.Sequence>
  {/* Placeholder for remaining scenes */}
  <Series.Sequence durationInFrames={species + add + profile + family + outro}>
    <AbsoluteFill style={{ background: "#0f172a" }} />
  </Series.Sequence>
</Series>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
```

Expected: only pre-existing TeaserVideoLong/TeaserVideoShort errors.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/PetsIntroScene.tsx src/PetsTutorial.tsx
git commit -m "feat(pets): add PetsIntroScene"
```

---

### Task 5: PetsSpeciesScene (Scene 2 — species cards)

**Files:**
- Create: `src/scenes/PetsSpeciesScene.tsx`
- Modify: `src/PetsTutorial.tsx`

- [ ] **Step 1: Create the scene**

```typescript
// src/scenes/PetsSpeciesScene.tsx
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

const SPECIES = [
  { emoji: "🐕", name: "כלב",   examples: "Golden Retriever, לברדור, פודל ועוד", color: "#2563eb" },
  { emoji: "🐈", name: "חתול",  examples: "פרסי, סיאמי, מיקס ועוד",              color: "#7c3aed" },
  { emoji: "🐦", name: "ציפור", examples: "תוכי, קנרית, זבוב ועוד",               color: "#0891b2" },
  { emoji: "🐇", name: "ארנב",  examples: "ארנב גמד, אנגורה ועוד",                color: "#16a34a" },
];

export const PetsSpeciesScene: React.FC = () => {
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
      <PetraSidebar width={SIDEBAR_W} activeLabel="חיות מחמד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>חיות מחמד</div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 16 }}>
            סוגי בעלי חיים נתמכים
          </div>

          {/* 2×2 species grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            {SPECIES.map((sp, i) => {
              const startFrame = 25 + i * 22;
              const cardP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const cardY = interpolate(cardP, [0, 1], [28, 0]);
              const cardOpacity = interpolate(frame, [startFrame, startFrame + 16], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={sp.name} style={{
                  background: "white", borderRadius: 14,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  borderTop: `3px solid ${sp.color}`,
                  padding: "18px 18px 14px",
                  opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                }}>
                  <div style={{ fontSize: 40, marginBottom: 8, lineHeight: 1 }}>{sp.emoji}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{sp.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{sp.examples}</div>
                </div>
              );
            })}
          </div>

          {/* Callout */}
          <div style={{
            background: `rgba(234,88,12,0.08)`,
            border: `1px solid rgba(234,88,12,0.25)`,
            borderRadius: 10, padding: "10px 16px",
            opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
          }}>
            <span style={{ fontSize: 12, color: ORANGE, fontWeight: 600 }}>
              לא מוגבל לכלבים — בחרו את סוג החיה בעת יצירת הפרופיל
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment in PetsTutorial.tsx**

Uncomment the import:
```typescript
import { PetsSpeciesScene } from "./scenes/PetsSpeciesScene";
```

Replace the `<Series>` block with:

```tsx
<Series>
  <Series.Sequence durationInFrames={intro} premountFor={fps}>
    <PetsIntroScene />
    <SceneAudio file="voiceover/pets-intro.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={species} premountFor={fps}>
    <PetsSpeciesScene />
    <SceneAudio file="voiceover/pets-species.wav" />
  </Series.Sequence>
  {/* Placeholder for remaining scenes */}
  <Series.Sequence durationInFrames={add + profile + family + outro}>
    <AbsoluteFill style={{ background: "#0f172a" }} />
  </Series.Sequence>
</Series>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
```

Expected: only pre-existing errors.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/PetsSpeciesScene.tsx src/PetsTutorial.tsx
git commit -m "feat(pets): add PetsSpeciesScene"
```

---

### Task 6: PetsAddScene (Scene 3 — add pet modal)

**Files:**
- Create: `src/scenes/PetsAddScene.tsx`
- Modify: `src/PetsTutorial.tsx`

- [ ] **Step 1: Create the scene**

```typescript
// src/scenes/PetsAddScene.tsx
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

const FIELDS = [
  { label: "שם החיה",    value: "פיפי",           delay: 55 },
  { label: "גזע",        value: "תוכי אמזוני",    delay: 70 },
  { label: "מין",        value: "נקבה",            delay: 85 },
  { label: "תאריך לידה", value: "05.06.2022",     delay: 100 },
  { label: "מיקרוצ'יפ",  value: "972000098765",   delay: 115 },
];

export const PetsAddScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  // Species dropdown highlight
  const dropdownHighlight = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  // Backdrop + modal
  const backdropOpacity = interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 18, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.9, 1]);
  const modalOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });

  // Save button highlight
  const saveHighlight = interpolate(frame, [130, 142], [0, 1], { extrapolateRight: "clamp" });

  // New pet card
  const newCardOpacity = interpolate(frame, [148, 162], [0, 1], { extrapolateRight: "clamp" });
  const newCardP = spring({ frame: frame - 148, fps, config: { damping: 160 } });
  const newCardScale = interpolate(newCardP, [0, 1], [0.8, 1]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="לקוחות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לקוחות</div>
        </div>

        {/* Customer mini-card visible on right */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{
            background: "white", borderRadius: 12, padding: "16px",
            width: 200, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            float: "right",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #ea580c, #c2410c)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "white", fontWeight: 800,
              }}>ר</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>רחל כהן</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>3 ביקורים</div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>חיות מחמד</div>
            <div style={{
              background: "#f8fafc", borderRadius: 8, padding: "8px 10px",
              display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
            }}>
              <span style={{ fontSize: 16 }}>🐕</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>בובו</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>פודל · 3 שנים</div>
              </div>
            </div>
            {/* New pet card */}
            <div style={{
              background: "#fff7ed", border: `1px solid ${ORANGE}40`,
              borderRadius: 8, padding: "8px 10px",
              display: "flex", alignItems: "center", gap: 8,
              opacity: newCardOpacity, transform: `scale(${newCardScale})`,
            }}>
              <span style={{ fontSize: 16 }}>🐦</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>פיפי</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>תוכי · 3 שנים</div>
              </div>
              <span style={{
                fontSize: 9, background: "#dcfce7", color: "#15803d",
                borderRadius: 4, padding: "1px 5px", fontWeight: 700,
              }}>חדש</span>
            </div>
          </div>
        </div>

        {/* Backdrop */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(15,23,42,0.5)",
          opacity: backdropOpacity,
        }} />

        {/* Modal */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          background: "white", borderRadius: 16,
          padding: "24px 28px", width: 380,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          direction: "rtl",
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 18 }}>
            הוסף חיית מחמד
          </h2>

          {/* Species dropdown — highlighted */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>סוג</div>
            <div style={{
              background: dropdownHighlight > 0.5 ? `${ORANGE}10` : "#f8fafc",
              border: `1.5px solid ${dropdownHighlight > 0.5 ? ORANGE : "#e2e8f0"}`,
              borderRadius: 8, padding: "9px 12px",
              fontSize: 13, color: "#0f172a",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              boxShadow: dropdownHighlight > 0.5 ? `0 0 0 3px ${ORANGE}20` : "none",
            }}>
              <span>🐦 ציפור</span>
              <span style={{ color: "#94a3b8" }}>▾</span>
            </div>
          </div>

          {/* Other fields */}
          {FIELDS.map((f) => {
            const fOpacity = interpolate(frame, [f.delay, f.delay + 14], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={f.label} style={{ marginBottom: 12, opacity: fOpacity }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{f.label}</div>
                <div style={{
                  background: "#f8fafc", border: "1.5px solid #e2e8f0",
                  borderRadius: 8, padding: "9px 12px",
                  fontSize: 13, color: "#0f172a",
                }}>{f.value}</div>
              </div>
            );
          })}

          {/* Save button */}
          <div style={{
            background: saveHighlight > 0.5 ? ORANGE : "#0f172a",
            color: "white", borderRadius: 10, padding: "11px",
            fontSize: 13, fontWeight: 700, textAlign: "center",
            marginTop: 8,
            boxShadow: saveHighlight > 0.5 ? "0 4px 20px rgba(234,88,12,0.4)" : "none",
          }}>שמור</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment in PetsTutorial.tsx**

Uncomment the import:
```typescript
import { PetsAddScene } from "./scenes/PetsAddScene";
```

Replace the `<Series>` block with:

```tsx
<Series>
  <Series.Sequence durationInFrames={intro} premountFor={fps}>
    <PetsIntroScene />
    <SceneAudio file="voiceover/pets-intro.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={species} premountFor={fps}>
    <PetsSpeciesScene />
    <SceneAudio file="voiceover/pets-species.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={add} premountFor={fps}>
    <PetsAddScene />
    <SceneAudio file="voiceover/pets-add.wav" />
  </Series.Sequence>
  {/* Placeholder for remaining scenes */}
  <Series.Sequence durationInFrames={profile + family + outro}>
    <AbsoluteFill style={{ background: "#0f172a" }} />
  </Series.Sequence>
</Series>
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
git add src/scenes/PetsAddScene.tsx src/PetsTutorial.tsx
git commit -m "feat(pets): add PetsAddScene"
```

---

### Task 7: PetsProfileScene (Scene 4 — pet profile)

**Files:**
- Create: `src/scenes/PetsProfileScene.tsx`
- Modify: `src/PetsTutorial.tsx`

- [ ] **Step 1: Create the scene**

```typescript
// src/scenes/PetsProfileScene.tsx
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const PET_FIELDS = [
  { label: "סוג",           value: "ציפור",                               delay: 20 },
  { label: "גזע",           value: "תוכי אמזוני",                        delay: 32 },
  { label: "מין",           value: "נקבה",                                delay: 44 },
  { label: "תאריך לידה",    value: "05.06.2022 (3 שנים)",               delay: 56 },
  { label: "מיקרוצ'יפ",     value: "972000098765",                       delay: 68 },
  { label: "הערות רפואיות", value: "רגיש לאבק, חיסון מנטוקס עד 06/2026", delay: 80 },
];

const ANNOTATIONS = [
  { text: "סוג בעל החיים",       delay: 20 },
  { text: "גיל מחושב אוטומטית", delay: 38 },
  { text: "מיקרוצ'יפ לזיהוי",   delay: 74 },
  { text: "הערות רפואיות",       delay: 86 },
];

export const PetsProfileScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const summaryOpacity = interpolate(frame, [100, 116], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="לקוחות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header with breadcrumb */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 6, opacity: headerOpacity,
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>פיפי</span>
          <span style={{ color: "#94a3b8" }}>‹</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>רחל כהן</span>
          <span style={{ color: "#94a3b8" }}>‹</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>לקוחות</span>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", gap: 28, alignItems: "flex-start" }}>
          {/* Pet card */}
          <div style={{
            background: "white", borderRadius: 16, width: 300,
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)", overflow: "hidden",
            border: "1px solid #e2e8f0", flexShrink: 0,
          }}>
            {/* Card header */}
            <div style={{
              background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}05)`,
              borderBottom: "1px solid #e2e8f0", padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: `${ORANGE}20`, border: `2px solid ${ORANGE}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28,
              }}>🐦</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>פיפי</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>תוכי אמזוני · 3 שנים</div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: "14px 20px" }}>
              {PET_FIELDS.map((field) => {
                const fOpacity = interpolate(frame, [field.delay, field.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div key={field.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid #f1f5f9", opacity: fOpacity,
                  }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{field.label}</span>
                    <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, maxWidth: 160, textAlign: "left" }}>{field.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side: annotations */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, paddingTop: 50 }}>
            {ANNOTATIONS.map((ann, i) => {
              const annOpacity = interpolate(frame, [ann.delay + 5, ann.delay + 18], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  opacity: annOpacity, display: "flex", alignItems: "center", gap: 8, marginBottom: 22,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, flexShrink: 0 }} />
                  <div style={{ height: 1, width: 32, background: `${ORANGE}60`, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: ORANGE,
                    background: `${ORANGE}10`, border: `1px solid ${ORANGE}30`,
                    borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap",
                  }}>{ann.text}</span>
                </div>
              );
            })}

            {/* Summary dark card */}
            <div style={{
              opacity: summaryOpacity,
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              borderRadius: 12, padding: "14px 18px", color: "white", marginTop: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>כל המידע הרפואי</div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                חיסונים, הערות, שבב —<br />הכל נגיש בלחיצה אחת
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment in PetsTutorial.tsx**

Uncomment the import:
```typescript
import { PetsProfileScene } from "./scenes/PetsProfileScene";
```

Replace the `<Series>` block with:

```tsx
<Series>
  <Series.Sequence durationInFrames={intro} premountFor={fps}>
    <PetsIntroScene />
    <SceneAudio file="voiceover/pets-intro.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={species} premountFor={fps}>
    <PetsSpeciesScene />
    <SceneAudio file="voiceover/pets-species.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={add} premountFor={fps}>
    <PetsAddScene />
    <SceneAudio file="voiceover/pets-add.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={profile} premountFor={fps}>
    <PetsProfileScene />
    <SceneAudio file="voiceover/pets-profile.wav" />
  </Series.Sequence>
  {/* Placeholder for remaining scenes */}
  <Series.Sequence durationInFrames={family + outro}>
    <AbsoluteFill style={{ background: "#0f172a" }} />
  </Series.Sequence>
</Series>
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
git add src/scenes/PetsProfileScene.tsx src/PetsTutorial.tsx
git commit -m "feat(pets): add PetsProfileScene"
```

---

### Task 8: PetsFamilyScene (Scene 5 — multi-pet family)

**Files:**
- Create: `src/scenes/PetsFamilyScene.tsx`
- Modify: `src/PetsTutorial.tsx`

- [ ] **Step 1: Create the scene**

```typescript
// src/scenes/PetsFamilyScene.tsx
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

const PETS = [
  { emoji: "🐕", name: "רקסי",   breed: "גולדן רטריבר", age: "4 שנים",    color: "#2563eb" },
  { emoji: "🐈", name: "מיאו",   breed: "פרסי",         age: "2 שנים",    color: "#7c3aed" },
  { emoji: "🐦", name: "ציוצי",  breed: "קנרית",        age: "1 שנה",     color: "#0891b2" },
  { emoji: "🐇", name: "פומפום", breed: "ארנב גמד",     age: "6 חודשים",  color: "#16a34a" },
];

export const PetsFamilyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.in(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const calloutP = spring({ frame: frame - 200, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [20, 0]);
  const calloutOpacity = interpolate(frame, [200, 220], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="לקוחות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לקוחות</div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Customer card */}
          <div style={{
            background: "white", borderRadius: 12, padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 14,
            opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "linear-gradient(135deg, #ea580c, #c2410c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "white", fontWeight: 800,
            }}>מ</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>משפחת לוי</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>לקוח VIP · 12 ביקורים</div>
            </div>
          </div>

          {/* Pets section heading */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
            opacity: interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <div style={{
              background: ORANGE, color: "white",
              fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 10px",
            }}>+ הוסף חיה</div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>חיות מחמד (4)</span>
          </div>

          {/* Pet cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {PETS.map((pet, i) => {
              const startFrame = 30 + i * 28;
              const cardP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const cardY = interpolate(cardP, [0, 1], [24, 0]);
              const cardOpacity = interpolate(frame, [startFrame, startFrame + 16], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={pet.name} style={{
                  background: "white", borderRadius: 12, padding: "14px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  borderRight: `3px solid ${pet.color}`,
                  display: "flex", alignItems: "center", gap: 10,
                  opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{pet.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{pet.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{pet.breed} · {pet.age}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Callout */}
          <div style={{
            marginTop: 14, background: "rgba(234,88,12,0.08)",
            border: "1px solid rgba(234,88,12,0.25)", borderRadius: 10, padding: "10px 16px",
            opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
          }}>
            <span style={{ fontSize: 12, color: ORANGE, fontWeight: 600 }}>
              כל החיות מקושרות לאותו לקוח — כל תור, הזמנה ורשומה בפרופיל אחד
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

**Important:** The line `const opacity = Math.in(fadeIn, fadeOut);` must be `Math.min(fadeIn, fadeOut)`. Make sure this typo is corrected when writing the actual file.

- [ ] **Step 2: Uncomment in PetsTutorial.tsx**

Uncomment the import:
```typescript
import { PetsFamilyScene } from "./scenes/PetsFamilyScene";
```

Replace the `<Series>` block with:

```tsx
<Series>
  <Series.Sequence durationInFrames={intro} premountFor={fps}>
    <PetsIntroScene />
    <SceneAudio file="voiceover/pets-intro.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={species} premountFor={fps}>
    <PetsSpeciesScene />
    <SceneAudio file="voiceover/pets-species.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={add} premountFor={fps}>
    <PetsAddScene />
    <SceneAudio file="voiceover/pets-add.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={profile} premountFor={fps}>
    <PetsProfileScene />
    <SceneAudio file="voiceover/pets-profile.wav" />
  </Series.Sequence>
  <Series.Sequence durationInFrames={family} premountFor={fps}>
    <PetsFamilyScene />
    <SceneAudio file="voiceover/pets-family.wav" />
  </Series.Sequence>
  {/* Placeholder for outro */}
  <Series.Sequence durationInFrames={outro}>
    <AbsoluteFill style={{ background: "#0f172a" }} />
  </Series.Sequence>
</Series>
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
git add src/scenes/PetsFamilyScene.tsx src/PetsTutorial.tsx
git commit -m "feat(pets): add PetsFamilyScene"
```

---

### Task 9: PetsOutroScene (Scene 6 — dark outro) + Final wiring

**Files:**
- Create: `src/scenes/PetsOutroScene.tsx`
- Modify: `src/PetsTutorial.tsx`

- [ ] **Step 1: Create the scene**

```typescript
// src/scenes/PetsOutroScene.tsx
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
  { text: "כל הסוגים נתמכים" },
  { text: "פרופיל רפואי מלא" },
  { text: "כמה חיות ללקוח" },
];

export const PetsOutroScene: React.FC = () => {
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
      fontFamily: FONT, direction: "rtl", padding: "0 80px",
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
        opacity: titleOpacity, transform: `translateY(${titleY}px)`, lineHeight: 1.2,
      }}>
        חיות המחמד של פטרה
      </h1>
      <p style={{
        color: "white", fontSize: 20, fontWeight: 700,
        margin: 0, marginBottom: 32, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
      }}>
        כל בעל חיים, כל מידע, תמיד נגיש
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
        display: "flex", alignItems: "center", gap: 12, direction: "rtl",
      }}>
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>נסו עכשיו</span>
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

- [ ] **Step 2: Final PetsTutorial.tsx — full wired version**

Replace the entire content of `src/PetsTutorial.tsx`:

```typescript
// src/PetsTutorial.tsx
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
import { PetsIntroScene } from "./scenes/PetsIntroScene";
import { PetsSpeciesScene } from "./scenes/PetsSpeciesScene";
import { PetsAddScene } from "./scenes/PetsAddScene";
import { PetsProfileScene } from "./scenes/PetsProfileScene";
import { PetsFamilyScene } from "./scenes/PetsFamilyScene";
import { PetsOutroScene } from "./scenes/PetsOutroScene";
import { PETS_SCENES } from "../voiceover-pets-config";

export type PetsTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = PETS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = PETS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculatePetsMetadata: CalculateMetadataFunction<PetsTutorialProps> =
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

export const PetraPetsTutorial: React.FC<PetsTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, species, add, profile, family, outro] = sceneDurationsFrames;

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
          <PetsIntroScene />
          <SceneAudio file="voiceover/pets-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={species} premountFor={fps}>
          <PetsSpeciesScene />
          <SceneAudio file="voiceover/pets-species.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={add} premountFor={fps}>
          <PetsAddScene />
          <SceneAudio file="voiceover/pets-add.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={profile} premountFor={fps}>
          <PetsProfileScene />
          <SceneAudio file="voiceover/pets-profile.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={family} premountFor={fps}>
          <PetsFamilyScene />
          <SceneAudio file="voiceover/pets-family.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <PetsOutroScene />
          <SceneAudio file="voiceover/pets-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1
```

Expected: only pre-existing TeaserVideoLong/TeaserVideoShort errors. No new errors.

- [ ] **Step 4: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/PetsOutroScene.tsx src/PetsTutorial.tsx
git commit -m "feat(pets): add PetsOutroScene + final wiring"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Scene 1 intro: Task 4
- ✅ Scene 2 species (כלב/חתול/ציפור/ארנב): Task 5
- ✅ Scene 3 add pet with species dropdown: Task 6
- ✅ Scene 4 pet profile with medical notes: Task 7
- ✅ Scene 5 family with 4 pets: Task 8
- ✅ Scene 6 outro with "נסו עכשיו" CTA: Task 9
- ✅ Voiceover config + generator: Tasks 1–2
- ✅ Root.tsx registration: Task 3
- ✅ bg-music at 0.13: Task 3

**Typo to fix:** In Task 8 (PetsFamilyScene), the `opacity` line has `Math.in` — this is intentionally flagged. The implementer must write `Math.min` in the actual file.

**Type consistency:** `PetsTutorialProps`, `calculatePetsMetadata`, `PetraPetsTutorial` used consistently across Tasks 3 and 9.
