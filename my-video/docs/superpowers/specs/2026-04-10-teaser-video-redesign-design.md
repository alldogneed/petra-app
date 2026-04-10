# Petra Teaser Video — Redesign Spec (v2)

**Date:** 2026-04-10
**Replaces:** `docs/specs/2026-04-08-teaser-video-design.md`

---

## Goal

Replace the current 31-second teaser (`PetraTeaserVideowebsite`) with a ~90-second version that:
- Lets viewers clearly read pain-point text and UI features
- Focuses on 4 high-impact topics instead of 6 rushed ones
- Ends with a free-forever CTA (not a time-limited trial)
- Emphasizes Petra's unique differentiator: built from real pet-business field experience

---

## Format

- **Dimensions:** 1280×720 (unchanged)
- **FPS:** 30 (unchanged)
- **Total duration:** 2700 frames (~90 seconds)
- **Voiceover:** None — UI animations + text only
- **Music:** Existing `teaser-music.mp3` at volume 0.18
- **Language:** Hebrew / RTL

---

## Scene Structure

| # | Scene | Frames | Duration | Content |
|---|-------|--------|----------|---------|
| 1 | Chaos / Hook | 0–240 | 8s | Text-only dark background: "לנהל עסק עם בע״ח זה כאוס" |
| 2 | Logo | 240–390 | 5s | Petra logo reveal + "יש דרך אחרת" |
| 3 | Leads | 390–840 | 15s | Pain (4s) → UI (11s) |
| 4 | Boarding | 840–1290 | 15s | Pain (4s) → UI (11s) |
| 5 | Online Booking | 1290–1740 | 15s | Pain (4s) → UI (11s) |
| 6 | Reminders | 1740–2190 | 15s | Pain (4s) → UI (11s) |
| 7 | USP Beat | 2190–2460 | 9s | Full-screen differentiator text |
| 8 | CTA | 2460–2700 | 8s | Logo + CTA + URL |

---

## Scene Details

### Scene 1 — Chaos / Hook (frames 0–240)

**Purpose:** Immediate emotional hook. No UI yet.

**Layout:** `AbsoluteFill`, background `#0f172a` (near-black).

**Animations:**
- Frame 0–30: fade in from black
- Frame 15–60: line 1 slides in from right: **"לנהל עסק עם בע״ח"** (fontSize 48, white, fontWeight 800)
- Frame 45–90: line 2 slides in: **"זה כאוס"** (fontSize 64, color `#ef4444` red, fontWeight 900)
- Frame 90–210: both lines hold, subtle scale pulse on "כאוס" (1.0→1.03→1.0)
- Frame 210–240: fade out to black

**No cursor. No UI elements.**

---

### Scene 2 — Logo (frames 240–390)

**Purpose:** Brand moment + pivot phrase.

**Layout:** `AbsoluteFill`, background `#0f172a`.

**Animations:**
- Frame 240–270: fade in from black
- Frame 255–300: Petra logo appears (spring scale 0→1), centered
- Frame 300–345: subtitle fades in below logo: **"יש דרך אחרת"** (fontSize 22, color `#94a3b8`)
- Frame 345–390: hold

**Logo:** Use existing Petra logo asset (same as `TeaserLogoScene`).

---

### Scene 3 — Leads (frames 390–840)

**Purpose:** Show how Petra captures and tracks leads instead of losing them in WhatsApp.

#### Pain phase (frames 390–510, 4s)
- Background `#0f172a`
- Pain text slides in: **"לידים שנעלמים בין הצ׳אטים"** (fontSize 40, white, fontWeight 800)
- Sub-line fades in: **"כמה פניות השבוע לא קיבלו מענה?"** (fontSize 20, color `#94a3b8`)

#### UI phase (frames 510–840, 11s)
- Transition: crossfade to Petra leads page UI
- Render: existing `TeaserCRMScene` visual style — kanban or table view of leads
- Cursor animation: moves lead card from "ליד חדש" column to "בטיפול"
- HighlightBox: highlights the lead card being moved (~frames 570–750)
- Benefit tag appears at frame 650: **"כל ליד מתועד ועוקב אוטומטית"** (green pill, bottom-center)

---

### Scene 4 — Boarding (frames 840–1290)

**Purpose:** Show room map and check-in instead of paper/memory management.

#### Pain phase (frames 840–960, 4s)
- Pain text: **"איזה כלב באיזה חדר?"** (fontSize 40, white, fontWeight 800)
- Sub-line: **"אל תסמוך על הזיכרון"** (fontSize 20, color `#94a3b8`)

#### UI phase (frames 960–1290, 11s)
- Render: boarding room map (grid of rooms with dog names)
- Cursor: clicks on a room, shows dog details panel
- HighlightBox: highlights the room map grid (~frames 1010–1200)
- Benefit tag at frame 1100: **"מפת חדרים בזמן אמת"** (green pill)

---

### Scene 5 — Online Booking (frames 1290–1740)

**Purpose:** Show self-service booking page so owner doesn't miss calls.

#### Pain phase (frames 1290–1410, 4s)
- Pain text: **"הלקוח התקשר. היית עסוק."** (fontSize 40, white, fontWeight 800)
- Sub-line: **"הוא הזמין אצל המתחרה"** (fontSize 20, color `#ef4444` red)

#### UI phase (frames 1410–1740, 11s)
- Render: public booking page (`/book/[slug]`) — service selector, date picker, confirm button
- Cursor: selects service → picks date → clicks "אישור הזמנה"
- HighlightBox: highlights the booking confirmation button (~frames 1550–1700)
- Benefit tag at frame 1580: **"הלקוח מזמין לבד — 24/7"** (green pill)

---

### Scene 6 — Reminders (frames 1740–2190)

**Purpose:** Show automatic WhatsApp reminder setup instead of manual follow-up.

#### Pain phase (frames 1740–1860, 4s)
- Pain text: **"ביטול ברגע האחרון?"** (fontSize 40, white, fontWeight 800)
- Sub-line: **"כי שכחו. ואתה לא הזכרת."** (fontSize 20, color `#94a3b8`)

#### UI phase (frames 1860–2190, 11s)
- Render: Settings → הודעות tab — WhatsApp toggle ON, reminder timing buttons (24/48/72h)
- Cursor: clicks "48 שעות" button, then moves to template card
- HighlightBox: highlights the WhatsApp toggle + timing row (~frames 1910–2090)
- Benefit tag at frame 2000: **"תזכורת אוטומטית לכל תור"** (green pill)

---

### Scene 7 — USP Beat (frames 2190–2460)

**Purpose:** Land the key differentiator before the CTA.

**Layout:** `AbsoluteFill`, background `#0f172a`.

**Animations:**
- Frame 2190–2220: crossfade from reminders scene
- Frame 2220–2280: first line fades + slides in: **"המערכת היחידה"** (fontSize 44, white, fontWeight 900)
- Frame 2280–2340: second line: **"שנבנתה מהשטח"** (fontSize 44, color `#ea580c` orange, fontWeight 900)
- Frame 2340–2400: third line fades in: **"עם אנשים שמכירים בע״ח"** (fontSize 22, color `#94a3b8`)
- Frame 2400–2460: all three lines hold

**No cursor. No UI.**

---

### Scene 8 — CTA (frames 2460–2700)

**Purpose:** Convert interest to signup.

**Layout:** `AbsoluteFill`, background `#0f172a`.

**Animations:**
- Frame 2460–2490: crossfade from USP beat
- Frame 2490–2550: Petra logo appears (spring scale)
- Frame 2550–2610: CTA text fades in: **"נסו חינם עכשיו"** (fontSize 48, white, fontWeight 900)
- Frame 2610–2650: sub-line: **"ללא מגבלת זמן"** (fontSize 20, color `#22c55e` green)
- Frame 2650–2680: URL: **`petra-app.com`** (fontSize 18, color `#94a3b8`)
- Frame 2680–2700: gentle fade out

---

## Visual Language (consistent across all scenes)

| Element | Value |
|---------|-------|
| Background (dark) | `#0f172a` |
| Pain text | `white`, fontWeight 800 |
| Pain emphasis | `#ef4444` (red) |
| Orange accent | `#ea580c` |
| Green benefit | `#22c55e` |
| Muted text | `#94a3b8` |
| Font | `'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif` |
| Direction | `rtl` |

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Pain text animation pattern | `TeaserChaosScene.tsx` |
| Logo reveal | `TeaserLogoScene.tsx` |
| Leads UI | `TeaserCRMScene.tsx` (adapt) |
| Boarding UI | `TeaserBoardingScene.tsx` (adapt) |
| Booking UI | `TeaserBookingScene.tsx` (adapt) |
| BenefitTag component | `src/components/teaser/BenefitTag.tsx` |
| CursorAnimation | `src/components/teaser/CursorAnimation.tsx` |
| PainOverlay | `src/components/teaser/PainOverlay.tsx` |
| Music | `public/teaser-music.mp3` |

**New scenes to build:** `TeaserRemindersScene.tsx`, `TeaserUSPScene.tsx`
**Scenes to adapt:** All 4 content scenes get extended timing + pain phase prepended

---

## Composition Registration

Update `src/TeaserVideo.tsx`:
- Composition ID: `PetraTeaserVideowebsite`
- `durationInFrames`: 2700
- All 8 scenes wired via `<Series>`

---

## What NOT to Build

- No voiceover or audio beyond existing music
- No split-screen before/after
- No new UI components beyond what's listed
- Do not modify the existing tutorial video compositions
