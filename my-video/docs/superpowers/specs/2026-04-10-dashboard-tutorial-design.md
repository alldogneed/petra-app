# Petra Dashboard Tutorial — Design Spec

**Date:** 2026-04-10

---

## Goal

Renovate the existing `DashboardTutorial` to match the visual language of the newer Petra tutorial series (Tasks, Settings, Boarding, Booking). Same 6 scenes, new scene files, new voiceover config, sidebar added to all UI scenes, bg-music added.

**Core message:** כל מה שצריך לנהל את העסק — במקום אחד.

---

## Format

- **Dimensions:** 1280×720
- **FPS:** 30
- **Total duration:** ~80 seconds
- **Voiceover:** Hebrew TTS via Gemini (Aoede voice), one WAV per scene
- **Music:** `bg-music.mp3` at volume 0.13, loop, fade in/out
- **Language:** Hebrew / RTL
- **Composition ID:** `PetraDashboardTutorial` (new, alongside the old `DashboardTutorial`)

---

## Scene Structure

| # | Scene ID | Duration | Content |
|---|----------|----------|---------|
| 1 | `dashboard-intro` | ~12s | Dark intro — PETRA logo, badge, title "לוח הבקרה" |
| 2 | `dashboard-stats` | ~15s | 4 stat cards animate in with number counter |
| 3 | `dashboard-appointments` | ~15s | Upcoming appointments + WhatsApp callout |
| 4 | `dashboard-orders` | ~13s | Recent orders table + status badges |
| 5 | `dashboard-checklist` | ~13s | Setup checklist with animated check-offs |
| 6 | `dashboard-outro` | ~10s | Dark outro with benefit pills + CTA |

**Total:** ~78s

---

## Scene Details

### Scene 1 — Intro (`dashboard-intro`, ~12s)

**Pattern:** Identical to `TasksIntroScene` — dark background, centered content.

**Layout:** Dark gradient `#0f172a → #1e293b`, centered column, background glow + decorative dots.

**Elements (in animation order):**
- Petra icon + "PETRA" text — spring scale-in
- Orange badge "מדריך מהיר" — fade in
- Title "**לוח הבקרה**" (white, 60px, fontWeight 800) — spring slide-up
- Subtitle "כל מה שצריך לנהל את העסק — במקום אחד" (#94a3b8, 20px) — spring slide-up

**Voiceover script:**
> "ברוכים הבאים לדשבורד של פטרה — מרכז הניהול של העסק שלכם. בסקירה אחת תראו הכנסות, תורים, לקוחות, ותשלומים ממתינים."

---

### Scene 2 — Stats (`dashboard-stats`, ~15s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="דשבורד").

**Layout:** Sidebar right (210px), content area left. `#f1f5f9` background. White header bar (height 52px) with page title "לוח הבקרה".

**UI elements:**
- 4 stat cards in 2×2 grid, staggered fade/slide-up (spring):
  - **₪12,450** — "הכנסות החודש" — sub: "היום: ₪680" — orange
  - **6** — "תורים היום" — sub: "הבא: 10:30" — blue (#2563eb)
  - **48** — "לקוחות פעילים" — sub: "+3 החודש" — green (#16a34a)
  - **3** — "תשלומים ממתינים" — sub: "סה״כ ₪1,230" — amber (#d97706)
- Each card: animated number counter from 0 → final value
- Orange callout at bottom: "הנתונים מתעדכנים בזמן אמת — כל תשלום ותור מתווסף אוטומטית"

**Voiceover script:**
> "בראש הדשבורד ארבע כרטיסיות נותנות מבט-על על העסק — הכנסות החודש, תורים להיום, לקוחות פעילים, ותשלומים שממתינים לגביה. הכל מתעדכן בזמן אמת."

---

### Scene 3 — Appointments (`dashboard-appointments`, ~15s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="דשבורד").

**Layout:** Sidebar right, content left. White header bar. Section heading "תורים קרובים" with orange accent bar.

**UI elements:**
- 4 appointment rows slide in from right, staggered:
  - 09:00 — מקס (לברדור) — אילוף בסיסי — דני כהן — 💬 button
  - 10:30 — בלה (פינצ'ר) — טיפוח ועיצוב — שרה לוי — 💬 button
  - 14:00 — רקי (האסקי) — אילוף מתקדם — מיכל ברנשטיין — 💬 button
  - 16:30 — קפה (שפניה) — בדיקת בריאות — דוד אברהם — 💬 button
- Green callout box (fades in late): "תזכורות WhatsApp אוטומטיות — פטרה שולחת תזכורת ללקוח 24-48 שעות לפני התור"

**Voiceover script:**
> "מתחת לכרטיסיות תראו את התורים הקרובים. לחצו על כפתור הוואטסאפ לשליחת תזכורת ישירות ללקוח — או הפעילו תזכורות אוטומטיות שיוצאות 24 עד 48 שעות לפני כל תור."

---

### Scene 4 — Orders (`dashboard-orders`, ~13s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="דשבורד").

**Layout:** Sidebar right, content left. Section heading "הזמנות אחרונות" + link "לכל ההזמנות ←".

**UI elements:**
- Orders table in white card (border-radius 16):
  - Header row: לקוח / חיה | תאריך | שירות | סכום | סטטוס
  - 5 order rows animate in (slide from right), staggered:
    - דני כהן / מקס | היום | אילוף בסיסי ×4 | ₪480 | ✓ שולם (green)
    - שרה לוי / בלה | אתמול | טיפוח ועיצוב | ₪180 | ⏳ ממתין (amber)
    - מיכל ברנשטיין / רקי | 23/03 | חבילת אילוף מלאה | ₪1,200 | ✓ שולם
    - דוד אברהם / קפה | 21/03 | פנסיון 3 לילות | ₪360 | ⏳ ממתין
    - יוסי מזרחי / לונה | 18/03 | בדיקת בריאות | ₪220 | ✓ שולם
- Summary callout (fades in): "שולם החודש ₪2,440" | "ממתין לגביה ₪540" | tip on WhatsApp payment request

**Voiceover script:**
> "בסעיף ההזמנות האחרונות תוכלו לראות מה שולם ומה ממתין לגביה. לחצו על שורה כדי לנווט להזמנה — ומשם לשלוח דרישת תשלום ישירות בוואטסאפ."

---

### Scene 5 — Checklist (`dashboard-checklist`, ~13s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="דשבורד").

**Layout:** Sidebar right, content left. Section heading "צ'קליסט הקמה" with progress bar and counter "X/7 הושלמו".

**UI elements:**
- Progress bar (gradient orange → green) fills as items complete
- 7 checklist items slide in from right, staggered:
  - ✅ הגדרת פרטי העסק (completed, green bg)
  - ✅ הוספת שירות ראשון (completed)
  - ✅ הוספת לקוח ראשון (completed)
  - ✅ קביעת תור ראשון (completed)
  - ○ יצירת הזמנה (pending, white bg)
  - ○ הגדרת חוזה לדוגמה (pending)
  - ○ הפעלת תזכורות WhatsApp (pending)
- Check animations spring-in as each item arrives

**Voiceover script:**
> "הצ'קליסט מוביל אתכם שלב אחרי שלב בהגדרת העסק — משירותים ולקוחות ועד לתזכורות אוטומטיות. כל שלב שמסיימים מסתמן ירוק."

---

### Scene 6 — Outro (`dashboard-outro`, ~10s)

**Pattern:** Identical to `TasksOutroScene` — dark background, centered content.

**Voiceover script:**
> "הדשבורד של פטרה — כל מה שצריך לנהל את העסק, במקום אחד. התחילו עכשיו בחינם."

**Elements:**
- Petra icon (80px) — spring scale-in
- Title "הדשבורד של פטרה" (white, 44px) — spring slide-up
- Tagline "כל מה שצריך לנהל את העסק, במקום אחד" (white, 20px)
- 3 benefit pills (fade/scale in staggered):
  - "מבט-על על העסק"
  - "תזכורות אוטומטיות"
  - "ניהול תשלומים"
- Orange CTA button "התחילו עכשיו בחינם ←"
- URL "petra-app.com"

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
| Sidebar activeLabel | `"דשבורד"` |

---

## Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `voiceover-dashboard-config.ts` | Scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-dashboard.ts` | Gemini TTS generator for dashboard WAVs |
| Create | `src/scenes/DashboardIntroScene.tsx` | Scene 1: dark intro (replaces IntroScene pattern) |
| Create | `src/scenes/DashboardStatsScene.tsx` | Scene 2: stat cards with sidebar |
| Create | `src/scenes/DashboardAppointmentsScene.tsx` | Scene 3: appointments with sidebar |
| Create | `src/scenes/DashboardOrdersScene.tsx` | Scene 4: orders table with sidebar |
| Create | `src/scenes/DashboardChecklistScene.tsx` | Scene 5: checklist with sidebar |
| Create | `src/scenes/DashboardOutroScene.tsx` | Scene 6: dark outro |
| Modify | `src/DashboardTutorial.tsx` | Update to use new scenes + new voiceover config + bg-music |
| Modify | `src/Root.tsx` | Add `PetraDashboardTutorial` composition |

**Audio:** Generate WAVs → `public/voiceover/dashboard-{id}.wav`

**Old scene files** (`IntroScene.tsx`, `StatsScene.tsx`, `AppointmentsScene.tsx`, `OrdersScene.tsx`, `ChecklistScene.tsx`, `OutroScene.tsx`) and `voiceover-config.ts` are left untouched for backward compatibility — the old `DashboardTutorial` composition stays as-is; a new `PetraDashboardTutorial` is added alongside it.

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Sidebar | `src/scenes/PetraSidebar.tsx` |
| Intro pattern | `src/scenes/TasksIntroScene.tsx` |
| Outro pattern | `src/scenes/TasksOutroScene.tsx` |
| calculateMetadata pattern | `src/TasksTutorial.tsx` |
| Content from old scenes | `src/scenes/StatsScene.tsx`, `AppointmentsScene.tsx`, `OrdersScene.tsx`, `ChecklistScene.tsx` |

---

## What NOT to Build

- No CursorOverlay in dashboard scenes (dashboard is static overview, no click interactions to demo)
- No modifications to old scene files or `voiceover-config.ts`
- No real API calls — all data is hardcoded
