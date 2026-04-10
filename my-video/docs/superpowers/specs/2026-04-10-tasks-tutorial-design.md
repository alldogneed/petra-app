# Petra Tasks Tutorial — Design Spec

**Date:** 2026-04-10

---

## Goal

Build a ~2.5-minute Hebrew tutorial video for the Petra Tasks system, targeting pet-business owners who manage a team and daily logistics. The video demonstrates how Tasks keeps the whole team synchronized — covering creation, status management, filtering, and bulk operations.

**Core message:** Tasks is not a personal to-do list — it's a logistics and team coordination tool for busy pet businesses.

---

## Format

- **Dimensions:** 1280×720
- **FPS:** 30
- **Total duration:** ~4500 frames (~150 seconds)
- **Voiceover:** Hebrew TTS via Gemini (Aoede voice), one WAV per scene
- **Music:** `teaser-music.mp3` at volume 0.12, loop, fade in/out
- **Language:** Hebrew / RTL
- **Composition ID:** `PetraTasksTutorial`

---

## Scene Structure

| # | Scene ID | Duration | Content |
|---|----------|----------|---------|
| 1 | `tasks-intro` | ~12s (360 frames) | Hook: team chaos → Tasks solution |
| 2 | `tasks-overview` | ~30s (900 frames) | Main view: statuses, categories, priorities |
| 3 | `tasks-create` | ~35s (1050 frames) | Create task, link to customer, set priority + due time |
| 4 | `tasks-filters` | ~25s (750 frames) | Category tabs, status filter, free-text search |
| 5 | `tasks-bulk` | ~28s (840 frames) | Selection mode, bulk complete, bulk postpone |
| 6 | `tasks-outro` | ~10s (300 frames) | Summary + CTA |

**Total:** ~4200 frames (~140s). Exact durations are adjusted per voiceover WAV length.

---

## Scene Details

### Scene 1 — Intro (`tasks-intro`, ~12s)

**Purpose:** Frame the problem. Team logistics in a pet business = endless things to remember.

**Layout:** Dark background `#0f172a`, text-only animation.

**Voiceover script:**
> "מנהלים עסק עם בע״ח — זה אומר משימות לוגיסטיות שוטפות. מי מאכיל את הכלבים בחדר 3? מי נותן תרופה לנובה ב-18:00? מי מתקשר ללקוח שחיכה? עם מערכת המשימות של פטרה, כל הצוות מסונכרן — ושום דבר לא נופל בין הכיסאות."

**Animations:**
- Lines of text fade/slide in: "מי מאכיל את הכלבים?" → "מי נותן תרופה ב-18:00?" → "מי מתקשר ללקוח?" (staggered, red #ef4444 emphasis on "מי")
- Transition to Petra UI

---

### Scene 2 — Overview (`tasks-overview`, ~30s)

**Purpose:** Show the main Tasks view — statuses, categories, priorities in action.

**Layout:** Full Petra app UI with sidebar (active: "משימות").

**UI elements shown:**
- Task list with 4–5 sample tasks covering all status states:
  - **באיחור** (red badge) — "מתן תרופה לנובה" overdue
  - **עכשיו** (green badge) — "האכלה — חדר 3" due now
  - **מתוכנן** (gray badge) — "צ׳ק-אאוט מקס" tomorrow
  - **הושלם** (muted green) — "שיחה עם ענבל כהן" completed
- Category tabs: cursor clicks כללי → פנסיון → תרופות, showing list filtering
- Priority badges: "דחופה" (red), "גבוהה" (orange), "בינונית" (blue)

**Voiceover script:**
> "בדף המשימות תראו את כל המשימות של העסק — מסודרות לפי סטטוס. באיחור מסומן באדום, פעיל עכשיו בירוק, ומתוכנן באפור. תוכלו לסנן לפי קטגוריה — כללי, פנסיון, תרופות, לידים, ועוד — ולראות בדיוק מה מחכה לטיפול."

**Cursor waypoints:**
1. Hover over overdue task badge
2. Click category tab "פנסיון" → list filters
3. Click category tab "תרופות" → list filters
4. Click "כל" to reset

---

### Scene 3 — Create Task (`tasks-create`, ~35s)

**Purpose:** Demonstrate creating a task with full details: category, priority, due time, linked customer.

**Layout:** Petra app UI. Task creation modal opens over the task list.

**UI elements shown:**
- Click "+ משימה חדשה" button
- Modal fills in:
  - Title: "מתן תרופה לנובה"
  - Category: "תרופות"
  - Priority: "גבוהה"
  - Due date: today, 18:00
  - Linked entity: search → "ענבל כהן" (customer)
  - Description: "אנטיביוטיקה — טבלייה אחת עם אוכל"
- Click "שמור" → modal closes → new task appears at top of list with status "עכשיו"
- Cursor clicks the task → brief view of task detail / linked customer link

**Voiceover script:**
> "ליצירת משימה חדשה — לוחצים על הכפתור, ממלאים את הפרטים: שם, קטגוריה, עדיפות ושעת ביצוע. אפשר גם לקשר את המשימה ישירות ללקוח — כך שמתוך המשימה תוכלו לנווט ישירות לפרופיל שלו בלחיצה אחת."

**Cursor waypoints:**
1. Click "+ משימה חדשה"
2. Type in title field
3. Click Category dropdown → select "תרופות"
4. Click Priority → select "גבוהה"
5. Set due time (18:00)
6. Click customer search → type "ענבל" → select result
7. Click "שמור"
8. Click newly created task row → shows linked customer chip

---

### Scene 4 — Filters & Search (`tasks-filters`, ~25s)

**Purpose:** Show how to find specific tasks quickly using filters and search.

**Layout:** Petra app UI, task list in view.

**UI elements shown:**
- Type in search bar: "תרופה" → list filters live to matching tasks
- Click status filter button "באיחור" → only red overdue tasks remain
- Clear filter → click date range picker, set "היום"
- Badge counts on category tabs update as filters apply

**Voiceover script:**
> "צריכים למצוא משימה ספציפית? השתמשו בחיפוש החופשי, או סננו לפי סטטוס — לדוגמה, רק המשימות שכבר באיחור. אפשר גם לסנן לפי תאריך ולראות רק את מה שרלוונטי להיום."

**Cursor waypoints:**
1. Click search field → type "תרופה"
2. Click status filter "באיחור"
3. Clear status filter
4. Click date range → select "היום"

---

### Scene 5 — Bulk Operations (`tasks-bulk`, ~28s)

**Purpose:** Show selection mode for bulk actions — marking multiple tasks done or postponing them.

**Layout:** Petra app UI, task list with checkboxes.

**UI elements shown:**
- Click "בחר" button → checkboxes appear on each task row
- Click 3 task checkboxes to select them
- Click "סמן כהושלם" → all 3 tasks flip to completed (green, strikethrough)
- Click "בחר" again → select 2 different tasks
- Click "דחה תאריך" → postpone dialog appears, pick tomorrow → tasks update

**Voiceover script:**
> "כשצריך לטפל בכמה משימות בבת אחת — לוחצים על בחר, מסמנים את הרצויות, וסוגרים את כולן בלחיצה אחת. אפשר גם לדחות כמה משימות לתאריך חדש — בלי לערוך כל אחת בנפרד."

**Cursor waypoints:**
1. Click "בחר" button
2. Click checkboxes on tasks 1, 2, 3
3. Click "סמן כהושלם" → tasks complete
4. Click "בחר" again
5. Click 2 more tasks
6. Click "דחה תאריך"
7. Pick tomorrow in date picker
8. Click "אשר"

---

### Scene 6 — Outro (`tasks-outro`, ~10s)

**Purpose:** Close with the core benefit and CTA.

**Layout:** Dark background `#0f172a`.

**Voiceover script:**
> "מערכת המשימות של פטרה — שכל הצוות יודע מה לעשות, ומתי. התחילו לנהל עכשיו בחינם."

**Animations:**
- "כל הצוות מסונכרן" (white, large)
- "ושום דבר לא נופל" (orange, large)
- Petra logo + "petra-app.com"
- Fade out

---

## Sample Task Data

```
Tasks shown across scenes:

1. "מתן תרופה לנובה"       | תרופות   | דחופה  | היום 18:00  | באיחור  | לקוח: ענבל כהן
2. "האכלה — חדר 3"         | האכלה    | גבוהה  | עכשיו       | עכשיו   | —
3. "צ׳ק-אאוט — מקס"        | פנסיון   | בינונית | מחר 10:00   | מתוכנן  | לקוח: יוסי גולן
4. "שיחה עם ענבל כהן"      | כללי     | נמוכה  | אתמול       | הושלם   | לקוח: ענבל כהן
5. "בדיקת חיסון — קיירה"   | בריאות   | גבוהה  | מחרתיים     | מתוכנן  | —
```

---

## Visual Language

Follows existing tutorial conventions:

| Element | Value |
|---------|-------|
| Background (UI) | `#f1f5f9` |
| Background (dark scenes) | `#0f172a` |
| Orange accent | `#ea580c` |
| Overdue badge | `#ef4444` red |
| Active badge | `#22c55e` green |
| Scheduled badge | `#94a3b8` gray |
| Completed badge | `#bbf7d0` muted green |
| Font | `'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif` |
| Direction | `rtl` |

---

## Files to Create

| File | Purpose |
|------|---------|
| `voiceover-tasks-config.ts` | Scene IDs, Hebrew voiceover scripts, default durations |
| `src/TasksTutorial.tsx` | Main composition — Series of 6 scenes + audio |
| `src/scenes/TasksIntroScene.tsx` | Scene 1: dark intro text animation |
| `src/scenes/TasksOverviewScene.tsx` | Scene 2: main tasks view UI |
| `src/scenes/TasksCreateScene.tsx` | Scene 3: task creation modal |
| `src/scenes/TasksFiltersScene.tsx` | Scene 4: filters and search |
| `src/scenes/TasksBulkScene.tsx` | Scene 5: selection mode + bulk actions |
| `src/scenes/TasksOutroScene.tsx` | Scene 6: dark outro |

**Register in:** `src/Root.tsx` — add `PetraTasksTutorial` composition.

**Audio:** Generate WAVs via Gemini TTS → `public/voiceover/tasks-{id}.wav`

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Sidebar component | `src/scenes/PetraSidebar.tsx` |
| Cursor animation | `src/components/teaser/CursorAnimation.tsx` (or existing tutorial cursor pattern) |
| HighlightBox | `src/scenes/HighlightBox.tsx` |
| Scene audio | Pattern from `OrdersTutorial.tsx` → `SceneAudio` component |
| Intro animation pattern | `src/scenes/teaser/TeaserHookScene.tsx` |
| Outro pattern | `src/scenes/teaser/TeaserCTASceneV2.tsx` |

---

## What NOT to Build

- No real data fetching — all task data is hardcoded in scene components
- No actual modal interactivity — modals are rendered as static UI with animated cursor
- Do not modify any existing tutorial compositions
