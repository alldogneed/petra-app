# Petra Online Booking Tutorial — Design Spec

**Date:** 2026-04-10

---

## Goal

Build a ~2-minute Hebrew tutorial video for Petra's online booking feature, targeting pet-business owners who currently coordinate appointments via WhatsApp. The video demonstrates the full cycle: how a customer books online, how the business configures availability, how they share their link, and how they get notified instantly.

**Core message:** Stop coordinating by hand — let customers book themselves, 24/7.

---

## Format

- **Dimensions:** 1280×720
- **FPS:** 30
- **Total duration:** ~108 seconds (~3240 frames)
- **Voiceover:** Hebrew TTS via Gemini (Aoede voice), one WAV per scene
- **Music:** `bg-music.mp3` at volume 0.13, loop, fade in/out
- **Language:** Hebrew / RTL
- **Composition ID:** `PetraBookingTutorial`

---

## Scene Structure

| # | Scene ID | Duration | Content |
|---|----------|----------|---------|
| 1 | `booking-intro` | ~14s | Hook: WhatsApp coordination chaos → online booking solution |
| 2 | `booking-customer-flow` | ~18s | Customer picks service → date → time slot |
| 3 | `booking-customer-details` | ~18s | Customer fills info + dog → confirm screen |
| 4 | `booking-setup` | ~18s | Business configures weekly hours + blocks a date |
| 5 | `booking-link` | ~14s | Unique booking link → copy + share to Instagram/WhatsApp |
| 6 | `booking-notifications` | ~16s | WhatsApp alert to business + Google Calendar auto-created |
| 7 | `booking-outro` | ~10s | Benefit summary + CTA |

**Total:** ~108s. Exact durations adjusted per voiceover WAV length.

---

## Scene Details

### Scene 1 — Intro (`booking-intro`, ~14s)

**Purpose:** Frame the pain. Pet businesses drown in WhatsApp booking coordination.

**Layout:** Dark background `#0f172a`, text-only animation. Matches Tasks/Settings/Boarding intro pattern.

**Voiceover script:**
> "הלקוחות שולחים הודעת וואטסאפ לקבוע תור — אתם עונים, מתאמים, ומאשרים. ואז עוד אחד. ועוד אחד. עם הזמנות אונליין של פטרה, הלקוח קובע לבד — עשרים וארבע שבע, בלי לחכות לתשובה."

**Animations:**
- Staggered lines fade/slide in from right (RTL):
  - "הלקוח שולח הודעה" (white, large)
  - "אתם מתאמים..." (gray, medium)
  - "ועוד אחד. ועוד אחד." (red `#ef4444`, medium)
- Cross-fade to: Petra orange badge "הזמנות אונליין" + subtitle "לקוחות קובעים לבד"
- Petra logo fades in bottom-right

---

### Scene 2 — Customer Flow (`booking-customer-flow`, ~18s)

**Purpose:** Show the customer-facing booking page — service selection, date picker, time slots.

**Layout:** Public booking page (NO sidebar — this is a standalone page, not the dashboard). White background. Petra orange header bar with business name and logo.

**UI elements shown:**
- **Header:** Business name "פנסיון כלבים שמח" + Petra branding strip (orange top bar)
- **Step indicator:** "שלב 1 מתוך 3" breadcrumb dots at top
- **Service cards (2 per row):**
  - "טיפול ורחצה" — ₪150 — 45 דקות — ✂️ icon
  - "פנסיון יומי" — ₪120 — ביום — 🏠 icon
  - "אילוף פרטי" — ₪250 — 60 דקות — 🐾 icon
  - "הליכה" — ₪80 — 30 דקות — 🦮 icon
- Cursor clicks "טיפול ורחצה" → card highlights orange
- **Date picker:** Month calendar (Hebrew day names), available days highlighted orange
- Cursor clicks a date → calendar highlights
- **Time slots grid:** 09:00 · 10:00 · 11:00 · 14:00 · 16:00 (available = white, busy = gray strikethrough)
- Cursor clicks "11:00" → slot highlights orange

**Voiceover script:**
> "הלקוח נכנס לעמוד ההזמנה, בוחר את השירות שמתאים לו, בוחר תאריך מהיומן — ורואה את השעות הפנויות בלבד. בחירה אחת, ומגיעים לשלב הפרטים."

**Cursor waypoints:**
1. Hover over service cards area (x≈400, y≈300)
2. Click "טיפול ורחצה" card (x≈300, y≈280), action: click
3. Move to calendar (x≈640, y≈420)
4. Click a date (x≈700, y≈440), action: click
5. Move to time slots (x≈400, y≈560)
6. Click "11:00" slot (x≈340, y≈560), action: click

---

### Scene 3 — Customer Details (`booking-customer-details`, ~18s)

**Purpose:** Show the customer filling in personal info, dog selection, and confirming.

**Layout:** Continuation of public booking page. Step 2 → Step 3 progression.

**UI elements shown:**
- **Customer info form:**
  - שם: "ענבל כהן" (typewriter)
  - טלפון: "054-321-1234" (typewriter)
  - אימייל: optional field
- **Dog section:**
  - "הכלבים שלך" header
  - Existing dog card: "מקס — לברדור — ♂" with checkbox selected (orange border)
  - "+ כלב חדש" button (not clicked — just shown)
- **Confirm screen (fade in):**
  - Summary card: service name, date, time, dog name, price
  - Cancellation policy (small gray text)
  - Big orange CTA button "אשר הזמנה"
- Cursor clicks "אשר הזמנה" → done screen fades in
- **Done screen:** ✅ large green checkmark, "תורך נקבע!" heading, "נשמח לראות אותך" subtext

**Voiceover script:**
> "הלקוח ממלא שם וטלפון, בוחר את הכלב שלו — ומגיע למסך האישור עם סיכום ההזמנה. לחיצה אחת — ותור נקבע."

**Cursor waypoints:**
1. Click name field → typewriter effect starts (x≈640, y≈280)
2. Move to dog card (x≈400, y≈420)
3. Click dog card checkbox (x≈390, y≈420), action: click
4. Move to confirm button (x≈640, y≈580)
5. Click "אשר הזמנה" (x≈640, y≈580), action: click

---

### Scene 4 — Business Setup (`booking-setup`, ~18s)

**Purpose:** Show the business owner configuring availability in Settings.

**Layout:** Full Petra app UI with sidebar (active: "הגדרות"). Settings page, tab "הזמנות" active.

**UI elements shown:**
- Settings header + tab bar: פרטי העסק | **הזמנות** (active, orange underline) | פנסיון | תשלומים | ...
- **Weekly schedule section ("שעות פתיחה"):**
  - 7 rows (ראשון–שבת), each with toggle + time range
  - ראשון: ✅ 09:00–18:00
  - שני: ✅ 09:00–18:00
  - שישי: ✅ 09:00–14:00
  - שבת: ❌ סגור (toggle off, grayed)
- Cursor toggles "שבת" to show it's off
- **Blocked dates section ("חסימת תאריכים"):**
  - Existing block: "25.04–28.04 — חופשת פסח"
  - "+ הוסף חסימה" button
- Cursor clicks "+ הוסף חסימה" → small modal with date range picker appears
- Date range: 01.05–02.05, reason: "יום עצמאות"
- "שמור" button pulse → block added to list

**Voiceover script:**
> "בהגדרות, תוכלו לקבוע שעות פתיחה לכל יום בשבוע — ולחסום תאריכים ספציפיים לחגים ולחופשות. הלקוחות יראו רק את הזמנים הפנויים באמת."

**Cursor waypoints:**
1. Click "הזמנות" tab in settings (x≈920, y≈53), action: click
2. Hover over שבת toggle row (x≈500, y≈320)
3. Click שבת toggle (x≈490, y≈320), action: click (shows it's off)
4. Move to "+ הוסף חסימה" (x≈200, y≈480)
5. Click "+ הוסף חסימה" (x≈200, y≈480), action: click
6. Move to "שמור" in modal (x≈640, y≈520)
7. Click "שמור" (x≈640, y≈520), action: click

---

### Scene 5 — Share the Link (`booking-link`, ~14s)

**Purpose:** Show the unique booking URL and how the business shares it.

**Layout:** Settings page (same as scene 4 or dedicated section). Then animated "share destinations" — Instagram, WhatsApp, Facebook.

**UI elements shown:**
- **Link section in Settings/הזמנות:**
  - Label: "הלינק שלך להזמנות"
  - URL display box: `petra-app.com/book/happy-dog-boarding` (orange, monospace)
  - "העתק" copy button beside it
  - Cursor clicks "העתק" → button flashes "הועתק! ✓"
- **Sharing destinations animation (3 cards slide in):**
  - 📸 **אינסטגרם** — "שמרו בביו"
  - 💬 **וואטסאפ** — "הוסיפו לחתימה"
  - 📘 **פייסבוק** — "פרסמו בדף"

**Voiceover script:**
> "לכל עסק יש לינק ייחודי להזמנות. תעתיקו אותו ותשתפו — בביו אינסטגרם, בחתימת וואטסאפ, בדף הפייסבוק. כל לחיצה מביאה לקוח ישירות לעמוד ההזמנה שלכם."

**Cursor waypoints:**
1. Hover over URL box (x≈500, y≈300)
2. Click "העתק" button (x≈180, y≈300), action: click

---

### Scene 6 — Notifications (`booking-notifications`, ~16s)

**Purpose:** Close the loop — show the business getting notified immediately after a booking.

**Layout:** Split or sequential: first a WhatsApp message mockup, then Google Calendar event.

**UI elements shown:**
- **WhatsApp notification card** (green header, chat bubble style):
  - Sender: "פטרה 🐾"
  - Message: "📅 הזמנה חדשה!\nענבל כהן — טיפול ורחצה\nמקס (לברדור)\n11.05 · 11:00"
  - Slides in from right with spring animation
- **Google Calendar event card** (blue, Google-style):
  - Title: "טיפול ורחצה — ענבל כהן"
  - Date/time: "11 מאי, 11:00–11:45"
  - Tag: "נוצר אוטומטית ע״י פטרה"
  - Slides in from right, staggered after WhatsApp card

**Voiceover script:**
> "ברגע שהלקוח אישר — אתם מקבלים הודעת וואטסאפ עם כל הפרטים, ואירוע נוצר אוטומטית ב-Google Calendar. אין צורך לרשום דבר בעצמכם."

**Animations:**
- Both cards enter with spring (right → final position), staggered by 20 frames
- Each card has a subtle glow pulse on entry

---

### Scene 7 — Outro (`booking-outro`, ~10s)

**Purpose:** Land the core value and drive to CTA.

**Layout:** Dark background `#0f172a`. Matches Tasks/Settings/Boarding outro pattern.

**Voiceover script:**
> "הזמנות אונליין של פטרה — פחות תיאום, יותר זמן לעסק. התחילו בחינם."

**Animations:**
- "פחות תיאום" (white, large, slides in)
- "יותר זמן לעסק" (orange `#ea580c`, large, slides in)
- Petra logo + "petra-app.com" fade in
- Fade out

---

## Sample Data

```
Business:    "פנסיון כלבים שמח"
Slug:        happy-dog-boarding
Customer:    ענבל כהן · 054-321-1234
Dog:         מקס · לברדור · ♂
Service:     טיפול ורחצה · 45 דקות · ₪150
Booking:     11.05.2026 · 11:00
Block:       25.04–28.04 חופשת פסח | 01.05–02.05 יום העצמאות
```

---

## Visual Language

Follows existing tutorial conventions:

| Element | Value |
|---------|-------|
| Background (UI) | `#f1f5f9` |
| Background (dark scenes) | `#0f172a` |
| Orange accent | `#ea580c` |
| Booking page background | `#ffffff` |
| Booking page header bar | `#ea580c` (orange strip, 4px top border) |
| Available time slot | white + orange border on hover |
| Busy time slot | `#f1f5f9` + strikethrough gray |
| WhatsApp card | `#25D366` header, white body |
| Calendar card | `#4285F4` header, white body |
| Font | `'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif` |
| Direction | `rtl` |

---

## Files to Create

| File | Purpose |
|------|---------|
| `voiceover-booking-config.ts` | Scene IDs, Hebrew scripts, default durations |
| `src/BookingTutorial.tsx` | Main composition — Series of 7 scenes + audio |
| `src/scenes/BookingIntroScene.tsx` | Scene 1: dark intro text animation |
| `src/scenes/BookingCustomerFlowScene.tsx` | Scene 2: public booking page — service+date+time |
| `src/scenes/BookingCustomerDetailsScene.tsx` | Scene 3: customer info + dog + confirm |
| `src/scenes/BookingSetupScene.tsx` | Scene 4: settings availability + blocks |
| `src/scenes/BookingLinkScene.tsx` | Scene 5: unique link + share destinations |
| `src/scenes/BookingNotificationsScene.tsx` | Scene 6: WhatsApp + Google Calendar cards |
| `src/scenes/BookingOutroScene.tsx` | Scene 7: dark outro |

**Register in:** `src/Root.tsx` — add `PetraBookingTutorial` composition.

**Audio:** Generate WAVs via Gemini TTS → `public/voiceover/booking-{id}.wav`

---

## Reuse from Existing Codebase

| What | Where |
|------|-------|
| Sidebar component | `src/scenes/PetraSidebar.tsx` |
| CursorOverlay | `src/scenes/CursorOverlay.tsx` |
| HighlightBox | `src/scenes/HighlightBox.tsx` |
| Intro dark animation pattern | `src/scenes/TasksIntroScene.tsx` |
| Outro dark pattern | `src/scenes/TasksOutroScene.tsx` |
| Settings tab bar | `src/scenes/SettingsTabsBar.tsx` |
| SceneAudio + calculateMetadata | `src/TasksTutorial.tsx` |

---

## What NOT to Build

- No real API calls — all data is hardcoded in scene components
- No actual form interactivity — animated cursor simulates all clicks
- The booking page UI is a **Remotion mock**, not an iframe of the real page
- Do not modify any existing tutorial compositions
