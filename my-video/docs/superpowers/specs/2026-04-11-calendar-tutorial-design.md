# Petra Calendar Tutorial — Design Spec

**Date:** 2026-04-11

---

## Goal

Build a new `PetraCalendarTutorial` composition for the "יומן" feature of Petra. 6 scenes covering calendar views, appointment booking, recurring appointments, and availability management.

**Core message:** נהלו את הזמן שלכם — תורים, חזרות, וזמינות בלחיצה.

---

## Format

- **Dimensions:** 1280×720
- **FPS:** 30
- **Total duration:** ~66 seconds
- **Voiceover:** Hebrew TTS via Gemini (Aoede voice), one WAV per scene
- **Music:** `bg-music.mp3` at volume 0.13, loop, fade in/out
- **Language:** Hebrew / RTL
- **Composition ID:** `PetraCalendarTutorial`

---

## Scene Structure

| # | Scene ID | Duration | Content |
|---|----------|----------|---------|
| 1 | `calendar-intro` | ~10s | Dark intro — PETRA logo, badge, title "יומן פטרה" |
| 2 | `calendar-week` | ~12s | Sidebar + weekly view with colored appointment blocks |
| 3 | `calendar-add` | ~11s | Sidebar + add-appointment modal |
| 4 | `calendar-recurring` | ~11s | Sidebar + recurring toggle in modal |
| 5 | `calendar-availability` | ~12s | Sidebar + working hours + block time form |
| 6 | `calendar-outro` | ~10s | Dark outro — logo, benefit pills, CTA |

**Total:** ~66s

---

## Scene Details

### Scene 1 — Intro (`calendar-intro`, ~10s)

**Pattern:** Identical to `AdminIntroScene` / `PetsIntroScene` — dark background, centered content.

**Layout:** Dark gradient `#0f172a → #1e293b`, centered column, background glow + decorative dots.

**Elements (in animation order):**
- Petra icon + "PETRA" text — spring scale-in
- Orange badge "מדריך מהיר" — fade in
- Title **"יומן פטרה"** (white, 60px, fontWeight 800) — spring slide-up
- Subtitle "כל התורים, החזרות והזמינות — במקום אחד" (#94a3b8, 20px) — spring slide-up

**Voiceover script:**
> "יומן פטרה — כל התורים שלכם, בתצוגה ברורה, עם ניהול זמן מלא."

---

### Scene 2 — Weekly View (`calendar-week`, ~12s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="יומן").

**Layout:** Sidebar right (210px), content left. `#f1f5f9` background. White header bar with navigation arrows, date range text, and view mode tabs (יום / שבוע / חודש / סדר יום — "שבוע" active/orange). Orange "+" button on the left.

**UI elements:**
- 7-column week grid (ראשון–שבת) with time rows
- 5–6 colored appointment blocks staggered fade/slide in:
  - 🟠 **ראשון 09:00** — "אילוף — דנה לוי"
  - 🟢 **שני 10:30** — "גרומינג — יוסי כהן"
  - 🔵 **שלישי 14:00** — "אילוף — מירי לוי"
  - 🟠 **רביעי 09:00** — "אילוף — רון אבן"
  - 🟢 **חמישי 11:00** — "גרומינג — שרה גל"
- Orange callout at bottom: "4 תצוגות — יום, שבוע, חודש, וסדר יום"

**Voiceover script:**
> "בתצוגה השבועית תראו את כל התורים — לפי שירות, לקוח ושעה. עוברים בין יום, שבוע וחודש בלחיצה."

---

### Scene 3 — Add Appointment (`calendar-add`, ~11s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="יומן").

**Layout:** Sidebar right, content left. Weekly view visible in background. Modal centered over backdrop.

**UI elements:**
- Backdrop fades in over calendar
- Modal springs in (spring scale): "הוסף תור"
  - **לקוח**: "דנה לוי"
  - **שירות**: "אילוף — 60 דק׳" (highlighted orange)
  - **תאריך**: "14.04.2026"
  - **שעה**: "09:00"
  - **הערות**: "שיעור ראשון"
- "שמור" button highlighted orange at bottom
- After save: new orange appointment block appears in the calendar behind the closing modal

**Voiceover script:**
> "הוספת תור לוקחת שניות — בוחרים לקוח, שירות, ותאריך. הוא מופיע מיד ביומן."

---

### Scene 4 — Recurring Appointments (`calendar-recurring`, ~11s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="יומן").

**Layout:** Same modal as Scene 3, but with the recurring toggle visible and active.

**UI elements:**
- Modal "הוסף תור" with same fields as Scene 3
- Toggle row "חוזר" — animates to ON (orange)
- Dropdown appears below toggle (spring expand): showing options
  - "כל שבוע" (selected, highlighted orange)
  - "כל שבועיים"
  - "כל חודש"
- Orange callout below modal: "קבעו סדרת תורים בבת אחת — שבועי, דו-שבועי, או חודשי"

**Voiceover script:**
> "תורים חוזרים? מפעילים את האפשרות ובוחרים תדירות — השאר קורה אוטומטית."

---

### Scene 5 — Availability (`calendar-availability`, ~12s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="הגדרות").

**Layout:** Sidebar right, content left. Page title "זמינות". Two sections: working hours table + block time form.

**UI elements:**
- Section: "שעות פעילות" — table with 7 rows (ראשון–שבת):
  - Each row: day name + open/close time inputs (e.g. 09:00–18:00)
  - Saturday row: greyed out / closed
  - Rows animate in staggered
- Section: "חסימת זמן" (slides in after ~frame 90):
  - Form: מ: "20.04.2026 09:00" / עד: "25.04.2026 18:00" / סיבה: "חופשה"
  - Orange "הוסף חסימה" button
- Orange callout: "חסמו ימי חופשה — הלקוחות לא יוכלו להזמין בזמן זה"

**Voiceover script:**
> "בהגדרות הזמינות קובעים שעות פעילות לכל יום — ואפשר לחסום ימי חופשה בקלות."

---

### Scene 6 — Outro (`calendar-outro`, ~10s)

**Pattern:** Identical to `AdminOutroScene` / `PetsOutroScene` — dark background, centered content.

**Elements:**
- Petra icon (80px) — spring scale-in
- Title "יומן פטרה" (white, 44px) — spring slide-up
- Tagline "הזמן שלכם, בשליטה שלכם" (white, 20px)
- 3 benefit pills (fade/scale in staggered):
  - "4 תצוגות יומן"
  - "תורים חוזרים"
  - "ניהול זמינות"
- Orange CTA button "נסו עכשיו ←"
- URL "petra-app.com"

**Voiceover script:**
> "יומן פטרה — הזמן שלכם, בשליטה שלכם."

---

## Visual Language

Follows established tutorial conventions:

| Element | Value |
|---------|-------|
| Background (UI scenes) | `#f1f5f9` |
| Background (dark scenes) | `#0f172a` |
| Orange accent | `#ea580c` |
| Sidebar width | 210px (right side) |
| Content area | `right: 210px, left: 0` |
| Font | `'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif` |
| Direction | `rtl` |
| Sidebar activeLabel (scenes 2–4) | `"יומן"` |
| Sidebar activeLabel (scene 5) | `"הגדרות"` |

---

## Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `voiceover-calendar-config.ts` | Scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-calendar.ts` | Gemini TTS generator for calendar WAVs |
| Create | `src/scenes/CalendarIntroScene.tsx` | Scene 1: dark intro |
| Create | `src/scenes/CalendarWeekScene.tsx` | Scene 2: weekly view with appointment blocks |
| Create | `src/scenes/CalendarAddScene.tsx` | Scene 3: add-appointment modal |
| Create | `src/scenes/CalendarRecurringScene.tsx` | Scene 4: recurring toggle + dropdown |
| Create | `src/scenes/CalendarAvailabilityScene.tsx` | Scene 5: working hours + block time |
| Create | `src/scenes/CalendarOutroScene.tsx` | Scene 6: dark outro |
| Create | `src/CalendarTutorial.tsx` | Main composition with bg-music + 6 scenes |
| Modify | `src/Root.tsx` | Add `PetraCalendarTutorial` composition |

**Audio:** Generate WAVs → `public/voiceover/calendar-{id}.wav`

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Sidebar | `src/scenes/PetraSidebar.tsx` |
| Intro pattern | `src/scenes/PetsIntroScene.tsx` |
| Outro pattern | `src/scenes/AdminOutroScene.tsx` |
| Composition pattern | `src/PetsTutorial.tsx` |
| Root registration | `src/Root.tsx` |

---

## What NOT to Build

- No CursorOverlay
- No real API calls — all data is hardcoded
- No drag-and-drop animation (too complex for a static Remotion scene)
- No Google Calendar integration UI (out of scope for this tutorial)
