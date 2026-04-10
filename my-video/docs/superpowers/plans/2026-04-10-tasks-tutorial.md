# Tasks Tutorial Video — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 6-scene Hebrew tutorial video for the Petra Tasks system covering team logistics, creation, filtering, and bulk operations.

**Architecture:** Follows the established tutorial pattern exactly — `voiceover-tasks-config.ts` → `generate-voiceover-tasks.ts` → 6 scene TSX files → `src/TasksTutorial.tsx` composition → registered in `src/Root.tsx`. Each scene is a standalone React component using Remotion hooks; audio duration drives scene length via `calculateTasksMetadata`.

**Tech Stack:** Remotion 4.x, React, TypeScript, Google Gemini TTS (Aoede voice), staticFile() for assets.

---

## Context — Critical Patterns

**Working directory:** `/Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video`

**Node PATH prefix** required for every shell command:
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH"
```

**Remotion still command** (for visual verification):
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-scene-N.png --frame=30
```
(Use `PetraTasksTutorial` only after Task 9 registers it. Before that, render scenes individually isn't possible — skip still verification or render the full comp after Task 9.)

**Sidebar active label for Tasks:** `"ניהול משימות"` (matches PetraSidebar NAV_ITEMS exactly).

**Scene pattern** (from `OrdersTutorial.tsx`):
- `useCurrentFrame()` returns local frame (0-based within the sequence)
- `useVideoConfig()` → `{ fps, durationInFrames }`
- Fade in: `interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" })`
- Fade out: `interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" })`
- `opacity = Math.min(fadeIn, fadeOut)`

**Sample task data used across all UI scenes:**
```
TASKS = [
  { id:1, title:"מתן תרופה לנובה",     cat:"תרופות",  priority:"דחופה",  due:"היום 18:00",   status:"overdue",   customer:"ענבל כהן" },
  { id:2, title:"האכלה — חדר 3",        cat:"האכלה",   priority:"גבוהה",  due:"עכשיו",        status:"active",    customer:null },
  { id:3, title:"צ׳ק-אאוט — מקס",       cat:"פנסיון",  priority:"בינונית",due:"מחר 10:00",   status:"scheduled", customer:"יוסי גולן" },
  { id:4, title:"שיחה עם ענבל כהן",    cat:"כללי",    priority:"נמוכה",  due:"אתמול",        status:"done",      customer:"ענבל כהן" },
  { id:5, title:"בדיקת חיסון — קיירה", cat:"בריאות",  priority:"גבוהה",  due:"מחרתיים",      status:"scheduled", customer:null },
]
```

**Status colors:**
- `overdue` → badge bg `#fef2f2`, text `#dc2626`, dot `#ef4444`, label "באיחור"
- `active`  → badge bg `#f0fdf4`, text `#16a34a`, dot `#22c55e`, label "עכשיו"
- `scheduled`→ badge bg `#f8fafc`, text `#64748b`, dot `#94a3b8`, label "מתוכנן"
- `done`    → badge bg `#f0fdf4`, text `#16a34a`, dot `#bbf7d0`, label "הושלם", row opacity 0.55

**Priority colors:**
- `דחופה` → `#ef4444` | `גבוהה` → `#ea580c` | `בינונית` → `#3b82f6` | `נמוכה` → `#94a3b8`

**Category colors:**
- `תרופות` → `#8b5cf6` | `האכלה` → `#f59e0b` | `פנסיון` → `#3b82f6` | `כללי` → `#64748b` | `בריאות` → `#22c55e`

**Common constants (used in every UI scene):**
```tsx
const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;
```

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `voiceover-tasks-config.ts` | Create | 6 scene voiceover scripts + default durations |
| `generate-voiceover-tasks.ts` | Create | Gemini TTS script → `public/voiceover/tasks-*.wav` |
| `src/scenes/TasksIntroScene.tsx` | Create | Scene 1: dark hook text animation |
| `src/scenes/TasksOverviewScene.tsx` | Create | Scene 2: task list UI with statuses + tab animation |
| `src/scenes/TasksCreateScene.tsx` | Create | Scene 3: task creation modal UI |
| `src/scenes/TasksFiltersScene.tsx` | Create | Scene 4: search + filter animations |
| `src/scenes/TasksBulkScene.tsx` | Create | Scene 5: selection mode + bulk complete |
| `src/scenes/TasksOutroScene.tsx` | Create | Scene 6: dark outro + CTA |
| `src/TasksTutorial.tsx` | Create | Main composition — Series of 6 scenes + audio |
| `src/Root.tsx` | Modify | Register `PetraTasksTutorial` composition |

---

## Task 1: Voiceover Config + Generate Script

**Files:**
- Create: `voiceover-tasks-config.ts`
- Create: `generate-voiceover-tasks.ts`

- [ ] **Step 1: Create voiceover config**

```typescript
// voiceover-tasks-config.ts
export const TASKS_SCENES = [
  {
    id: "tasks-intro",
    text: "מנהלים עסק עם בעלי חיים — זה אומר מְשִׁימוֹת לוגיסטיות שוטפות. מי מאכיל את הכלבים בחדר 3? מי נותן תרופה לנובה ב-18:00? מי מתקשר ללקוח שחיכה? עם מערכת המְשִׁימוֹת של פטרה, כל הצוות מסונכרן — ושום דבר לא נופל בין הכיסאות.",
    defaultDurationSec: 14,
  },
  {
    id: "tasks-overview",
    text: "בדף המְשִׁימוֹת תראו את כל המְשִׁימוֹת של העסק — מסודרות לפי סטטוס. באיחור מסומן באדום, פעיל עכשיו בירוק, ומתוכנן באפור. תוכלו לסנן לפי קטגוריה — כללי, פנסיון, תרופות, לִידִים, ועוד — ולראות בדיוק מה מחכה לטיפול.",
    defaultDurationSec: 18,
  },
  {
    id: "tasks-create",
    text: "ליצירת מְשִׁימָה חדשה — לוחצים על הכפתור, ממלאים את הפרטים: שם, קטגוריה, עֲדִיפוּת ושעת ביצוע. אפשר גם לקשר את המְשִׁימָה ישירות ללקוח — כך שמתוך המְשִׁימָה תוכלו לנווט ישירות לפרופיל שלו בלחיצה אחת.",
    defaultDurationSec: 20,
  },
  {
    id: "tasks-filters",
    text: "צריכים למצוא מְשִׁימָה ספציפית? השתמשו בחיפוש החופשי, או סננו לפי סטטוס — לדוגמה, רק המְשִׁימוֹת שכבר באיחור. אפשר גם לסנן לפי תאריך ולראות רק את מה שרלוונטי להיום.",
    defaultDurationSec: 16,
  },
  {
    id: "tasks-bulk",
    text: "כשצריך לטפל בכמה מְשִׁימוֹת בבת אחת — לוחצים על בחר, מסמנים את הרצויות, וסוגרים את כולן בלחיצה אחת. אפשר גם לדחות כמה מְשִׁימוֹת לתאריך חדש — בלי לערוך כל אחת בנפרד.",
    defaultDurationSec: 18,
  },
  {
    id: "tasks-outro",
    text: "מערכת המְשִׁימוֹת של פטרה — שכל הצוות יודע מה לעשות, ומתי. התחילו לנהל עכשיו בחינם.",
    defaultDurationSec: 10,
  },
] as const;
```

- [ ] **Step 2: Create generate script**

```typescript
// generate-voiceover-tasks.ts
/**
 * Generates Hebrew voiceover for the Tasks tutorial using Google Gemini 2.5 TTS.
 *
 * Usage:
 *   GEMINI_KEY=AIza... npx tsx generate-voiceover-tasks.ts
 *
 * Output: public/voiceover/{scene-id}.wav
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { TASKS_SCENES } from "./voiceover-tasks-config.js";

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
    console.error("    Run: GEMINI_KEY=AIza... npx tsx generate-voiceover-tasks.ts");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📦 Petra Tasks Tutorial Voiceover — Gemini 2.5 TTS (${VOICE})\n`);

  for (let i = 0; i < TASKS_SCENES.length; i++) {
    const scene = TASKS_SCENES[i];
    const outPath = `${OUTPUT_DIR}/${scene.id}.wav`;

    if (existsSync(outPath)) {
      console.log(`⏭  ${scene.id} — already exists, skipping`);
      continue;
    }

    await generateScene(scene.id, scene.text, apiKey);

    if (i < TASKS_SCENES.length - 1) {
      const next = TASKS_SCENES[i + 1];
      if (!existsSync(`${OUTPUT_DIR}/${next.id}.wav`)) {
        console.log(`    ⏳ Waiting 22s (rate limit)...`);
        await sleep(22000);
      }
    }
  }

  console.log(`\n✅ Done! WAVs saved to public/voiceover/tasks-*.wav`);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
```

- [ ] **Step 3: Run the voiceover generator**

```bash
GEMINI_KEY=<your-key> PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-tasks.ts
```

Expected output: 6 lines like `✅ public/voiceover/tasks-intro.wav — 14.2s (682 KB)`

If `GEMINI_KEY` is not available, skip this step — the composition uses `defaultDurationSec` as fallback.

- [ ] **Step 4: Commit**

```bash
git add voiceover-tasks-config.ts generate-voiceover-tasks.ts
git commit -m "feat(tasks-tutorial): add voiceover config and TTS generate script"
```

---

## Task 2: TasksIntroScene

**Files:**
- Create: `src/scenes/TasksIntroScene.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/TasksIntroScene.tsx
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

const QUESTIONS = [
  "מי מאכיל את הכלבים בחדר 3?",
  "מי נותן תרופה לנובה ב-18:00?",
  "מי מתקשר ללקוח שחיכה?",
];

export const TasksIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const labelOpacity = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: "clamp" });

  // Three questions stagger in, each sliding from right
  const questionDelays = [42, 68, 94];

  // "מסונכרן" answer fades in after all questions
  const answerOpacity = interpolate(frame, [130, 148], [0, 1], { extrapolateRight: "clamp" });
  const answerP = spring({ frame: frame - 130, fps, config: { damping: 200 } });
  const answerY = interpolate(answerP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 45%, rgba(234,88,12,${0.08 + pulse * 0.05}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
    }}>
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
        transform: `scale(${logoScale})`, opacity: logoOpacity,
        marginBottom: 20, display: "flex", alignItems: "center", gap: 10,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 38, height: 38, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>PETRA</span>
      </div>

      {/* Label */}
      <div style={{
        opacity: labelOpacity,
        background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.5)",
        borderRadius: 99, padding: "5px 16px", marginBottom: 32,
        color: "#fb923c", fontSize: 13, fontWeight: 600,
      }}>
        ניהול משימות
      </div>

      {/* Questions */}
      {QUESTIONS.map((q, i) => {
        const d = questionDelays[i];
        const qOpacity = interpolate(frame, [d, d + 12], [0, 1], { extrapolateRight: "clamp" });
        const qP = spring({ frame: frame - d, fps, config: { damping: 180 } });
        const qX = interpolate(qP, [0, 1], [60, 0]);
        return (
          <div key={q} style={{
            opacity: qOpacity, transform: `translateX(${qX}px)`,
            marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ color: "#ef4444", fontSize: 26, fontWeight: 900 }}>מי</span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 22, fontWeight: 600 }}>
              {q.replace("מי ", "")}
            </span>
          </div>
        );
      })}

      {/* Answer */}
      <div style={{
        marginTop: 28, opacity: answerOpacity, transform: `translateY(${answerY}px)`,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "white", marginBottom: 6 }}>
          כל הצוות מסונכרן
        </div>
        <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>
          ושום דבר לא נופל בין הכיסאות
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep TasksIntro
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TasksIntroScene.tsx
git commit -m "feat(tasks-tutorial): add TasksIntroScene"
```

---

## Task 3: TasksOverviewScene

**Files:**
- Create: `src/scenes/TasksOverviewScene.tsx`

**What it shows:** Full Petra UI — sidebar (active: "ניהול משימות"), task list with 5 tasks in all status states, category tabs. Tab animation switches from "כל" → "פנסיון" → "תרופות" → "כל" over the scene's duration.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/TasksOverviewScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const CATEGORY_TABS = ["כל", "כללי", "פנסיון", "האכלה", "תרופות", "לידים", "בריאות"];

// Tab switching: כל(0-150) → פנסיון(150-310) → תרופות(310-460) → כל(460+)
function getActiveTab(frame: number): string {
  if (frame < 150) return "כל";
  if (frame < 310) return "פנסיון";
  if (frame < 460) return "תרופות";
  return "כל";
}

const STATUS_STYLE = {
  overdue:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444", label: "באיחור" },
  active:    { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e", label: "עכשיו" },
  scheduled: { bg: "#f8fafc", text: "#64748b", dot: "#94a3b8", label: "מתוכנן" },
  done:      { bg: "#f0fdf4", text: "#16a34a", dot: "#bbf7d0", label: "הושלם" },
} as const;

const PRIORITY_COLOR: Record<string, string> = {
  "דחופה": "#ef4444", "גבוהה": "#ea580c", "בינונית": "#3b82f6", "נמוכה": "#94a3b8",
};
const CAT_COLOR: Record<string, string> = {
  "תרופות": "#8b5cf6", "האכלה": "#f59e0b", "פנסיון": "#3b82f6", "כללי": "#64748b", "בריאות": "#22c55e",
};

const ALL_TASKS = [
  { title: "מתן תרופה לנובה",     cat: "תרופות", priority: "דחופה",  due: "היום 18:00",  status: "overdue"   as const, rowDelay: 22 },
  { title: "האכלה — חדר 3",        cat: "האכלה",  priority: "גבוהה",  due: "עכשיו",       status: "active"    as const, rowDelay: 34 },
  { title: "צ׳ק-אאוט — מקס",       cat: "פנסיון", priority: "בינונית",due: "מחר 10:00",  status: "scheduled" as const, rowDelay: 46 },
  { title: "שיחה עם ענבל כהן",    cat: "כללי",   priority: "נמוכה",  due: "אתמול",       status: "done"      as const, rowDelay: 58 },
  { title: "בדיקת חיסון — קיירה", cat: "בריאות", priority: "גבוהה",  due: "מחרתיים",     status: "scheduled" as const, rowDelay: 70 },
];

// Filter tasks by active tab (simulates real filter behavior)
function getVisibleTasks(tab: string, frame: number) {
  // During tab switch (150-175 for פנסיון, 310-335 for תרופות), fade out and show subset
  if (tab === "פנסיון") return ALL_TASKS.filter((t) => t.cat === "פנסיון");
  if (tab === "תרופות") return ALL_TASKS.filter((t) => t.cat === "תרופות");
  return ALL_TASKS;
}

export const TasksOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const activeTab = getActiveTab(frame);
  const visibleTasks = getVisibleTasks(activeTab, frame);

  // Content cross-fade on tab switch
  const contentOpacity = interpolate(
    frame,
    [148, 155, 160, 308, 315, 320, 458, 465, 470],
    [1,   0,   1,   1,   0,   1,   1,   0,   1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const zoomP = spring({ frame: frame - 8, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.06]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      {/* Sidebar */}
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 42%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity, flexShrink: 0,
          }}>
            <div style={{
              background: ORANGE, color: "white",
              borderRadius: 8, padding: "6px 14px",
              fontSize: 12, fontWeight: 700,
            }}>
              + משימה חדשה
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
          </div>

          {/* Category tabs */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            display: "flex", padding: "0 24px", opacity: headerOpacity,
          }}>
            {CATEGORY_TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <div key={tab} style={{
                  padding: "10px 12px 8px",
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? ORANGE : "#64748b",
                  borderBottom: isActive ? `2px solid ${ORANGE}` : "2px solid transparent",
                  whiteSpace: "nowrap",
                }}>
                  {tab}
                </div>
              );
            })}
          </div>

          {/* Task list */}
          <div style={{ padding: "16px 24px", opacity: contentOpacity }}>
            {visibleTasks.map((task, i) => {
              const st = STATUS_STYLE[task.status];
              const rowOpacity = interpolate(frame, [task.rowDelay, task.rowDelay + 12], [0, 1], { extrapolateRight: "clamp" });
              const rowP = spring({ frame: frame - task.rowDelay, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [10, 0]);
              const isDone = task.status === "done";

              return (
                <div key={task.title} style={{
                  background: "white", borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  borderRight: `3px solid ${st.dot}`,
                  padding: "11px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 8,
                  opacity: rowOpacity * (isDone ? 0.55 : 1),
                  transform: `translateY(${rowY}px)`,
                }}>
                  {/* Status badge */}
                  <div style={{
                    background: st.bg, color: st.text,
                    borderRadius: 99, padding: "3px 9px",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {st.label}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1,
                    textDecoration: isDone ? "line-through" : "none",
                  }}>
                    {task.title}
                  </div>

                  {/* Category */}
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: CAT_COLOR[task.cat] ?? "#64748b",
                    background: `${CAT_COLOR[task.cat] ?? "#64748b"}18`,
                    borderRadius: 4, padding: "2px 7px", flexShrink: 0,
                  }}>
                    {task.cat}
                  </div>

                  {/* Priority dot */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[task.priority] }} />
                    <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>{task.priority}</span>
                  </div>

                  {/* Due date */}
                  <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{task.due}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Highlight: overdue task badge area — first 120 frames */}
      <HighlightBox x={220} y={104} width={580} height={44} startFrame={80} endFrame={140} borderRadius={10} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep TasksOverview
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TasksOverviewScene.tsx
git commit -m "feat(tasks-tutorial): add TasksOverviewScene"
```

---

## Task 4: TasksCreateScene

**Files:**
- Create: `src/scenes/TasksCreateScene.tsx`

**What it shows:** Task list behind, modal overlaid. Fields animate in sequentially: title → category → priority → due time → linked customer. Then "שמור" is clicked, modal fades out, new task row appears at top of list.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/TasksCreateScene.tsx
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

// Timeline (all in local frames):
const MODAL_OPEN   = 18;
const TITLE_IN     = 35;
const CAT_IN       = 70;
const PRIORITY_IN  = 100;
const DUE_IN       = 130;
const CUSTOMER_IN  = 165;
const SAVE_CLICK   = 220;
const MODAL_CLOSE  = 232;
const NEW_TASK_IN  = 248;

export const TasksCreateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });

  const modalP = spring({ frame: frame - MODAL_OPEN, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalP, [0, 1], [0.93, 1]);
  const modalOpacity = interpolate(frame, [MODAL_OPEN, MODAL_OPEN + 12], [0, 1], { extrapolateRight: "clamp" })
    * interpolate(frame, [MODAL_CLOSE, MODAL_CLOSE + 10], [1, 0], { extrapolateLeft: "clamp" });

  const titleOpacity  = interpolate(frame, [TITLE_IN,    TITLE_IN + 12],    [0, 1], { extrapolateRight: "clamp" });
  const catOpacity    = interpolate(frame, [CAT_IN,      CAT_IN + 12],      [0, 1], { extrapolateRight: "clamp" });
  const prioOpacity   = interpolate(frame, [PRIORITY_IN, PRIORITY_IN + 12], [0, 1], { extrapolateRight: "clamp" });
  const dueOpacity    = interpolate(frame, [DUE_IN,      DUE_IN + 12],      [0, 1], { extrapolateRight: "clamp" });
  const custOpacity   = interpolate(frame, [CUSTOMER_IN, CUSTOMER_IN + 12], [0, 1], { extrapolateRight: "clamp" });

  // Save button pulse on click
  const savePulse = interpolate(frame, [SAVE_CLICK, SAVE_CLICK + 4, SAVE_CLICK + 9], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // New task row after modal closes
  const newRowOpacity = interpolate(frame, [NEW_TASK_IN, NEW_TASK_IN + 14], [0, 1], { extrapolateRight: "clamp" });
  const newRowP = spring({ frame: frame - NEW_TASK_IN, fps, config: { damping: 200 } });
  const newRowY = interpolate(newRowP, [0, 1], [-14, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      {/* Background task list (blurred) */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, filter: `blur(${modalOpacity > 0.1 ? 2 : 0}px)` }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
            + משימה חדשה
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
        </div>

        {/* New task row appears after save */}
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{
            background: "white", borderRadius: 10,
            border: "1px solid #e2e8f0", borderRight: "3px solid #22c55e",
            padding: "11px 14px",
            display: "flex", alignItems: "center", gap: 12,
            opacity: newRowOpacity, transform: `translateY(${newRowY}px)`,
          }}>
            <div style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>עכשיו</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1 }}>מתן תרופה לנובה</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#8b5cf6", background: "#8b5cf618", borderRadius: 4, padding: "2px 7px" }}>תרופות</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} />
              <span style={{ fontSize: 10, color: ORANGE, fontWeight: 600 }}>גבוהה</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>היום 18:00</div>
          </div>
        </div>
      </div>

      {/* Modal overlay */}
      {modalOpacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${modalOpacity * 0.45})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{
            background: "white", borderRadius: 20,
            padding: "28px 32px", width: 500,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
            direction: "rtl",
          }}>
            {/* Modal header */}
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 22 }}>משימה חדשה</div>

            {/* Title field */}
            <div style={{ marginBottom: 14, opacity: titleOpacity }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>שם המשימה *</label>
              <div style={{ border: `2px solid ${ORANGE}`, borderRadius: 8, padding: "9px 12px", background: "white", boxShadow: "0 0 0 3px rgba(234,88,12,0.1)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>מתן תרופה לנובה</span>
                <span style={{ display: "inline-block", width: 1.5, height: 14, background: ORANGE, marginRight: 2, verticalAlign: "middle" }} />
              </div>
            </div>

            {/* Category + Priority row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, opacity: catOpacity }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>קטגוריה</label>
                <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 700 }}>תרופות</span>
                  <span style={{ color: "#94a3b8", fontSize: 14 }}>▾</span>
                </div>
              </div>
              <div style={{ flex: 1, opacity: prioOpacity }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>עדיפות</label>
                <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE }} />
                    <span style={{ fontSize: 13, color: ORANGE, fontWeight: 700 }}>גבוהה</span>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 14 }}>▾</span>
                </div>
              </div>
            </div>

            {/* Due date/time */}
            <div style={{ marginBottom: 14, opacity: dueOpacity }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>תאריך ושעה</label>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px" }}>
                  <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>10.04.2026</span>
                </div>
                <div style={{ width: 100, border: `1.5px solid ${ORANGE}`, borderRadius: 8, padding: "9px 12px", boxShadow: "0 0 0 2px rgba(234,88,12,0.1)" }}>
                  <span style={{ fontSize: 13, color: ORANGE, fontWeight: 700 }}>18:00</span>
                </div>
              </div>
            </div>

            {/* Linked customer */}
            <div style={{ marginBottom: 22, opacity: custOpacity }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>קישור ללקוח</label>
              <div style={{
                border: "1.5px solid #22c55e", borderRadius: 8, padding: "9px 12px",
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(34,197,94,0.04)",
              }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>ע</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>ענבל כהן</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginRight: "auto" }}>054-321-1234</span>
              </div>
            </div>

            {/* Save button */}
            <div style={{
              background: ORANGE, color: "white",
              borderRadius: 10, padding: "12px",
              textAlign: "center", fontSize: 14, fontWeight: 800,
              transform: `scale(${savePulse})`,
              boxShadow: "0 4px 18px rgba(234,88,12,0.35)",
            }}>
              שמור משימה
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep TasksCreate
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TasksCreateScene.tsx
git commit -m "feat(tasks-tutorial): add TasksCreateScene"
```

---

## Task 5: TasksFiltersScene

**Files:**
- Create: `src/scenes/TasksFiltersScene.tsx`

**What it shows:** Task list visible. Search bar types "תרופה" → list filters to 1 result. Status filter "באיחור" button activates. Date range "היום" applied. HighlightBox on search bar while typing, then on filter buttons.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/TasksFiltersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// Timeline
const SEARCH_START  = 20;  // search bar highlighted, text appears
const FILTER_START  = 145; // status filter "באיחור" activates
const DATE_START    = 270; // date filter "היום" activates

// Typewriter: "תרופה" typed character by character
const SEARCH_TEXT = "תרופה";
function getTypedText(frame: number): string {
  if (frame < SEARCH_START) return "";
  const charsTyped = Math.min(
    SEARCH_TEXT.length,
    Math.floor((frame - SEARCH_START) / 8)
  );
  return SEARCH_TEXT.slice(0, charsTyped);
}

const ALL_TASKS = [
  { title: "מתן תרופה לנובה",     cat: "תרופות", priority: "דחופה",  due: "היום 18:00",  status: "overdue"   as const },
  { title: "האכלה — חדר 3",        cat: "האכלה",  priority: "גבוהה",  due: "עכשיו",       status: "active"    as const },
  { title: "צ׳ק-אאוט — מקס",       cat: "פנסיון", priority: "בינונית",due: "מחר 10:00",  status: "scheduled" as const },
  { title: "שיחה עם ענבל כהן",    cat: "כללי",   priority: "נמוכה",  due: "אתמול",       status: "done"      as const },
  { title: "בדיקת חיסון — קיירה", cat: "בריאות", priority: "גבוהה",  due: "מחרתיים",     status: "scheduled" as const },
];

const STATUS_DOT: Record<string, string> = {
  overdue: "#ef4444", active: "#22c55e", scheduled: "#94a3b8", done: "#bbf7d0",
};
const STATUS_LABEL: Record<string, string> = {
  overdue: "באיחור", active: "עכשיו", scheduled: "מתוכנן", done: "הושלם",
};
const PRIORITY_COLOR: Record<string, string> = {
  "דחופה": "#ef4444", "גבוהה": "#ea580c", "בינונית": "#3b82f6", "נמוכה": "#94a3b8",
};

export const TasksFiltersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });
  const typedText = getTypedText(frame);

  // Filter state
  const searchActive = frame >= SEARCH_START && typedText.length > 0;
  const statusFilterActive = frame >= FILTER_START;
  const dateFilterActive = frame >= DATE_START;

  // Visible tasks based on active filters
  let visibleTasks = ALL_TASKS;
  if (searchActive && typedText === SEARCH_TEXT) {
    visibleTasks = ALL_TASKS.filter((t) => t.title.includes("תרופה"));
  } else if (searchActive) {
    // partial search — show all with opacity changes
    visibleTasks = ALL_TASKS;
  }
  if (statusFilterActive) {
    visibleTasks = visibleTasks.filter((t) => t.status === "overdue");
  }

  const listOpacity = interpolate(frame, [75, 88], [1, 0.3, ], { extrapolateRight: "clamp" })
    * interpolate(frame, [88, 100], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const zoomP = spring({ frame: frame - 6, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.05]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 38%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>+ משימה חדשה</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
          </div>

          {/* Filters toolbar */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "10px 24px", display: "flex", alignItems: "center", gap: 10,
            opacity: headerOpacity,
          }}>
            {/* Search field */}
            <div style={{
              flex: 1, border: `1.5px solid ${frame >= SEARCH_START && frame < FILTER_START ? ORANGE : "#e2e8f0"}`,
              borderRadius: 8, padding: "7px 12px",
              display: "flex", alignItems: "center", gap: 6,
              background: "white",
              boxShadow: frame >= SEARCH_START && frame < FILTER_START ? "0 0 0 2px rgba(234,88,12,0.1)" : "none",
            }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>🔍</span>
              <span style={{ fontSize: 13, color: typedText ? "#0f172a" : "#94a3b8", fontWeight: typedText ? 600 : 400 }}>
                {typedText || "חיפוש משימה..."}
              </span>
            </div>

            {/* Status filter buttons */}
            {["הכל", "באיחור", "עכשיו", "מתוכנן"].map((s) => {
              const isActive = s === "באיחור" && statusFilterActive;
              return (
                <div key={s} style={{
                  padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: isActive ? ORANGE : "white",
                  color: isActive ? "white" : "#64748b",
                  border: `1.5px solid ${isActive ? ORANGE : "#e2e8f0"}`,
                  flexShrink: 0,
                }}>
                  {s}
                </div>
              );
            })}

            {/* Date filter */}
            <div style={{
              padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
              background: dateFilterActive ? "#eff6ff" : "white",
              color: dateFilterActive ? "#3b82f6" : "#64748b",
              border: `1.5px solid ${dateFilterActive ? "#3b82f6" : "#e2e8f0"}`,
              flexShrink: 0,
            }}>
              {dateFilterActive ? "היום" : "כל תאריך"}
            </div>
          </div>

          {/* Task list */}
          <div style={{ padding: "14px 24px" }}>
            {visibleTasks.map((task, i) => {
              const rowOpacity = interpolate(frame, [12 + i * 10, 24 + i * 10], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={task.title} style={{
                  background: "white", borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  borderRight: `3px solid ${STATUS_DOT[task.status]}`,
                  padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 8,
                  opacity: rowOpacity * (task.status === "done" ? 0.55 : 1),
                }}>
                  <div style={{
                    background: task.status === "overdue" ? "#fef2f2" : task.status === "active" ? "#f0fdf4" : "#f8fafc",
                    color: task.status === "overdue" ? "#dc2626" : task.status === "active" ? "#16a34a" : "#64748b",
                    borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {STATUS_LABEL[task.status]}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1, textDecoration: task.status === "done" ? "line-through" : "none" }}>
                    {task.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[task.priority] }} />
                    <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>{task.priority}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{task.due}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Highlight search bar while typing */}
      <HighlightBox x={220} y={60} width={340} height={36} startFrame={SEARCH_START} endFrame={FILTER_START - 10} borderRadius={8} />
      {/* Highlight status filter area */}
      <HighlightBox x={572} y={60} width={252} height={36} startFrame={FILTER_START} endFrame={DATE_START - 10} borderRadius={7} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep TasksFilters
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TasksFiltersScene.tsx
git commit -m "feat(tasks-tutorial): add TasksFiltersScene"
```

---

## Task 6: TasksBulkScene

**Files:**
- Create: `src/scenes/TasksBulkScene.tsx`

**What it shows:** Task list → "בחר" button clicked → checkboxes appear on rows → 3 tasks selected → "סמן כהושלם" → tasks get strikethrough + completed status → second batch selected → "דחה תאריך" → postpone dialog.

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/TasksBulkScene.tsx
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

// Timeline
const SELECT_MODE_ON = 35;   // "בחר" clicked, checkboxes appear
const CHECK_1        = 60;   // task 1 checked
const CHECK_2        = 78;   // task 2 checked
const CHECK_3        = 96;   // task 3 checked
const BULK_COMPLETE  = 130;  // "סמן כהושלם" clicked
const TASKS_DONE     = 142;  // tasks show completed
const SELECT_MODE_2  = 220;  // second selection batch
const CHECK_4        = 248;
const CHECK_5        = 264;
const POSTPONE_CLICK = 298;
const DIALOG_OPEN    = 310;

const STATUS_DOT: Record<string, string> = {
  overdue: "#ef4444", active: "#22c55e", scheduled: "#94a3b8", done: "#bbf7d0",
};
const STATUS_LABEL: Record<string, string> = {
  overdue: "באיחור", active: "עכשיו", scheduled: "מתוכנן", done: "הושלם",
};
const PRIORITY_COLOR: Record<string, string> = {
  "דחופה": "#ef4444", "גבוהה": "#ea580c", "בינונית": "#3b82f6", "נמוכה": "#94a3b8",
};

const TASKS = [
  { title: "מתן תרופה לנובה",     priority: "דחופה",  due: "היום 18:00",  status: "overdue"   as const, checkFrame: CHECK_1 },
  { title: "האכלה — חדר 3",        priority: "גבוהה",  due: "עכשיו",       status: "active"    as const, checkFrame: CHECK_2 },
  { title: "צ׳ק-אאוט — מקס",       priority: "בינונית",due: "מחר 10:00",  status: "scheduled" as const, checkFrame: CHECK_3 },
  { title: "שיחה עם ענבל כהן",    priority: "נמוכה",  due: "אתמול",       status: "done"      as const, checkFrame: CHECK_4 },
  { title: "בדיקת חיסון — קיירה", priority: "גבוהה",  due: "מחרתיים",     status: "scheduled" as const, checkFrame: CHECK_5 },
];

export const TasksBulkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });

  const selectModeActive = frame >= SELECT_MODE_ON && frame < SELECT_MODE_2 - 10;
  const selectMode2Active = frame >= SELECT_MODE_2;
  const checkboxVisible = selectModeActive || selectMode2Active;

  // Which tasks are checked in each batch
  const batch1Checked = (i: number) => selectModeActive && frame >= TASKS[i]?.checkFrame;
  const batch2Checked = (i: number) => selectMode2Active && i >= 3 && frame >= TASKS[i]?.checkFrame;
  const isChecked = (i: number) => batch1Checked(i) || batch2Checked(i);

  // After bulk complete, first 3 tasks show as done
  const isCompleted = (i: number) => i < 3 && frame >= TASKS_DONE;

  // Bulk action bar visibility
  const bulkBarOpacity1 = interpolate(frame, [CHECK_1, CHECK_1 + 10], [0, 1], { extrapolateRight: "clamp" })
    * interpolate(frame, [TASKS_DONE + 5, TASKS_DONE + 15], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bulkBarOpacity2 = interpolate(frame, [CHECK_4, CHECK_4 + 10], [0, 1], { extrapolateRight: "clamp" })
    * interpolate(frame, [DIALOG_OPEN, DIALOG_OPEN + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Postpone dialog
  const dialogOpacity = interpolate(frame, [DIALOG_OPEN, DIALOG_OPEN + 12], [0, 1], { extrapolateRight: "clamp" });
  const dialogP = spring({ frame: frame - DIALOG_OPEN, fps, config: { damping: 200 } });
  const dialogScale = interpolate(dialogP, [0, 1], [0.93, 1]);

  // "סמן כהושלם" button pulse
  const completePulse = interpolate(frame, [BULK_COMPLETE, BULK_COMPLETE + 4, BULK_COMPLETE + 9], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>+ משימה חדשה</div>
            <div style={{
              background: checkboxVisible ? "#fef2f2" : "#f8fafc",
              color: checkboxVisible ? "#dc2626" : "#64748b",
              border: `1.5px solid ${checkboxVisible ? "#fca5a5" : "#e2e8f0"}`,
              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
            }}>
              {checkboxVisible ? "ביטול" : "בחר"}
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
        </div>

        {/* Bulk action bar */}
        {(bulkBarOpacity1 > 0.01 || bulkBarOpacity2 > 0.01) && (
          <div style={{
            background: "#0f172a",
            padding: "10px 24px",
            display: "flex", alignItems: "center", gap: 10,
            opacity: Math.max(bulkBarOpacity1, bulkBarOpacity2),
          }}>
            <span style={{ color: "white", fontSize: 13, fontWeight: 700, flex: 1 }}>
              {frame >= SELECT_MODE_2 ? "2 נבחרו" : "3 נבחרו"}
            </span>
            {bulkBarOpacity1 > 0.01 && (
              <div style={{
                background: "#22c55e", color: "white", borderRadius: 8,
                padding: "6px 14px", fontSize: 12, fontWeight: 700,
                transform: `scale(${completePulse})`,
              }}>
                סמן כהושלם
              </div>
            )}
            {bulkBarOpacity2 > 0.01 && (
              <div style={{ background: "#3b82f6", color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
                דחה תאריך
              </div>
            )}
            <div style={{ background: "#ef4444", color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>מחק</div>
          </div>
        )}

        {/* Task list */}
        <div style={{ padding: "12px 24px" }}>
          {TASKS.map((task, i) => {
            const rowOpacity = interpolate(frame, [12 + i * 10, 24 + i * 10], [0, 1], { extrapolateRight: "clamp" });
            const completed = isCompleted(i);
            const checked = isChecked(i);
            const checkAnim = interpolate(frame, [task.checkFrame, task.checkFrame + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const effectiveStatus = completed ? "done" : task.status;

            return (
              <div key={task.title} style={{
                background: checked ? "rgba(234,88,12,0.04)" : "white",
                borderRadius: 10,
                border: `1px solid ${checked ? "rgba(234,88,12,0.3)" : "#e2e8f0"}`,
                borderRight: `3px solid ${STATUS_DOT[effectiveStatus]}`,
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 8,
                opacity: rowOpacity * (completed ? 0.55 : 1),
              }}>
                {/* Checkbox */}
                {checkboxVisible && (
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: `2px solid ${checked ? ORANGE : "#cbd5e1"}`,
                    background: checked ? ORANGE : "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    opacity: interpolate(frame, [SELECT_MODE_ON, SELECT_MODE_ON + 10], [0, 1], { extrapolateRight: "clamp" }),
                  }}>
                    {checked && <span style={{ color: "white", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                )}

                {/* Status */}
                <div style={{
                  background: effectiveStatus === "overdue" ? "#fef2f2" : effectiveStatus === "active" ? "#f0fdf4" : "#f8fafc",
                  color: effectiveStatus === "overdue" ? "#dc2626" : effectiveStatus === "active" ? "#16a34a" : "#64748b",
                  borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {STATUS_LABEL[effectiveStatus]}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1, textDecoration: completed ? "line-through" : "none" }}>
                  {task.title}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[task.priority] }} />
                  <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>{task.priority}</span>
                </div>

                <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{task.due}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Postpone dialog */}
      {dialogOpacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${dialogOpacity * 0.4})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 80,
        }}>
          <div style={{
            background: "white", borderRadius: 16,
            padding: "24px 28px", width: 380,
            transform: `scale(${dialogScale})`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>דחיית משימות</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>בחר תאריך חדש עבור 2 המשימות הנבחרות</div>
            <div style={{
              border: "2px solid #3b82f6", borderRadius: 10, padding: "11px 14px",
              marginBottom: 18, background: "#eff6ff",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>11.04.2026 (מחר)</span>
            </div>
            <div style={{
              background: "#3b82f6", color: "white",
              borderRadius: 10, padding: "11px",
              textAlign: "center", fontSize: 14, fontWeight: 800,
            }}>
              אשר דחייה
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep TasksBulk
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TasksBulkScene.tsx
git commit -m "feat(tasks-tutorial): add TasksBulkScene"
```

---

## Task 7: TasksOutroScene

**Files:**
- Create: `src/scenes/TasksOutroScene.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/scenes/TasksOutroScene.tsx
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
  { text: "לוגיסטיקה יומיומית מסודרת" },
  { text: "כל הצוות מסונכרן" },
  { text: "אפס דברים שנופלים" },
];

export const TasksOutroScene: React.FC = () => {
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
        מערכת המשימות של פטרה
      </h1>
      <p style={{
        color: "white", fontSize: 20, fontWeight: 700,
        margin: 0, marginBottom: 32, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
      }}>
        שכל הצוות יודע מה לעשות, ומתי
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
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>התחילו לנהל עכשיו בחינם</span>
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
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep TasksOutro
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/TasksOutroScene.tsx
git commit -m "feat(tasks-tutorial): add TasksOutroScene"
```

---

## Task 8: TasksTutorial Composition

**Files:**
- Create: `src/TasksTutorial.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/TasksTutorial.tsx
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
import { TasksIntroScene } from "./scenes/TasksIntroScene";
import { TasksOverviewScene } from "./scenes/TasksOverviewScene";
import { TasksCreateScene } from "./scenes/TasksCreateScene";
import { TasksFiltersScene } from "./scenes/TasksFiltersScene";
import { TasksBulkScene } from "./scenes/TasksBulkScene";
import { TasksOutroScene } from "./scenes/TasksOutroScene";
import { TASKS_SCENES } from "../voiceover-tasks-config";

export type TasksTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = TASKS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = TASKS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateTasksMetadata: CalculateMetadataFunction<TasksTutorialProps> =
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

export const TasksTutorial: React.FC<TasksTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, overview, create, filters, bulk, outro] = sceneDurationsFrames;

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("teaser-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps * 2, durationInFrames],
            [0, 0.12, 0.12, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <TasksIntroScene />
          <SceneAudio file="voiceover/tasks-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={overview} premountFor={fps}>
          <TasksOverviewScene />
          <SceneAudio file="voiceover/tasks-overview.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={create} premountFor={fps}>
          <TasksCreateScene />
          <SceneAudio file="voiceover/tasks-create.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={filters} premountFor={fps}>
          <TasksFiltersScene />
          <SceneAudio file="voiceover/tasks-filters.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={bulk} premountFor={fps}>
          <TasksBulkScene />
          <SceneAudio file="voiceover/tasks-bulk.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <TasksOutroScene />
          <SceneAudio file="voiceover/tasks-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TeaserVideoLong\|TeaserVideoShort"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/TasksTutorial.tsx
git commit -m "feat(tasks-tutorial): add TasksTutorial composition"
```

---

## Task 9: Register in Root + Visual Verification

**Files:**
- Modify: `src/Root.tsx`

- [ ] **Step 1: Add imports to Root.tsx**

In `src/Root.tsx`, add after the last tutorial import (after the `SettingsTutorial` block):

```tsx
import {
  TasksTutorial,
  TasksTutorialProps,
  calculateTasksMetadata,
} from "./TasksTutorial";
import { TASKS_SCENES } from "../voiceover-tasks-config";
```

- [ ] **Step 2: Add defaultProps constant**

After the `settingsDefaultProps` constant, add:

```tsx
const tasksDefaultProps: TasksTutorialProps = {
  sceneDurationsFrames: TASKS_SCENES.map((s) => s.defaultDurationSec * FPS),
};
```

- [ ] **Step 3: Add Composition element**

Inside `<>...</>` in `RemotionRoot`, after the `PetraTeaserVideowebsite` composition:

```tsx
<Composition
  id="PetraTasksTutorial"
  component={TasksTutorial}
  calculateMetadata={calculateTasksMetadata}
  durationInFrames={
    TASKS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
  }
  fps={FPS}
  width={1280}
  height={720}
  defaultProps={tasksDefaultProps}
/>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video && PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TeaserVideoLong\|TeaserVideoShort"
```

Expected: no errors.

- [ ] **Step 5: Visual verification — render one still per scene**

```bash
# Scene 1 (Intro): frame 30
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-s1.png --frame=30

# Scene 2 (Overview): frame = intro_frames + 60
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-s2.png --frame=450

# Scene 3 (Create): frame at modal open = intro+overview+35
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-s3.png --frame=1260

# Scene 4 (Filters): mid-scene
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-s4.png --frame=1800

# Scene 5 (Bulk): after checkboxes appear
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-s5.png --frame=2340

# Scene 6 (Outro): mid-scene
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node_modules/.bin/remotion still PetraTasksTutorial /tmp/tasks-s6.png --frame=2880
```

Open each PNG and verify:
- S1: Dark bg, "מי מאכיל/נותן/מתקשר" questions visible, Petra logo at top
- S2: Petra UI with task list, status badges visible, category tabs
- S3: Modal open over blurred task list, form fields visible
- S4: Task list with search bar highlighted, filter buttons visible
- S5: Task list with checkboxes, some rows checked
- S6: Dark outro with logo, CTA button, URL

- [ ] **Step 6: Commit**

```bash
git add src/Root.tsx
git commit -m "feat(tasks-tutorial): register PetraTasksTutorial composition in Root"
```

---

## Task 10: Generate Voiceover WAVs

Run only if `GEMINI_KEY` is available.

- [ ] **Step 1: Run the generator**

```bash
cd /Users/or-rabinovich/Desktop/פיתוח/petra-app/my-video
GEMINI_KEY=<your-key> PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx tsx generate-voiceover-tasks.ts
```

Expected: 6 WAV files in `public/voiceover/`:
- `tasks-intro.wav` (~14s)
- `tasks-overview.wav` (~18s)
- `tasks-create.wav` (~20s)
- `tasks-filters.wav` (~16s)
- `tasks-bulk.wav` (~18s)
- `tasks-outro.wav` (~10s)

- [ ] **Step 2: Verify durations load correctly**

Open Remotion Studio and navigate to `PetraTasksTutorial`. The total duration in the timeline should match the actual WAV durations (not the defaultDurationSec values).

- [ ] **Step 3: Commit WAVs**

```bash
git add public/voiceover/tasks-*.wav
git commit -m "feat(tasks-tutorial): add generated voiceover WAV files"
```

---

## Self-Review

**Spec coverage:**
- ✅ Scene 1 (tasks-intro): hook with team chaos questions, "כל הצוות מסונכרן"
- ✅ Scene 2 (tasks-overview): task list, all statuses, category tab filter animation
- ✅ Scene 3 (tasks-create): modal, all fields, linked customer, save → new row
- ✅ Scene 4 (tasks-filters): search typewriter, status filter, date filter, HighlightBox
- ✅ Scene 5 (tasks-bulk): selection mode, 3 tasks → complete, 2 tasks → postpone dialog
- ✅ Scene 6 (tasks-outro): benefits, CTA, URL
- ✅ Composition registered as `PetraTasksTutorial`
- ✅ Voiceover config + generate script
- ✅ Music: `teaser-music.mp3` at 0.12 volume

**No placeholders found.**

**Type consistency:**
- `TasksTutorialProps.sceneDurationsFrames: number[]` used consistently across TasksTutorial + Root
- `calculateTasksMetadata` matches `CalculateMetadataFunction<TasksTutorialProps>` signature
- All scene components export named React.FC with no props (same as every other tutorial scene)
- TASKS_SCENES destructuring in composition: `[intro, overview, create, filters, bulk, outro]` = 6 items matching 6 scenes in config
