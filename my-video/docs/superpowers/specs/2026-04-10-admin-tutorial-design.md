# Petra Admin Tutorial — Design Spec

**Date:** 2026-04-10

---

## Goal

Build a new `PetraAdminTutorial` composition for the "ניהול ובקרה" section of Petra. 8 scenes covering all 6 tabs of the `/business-admin` page, following the exact same visual language as the newer Petra tutorial series (Tasks, Settings, Booking, Dashboard).

**Core message:** שקיפות מלאה — כל פעולה, כל משתמש, בזמן אמת.

---

## Format

- **Dimensions:** 1280×720
- **FPS:** 30
- **Total duration:** ~94 seconds
- **Voiceover:** Hebrew TTS via Gemini (Aoede voice), one WAV per scene
- **Music:** `bg-music.mp3` at volume 0.13, loop, fade in/out
- **Language:** Hebrew / RTL
- **Composition ID:** `PetraAdminTutorial`

---

## Scene Structure

| # | Scene ID | Duration | Content |
|---|----------|----------|---------|
| 1 | `admin-intro` | ~10s | Dark intro — PETRA logo, badge, title "ניהול ובקרה" |
| 2 | `admin-overview` | ~13s | Sidebar + טאב "סקירה": 4 stat cards + activity feed |
| 3 | `admin-activity` | ~13s | Sidebar + טאב "פעילות": filterable activity log |
| 4 | `admin-team` | ~14s | Sidebar + טאב "צוות": team table with roles, online status, edit |
| 5 | `admin-sessions` | ~12s | Sidebar + טאב "סשנים": active sessions per device + force logout |
| 6 | `admin-messages` | ~12s | Sidebar + טאב "הודעות מערכת": message form + list with expiry |
| 7 | `admin-subscription` | ~10s | Sidebar + טאב "מנוי וחיוב": plan card + billing history |
| 8 | `admin-outro` | ~10s | Dark outro — logo, benefit pills, CTA |

**Total:** ~94s

---

## Scene Details

### Scene 1 — Intro (`admin-intro`, ~10s)

**Pattern:** Identical to `TasksIntroScene` / `BookingIntroScene` — dark background, centered content.

**Layout:** Dark gradient `#0f172a → #1e293b`, centered column, background glow + decorative dots.

**Elements (in animation order):**
- Petra icon + "PETRA" text — spring scale-in
- Orange badge "מדריך מהיר" — fade in
- Title **"ניהול ובקרה"** (white, 60px, fontWeight 800) — spring slide-up
- Subtitle "שקיפות מלאה — כל פעולה, כל משתמש, בזמן אמת" (#94a3b8, 20px) — spring slide-up

**Voiceover script:**
> "ניהול ובקרה של פטרה — שקיפות מלאה על כל פעולה, כל משתמש, בזמן אמת."

---

### Scene 2 — Overview (`admin-overview`, ~13s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="ניהול ובקרה").

**Layout:** Sidebar right (210px), content area left. `#f1f5f9` background. White header bar (52px) with title "ניהול ובקרה" + green pulsing dot "ניטור פעיל". Tab bar below header with 6 tabs, "סקירה" active.

**UI elements:**
- 4 stat cards in a row, staggered fade/slide-up:
  - **3** — "חברי צוות פעילים" — blue (#2563eb)
  - **48** — "לקוחות" — green (#16a34a)
  - **6** — "תורים היום" — orange (#ea580c)
  - **₪12,450** — "הכנסות החודש" — amber (#d97706)
- Activity feed below (white card): 4 rows slide in, each showing user avatar initial, name, action label, relative timestamp
  - דני | הוסיף לקוח | לפני 3 דק׳
  - שרה | קבע תור | לפני 12 דק׳
  - מיכל | יצר הזמנה | לפני 28 דק׳
  - דני | שלח תזכורת | לפני 45 דק׳

**Voiceover script:**
> "בסקירה תראו את מצב הצוות, הלקוחות, התורים וההכנסות — ומתחת, פיד פעילות חי שמתעדכן כל שלושים שניות."

---

### Scene 3 — Activity (`admin-activity`, ~13s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="ניהול ובקרה").

**Layout:** Same header + tab bar, "פעילות" tab active.

**UI elements:**
- Two filter dropdowns: "כל חברי הצוות ▾" and "כל הפעולות ▾" — fade in
- Activity log table (white card), 6 rows animate in staggered:
  - 🟢 דני כהן | הוסיף לקוח | לפני 3 דק׳
  - 🔵 שרה לוי | קבע תור | לפני 12 דק׳
  - 🟢 דני כהן | יצר הזמנה | לפני 28 דק׳
  - 🔴 מיכל ב׳ | מחק תור | לפני 1 שע׳
  - 🔵 שרה לוי | עדכן הגדרות | לפני 2 שע׳
  - 🟢 דני כהן | הוסיף לקוח | לפני 3 שע׳
- Orange callout: "כל פעולה נשמרת — לא ניתן למחוק מהיסטוריית הפעילות"

**Voiceover script:**
> "בטאב הפעילות תוכלו לסנן לפי חבר צוות או סוג פעולה — ולראות בדיוק מי עשה מה ומתי."

---

### Scene 4 — Team (`admin-team`, ~14s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="ניהול ובקרה").

**Layout:** Same header + tab bar, "צוות" tab active.

**UI elements:**
- Team table (white card), 4 rows slide in staggered:
  - **דני כהן** | 🟠 בעלים | 🟢 אונליין עכשיו
  - **שרה לוי** | 🟣 מנהל | 🟢 לפני 2 דק׳
  - **מיכל ברנשטיין** | 🔵 עובד | ⚫ לפני 3 שע׳
  - **יוסי מזרחי** | 🔵 עובד | ⚫ לפני יום
- Each row has role badge (color-coded) + online indicator dot + "ערוך" button
- Animation: clicking "ערוך" on שרה's row → role dropdown appears showing options (בעלים / מנהל / עובד)

**Voiceover script:**
> "בניהול הצוות תראו את כל החברים, האם הם אונליין כרגע, ותוכלו לשנות תפקידים ולהשבית גישה בלחיצה."

---

### Scene 5 — Sessions (`admin-sessions`, ~12s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="ניהול ובקרה").

**Layout:** Same header + tab bar, "סשנים" tab active.

**UI elements:**
- Sessions table (white card), 4 rows slide in staggered:
  - דני כהן | iPhone | 212.143.xx.xx | 🟢 אונליין עכשיו | [X]
  - שרה לוי | Mac | 77.125.xx.xx | 🟢 לפני 2 דק׳ | [X]
  - מיכל ברנשטיין | Android | 46.120.xx.xx | ⚫ לפני 3 שע׳ | [X]
  - יוסי מזרחי | Windows | 31.168.xx.xx | ⚫ לפני יום | [X]
- Orange callout: "ניתוק מרחוק — לחצו על X לניתוק מיידי של סשן חשוד"

**Voiceover script:**
> "בטאב הסשנים תראו מאיזה מכשיר כל אחד מחובר — ותוכלו לנתק אותו מרחוק אם צריך."

---

### Scene 6 — System Messages (`admin-messages`, ~12s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="ניהול ובקרה").

**Layout:** Same header + tab bar, "הודעות מערכת" tab active.

**UI elements:**
- "הוסף הודעה" button (orange) at top right — fades in
- Message creation form (white card) with fields: כותרת, תוכן, תאריך תפוגה — fields appear filled:
  - כותרת: "סגירה לחגים"
  - תוכן: "העסק סגור 25-28 אפריל לחופשת פסח"
  - תאריך תפוגה: 28.04.2026
- "פרסם" button highlighted orange
- Existing message list below (2 messages slide in): one active (green), one expired (red badge "פג תוקף")

**Voiceover script:**
> "הודעות מערכת מאפשרות לשלוח הודעה לכל חברי הצוות — עם תאריך תפוגה אוטומטי."

---

### Scene 7 — Subscription (`admin-subscription`, ~10s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="ניהול ובקרה").

**Layout:** Same header + tab bar, "מנוי וחיוב" tab active.

**UI elements:**
- Subscription card (white, border-top orange): "תוכנית PRO" badge + "פעיל" green badge. "מתחדש ב-01.05.2026" subtitle. "23 ימים שנותרו" countdown.
- Billing history list (3 items fade in):
  - 01.04.2026 | חיוב חודשי PRO | ₪149 | ✓ שולם
  - 01.03.2026 | חיוב חודשי PRO | ₪149 | ✓ שולם
  - 01.02.2026 | חיוב חודשי PRO | ₪149 | ✓ שולם

**Voiceover script:**
> "בכרטיסיית המנוי תראו את התוכנית הפעילה שלכם, מתי היא מתחדשת, ואת היסטוריית החיוב."

---

### Scene 8 — Outro (`admin-outro`, ~10s)

**Pattern:** Identical to `TasksOutroScene` — dark background, centered content.

**Elements:**
- Petra icon (80px) — spring scale-in
- Title "ניהול ובקרה של פטרה" (white, 44px) — spring slide-up
- Tagline "שקיפות מלאה על כל מה שקורה בעסק" (white, 20px)
- 3 benefit pills (fade/scale in staggered):
  - "פיקוח על הצוות"
  - "היסטוריית פעילות"
  - "ניהול הרשאות"
- Orange CTA button "התחילו עכשיו בחינם ←"
- URL "petra-app.com"

**Voiceover script:**
> "ניהול ובקרה של פטרה — שקיפות מלאה על כל מה שקורה בעסק. כל פעולה, כל משתמש, בזמן אמת."

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
| Sidebar activeLabel | `"ניהול ובקרה"` |

**Tab bar:** Shared `AdminTabBar` component used across scenes 2–7 (shows 6 tabs, highlights the active one).

---

## Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `voiceover-admin-config.ts` | Scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-admin.ts` | Gemini TTS generator for admin WAVs |
| Create | `src/scenes/AdminIntroScene.tsx` | Scene 1: dark intro |
| Create | `src/scenes/AdminTabBar.tsx` | Shared tab bar used in all UI scenes |
| Create | `src/scenes/AdminOverviewScene.tsx` | Scene 2: stat cards + activity feed |
| Create | `src/scenes/AdminActivityScene.tsx` | Scene 3: filterable activity log |
| Create | `src/scenes/AdminTeamScene.tsx` | Scene 4: team table + role editing |
| Create | `src/scenes/AdminSessionsScene.tsx` | Scene 5: sessions + force logout |
| Create | `src/scenes/AdminMessagesScene.tsx` | Scene 6: system messages |
| Create | `src/scenes/AdminSubscriptionScene.tsx` | Scene 7: subscription card + billing |
| Create | `src/scenes/AdminOutroScene.tsx` | Scene 8: dark outro |
| Create | `src/AdminTutorial.tsx` | Main composition with bg-music + all 8 scenes |
| Modify | `src/Root.tsx` | Add `PetraAdminTutorial` composition |

**Audio:** Generate WAVs → `public/voiceover/admin-{id}.wav`

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Sidebar | `src/scenes/PetraSidebar.tsx` |
| Intro pattern | `src/scenes/TasksIntroScene.tsx` |
| Outro pattern | `src/scenes/TasksOutroScene.tsx` |
| Composition pattern | `src/TasksTutorial.tsx` / `src/BookingTutorial.tsx` |
| Root registration | `src/Root.tsx` |

---

## What NOT to Build

- No CursorOverlay (admin page is a monitoring view, no click interactions to demo)
- No real API calls — all data is hardcoded
- No modifications to existing scene files
