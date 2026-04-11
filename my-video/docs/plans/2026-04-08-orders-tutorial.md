# Orders Tutorial Video — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `PetraOrdersTutorial` Remotion composition — 8 scenes, Hebrew voiceover via Gemini TTS, matching the style of the Sales/Customers/Finances tutorials.

**Architecture:** One config file drives scene IDs + voiceover texts. A generation script produces WAV files. Each scene is an independent `.tsx` component. `OrdersTutorial.tsx` composes them via `<Series>` with `calculateMetadata` reading actual audio durations.

**Tech Stack:** Remotion 4.x, TypeScript/React, Gemini 2.5 Flash TTS (`gemini-2.5-flash-preview-tts`), `@google/generative-ai` npm package, Node.js WAV generation script.

**Project root:** `/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video`

---

## Task 1: Voiceover config + WAV generation script

**Files:**
- Create: `voiceover-orders-config.ts`
- Create: `scripts/generate-orders-voiceover.js`

- [ ] **Step 1: Create voiceover config**

Create `voiceover-orders-config.ts` at project root:

```typescript
export const ORDERS_SCENES = [
  {
    id: "orders-intro",
    text: "ברוכים הבאים למדריך מערכת ההזמנות של פטרה. כאן תלמדו ליצור הזמנות ולהבין איך הן מחברות את כל העסק שלכם.",
    defaultDurationSec: 8,
  },
  {
    id: "orders-hub",
    text: "כל פעולה בעסק — תור, פנסיון, אילוף, מכירת מוצר — מתועדת כהזמנה. הזמנה מחברת את הלקוח, הכלב, השירות, הַתַּשְׁלוּם, והתזכורות — למקום אחד.",
    defaultDurationSec: 14,
  },
  {
    id: "orders-types",
    text: "יש ארבעה סוגי הזמנות — אילוף, פנסיון, טיפוח, ומוצרים. הבחירה קובעת מה ייפָּתַח אוטומטית בהמשך — כלוב בפנסיון, תהליך אילוף, או תור ביומן.",
    defaultDurationSec: 14,
  },
  {
    id: "orders-customer",
    text: "בוחרים לקוח — הכלב שלו מופיע אוטומטית. לפנסיון בוחרים תאריכי כניסה ויציאה, והמערכת מחשבת לילות ועלות לבד.",
    defaultDurationSec: 16,
  },
  {
    id: "orders-items",
    text: "בשלב הפריטים — המחירון שבניתם נשלף אוטומטית. בוחרים שירות, מגדירים כמות, והמחיר מחושב לבד. המחירון מוגדר בְּמַעֲרֶכֶת הפיננסים.",
    defaultDurationSec: 10,
  },
  {
    id: "orders-auto",
    text: "ברגע שיוצרים הזמנת פנסיון — כלוב נפתח אוטומטית בְּמַעֲרֶכֶת הפנסיון. הזמנת אילוף — תהליך אילוף נפתח לבד. וכל הזמנה עם תאריך — תזכורת בוואטסאפ מתוזמנת אוטומטית.",
    defaultDurationSec: 18,
  },
  {
    id: "orders-lifecycle",
    text: "לאחר יצירת ההזמנה — אשרו אותה ועדכנו סטטוס כשהשירות הושלם. מֵעַמּוּד ההזמנה שולחים דרישת תשלום בוואטסאפ ורושמים תשלום שהתקבל.",
    defaultDurationSec: 14,
  },
  {
    id: "orders-outro",
    text: "מַעֲרֶכֶת ההזמנות של פטרה — כל שירות, כל לקוח, כל תשלום, במקום אחד. צרו הזמנה עכשיו וְתִרְאוּ אֶת הַהֶבְדֵּל.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Create WAV generation script**

Create `scripts/generate-orders-voiceover.js`:

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const { ORDERS_SCENES } = require("../voiceover-orders-config");

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OUT_DIR = path.join(__dirname, "../public/voiceover");

function buildWav(pcmData, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  header.writeUInt16LE(channels * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmData]);
}

async function generateOne(scene) {
  const outPath = path.join(OUT_DIR, `${scene.id}.wav`);
  if (fs.existsSync(outPath)) {
    console.log(`SKIP (exists): ${scene.id}`);
    return;
  }
  console.log(`Generating: ${scene.id} ...`);
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: scene.text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
    },
  });
  const part = result.response.candidates[0].content.parts[0];
  const rawBuffer = Buffer.from(part.inlineData.data, "base64");
  const wavBuffer = buildWav(rawBuffer);
  // Verify RIFF header
  if (wavBuffer.slice(0, 4).toString() !== "RIFF") {
    throw new Error(`WAV header missing for ${scene.id}!`);
  }
  fs.writeFileSync(outPath, wavBuffer);
  console.log(`  -> ${(wavBuffer.length / 1024).toFixed(0)} KB written`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const scene of ORDERS_SCENES) {
    await generateOne(scene);
    await new Promise(r => setTimeout(r, 500)); // avoid rate limiting
  }
  console.log("Done.");
}

main().catch(console.error);
```

- [ ] **Step 3: Run generation**

```bash
cd "/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video"
GEMINI_API_KEY=<your_key> node scripts/generate-orders-voiceover.js
```

Expected output: 8 lines `-> NNN KB written`, no errors.

- [ ] **Step 4: Verify WAV files**

```bash
for f in public/voiceover/orders-*.wav; do
  echo -n "$f: "
  xxd "$f" | head -1 | cut -c10-20
done
```

Expected: each file shows `5249 4646` (= "RIFF"). If any show `0000 0000`, the WAV header is missing — re-run generation for that file.

- [ ] **Step 5: Commit**

```bash
git add voiceover-orders-config.ts scripts/generate-orders-voiceover.js public/voiceover/orders-*.wav
git commit -m "feat(video): add orders tutorial voiceover config + WAV files"
```

---

## Task 2: OrdersTutorial.tsx scaffold + Root.tsx registration

**Files:**
- Create: `src/OrdersTutorial.tsx`
- Modify: `src/Root.tsx`

- [ ] **Step 1: Create OrdersTutorial.tsx**

Create `src/OrdersTutorial.tsx`:

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
import { OrdersIntroScene } from "./scenes/OrdersIntroScene";
import { OrdersHubScene } from "./scenes/OrdersHubScene";
import { OrdersTypesScene } from "./scenes/OrdersTypesScene";
import { OrdersCustomerScene } from "./scenes/OrdersCustomerScene";
import { OrdersItemsScene } from "./scenes/OrdersItemsScene";
import { OrdersAutoScene } from "./scenes/OrdersAutoScene";
import { OrdersLifecycleScene } from "./scenes/OrdersLifecycleScene";
import { OrdersOutroScene } from "./scenes/OrdersOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { ORDERS_SCENES } from "../voiceover-orders-config";

export type OrdersTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = ORDERS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = ORDERS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateOrdersMetadata: CalculateMetadataFunction<OrdersTutorialProps> =
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

export const OrdersTutorial: React.FC<OrdersTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, hub, types, customer, items, auto, lifecycle, outro] =
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
          <OrdersIntroScene />
          <SceneAudio file="voiceover/orders-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={hub} premountFor={fps}>
          <OrdersHubScene />
          <SceneAudio file="voiceover/orders-hub.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={types} premountFor={fps}>
          <OrdersTypesScene />
          <SceneAudio file="voiceover/orders-types.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={customer} premountFor={fps}>
          <OrdersCustomerScene />
          <SceneAudio file="voiceover/orders-customer.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={items} premountFor={fps}>
          <OrdersItemsScene />
          <SceneAudio file="voiceover/orders-items.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={auto} premountFor={fps}>
          <OrdersAutoScene />
          <SceneAudio file="voiceover/orders-auto.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={lifecycle} premountFor={fps}>
          <OrdersLifecycleScene />
          <SceneAudio file="voiceover/orders-lifecycle.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <OrdersOutroScene />
          <SceneAudio file="voiceover/orders-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Register in Root.tsx**

Add to `src/Root.tsx` — imports section:

```typescript
import {
  OrdersTutorial,
  OrdersTutorialProps,
  calculateOrdersMetadata,
} from "./OrdersTutorial";
import { ORDERS_SCENES } from "../voiceover-orders-config";
```

Add inside `<>` block (after the existing 3 compositions):

```typescript
<Composition
  id="PetraOrdersTutorial"
  component={OrdersTutorial}
  calculateMetadata={calculateOrdersMetadata}
  durationInFrames={
    ORDERS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
  }
  fps={FPS}
  width={1280}
  height={720}
  defaultProps={{
    sceneDurationsFrames: ORDERS_SCENES.map((s) => s.defaultDurationSec * FPS),
  }}
/>
```

- [ ] **Step 3: Create stub scene files so TypeScript compiles**

Create each of these as a minimal stub (will be replaced in later tasks):

`src/scenes/OrdersIntroScene.tsx`:
```typescript
export const OrdersIntroScene: React.FC = () => <div />;
```

Repeat for: `OrdersHubScene`, `OrdersTypesScene`, `OrdersCustomerScene`, `OrdersItemsScene`, `OrdersAutoScene`, `OrdersLifecycleScene`, `OrdersOutroScene`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video"
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/OrdersTutorial.tsx src/Root.tsx src/scenes/Orders*.tsx
git commit -m "feat(video): scaffold OrdersTutorial composition + stub scenes"
```

---

## Task 3: OrdersIntroScene

**Files:**
- Modify: `src/scenes/OrdersIntroScene.tsx`

- [ ] **Step 1: Write the scene**

Replace stub with full implementation in `src/scenes/OrdersIntroScene.tsx`:

```typescript
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

export const OrdersIntroScene: React.FC = () => {
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
        מערכת ההזמנות
      </h1>

      {/* Subtitle */}
      <p style={{
        color: "#94a3b8", fontSize: 20,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity,
        transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        ניהול שירותים, לקוחות ותשלומים — במקום אחד
      </p>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify in Remotion Studio**

Open `http://localhost:3004/PetraOrdersTutorial` (or whichever port the studio is running on) and scrub to frame 0. Confirm: dark background, Petra logo + "PETRA" text, orange badge "מדריך מהיר", title "מערכת ההזמנות", subtitle in grey.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OrdersIntroScene.tsx
git commit -m "feat(video): add OrdersIntroScene"
```

---

## Task 4: OrdersHubScene — animated hub infographic

**Files:**
- Modify: `src/scenes/OrdersHubScene.tsx`

- [ ] **Step 1: Write the scene**

```typescript
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

// Nodes arranged around center (640, 340)
// Center of canvas: 640x720 → center at 640, 360
const CENTER_X = 600;
const CENTER_Y = 330;

const NODES = [
  { label: "לקוח + כלב",      icon: "👤", x: 600, y: 120,  delay: 20 },
  { label: "פנסיון",           icon: "🏠", x: 920, y: 230,  delay: 35 },
  { label: "תהליך אילוף",      icon: "🐾", x: 920, y: 430,  delay: 50 },
  { label: "תשלום",            icon: "💳", x: 600, y: 530,  delay: 65 },
  { label: "תזכורת WhatsApp",  icon: "📲", x: 280, y: 330,  delay: 80 },
];

const Node: React.FC<{
  label: string;
  icon: string;
  x: number;
  y: number;
  delay: number;
  frame: number;
  fps: number;
}> = ({ label, icon, x, y, delay, frame, fps }) => {
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const nodeOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(progress, [0, 1], [0.7, 1]);

  return (
    <div style={{
      position: "absolute",
      left: x - 72, top: y - 26,
      opacity: nodeOpacity,
      transform: `scale(${scale})`,
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 12,
      padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 8,
      direction: "rtl",
      width: 144,
      backdropFilter: "blur(4px)",
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
};

const ConnectingLine: React.FC<{
  x1: number; y1: number;
  x2: number; y2: number;
  delay: number;
  frame: number;
}> = ({ x1, y1, x2, y2, delay, frame }) => {
  const progress = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: "clamp" });
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div style={{
      position: "absolute",
      left: x1, top: y1 - 1,
      width: length * progress,
      height: 2,
      background: "linear-gradient(90deg, rgba(234,88,12,0.6), rgba(234,88,12,0.2))",
      transform: `rotate(${angle}deg)`,
      transformOrigin: "0 50%",
      borderRadius: 2,
    }} />
  );
};

export const OrdersHubScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const centerProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const centerScale = interpolate(centerProgress, [0, 1], [0.6, 1]);
  const centerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 45%, rgba(234,88,12,${0.08 + pulse * 0.05}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      fontFamily: FONT,
      direction: "rtl",
    }}>
      {/* Connecting lines (drawn before nodes so nodes appear on top) */}
      {NODES.map((node) => (
        <ConnectingLine
          key={node.label}
          x1={CENTER_X} y1={CENTER_Y}
          x2={node.x} y2={node.y}
          delay={node.delay - 8}
          frame={frame}
        />
      ))}

      {/* Center card */}
      <div style={{
        position: "absolute",
        left: CENTER_X - 70, top: CENTER_Y - 36,
        opacity: centerOpacity,
        transform: `scale(${centerScale})`,
        background: "linear-gradient(135deg, #ea580c, #c2410c)",
        borderRadius: 16,
        padding: "16px 28px",
        boxShadow: "0 8px 40px rgba(234,88,12,0.5)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "white" }}>הזמנה</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>מרכז הניהול</span>
      </div>

      {/* Nodes */}
      {NODES.map((node) => (
        <Node key={node.label} {...node} frame={frame} fps={fps} />
      ))}

      {/* Bottom label */}
      <div style={{
        position: "absolute",
        bottom: 40, left: 0, right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [90, 105], [0, 1], { extrapolateRight: "clamp" }),
        color: "rgba(255,255,255,0.4)",
        fontSize: 13, fontWeight: 500,
      }}>
        כל הזמנה מניעה את כל המערכות בפטרה
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify in Remotion Studio**

Scrub through the hub scene. Confirm: center orange "הזמנה" card appears first with spring, then 5 nodes appear one by one with connecting lines animating outward. Lines radiate from center to each node.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OrdersHubScene.tsx
git commit -m "feat(video): add OrdersHubScene infographic"
```

---

## Task 5: OrdersTypesScene — order type selector

**Files:**
- Modify: `src/scenes/OrdersTypesScene.tsx`

**Browser reference:** Before writing this scene, open the Petra dev app and navigate to any orders page → click "הזמנה חדשה" → observe the exact step-0 category card layout, colors, Hebrew labels, and card proportions. Match these precisely.

- [ ] **Step 1: Connect to Petra app in browser and observe the CreateOrderModal step 0**

Start the Petra dev server if not running:
```bash
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'; node node_modules/.bin/next dev) > /tmp/petra-dev.log 2>&1 &
```
Open `http://localhost:3000` in browser, navigate to Orders/Finances, click "הזמנה חדשה". Take note of exact card layout.

- [ ] **Step 2: Write the scene**

```typescript
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const ORDER_TYPES = [
  {
    id: "training",
    label: "אילוף",
    icon: "🐾",
    subLabel: "יוצר תהליך אילוף אוטומטית",
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    delay: 30,
  },
  {
    id: "boarding",
    label: "פנסיון",
    icon: "🏠",
    subLabel: "פותח כלוב בפנסיון אוטומטית",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    delay: 50,
  },
  {
    id: "grooming",
    label: "טיפוח",
    icon: "✂️",
    subLabel: "קובע תור ביומן",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    delay: 70,
  },
  {
    id: "products",
    label: "מוצרים",
    icon: "🛒",
    subLabel: "מכירה ישירה",
    gradient: "linear-gradient(135deg, #64748b, #475569)",
    delay: 90,
  },
];

export const OrdersTypesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const modalOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.94, 1]);

  // Highlight ring cycles through types after all are shown
  const highlightIndex = Math.floor(
    interpolate(frame, [110, 350], [0, ORDER_TYPES.length], { extrapolateRight: "clamp" })
  ) % ORDER_TYPES.length;

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      {/* Content area */}
      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Topbar */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>ניהול הזמנות ושירותים</div>
          </div>
          <div style={{
            background: "#ea580c", color: "white",
            borderRadius: 8, padding: "7px 16px",
            fontSize: 12, fontWeight: 700,
          }}>
            + הזמנה חדשה
          </div>
        </div>

        {/* Modal overlay */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.45)",
          opacity: modalOpacity,
        }}>
          <div style={{
            background: "white",
            borderRadius: 20,
            padding: "32px 36px",
            width: 560,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            {/* Modal header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>הזמנה חדשה</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>בחרו את סוג ההזמנה</div>
            </div>

            {/* 2×2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {ORDER_TYPES.map((type, i) => {
                const cardProgress = spring({ frame: frame - type.delay, fps, config: { damping: 200 } });
                const cardOpacity = interpolate(frame, [type.delay, type.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                const cardScale = interpolate(cardProgress, [0, 1], [0.85, 1]);
                const isHighlighted = frame > 110 && highlightIndex === i;

                return (
                  <div key={type.id} style={{
                    opacity: cardOpacity,
                    transform: `scale(${cardScale})`,
                    borderRadius: 14,
                    padding: "20px 18px",
                    background: isHighlighted ? type.gradient : "white",
                    border: isHighlighted
                      ? "2px solid transparent"
                      : "2px solid #e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: isHighlighted ? "0 6px 20px rgba(0,0,0,0.15)" : "none",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <span style={{ fontSize: 28 }}>{type.icon}</span>
                    <div style={{
                      fontSize: 16, fontWeight: 800,
                      color: isHighlighted ? "white" : "#0f172a",
                    }}>
                      {type.label}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: isHighlighted ? "rgba(255,255,255,0.8)" : "#94a3b8",
                      lineHeight: 1.4,
                    }}>
                      {type.subLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Compare with real app and adjust**

After viewing in Remotion Studio, open the real app modal and adjust colors, spacing, or label text to match.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/OrdersTypesScene.tsx
git commit -m "feat(video): add OrdersTypesScene"
```

---

## Task 6: OrdersCustomerScene — customer + pet + dates

**Files:**
- Modify: `src/scenes/OrdersCustomerScene.tsx`

**Browser reference:** Open the real CreateOrderModal, select "פנסיון", and view step 1. Note: customer search field style, pet selection badges, date picker layout, the nights calculation display.

- [ ] **Step 1: Write the scene**

```typescript
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

export const OrdersCustomerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.94, 1]);
  const modalOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: "clamp" });

  // Fields animate in sequence across the full voiceover duration
  const customerOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const customerHighlight = interpolate(frame, [45, 80], [0, 1], { extrapolateRight: "clamp" });
  const petOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateRight: "clamp" });
  const checkInOpacity = interpolate(frame, [140, 155], [0, 1], { extrapolateRight: "clamp" });
  const checkOutOpacity = interpolate(frame, [175, 190], [0, 1], { extrapolateRight: "clamp" });
  const summaryOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Topbar */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
        </div>

        {/* Modal overlay */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.45)",
          opacity: modalOpacity,
        }}>
          <div style={{
            background: "white", borderRadius: 20,
            padding: "28px 32px", width: 520,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            {/* Modal header with step indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנת פנסיון</div>
              <div style={{
                background: "#f1f5f9", borderRadius: 99,
                padding: "2px 10px", fontSize: 11, color: "#64748b", fontWeight: 600,
                marginRight: "auto",
              }}>
                שלב 2 מתוך 3
              </div>
            </div>

            {/* Customer field */}
            <div style={{ marginBottom: 16, opacity: customerOpacity }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                לקוח *
              </label>
              <div style={{
                border: `2px solid ${interpolate(customerHighlight, [0, 1], [0.5, 1]) > 0.7 ? ORANGE : "#e2e8f0"}`,
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "white",
                boxShadow: customerHighlight > 0.7 ? `0 0 0 3px rgba(234,88,12,0.12)` : "none",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>דנה כהן</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>054-321-8876</span>
              </div>
            </div>

            {/* Pet selection */}
            <div style={{ marginBottom: 16, opacity: petOpacity }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                כלב *
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  borderRadius: 10, padding: "10px 14px",
                  border: `2px solid ${ORANGE}`,
                  background: "rgba(234,88,12,0.05)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: ORANGE, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>מקס</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>גולדן רטריבר</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>זכר • 3 שנים</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6, fontWeight: 500 }}>
                ✓ כלב נבחר אוטומטית
              </div>
            </div>

            {/* Dates row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, opacity: checkInOpacity }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  כניסה
                </label>
                <div style={{
                  border: "1.5px solid #e2e8f0", borderRadius: 10,
                  padding: "10px 14px", background: "white",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>08.04.2026</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>12:00</div>
                </div>
              </div>
              <div style={{ flex: 1, opacity: checkOutOpacity }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  יציאה
                </label>
                <div style={{
                  border: "1.5px solid #e2e8f0", borderRadius: 10,
                  padding: "10px 14px", background: "white",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>11.04.2026</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>12:00</div>
                </div>
              </div>
            </div>

            {/* Auto-calculated summary */}
            <div style={{
              opacity: summaryOpacity,
              background: "rgba(234,88,12,0.06)",
              border: "1.5px solid rgba(234,88,12,0.2)",
              borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🌙</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>3 לילות • 1 כלב</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>חושב אוטומטית לפי תאריכי הכניסה והיציאה</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Adjust based on browser reference**

Compare field layout and labels with the real app modal step 1. Update font sizes, spacing, or field order to match.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OrdersCustomerScene.tsx
git commit -m "feat(video): add OrdersCustomerScene"
```

---

## Task 7: OrdersItemsScene — items from price list

**Files:**
- Modify: `src/scenes/OrdersItemsScene.tsx`

- [ ] **Step 1: Write the scene**

```typescript
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const CATEGORIES = ["פנסיון", "אילוף", "טיפוח", "מוצרים"];

export const OrdersItemsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.94, 1]);

  const item1Opacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const item1Progress = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const item1Y = interpolate(item1Progress, [0, 1], [16, 0]);

  const qtyOpacity = interpolate(frame, [100, 115], [0, 1], { extrapolateRight: "clamp" });
  const refOpacity = interpolate(frame, [200, 220], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center",
          flexShrink: 0,
          opacity: interpolate(frame, [5, 15], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
        </div>

        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.45)",
          opacity: modalOpacity,
        }}>
          <div style={{
            background: "white", borderRadius: 20,
            padding: "28px 32px", width: 520,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>בחירת פריטים</div>
              <div style={{
                background: "#f1f5f9", borderRadius: 99,
                padding: "2px 10px", fontSize: 11, color: "#64748b", fontWeight: 600,
                marginRight: "auto",
              }}>
                שלב 3 מתוך 3
              </div>
            </div>

            {/* Category chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => (
                <div key={cat} style={{
                  borderRadius: 99, padding: "5px 14px",
                  fontSize: 12, fontWeight: 600,
                  background: cat === "פנסיון" ? ORANGE : "#f1f5f9",
                  color: cat === "פנסיון" ? "white" : "#64748b",
                  border: cat === "פנסיון" ? "none" : "1px solid #e2e8f0",
                }}>
                  {cat}
                </div>
              ))}
            </div>

            {/* Item row */}
            <div style={{
              opacity: item1Opacity,
              transform: `translateY(${item1Y}px)`,
              border: "1.5px solid #e2e8f0", borderRadius: 12,
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>לינה פנסיון</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>לילה × כלב</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>₪150</div>

              {/* Quantity control */}
              <div style={{ opacity: qtyOpacity, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: "#64748b", cursor: "pointer",
                }}>−</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", minWidth: 20, textAlign: "center" }}>3</span>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: ORANGE, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, cursor: "pointer",
                }}>+</div>
              </div>

              <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE, minWidth: 60, textAlign: "left" }}>
                ₪450
              </div>
            </div>

            {/* Total */}
            <div style={{
              opacity: item1Opacity,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 4px",
              borderTop: "1px solid #f1f5f9",
            }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>סה"כ לתשלום</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>₪450</span>
            </div>

            {/* Reference label */}
            <div style={{
              opacity: refOpacity,
              background: "#f8fafc",
              borderRadius: 8, padding: "8px 12px",
              marginTop: 8,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 13 }}>💡</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                המחירון מוגדר במערכת הפיננסים
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify and adjust based on real app**

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OrdersItemsScene.tsx
git commit -m "feat(video): add OrdersItemsScene"
```

---

## Task 8: OrdersAutoScene — 3 automatic connections

**Files:**
- Modify: `src/scenes/OrdersAutoScene.tsx`

- [ ] **Step 1: Write the scene**

```typescript
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const PANELS = [
  {
    icon: "🏠",
    trigger: "הזמנת פנסיון",
    triggerColor: "#22c55e",
    result: "כלוב נפתח בפנסיון",
    resultColor: "#16a34a",
    delay: 20,
  },
  {
    icon: "🐾",
    trigger: "הזמנת אילוף",
    triggerColor: "#6366f1",
    result: "תהליך אילוף נפתח",
    resultColor: "#4f46e5",
    delay: 90,
  },
  {
    icon: "📲",
    trigger: "הזמנה עם תאריך",
    triggerColor: "#0ea5e9",
    result: "תזכורת WhatsApp",
    resultColor: "#0284c7",
    badge: "PRO+",
    delay: 160,
  },
];

export const OrdersAutoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.06 + pulse * 0.03}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      fontFamily: FONT,
      direction: "rtl",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 60px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleOpacity,
        fontSize: 26, fontWeight: 800, color: "white",
        marginBottom: 48, textAlign: "center",
      }}>
        מה נוצר אוטומטית ברגע שיוצרים הזמנה
      </div>

      {/* 3 panels */}
      <div style={{ display: "flex", gap: 24, width: "100%", justifyContent: "center" }}>
        {PANELS.map((panel) => {
          const panelProgress = spring({ frame: frame - panel.delay, fps, config: { damping: 200 } });
          const panelOpacity = interpolate(frame, [panel.delay, panel.delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const panelY = interpolate(panelProgress, [0, 1], [30, 0]);
          const arrowOpacity = interpolate(frame, [panel.delay + 25, panel.delay + 40], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div key={panel.trigger} style={{
              flex: 1,
              maxWidth: 280,
              opacity: panelOpacity,
              transform: `translateY(${panelY}px)`,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              backdropFilter: "blur(4px)",
            }}>
              {/* Icon */}
              <span style={{ fontSize: 36 }}>{panel.icon}</span>

              {/* Trigger */}
              <div style={{
                background: `${panel.triggerColor}22`,
                border: `1.5px solid ${panel.triggerColor}55`,
                borderRadius: 10, padding: "8px 16px",
                fontSize: 13, fontWeight: 700,
                color: panel.triggerColor,
                textAlign: "center",
              }}>
                {panel.trigger}
              </div>

              {/* Arrow */}
              <div style={{
                opacity: arrowOpacity,
                fontSize: 22, color: "rgba(255,255,255,0.4)",
              }}>
                ↓
              </div>

              {/* Result */}
              <div style={{
                opacity: arrowOpacity,
                textAlign: "center",
              }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: "white",
                  marginBottom: 6,
                }}>
                  {panel.result}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  אוטומטית, ללא פעולה נוספת
                </div>
                {panel.badge && (
                  <div style={{
                    display: "inline-block",
                    marginTop: 8,
                    background: "rgba(234,88,12,0.25)",
                    border: "1px solid rgba(234,88,12,0.5)",
                    borderRadius: 99, padding: "2px 10px",
                    fontSize: 10, fontWeight: 700, color: "#fb923c",
                  }}>
                    {panel.badge}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify in Remotion Studio**

Scrub through the scene. Confirm: title appears first, then 3 panels slide in with staggered timing (~3 second gaps), each arrow + result appears after the card.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OrdersAutoScene.tsx
git commit -m "feat(video): add OrdersAutoScene"
```

---

## Task 9: OrdersLifecycleScene — status flow + payment

**Files:**
- Modify: `src/scenes/OrdersLifecycleScene.tsx`

**Browser reference:** Open the real order detail page (`/orders/[id]`). Note: exact status badge placement, action buttons (confirm/complete/cancel), payment section layout, WhatsApp button style.

- [ ] **Step 1: Write the scene**

```typescript
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const STATUSES = [
  { id: "draft",     label: "טיוטה",    color: "#94a3b8", bg: "#f1f5f9" },
  { id: "confirmed", label: "אושרה",    color: "#3b82f6", bg: "#eff6ff" },
  { id: "completed", label: "הושלמה",   color: "#22c55e", bg: "#f0fdf4" },
];

export const OrdersLifecycleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardProgress = spring({ frame: frame - 15, fps, config: { damping: 200 } });
  const cardOpacity = interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(cardProgress, [0, 1], [20, 0]);

  // Status progresses: draft (0-80) → confirmed (80-180) → completed (180+)
  const activeStatusIndex = frame < 80 ? 0 : frame < 200 ? 1 : 2;
  const confirmBtnOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });
  const confirmBtnPulse = frame < 80
    ? interpolate(frame % 45, [0, 22, 45], [1, 1.04, 1])
    : 1;

  const paymentOpacity = interpolate(frame, [210, 228], [0, 1], { extrapolateRight: "clamp" });
  const paymentProgress = spring({ frame: frame - 210, fps, config: { damping: 200 } });
  const paymentY = interpolate(paymentProgress, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Topbar */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>← הזמנות</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>#A3F2B1</span>
          </div>
          <div style={{
            background: STATUSES[activeStatusIndex].bg,
            color: STATUSES[activeStatusIndex].color,
            border: `1.5px solid ${STATUSES[activeStatusIndex].color}44`,
            borderRadius: 99, padding: "4px 14px",
            fontSize: 12, fontWeight: 700,
          }}>
            {STATUSES[activeStatusIndex].label}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "20px 24px", overflowY: "hidden" }}>

          {/* Status stepper */}
          <div style={{
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
            marginBottom: 16,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {STATUSES.map((status, i) => {
                const isActive = i === activeStatusIndex;
                const isDone = i < activeStatusIndex;
                return (
                  <React.Fragment key={status.id}>
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      flex: 1,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: isActive ? ORANGE : isDone ? "#22c55e" : "#f1f5f9",
                        border: isActive ? `2px solid ${ORANGE}` : isDone ? "2px solid #22c55e" : "2px solid #e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800,
                        color: isActive || isDone ? "white" : "#94a3b8",
                        transform: isActive ? `scale(${confirmBtnPulse})` : "scale(1)",
                        transition: "all 0.3s",
                      }}>
                        {isDone ? "✓" : i + 1}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: isActive ? 700 : 500,
                        color: isActive ? ORANGE : isDone ? "#22c55e" : "#94a3b8",
                      }}>
                        {status.label}
                      </span>
                    </div>
                    {i < STATUSES.length - 1 && (
                      <div style={{
                        flex: 1, height: 2, marginTop: -20,
                        background: isDone ? "#22c55e" : "#e2e8f0",
                      }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Order info */}
          <div style={{
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
            marginBottom: 16,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>פרטי הזמנה</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>לקוח</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>דנה כהן</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>שירות</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>לינה פנסיון × 3</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>סה"כ</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>₪450</span>
            </div>
          </div>

          {/* Action button */}
          {activeStatusIndex === 0 && (
            <div style={{
              opacity: confirmBtnOpacity,
              background: ORANGE,
              borderRadius: 12, padding: "14px 24px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 16, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(234,88,12,0.35)",
              transform: `scale(${confirmBtnPulse})`,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>אשר הזמנה</span>
            </div>
          )}

          {/* Payment section */}
          <div style={{
            opacity: paymentOpacity,
            transform: `translateY(${paymentY}px)`,
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>תשלום</div>
              <div style={{
                background: "#dcfce7", color: "#16a34a",
                border: "1px solid #bbf7d0",
                borderRadius: 99, padding: "3px 10px",
                fontSize: 11, fontWeight: 700,
              }}>
                שולם ✓
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>₪450 • מזומן • 08.04.2026</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>₪450</span>
            </div>
            <div style={{
              background: "#dcfce7",
              border: "1.5px solid #25d366",
              borderRadius: 10, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            }}>
              <span style={{ fontSize: 16 }}>💬</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                שלח דרישת תשלום בוואטסאפ
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Adjust based on browser reference**

Compare with the real order detail page. Adjust badge styles, button placement, payment section to match.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OrdersLifecycleScene.tsx
git commit -m "feat(video): add OrdersLifecycleScene"
```

---

## Task 10: OrdersOutroScene

**Files:**
- Modify: `src/scenes/OrdersOutroScene.tsx`

- [ ] **Step 1: Write the scene**

```typescript
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

const BENEFITS = [
  { icon: "🔗", text: "חיבור אוטומטי לפנסיון" },
  { icon: "🐾", text: "תהליך אילוף מיידי" },
  { icon: "💳", text: "דרישת תשלום בלחיצה" },
  { icon: "📊", text: "מעקב בזמן אמת" },
];

export const OrdersOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoProgress, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const titleProgress = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [30, 0]);
  const titleOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });

  const benefitsDelay = 50;

  const ctaProgress = spring({ frame: frame - 90, fps, config: { damping: 200 } });
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.6, 1]);
  const ctaOpacity = interpolate(frame, [90, 106], [0, 1], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [110, 126], [0, 1], { extrapolateRight: "clamp" });

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
      <div style={{
        transform: `scale(${logoScale})`,
        opacity: logoOpacity,
        marginBottom: 32,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 88, height: 88, objectFit: "contain" }} />
      </div>

      {/* Title */}
      <h1 style={{
        color: "white", fontSize: 46, fontWeight: 800,
        margin: 0, marginBottom: 10,
        textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.2,
      }}>
        מערכת ההזמנות של פטרה
      </h1>
      <p style={{
        color: "white", fontSize: 22, fontWeight: 700,
        margin: 0, marginBottom: 36,
        textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
      }}>
        כל שירות, כל לקוח, כל תשלום — במקום אחד
      </p>

      {/* Benefits */}
      <div style={{ display: "flex", gap: 14, marginBottom: 40, justifyContent: "center" }}>
        {BENEFITS.map((b, i) => {
          const bOpacity = interpolate(
            frame,
            [benefitsDelay + i * 10, benefitsDelay + i * 10 + 15],
            [0, 1], { extrapolateRight: "clamp" }
          );
          const bScale = interpolate(
            spring({ frame: frame - benefitsDelay - i * 10, fps, config: { damping: 200 } }),
            [0, 1], [0.8, 1]
          );
          return (
            <div key={b.text} style={{
              opacity: bOpacity, transform: `scale(${bScale})`,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>{b.icon}</span>
              <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{b.text}</span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{
        background: "linear-gradient(135deg, #ea580c, #c2410c)",
        borderRadius: 16, padding: "18px 52px",
        opacity: ctaOpacity, transform: `scale(${ctaScale})`,
        boxShadow: "0 8px 32px rgba(234,88,12,0.45)",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        direction: "rtl",
      }}>
        <span style={{ color: "white", fontSize: 19, fontWeight: 800 }}>
          צרו הזמנה עכשיו ותראו את ההבדל
        </span>
        <span style={{ color: "white", fontSize: 20 }}>←</span>
      </div>

      {/* URL */}
      <div style={{ marginTop: 20, opacity: urlOpacity }}>
        <span style={{ color: "#475569", fontSize: 15, fontWeight: 500 }}>petra-app.com</span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify in Remotion Studio**

Confirm: dark background, 88px logo (PETRA text embedded), white subtitle, 4 benefit cards, orange CTA button, no double logo.

- [ ] **Step 3: Final TypeScript check**

```bash
cd "/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video"
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Final commit**

```bash
git add src/scenes/OrdersOutroScene.tsx
git commit -m "feat(video): add OrdersOutroScene — orders tutorial complete"
```

---

## Final Verification

- [ ] Open Remotion Studio at `http://localhost:3004`
- [ ] Select `PetraOrdersTutorial` composition
- [ ] Play full video — confirm all 8 scenes play with audio, no silent gaps
- [ ] Confirm total duration matches ~104s (adjusts to actual audio durations)
- [ ] Confirm sidebar has no emoji icons in any app-screen scene
- [ ] Confirm intro logo is 44px + white PETRA span
- [ ] Confirm outro logo is 88px only (no double logo)
- [ ] Confirm outro subtitle is white (not orange)
