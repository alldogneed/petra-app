# Admin Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `PetraAdminTutorial` — an 8-scene Remotion composition for the "ניהול ובקרה" section of Petra, matching the visual language of the existing tutorial series.

**Architecture:** New scene files (`Admin*Scene.tsx`) + shared `AdminTabBar.tsx` component + `AdminTutorial.tsx` composition registered in `Root.tsx`. Progressive uncomment strategy: Task 4 creates the shell with all scene imports commented; Tasks 5–12 each create a scene file and uncomment its block. Voiceover WAVs generated via Gemini TTS.

**Tech Stack:** Remotion 4.x, TypeScript, Google Gemini TTS (gemini-2.5-flash-preview-tts, Aoede voice), PCM→WAV conversion

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `voiceover-admin-config.ts` | 8 scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-admin.ts` | Gemini TTS generator for admin WAVs |
| Create | `src/scenes/AdminTabBar.tsx` | Shared 6-tab bar used by all UI scenes |
| Create | `src/AdminTutorial.tsx` | Main composition — bg-music + 8 scenes |
| Modify | `src/Root.tsx` | Register `PetraAdminTutorial` composition |
| Create | `src/scenes/AdminIntroScene.tsx` | Scene 1: dark intro |
| Create | `src/scenes/AdminOverviewScene.tsx` | Scene 2: סקירה tab |
| Create | `src/scenes/AdminActivityScene.tsx` | Scene 3: פעילות tab |
| Create | `src/scenes/AdminTeamScene.tsx` | Scene 4: צוות tab |
| Create | `src/scenes/AdminSessionsScene.tsx` | Scene 5: סשנים tab |
| Create | `src/scenes/AdminMessagesScene.tsx` | Scene 6: הודעות מערכת tab |
| Create | `src/scenes/AdminSubscriptionScene.tsx` | Scene 7: מנוי וחיוב tab |
| Create | `src/scenes/AdminOutroScene.tsx` | Scene 8: dark outro |
| Output | `public/voiceover/admin-*.wav` | 8 generated audio files |

---

### Task 1: Voiceover Config

**Files:**
- Create: `voiceover-admin-config.ts`

- [ ] **Step 1: Create the config file**

```typescript
// voiceover-admin-config.ts
export const ADMIN_SCENES = [
  {
    id: "admin-intro",
    text: "ניהול ובקרה של פטרה — שקיפות מלאה על כל פעולה, כל משתמש, בזמן אמת.",
    defaultDurationSec: 10,
  },
  {
    id: "admin-overview",
    text: "בסקירה תראו את מצב הצוות, הלקוחות, התורים וההכנסות — ומתחת, פיד פעילות חי שמתעדכן כל שלושים שניות.",
    defaultDurationSec: 13,
  },
  {
    id: "admin-activity",
    text: "בטאב הפעילות תוכלו לסנן לפי חבר צוות או סוג פעולה — ולראות בדיוק מי עשה מה ומתי.",
    defaultDurationSec: 13,
  },
  {
    id: "admin-team",
    text: "בניהול הצוות תראו את כל החברים, האם הם אונליין כרגע, ותוכלו לשנות תפקידים ולהשבית גישה בלחיצה.",
    defaultDurationSec: 14,
  },
  {
    id: "admin-sessions",
    text: "בטאב הסשנים תראו מאיזה מכשיר כל אחד מחובר — ותוכלו לנתק אותו מרחוק אם צריך.",
    defaultDurationSec: 12,
  },
  {
    id: "admin-messages",
    text: "הודעות מערכת מאפשרות לשלוח הודעה לכל חברי הצוות — עם תאריך תפוגה אוטומטי.",
    defaultDurationSec: 12,
  },
  {
    id: "admin-subscription",
    text: "בכרטיסיית המנוי תראו את התוכנית הפעילה שלכם, מתי היא מתחדשת, ואת היסטוריית החיוב.",
    defaultDurationSec: 10,
  },
  {
    id: "admin-outro",
    text: "ניהול ובקרה של פטרה — שקיפות מלאה על כל מה שקורה בעסק. כל פעולה, כל משתמש, בזמן אמת.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add voiceover-admin-config.ts
git commit -m "feat(admin): add voiceover-admin-config"
```

---

### Task 2: Voiceover Generator

**Files:**
- Create: `generate-voiceover-admin.ts`
- Output: `public/voiceover/admin-*.wav`

- [ ] **Step 1: Create the generator script**

```typescript
// generate-voiceover-admin.ts
/**
 * Generates Hebrew voiceover for the Admin tutorial using Google Gemini 2.5 TTS.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover-admin.ts
 *
 * Output: public/voiceover/admin-{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { ADMIN_SCENES } from "./voiceover-admin-config.js";

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
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover-admin.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📦 Petra Admin Tutorial Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < ADMIN_SCENES.length; i++) {
    const scene = ADMIN_SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    if (i < ADMIN_SCENES.length - 1) {
      const next = ADMIN_SCENES[i + 1];
      if (!existsSync(`${OUTPUT_DIR}/${next.id}.wav`)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! WAVs saved to public/voiceover/admin-*.wav`);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
```

- [ ] **Step 2: Run the generator**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video' && GEMINI_KEY=AIzaSyDBAhFuy7WG0w82BpwdcojUShgB_jfKrzA PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-admin.ts
```

Expected: 8 WAV files printed as `✅ public/voiceover/admin-*.wav`. Rate-limit 22s sleeps are built in (~3 minutes total).

- [ ] **Step 3: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add generate-voiceover-admin.ts public/voiceover/admin-intro.wav public/voiceover/admin-overview.wav public/voiceover/admin-activity.wav public/voiceover/admin-team.wav public/voiceover/admin-sessions.wav public/voiceover/admin-messages.wav public/voiceover/admin-subscription.wav public/voiceover/admin-outro.wav
git commit -m "feat(admin): add voiceover generator + generated WAVs"
```

---

### Task 3: AdminTabBar shared component

**Files:**
- Create: `src/scenes/AdminTabBar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/scenes/AdminTabBar.tsx

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const TABS = [
  { label: "סקירה" },
  { label: "פעילות" },
  { label: "צוות" },
  { label: "סשנים" },
  { label: "הודעות מערכת" },
  { label: "מנוי וחיוב" },
];

export const AdminTabBar: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  return (
    <div style={{
      background: "white",
      borderBottom: "1px solid #e2e8f0",
      padding: "0 24px",
      display: "flex",
      gap: 2,
      fontFamily: FONT,
      direction: "rtl",
    }}>
      {TABS.map((tab) => {
        const isActive = tab.label === activeTab;
        return (
          <div
            key={tab.label}
            style={{
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#ea580c" : "#64748b",
              borderBottom: isActive ? "2px solid #ea580c" : "2px solid transparent",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add src/scenes/AdminTabBar.tsx
git commit -m "feat(admin): add AdminTabBar shared component"
```

---

### Task 4: AdminTutorial.tsx shell + Root.tsx

**Files:**
- Create: `src/AdminTutorial.tsx`
- Modify: `src/Root.tsx`

- [ ] **Step 1: Read Root.tsx before editing**

Read `/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video/src/Root.tsx`.

- [ ] **Step 2: Create src/AdminTutorial.tsx**

```typescript
// src/AdminTutorial.tsx
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
import { ADMIN_SCENES } from "../voiceover-admin-config";

// Scene imports — uncommented as tasks complete:
// import { AdminIntroScene } from "./scenes/AdminIntroScene";
// import { AdminOverviewScene } from "./scenes/AdminOverviewScene";
// import { AdminActivityScene } from "./scenes/AdminActivityScene";
// import { AdminTeamScene } from "./scenes/AdminTeamScene";
// import { AdminSessionsScene } from "./scenes/AdminSessionsScene";
// import { AdminMessagesScene } from "./scenes/AdminMessagesScene";
// import { AdminSubscriptionScene } from "./scenes/AdminSubscriptionScene";
// import { AdminOutroScene } from "./scenes/AdminOutroScene";

export type AdminTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = ADMIN_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = ADMIN_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateAdminMetadata: CalculateMetadataFunction<AdminTutorialProps> =
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

export const PetraAdminTutorial: React.FC<AdminTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [
    intro = 300,
    overview = 390,
    activity = 390,
    team = 420,
    sessions = 360,
    messages = 360,
    subscription = 300,
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
        {/*
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <AdminIntroScene />
          <SceneAudio file="voiceover/admin-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={overview} premountFor={fps}>
          <AdminOverviewScene />
          <SceneAudio file="voiceover/admin-overview.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={activity} premountFor={fps}>
          <AdminActivityScene />
          <SceneAudio file="voiceover/admin-activity.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={team} premountFor={fps}>
          <AdminTeamScene />
          <SceneAudio file="voiceover/admin-team.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={sessions} premountFor={fps}>
          <AdminSessionsScene />
          <SceneAudio file="voiceover/admin-sessions.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={messages} premountFor={fps}>
          <AdminMessagesScene />
          <SceneAudio file="voiceover/admin-messages.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={subscription} premountFor={fps}>
          <AdminSubscriptionScene />
          <SceneAudio file="voiceover/admin-subscription.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <AdminOutroScene />
          <SceneAudio file="voiceover/admin-outro.wav" />
        </Series.Sequence>
        */}
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Add PetraAdminTutorial to Root.tsx**

Add import after the last existing tutorial import:
```typescript
import {
  PetraAdminTutorial,
  AdminTutorialProps,
  calculateAdminMetadata,
} from "./AdminTutorial";
import { ADMIN_SCENES } from "../voiceover-admin-config";
```

Add defaultProps constant after the last existing defaultProps:
```typescript
const adminDefaultProps: AdminTutorialProps = {
  sceneDurationsFrames: ADMIN_SCENES.map((s) => s.defaultDurationSec * FPS),
};
```

Add Composition before the closing `</>`:
```tsx
      <Composition
        id="PetraAdminTutorial"
        component={PetraAdminTutorial}
        calculateMetadata={calculateAdminMetadata}
        durationInFrames={
          ADMIN_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={adminDefaultProps}
      />
```

- [ ] **Step 4: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/AdminTutorial.tsx src/Root.tsx
git commit -m "feat(admin): add PetraAdminTutorial shell + Root composition"
```

---

### Task 5: AdminIntroScene

**Files:**
- Create: `src/scenes/AdminIntroScene.tsx`
- Modify: `src/AdminTutorial.tsx` (uncomment intro import + Sequence)

- [ ] **Step 1: Create AdminIntroScene.tsx**

Pattern: identical to `TasksIntroScene.tsx`.

```typescript
// src/scenes/AdminIntroScene.tsx
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

export const AdminIntroScene: React.FC = () => {
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
      <div style={{
        position: "absolute", top: "25%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 500,
        background: `radial-gradient(ellipse, rgba(234,88,12,${0.1 + pulse * 0.05}) 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${10 + i * 11}%`, left: `${3 + i * 12}%`,
          width: i % 2 === 0 ? 4 : 2, height: i % 2 === 0 ? 4 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.15)",
        }} />
      ))}

      <div style={{ transform: `scale(${logoScale})`, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>PETRA</span>
      </div>

      <div style={{
        opacity: badgeOpacity,
        background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.5)",
        borderRadius: 99, padding: "5px 16px", marginBottom: 20,
        color: "#fb923c", fontSize: 13, fontWeight: 600,
      }}>
        מדריך מהיר
      </div>

      <h1 style={{
        color: "white", fontSize: 60, fontWeight: 800,
        margin: 0, marginBottom: 18, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.15, textShadow: "0 2px 20px rgba(234,88,12,0.3)",
      }}>
        ניהול ובקרה
      </h1>

      <p style={{
        color: "#94a3b8", fontSize: 20,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        שקיפות מלאה — כל פעולה, כל משתמש, בזמן אמת
      </p>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment intro in AdminTutorial.tsx**

Read `src/AdminTutorial.tsx`, then:
1. Uncomment: `// import { AdminIntroScene } from "./scenes/AdminIntroScene";`
2. Pull the intro Sequence out of the `{/* ... */}` JSX comment block so it's active. Keep the remaining 7 inside the comment.

```tsx
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <AdminIntroScene />
          <SceneAudio file="voiceover/admin-intro.wav" />
        </Series.Sequence>
        {/*
        <Series.Sequence durationInFrames={overview} premountFor={fps}>
          ...remaining 7 scenes...
        */}
      </Series>
```

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminIntroScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminIntroScene"
```

---

### Task 6: AdminOverviewScene

**Files:**
- Create: `src/scenes/AdminOverviewScene.tsx`
- Modify: `src/AdminTutorial.tsx` (uncomment overview block)

- [ ] **Step 1: Create AdminOverviewScene.tsx**

Layout: `#f1f5f9` bg, PetraSidebar activeLabel="ניהול ובקרה", white header with "ניהול ובקרה" + green pulsing dot "ניטור פעיל", AdminTabBar activeTab="סקירה". 4 stat cards in a row, activity feed below.

```typescript
// src/scenes/AdminOverviewScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const STATS = [
  { value: 3,      label: "חברי צוות פעילים", color: "#2563eb" },
  { value: 48,     label: "לקוחות",            color: "#16a34a" },
  { value: 6,      label: "תורים היום",        color: "#ea580c" },
  { value: 12450,  label: "הכנסות החודש",      color: "#d97706", currency: true },
];

const ACTIVITY = [
  { name: "דני כ׳",  action: "הוסיף לקוח",    time: "לפני 3 דק׳",  color: "#16a34a" },
  { name: "שרה ל׳",  action: "קבע תור",        time: "לפני 12 דק׳", color: "#2563eb" },
  { name: "מיכל ב׳", action: "יצר הזמנה",      time: "לפני 28 דק׳", color: "#16a34a" },
  { name: "דני כ׳",  action: "שלח תזכורת",     time: "לפני 45 דק׳", color: "#2563eb" },
];

export const AdminOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
              opacity: 0.6 + pulse * 0.4,
            }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>

        {/* Tab bar */}
        <div style={{ opacity: headerOpacity }}>
          <AdminTabBar activeTab="סקירה" />
        </div>

        <div style={{ padding: "16px 24px" }}>
          {/* Stat cards row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {STATS.map((stat, i) => {
              const startFrame = 20 + i * 25;
              const cardP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const cardY = interpolate(cardP, [0, 1], [24, 0]);
              const cardOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });

              const counterProgress = interpolate(frame, [startFrame + 5, startFrame + 50], [0, 1], { extrapolateRight: "clamp" });
              const current = Math.round(counterProgress * stat.value);
              const display = stat.currency ? `₪${current.toLocaleString()}` : String(current);

              return (
                <div key={stat.label} style={{
                  background: "white", borderRadius: 14, padding: "16px",
                  border: "1px solid #e2e8f0", borderTop: `3px solid ${stat.color}`,
                  opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{display}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginTop: 4 }}>{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Activity feed */}
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{
              padding: "12px 18px", borderBottom: "1px solid #f1f5f9",
              fontSize: 12, fontWeight: 700, color: "#0f172a",
              opacity: headerOpacity,
            }}>
              פעילות אחרונה
            </div>
            {ACTIVITY.map((item, i) => {
              const startFrame = 120 + i * 25;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-30, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 18px",
                  borderBottom: i < ACTIVITY.length - 1 ? "1px solid #f8fafc" : "none",
                  opacity: rowOpacity, transform: `translateX(${rowX}px)`,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: item.color, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "white", flexShrink: 0,
                  }}>
                    {item.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.name}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}> — {item.action}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.time}</div>
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

- [ ] **Step 2: Uncomment overview block in AdminTutorial.tsx**

Uncomment the import: `import { AdminOverviewScene } from "./scenes/AdminOverviewScene";`

Pull overview Sequence out of the comment block so it's active after intro. Keep remaining 6 in comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminOverviewScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminOverviewScene"
```

---

### Task 7: AdminActivityScene

**Files:**
- Create: `src/scenes/AdminActivityScene.tsx`
- Modify: `src/AdminTutorial.tsx`

- [ ] **Step 1: Create AdminActivityScene.tsx**

```typescript
// src/scenes/AdminActivityScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const ACTIONS = [
  { user: "דני כהן",       action: "הוסיף לקוח",     time: "לפני 3 דק׳",   color: "#16a34a" },
  { user: "שרה לוי",        action: "קבע תור",         time: "לפני 12 דק׳",  color: "#2563eb" },
  { user: "דני כהן",       action: "יצר הזמנה",       time: "לפני 28 דק׳",  color: "#16a34a" },
  { user: "מיכל ברנשטיין", action: "מחק תור",         time: "לפני 1 שע׳",   color: "#ef4444" },
  { user: "שרה לוי",        action: "עדכן הגדרות",    time: "לפני 2 שע׳",   color: "#2563eb" },
  { user: "דני כהן",       action: "הוסיף לקוח",     time: "לפני 3 שע׳",   color: "#16a34a" },
];

export const AdminActivityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const filtersOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" });
  const calloutOpacity = interpolate(frame, [280, 300], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <AdminTabBar activeTab="פעילות" />
        </div>

        <div style={{ padding: "16px 24px" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, opacity: filtersOpacity }}>
            {["כל חברי הצוות ▾", "כל הפעולות ▾"].map((f) => (
              <div key={f} style={{
                background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#475569",
                cursor: "pointer",
              }}>
                {f}
              </div>
            ))}
          </div>

          {/* Activity table */}
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 14 }}>
            {ACTIONS.map((item, i) => {
              const startFrame = 30 + i * 28;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-30, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "11px 18px",
                  borderBottom: i < ACTIONS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity, transform: `translateX(${rowX}px)`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: item.color, flexShrink: 0,
                  }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", width: 110 }}>{item.user}</div>
                  <div style={{ fontSize: 12, color: "#475569", flex: 1 }}>{item.action}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.time}</div>
                </div>
              );
            })}
          </div>

          {/* Callout */}
          <div style={{
            background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.25)",
            borderRadius: 12, padding: "12px 18px", opacity: calloutOpacity,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>
              כל פעולה נשמרת — לא ניתן למחוק מהיסטוריית הפעילות
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment activity block in AdminTutorial.tsx**

Uncomment import + pull activity Sequence out of comment. Keep remaining 5 in comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminActivityScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminActivityScene"
```

---

### Task 8: AdminTeamScene

**Files:**
- Create: `src/scenes/AdminTeamScene.tsx`
- Modify: `src/AdminTutorial.tsx`

- [ ] **Step 1: Create AdminTeamScene.tsx**

4 team member rows. Role badges color-coded. Online indicator dots. Row 2 (שרה) shows a role dropdown appearing at frame 230.

```typescript
// src/scenes/AdminTeamScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  "בעלים": { bg: "rgba(245,158,11,0.12)", text: "#b45309" },
  "מנהל":  { bg: "rgba(139,92,246,0.12)", text: "#7c3aed" },
  "עובד":  { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
};

const MEMBERS = [
  { name: "דני כהן",          role: "בעלים", online: true,  lastSeen: "אונליין עכשיו" },
  { name: "שרה לוי",           role: "מנהל",  online: true,  lastSeen: "לפני 2 דק׳" },
  { name: "מיכל ברנשטיין",    role: "עובד",  online: false, lastSeen: "לפני 3 שע׳" },
  { name: "יוסי מזרחי",       role: "עובד",  online: false, lastSeen: "לפני יום" },
];

const DROPDOWN_FRAME = 230;

export const AdminTeamScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const dropdownOpacity = interpolate(frame, [DROPDOWN_FRAME, DROPDOWN_FRAME + 12], [0, 1], { extrapolateRight: "clamp" });
  const dropdownP = spring({ frame: frame - DROPDOWN_FRAME, fps, config: { damping: 200 } });
  const dropdownY = interpolate(dropdownP, [0, 1], [-8, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <AdminTabBar activeTab="צוות" />
        </div>

        <div style={{ padding: "16px 24px" }}>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 80px",
              padding: "10px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
              opacity: headerOpacity,
            }}>
              {["שם", "תפקיד", "פעילות אחרונה", ""].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</div>
              ))}
            </div>

            {MEMBERS.map((member, i) => {
              const startFrame = 20 + i * 35;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-30, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });
              const roleStyle = ROLE_COLORS[member.role];
              const isEditRow = i === 1; // שרה row shows dropdown

              return (
                <div key={member.name} style={{ position: "relative" }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 80px",
                    alignItems: "center", padding: "13px 18px",
                    borderBottom: i < MEMBERS.length - 1 ? "1px solid #f1f5f9" : "none",
                    opacity: rowOpacity, transform: `translateX(${rowX}px)`,
                  }}>
                    {/* Name + online dot */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "#475569", flexShrink: 0,
                      }}>
                        {member.name[0]}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{member.name}</span>
                    </div>
                    {/* Role badge */}
                    <div style={{
                      display: "inline-block",
                      background: roleStyle.bg, color: roleStyle.text,
                      borderRadius: 99, padding: "3px 10px",
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {member.role}
                    </div>
                    {/* Last seen */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: member.online ? "#22c55e" : "#cbd5e1",
                      }} />
                      <span style={{ fontSize: 11, color: "#64748b" }}>{member.lastSeen}</span>
                    </div>
                    {/* Edit button */}
                    <div style={{
                      background: "#f1f5f9", borderRadius: 8, padding: "5px 12px",
                      fontSize: 11, fontWeight: 700, color: "#475569", textAlign: "center",
                      cursor: "pointer",
                    }}>
                      ערוך
                    </div>
                  </div>

                  {/* Role dropdown for שרה's row */}
                  {isEditRow && frame >= DROPDOWN_FRAME && (
                    <div style={{
                      position: "absolute", left: 18, top: "100%",
                      background: "white", borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                      zIndex: 50, width: 140,
                      opacity: dropdownOpacity, transform: `translateY(${dropdownY}px)`,
                    }}>
                      {["בעלים", "מנהל", "עובד"].map((role) => (
                        <div key={role} style={{
                          padding: "9px 14px", fontSize: 12, fontWeight: 600,
                          color: role === "מנהל" ? "#ea580c" : "#475569",
                          background: role === "מנהל" ? "rgba(234,88,12,0.05)" : "transparent",
                          borderBottom: role !== "עובד" ? "1px solid #f1f5f9" : "none",
                          cursor: "pointer",
                        }}>
                          {role}
                        </div>
                      ))}
                    </div>
                  )}
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

- [ ] **Step 2: Uncomment team block in AdminTutorial.tsx**

Uncomment import + pull team Sequence out of comment. Keep remaining 4 in comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminTeamScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminTeamScene"
```

---

### Task 9: AdminSessionsScene

**Files:**
- Create: `src/scenes/AdminSessionsScene.tsx`
- Modify: `src/AdminTutorial.tsx`

- [ ] **Step 1: Create AdminSessionsScene.tsx**

```typescript
// src/scenes/AdminSessionsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const SESSIONS = [
  { user: "דני כהן",        device: "iPhone",   ip: "212.143.xx.xx", online: true,  lastSeen: "אונליין עכשיו" },
  { user: "שרה לוי",         device: "Mac",      ip: "77.125.xx.xx",  online: true,  lastSeen: "לפני 2 דק׳" },
  { user: "מיכל ברנשטיין",  device: "Android",  ip: "46.120.xx.xx",  online: false, lastSeen: "לפני 3 שע׳" },
  { user: "יוסי מזרחי",    device: "Windows",  ip: "31.168.xx.xx",  online: false, lastSeen: "לפני יום" },
];

export const AdminSessionsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const calloutOpacity = interpolate(frame, [250, 270], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <AdminTabBar activeTab="סשנים" />
        </div>

        <div style={{ padding: "16px 24px" }}>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 14 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 40px",
              padding: "10px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
              opacity: headerOpacity,
            }}>
              {["שם", "מכשיר", "IP", "פעילות", ""].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</div>
              ))}
            </div>

            {SESSIONS.map((session, i) => {
              const startFrame = 20 + i * 35;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-30, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={session.user} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 40px",
                  alignItems: "center", padding: "12px 18px",
                  borderBottom: i < SESSIONS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity, transform: `translateX(${rowX}px)`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{session.user}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>{session.device}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{session.ip}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: session.online ? "#22c55e" : "#cbd5e1",
                    }} />
                    <span style={{ fontSize: 11, color: "#64748b" }}>{session.lastSeen}</span>
                  </div>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "#ef4444", fontWeight: 800, cursor: "pointer",
                  }}>
                    ✕
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.25)",
            borderRadius: 12, padding: "12px 18px", opacity: calloutOpacity,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>
              ניתוק מרחוק — לחצו על ✕ לניתוק מיידי של סשן חשוד
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Uncomment sessions block in AdminTutorial.tsx**

Uncomment import + pull sessions Sequence out of comment. Keep remaining 3 in comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminSessionsScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminSessionsScene"
```

---

### Task 10: AdminMessagesScene

**Files:**
- Create: `src/scenes/AdminMessagesScene.tsx`
- Modify: `src/AdminTutorial.tsx`

- [ ] **Step 1: Create AdminMessagesScene.tsx**

```typescript
// src/scenes/AdminMessagesScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const EXISTING_MESSAGES = [
  { title: "עדכון מערכת", date: "01.04.2026", expiry: "30.04.2026", active: true },
  { title: "חגי ניסן",    date: "15.03.2026", expiry: "25.03.2026", active: false },
];

export const AdminMessagesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const formOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const formP = spring({ frame: frame - 25, fps, config: { damping: 200 } });
  const formY = interpolate(formP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <AdminTabBar activeTab="הודעות מערכת" />
        </div>

        <div style={{ padding: "16px 24px" }}>
          {/* New message form */}
          <div style={{
            background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
            padding: "18px", marginBottom: 14,
            opacity: formOpacity, transform: `translateY(${formY}px)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>הוסף הודעה</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>כותרת</div>
              <div style={{
                border: "2px solid #3b82f6", borderRadius: 8, padding: "8px 12px",
                fontSize: 13, fontWeight: 600, color: "#0f172a",
              }}>
                סגירה לחגים
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>תוכן</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
                fontSize: 12, color: "#475569",
              }}>
                העסק סגור 25–28 אפריל לחופשת פסח
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>תאריך תפוגה</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#0f172a" }}>28.04.2026</div>
              </div>
              <div style={{
                background: ORANGE, color: "white", borderRadius: 8,
                padding: "9px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}>
                פרסם
              </div>
            </div>
          </div>

          {/* Existing messages */}
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {EXISTING_MESSAGES.map((msg, i) => {
              const startFrame = 160 + i * 30;
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={msg.title} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                  borderBottom: i < EXISTING_MESSAGES.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{msg.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>נוצר: {msg.date} · תפוגה: {msg.expiry}</div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: msg.active ? "#16a34a" : "#ef4444",
                    background: msg.active ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
                    borderRadius: 99, padding: "3px 10px",
                  }}>
                    {msg.active ? "פעיל" : "פג תוקף"}
                  </div>
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

- [ ] **Step 2: Uncomment messages block in AdminTutorial.tsx**

Uncomment import + pull messages Sequence out of comment. Keep remaining 2 in comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminMessagesScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminMessagesScene"
```

---

### Task 11: AdminSubscriptionScene

**Files:**
- Create: `src/scenes/AdminSubscriptionScene.tsx`
- Modify: `src/AdminTutorial.tsx`

- [ ] **Step 1: Create AdminSubscriptionScene.tsx**

```typescript
// src/scenes/AdminSubscriptionScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const BILLING = [
  { date: "01.04.2026", desc: "חיוב חודשי PRO", amount: "₪149", paid: true },
  { date: "01.03.2026", desc: "חיוב חודשי PRO", amount: "₪149", paid: true },
  { date: "01.02.2026", desc: "חיוב חודשי PRO", amount: "₪149", paid: true },
];

export const AdminSubscriptionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const cardP = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const cardY = interpolate(cardP, [0, 1], [24, 0]);
  const cardOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <AdminTabBar activeTab="מנוי וחיוב" />
        </div>

        <div style={{ padding: "16px 24px" }}>
          {/* Plan card */}
          <div style={{
            background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
            borderTop: `3px solid ${ORANGE}`, padding: "20px",
            marginBottom: 14,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  background: "rgba(234,88,12,0.1)", color: ORANGE,
                  borderRadius: 8, padding: "4px 12px",
                  fontSize: 13, fontWeight: 800,
                }}>
                  תוכנית PRO
                </div>
                <div style={{
                  background: "rgba(22,163,74,0.08)", color: "#16a34a",
                  borderRadius: 99, padding: "3px 10px",
                  fontSize: 11, fontWeight: 700,
                }}>
                  פעיל
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>₪149<span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>/חודש</span></div>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>מתחדש ב-01.05.2026</div>
            <div style={{
              background: "rgba(234,88,12,0.06)", borderRadius: 8, padding: "8px 14px",
              display: "inline-block",
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>23 </span>
              <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>ימים שנותרו</span>
            </div>
          </div>

          {/* Billing history */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10, opacity: cardOpacity }}>היסטוריית חיוב</div>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {BILLING.map((item, i) => {
              const startFrame = 120 + i * 30;
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateRight: "clamp" });
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [10, 0]);

              return (
                <div key={item.date} style={{
                  display: "flex", alignItems: "center", padding: "12px 18px", gap: 12,
                  borderBottom: i < BILLING.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.desc}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{item.date}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{item.amount}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#16a34a",
                    background: "rgba(22,163,74,0.08)", borderRadius: 99, padding: "3px 10px",
                  }}>
                    ✓ שולם
                  </div>
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

- [ ] **Step 2: Uncomment subscription block in AdminTutorial.tsx**

Uncomment import + pull subscription Sequence out of comment. Keep only outro in comment.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminSubscriptionScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminSubscriptionScene"
```

---

### Task 12: AdminOutroScene

**Files:**
- Create: `src/scenes/AdminOutroScene.tsx`
- Modify: `src/AdminTutorial.tsx` (final cleanup — all 8 scenes active)

- [ ] **Step 1: Create AdminOutroScene.tsx**

Pattern: identical to `TasksOutroScene.tsx`.

```typescript
// src/scenes/AdminOutroScene.tsx
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
  { text: "פיקוח על הצוות" },
  { text: "היסטוריית פעילות" },
  { text: "ניהול הרשאות" },
];

export const AdminOutroScene: React.FC = () => {
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
        opacity: titleOpacity, transform: `translateY(${titleY}px)`, lineHeight: 1.2,
      }}>
        ניהול ובקרה של פטרה
      </h1>
      <p style={{
        color: "white", fontSize: 20, fontWeight: 700,
        margin: 0, marginBottom: 32, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
      }}>
        שקיפות מלאה על כל מה שקורה בעסק
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 36, justifyContent: "center" }}>
        {BENEFITS.map((b, i) => {
          const bOpacity = interpolate(frame, [50 + i * 10, 62 + i * 10], [0, 1], { extrapolateRight: "clamp" });
          const bP = spring({ frame: frame - 50 - i * 10, fps, config: { damping: 200 } });
          const bScale = interpolate(bP, [0, 1], [0.8, 1]);
          return (
            <div key={b.text} style={{
              opacity: bOpacity, transform: `scale(${bScale})`,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
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
        display: "flex", alignItems: "center", gap: 12, direction: "rtl",
      }}>
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>התחילו עכשיו בחינם</span>
        <span style={{ color: "white", fontSize: 20 }}>←</span>
      </div>

      <div style={{ marginTop: 18, opacity: urlOpacity }}>
        <span style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>petra-app.com</span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Final cleanup of AdminTutorial.tsx**

Uncomment import: `import { AdminOutroScene } from "./scenes/AdminOutroScene";`

Remove the entire remaining `{/* ... */}` JSX comment block and replace with the active outro Sequence:

```tsx
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <AdminOutroScene />
          <SceneAudio file="voiceover/admin-outro.wav" />
        </Series.Sequence>
```

All 8 Sequences should now be active with no commented code.

- [ ] **Step 3: TypeScript check**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/AdminOutroScene.tsx src/AdminTutorial.tsx
git commit -m "feat(admin): add AdminOutroScene — all 8 scenes active"
```

---

### Task 13: Final Integration Check

**Files:** No new files — verification only.

- [ ] **Step 1: TypeScript clean build**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Verify all 8 WAV files**

```bash
ls $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video/public/voiceover/admin-'*.wav
```

Expected: 8 files — admin-intro, admin-overview, admin-activity, admin-team, admin-sessions, admin-messages, admin-subscription, admin-outro.

- [ ] **Step 3: Verify PetraAdminTutorial in Root.tsx**

```bash
grep "PetraAdminTutorial" $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video/src/Root.tsx'
```

Expected: import + defaultProps + `id="PetraAdminTutorial"` composition lines.

- [ ] **Step 4: Verify all 8 scene files + AdminTabBar**

```bash
ls $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video/src/scenes/Admin'*.tsx
```

Expected: 9 files (AdminTabBar + 8 scenes).

- [ ] **Step 5: Final commit**

```bash
cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app/my-video'
git add -A
git commit -m "feat(admin): complete PetraAdminTutorial" --allow-empty
```
