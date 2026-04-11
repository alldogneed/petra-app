# Petra Pets Tutorial — Design Spec

**Date:** 2026-04-11

---

## Goal

Build a new `PetraPetsTutorial` composition for the "חיות המחמד" feature of Petra. 6 scenes highlighting that Petra supports multiple animal species — not just dogs — making it suitable for clinics, groomers, rehabilitation centers, and more.

**Core message:** פרופיל מקצועי לכל בעל חיים — לקליניקות, גרומרים, שיקום ועוד.

---

## Format

- **Dimensions:** 1280×720
- **FPS:** 30
- **Total duration:** ~66 seconds
- **Voiceover:** Hebrew TTS via Gemini (Aoede voice), one WAV per scene
- **Music:** `bg-music.mp3` at volume 0.13, loop, fade in/out
- **Language:** Hebrew / RTL
- **Composition ID:** `PetraPetsTutorial`

---

## Scene Structure

| # | Scene ID | Duration | Content |
|---|----------|----------|---------|
| 1 | `pets-intro` | ~10s | Dark intro — PETRA logo, badge, title "חיות המחמד" |
| 2 | `pets-species` | ~12s | Sidebar + 4 species cards animating in |
| 3 | `pets-add` | ~11s | Sidebar + add-pet modal with species dropdown |
| 4 | `pets-profile` | ~12s | Sidebar + rich pet profile card |
| 5 | `pets-family` | ~11s | Sidebar + customer with 4 different pets |
| 6 | `pets-outro` | ~10s | Dark outro — logo, benefit pills, CTA |

**Total:** ~66s

---

## Scene Details

### Scene 1 — Intro (`pets-intro`, ~10s)

**Pattern:** Identical to `TasksIntroScene` / `AdminIntroScene` — dark background, centered content.

**Layout:** Dark gradient `#0f172a → #1e293b`, centered column, background glow + decorative dots.

**Elements (in animation order):**
- Petra icon + "PETRA" text — spring scale-in
- Orange badge "מדריך מהיר" — fade in
- Title **"חיות המחמד"** (white, 60px, fontWeight 800) — spring slide-up
- Subtitle "פרופיל מקצועי לכל בעל חיים — לקליניקות, גרומרים ועוד" (#94a3b8, 20px) — spring slide-up

**Voiceover script:**
> "חיות המחמד של פטרה — פרופיל מקצועי לכל בעל חיים, לכל עסק."

---

### Scene 2 — Species (`pets-species`, ~12s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="לקוחות").

**Layout:** Sidebar right (210px), content area left. `#f1f5f9` background. White header bar (52px) with title "חיות מחמד". Section heading "סוגי בעלי חיים נתמכים".

**UI elements:**
- 4 species cards in a 2×2 grid, staggered fade/slide-up (spring):
  - 🐕 **כלב** — "Golden Retriever, לברדור, פודל ועוד"
  - 🐈 **חתול** — "פרסי, סיאמי, מיקס ועוד"
  - 🐦 **ציפור** — "תוכי, קנרית, זבוב ועוד"
  - 🐇 **ארנב** — "ארנב גמד, אנגורה ועוד"
- Each card: animal emoji (large, 40px), Hebrew type name (bold), breed examples (small gray text), orange top-border accent
- Orange callout at bottom: "לא מוגבל לכלבים — בחרו את סוג החיה בעת יצירת הפרופיל"

**Voiceover script:**
> "פטרה תומכת בכלבים, חתולים, ציפורים, ארנבים ועוד — בחרו את הסוג בעת הוספה."

---

### Scene 3 — Add Pet (`pets-add`, ~11s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="לקוחות").

**Layout:** Sidebar right, content left. Customer profile visible on right, modal centered over backdrop.

**UI elements:**
- Customer mini-card (right): "רחל כהן" with existing pet badge
- Backdrop fades in over content
- Modal animates in (spring scale): "הוסף חיית מחמד"
  - **סוג** dropdown highlighted orange — showing "ציפור ▾" selected
  - **שם החיה**: "פיפי"
  - **גזע**: "תוכי אמזוני"
  - **מין**: "נקבה"
  - **תאריך לידה**: "05.06.2022"
  - **מיקרוצ'יפ**: "972000098765" (optional, grayed label)
- "שמור" button highlighted orange at bottom
- New pet card appears in customer sidebar: "פיפי — תוכי אמזוני · 3 שנים" with green "חדש" badge

**Voiceover script:**
> "הוספת חיה לוקחת שניות — שם, גזע, מין, תאריך לידה, ומיקרוצ'יפ."

---

### Scene 4 — Pet Profile (`pets-profile`, ~12s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="לקוחות").

**Layout:** Sidebar right, content left. Breadcrumb: לקוחות › רחל כהן › פיפי.

**UI elements:**
- Pet profile card (white, border-radius 16, shadow):
  - Header: orange avatar circle with "פ", name "פיפי", subtitle "תוכי אמזוני · 3 שנים"
  - Fields animate in staggered:
    - סוג: ציפור
    - גזע: תוכי אמזוני
    - מין: נקבה
    - תאריך לידה: 05.06.2022 (3 שנים)
    - מיקרוצ'יפ: 972000098765
    - הערות רפואיות: "רגיש לאבק, חיסון מנטוקס עד 06/2026"
- Right side annotations (orange dot + line + label):
  - "סוג בעל החיים"
  - "גיל מחושב אוטומטית"
  - "מיקרוצ'יפ לזיהוי"
  - "הערות רפואיות + חיסונים"
- Summary dark card: "כל המידע הרפואי — חיסונים, הערות, שבב — הכל נגיש בלחיצה אחת"

**Voiceover script:**
> "כל חיה מקבלת פרופיל עצמאי עם הערות רפואיות, חיסונים, וכל ההיסטוריה שלה."

---

### Scene 5 — Family (`pets-family`, ~11s)

**Pattern:** UI scene with `PetraSidebar` (activeLabel="לקוחות").

**Layout:** Sidebar right, content left. Customer profile page showing the pets section.

**UI elements:**
- Customer card: "משפחת לוי" — customer avatar, name
- Pets section heading "חיות מחמד (4)" with "+" add button
- 4 pet cards slide in staggered (each shows emoji + name + breed + age):
  - 🐕 **רקסי** — גולדן רטריבר · 4 שנים
  - 🐈 **מיאו** — פרסי · 2 שנים
  - 🐦 **ציוצי** — קנרית · 1 שנה
  - 🐇 **פומפום** — ארנב גמד · 6 חודשים
- Orange callout: "כל החיות מקושרות לאותו לקוח — כל תור, הזמנה ורשומה ב-פרופיל אחד"

**Voiceover script:**
> "ללקוח עם כמה חיות? כולן מקושרות לאותו פרופיל — עם גישה בלחיצה אחת."

---

### Scene 6 — Outro (`pets-outro`, ~10s)

**Pattern:** Identical to `AdminOutroScene` — dark background, centered content.

**Elements:**
- Petra icon (80px) — spring scale-in
- Title "חיות המחמד של פטרה" (white, 44px) — spring slide-up
- Tagline "כל בעל חיים, כל מידע, תמיד נגיש" (white, 20px)
- 3 benefit pills (fade/scale in staggered):
  - "כל הסוגים נתמכים"
  - "פרופיל רפואי מלא"
  - "כמה חיות ללקוח"
- Orange CTA button "נסו עכשיו ←"
- URL "petra-app.com"

**Voiceover script:**
> "חיות המחמד של פטרה — כל בעל חיים, כל מידע, תמיד נגיש."

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
| Sidebar activeLabel | `"לקוחות"` |

---

## Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `voiceover-pets-config.ts` | Scene IDs, Hebrew scripts, default durations |
| Create | `generate-voiceover-pets.ts` | Gemini TTS generator for pets WAVs |
| Create | `src/scenes/PetsIntroScene.tsx` | Scene 1: dark intro |
| Create | `src/scenes/PetsSpeciesScene.tsx` | Scene 2: 4 species cards |
| Create | `src/scenes/PetsAddScene.tsx` | Scene 3: add-pet modal with species dropdown |
| Create | `src/scenes/PetsProfileScene.tsx` | Scene 4: rich pet profile card |
| Create | `src/scenes/PetsFamilyScene.tsx` | Scene 5: customer with 4 pets |
| Create | `src/scenes/PetsOutroScene.tsx` | Scene 6: dark outro |
| Create | `src/PetsTutorial.tsx` | Main composition with bg-music + 6 scenes |
| Modify | `src/Root.tsx` | Add `PetraPetsTutorial` composition |

**Audio:** Generate WAVs → `public/voiceover/pets-{id}.wav`

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Sidebar | `src/scenes/PetraSidebar.tsx` |
| Intro pattern | `src/scenes/AdminIntroScene.tsx` |
| Outro pattern | `src/scenes/AdminOutroScene.tsx` |
| Composition pattern | `src/AdminTutorial.tsx` |
| Root registration | `src/Root.tsx` |
| Add-pet UI reference | `src/scenes/CustomersAddPetScene.tsx` |
| Pet details reference | `src/scenes/CustomersPetDetailsScene.tsx` |

---

## What NOT to Build

- No CursorOverlay
- No real API calls — all data is hardcoded
- No modifications to existing Customers scene files
- Scene 2 (species) uses emoji characters directly — no external icon library
