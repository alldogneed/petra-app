# Orders Tutorial Video — Design Spec
**Date:** 2026-04-08
**Duration:** ~104 seconds (~1:44)
**Composition ID:** `PetraOrdersTutorial`
**Style:** Same as Sales / Customers / Finances tutorials — Remotion, 1280×720, 30fps, Hebrew RTL, Gemini TTS Aoede, bg-music.mp3

---

## Overview

**Goal:** Help users — both new and existing — understand how orders work in Petra: how to create one, what gets created automatically, and how orders connect customers, pets, boarding, training, and payments into one flow.

**Non-goals:** Do not re-explain the price list (covered in Finances tutorial) or the WhatsApp payment request flow in depth (also covered in Finances). Reference them briefly.

---

## Scenes

### Scene 1 — Intro (`orders-intro`)
**Duration:** ~8s | **Type:** Full-screen title card

**Visual:**
- Same pattern as all other intros
- Dark gradient background `linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0c1422 100%)`
- Logo: `petra-icon.png` 44×44 + white "PETRA" span (fontSize 24, fontWeight 700)
- Orange pill badge: "מדריך מהיר"
- Title (fontSize 60, white, bold): **מערכת ההזמנות**
- Subtitle (fontSize 20, `#94a3b8`): ניהול שירותים, לקוחות ותשלומים — במקום אחד

**Voiceover:**
> "ברוכים הבאים למדריך מערכת ההזמנות של פטרה. כאן תלמדו ליצור הזמנות ולהבין איך הן מחברות את כל העסק שלכם."

---

### Scene 2 — הזמנה כלב העסק (`orders-hub`)
**Duration:** ~14s | **Type:** Full-screen infographic (dark background, no app chrome)

**Visual:**
- "הזמנה" badge/card in center (orange, bold)
- 5 connected nodes animating in one by one:
  - 👤 לקוח + כלב
  - 🏠 פנסיון
  - 🐾 תהליך אילוף
  - 💳 תשלום
  - 📲 תזכורת WhatsApp
- Lines/arrows connecting center to each node (spring animated, staggered)
- Background: same dark gradient as intro

**Voiceover:**
> "כל פעולה בעסק — תור, פנסיון, אילוף, מכירת מוצר — מתועדת כהזמנה. הזמנה מחברת את הלקוח, הכלב, השירות, התשלום, והתזכורות — למקום אחד."

---

### Scene 3 — 4 סוגי הזמנות (`orders-types`)
**Duration:** ~14s | **Type:** App screen (sidebar + modal step 0)

**Visual:**
- App chrome: `PetraSidebar` with `activeLabel="הזמנות"` (or "פיננסים" — check real app)
- Topbar: white bar, Petra logo
- Center: CreateOrderModal at step 0 — 4 category cards in a 2×2 grid:
  - **אילוף** (gradient blue/purple) — sub-label: "יוצר תהליך אילוף אוטומטית"
  - **פנסיון** (gradient green) — sub-label: "פותח כלוב בפנסיון אוטומטית"
  - **טיפוח** (gradient orange) — sub-label: "קובע תור ביומן"
  - **מוצרים** (gradient slate) — sub-label: "מכירה ישירה"
- Highlight ring animates around each card sequentially

**Implementation note:** Connect to Petra app in browser to match exact card layout, colors, and Hebrew labels of the real modal.

**Voiceover:**
> "יש ארבעה סוגי הזמנות — אילוף, פנסיון, טיפוח, ומוצרים. הבחירה קובעת מה ייפתח אוטומטית בהמשך — כלוב בפנסיון, תהליך אילוף, או תור ביומן."

---

### Scene 4 — לקוח, כלב, תאריכים (`orders-customer`)
**Duration:** ~16s | **Type:** App screen (CreateOrderModal step 1)

**Visual:**
- Modal step 1 — boarding example (shows most fields):
  - Customer search field → customer selected: "דנה כהן"
  - Pet auto-selected: "מקס (גולדן רטריבר)"
  - Check-in date/time: today 12:00
  - Check-out date/time: 3 days later 12:00
  - Auto-calculated label: "3 לילות • 2 כלבים" (if multi-pet selected)
- Animations: fields appear one by one as if being filled

**Implementation note:** Match exact field layout, date picker style, and pet selection UI from real app.

**Voiceover:**
> "בוחרים לקוח — הכלב שלו מופיע אוטומטית. לפנסיון בוחרים תאריכי כניסה ויציאה, והמערכת מחשבת לילות ועלות לבד."

---

### Scene 5 — פריטים מהמחירון (`orders-items`)
**Duration:** ~10s | **Type:** App screen (CreateOrderModal step 2)

**Visual:**
- Modal step 2 — items list:
  - Category chips at top (פנסיון selected/highlighted)
  - 1-2 items pre-populated from price list (e.g., "לינה פנסיון — ₪150 × 3 לילות = ₪450")
  - Quantity +/− buttons
- Brief animation: item appears, quantity ticked up
- Small reference label at bottom: "המחירון מוגדר במערכת הפיננסים"

**Implementation note:** Match real CreateOrderModal step 2 item layout.

**Voiceover:**
> "בשלב הפריטים — המחירון שבניתם נשלף אוטומטית. בוחרים שירות, מגדירים כמות, והמחיר מחושב לבד. המחירון מוגדר במערכת הפיננסים."

---

### Scene 6 — מה נוצר אוטומטית (`orders-auto`)
**Duration:** ~18s | **Type:** Split-screen infographic (3 panels)

**Visual:**
- 3 panels side by side (each 1/3 width), appearing with staggered spring animation:

  **Panel 1 — פנסיון:**
  - Icon: 🏠
  - Title: "הזמנת פנסיון"
  - Arrow → "כלוב נפתח בפנסיון"
  - Small mini-screenshot thumbnail of boarding board

  **Panel 2 — אילוף:**
  - Icon: 🐾
  - Title: "הזמנת אילוף"
  - Arrow → "תהליך אילוף נפתח"
  - Small mini-screenshot thumbnail of training program card

  **Panel 3 — תזכורת:**
  - Icon: 📲
  - Title: "כל הזמנה עם תאריך"
  - Arrow → "תזכורת WhatsApp מתוזמנת"
  - Small badge: "PRO+"

- Dark background (same as hub scene), white cards per panel

**Voiceover:**
> "ברגע שיוצרים הזמנת פנסיון — כלוב נפתח אוטומטית במערכת הפנסיון. הזמנת אילוף — תהליך אילוף נפתח לבד. וכל הזמנה עם תאריך — תזכורת בוואטסאפ מתוזמנת אוטומטית."

---

### Scene 7 — מחזור חיים ותשלום (`orders-lifecycle`)
**Duration:** ~14s | **Type:** App screen (order detail page)

**Visual:**
- Order detail page for "הזמנה #A3F2B1":
  - Status bar at top: **טיוטה → אושרה → הושלמה** (3 steps, active step highlighted in orange)
  - "אשר הזמנה" button (orange) → transitions status to "אושרה" with animation
  - Below: payments section showing "שלח דרישת תשלום בוואטסאפ" button (green/WhatsApp color)
  - Payment recorded: ₪450 — "מזומן" — badge "שולם"

**Implementation note:** Match real order detail page layout — status badge position, button placement, payment section.

**Voiceover:**
> "לאחר יצירת ההזמנה — אשרו אותה ועדכנו סטטוס כשהשירות הושלם. מעמוד ההזמנה שולחים דרישת תשלום בוואטסאפ ורושמים תשלום שהתקבל."

---

### Scene 8 — Outro (`orders-outro`)
**Duration:** ~10s | **Type:** Outro card (dark background)

**Visual:** Same pattern as all outros:
- `petra-icon.png` 88×88 (no petra-logo.png underneath)
- Title (white, 46px, bold): **מערכת ההזמנות של פטרה**
- Subtitle (white, 22px): כל שירות, כל לקוח, כל תשלום — במקום אחד
- 4 benefit cards (staggered spring):
  - "חיבור אוטומטי לפנסיון"
  - "תהליך אילוף מיידי"
  - "דרישת תשלום בלחיצה"
  - "מעקב בזמן אמת"
- CTA button (orange gradient): "צרו הזמנה עכשיו ותראו את ההבדל ←"
- URL: `petra-app.com`

**Voiceover:**
> "מערכת ההזמנות של פטרה — כל שירות, כל לקוח, כל תשלום, במקום אחד. צרו הזמנה עכשיו וְתִרְאוּ אֶת הַהֶבְדֵּל."

---

## Voiceover Config Summary

```typescript
export const ORDERS_SCENES = [
  { id: "orders-intro",     defaultDurationSec: 8  },
  { id: "orders-hub",       defaultDurationSec: 14 },
  { id: "orders-types",     defaultDurationSec: 14 },
  { id: "orders-customer",  defaultDurationSec: 16 },
  { id: "orders-items",     defaultDurationSec: 10 },
  { id: "orders-auto",      defaultDurationSec: 18 },
  { id: "orders-lifecycle", defaultDurationSec: 14 },
  { id: "orders-outro",     defaultDurationSec: 10 },
];
// Total default: 104s
```

---

## Files to Create

| File | Notes |
|------|-------|
| `voiceover-orders-config.ts` | Scene IDs + texts + defaultDurationSec |
| `src/OrdersTutorial.tsx` | Main composition + calculateOrdersMetadata |
| `src/scenes/OrdersIntroScene.tsx` | Copy SalesIntroScene pattern, change text |
| `src/scenes/OrdersHubScene.tsx` | New — hub infographic with animated connections |
| `src/scenes/OrdersTypesScene.tsx` | New — modal step 0, 4 category cards |
| `src/scenes/OrdersCustomerScene.tsx` | New — modal step 1, customer+pet+dates |
| `src/scenes/OrdersItemsScene.tsx` | New — modal step 2, price list items |
| `src/scenes/OrdersAutoScene.tsx` | New — 3-panel automatic connections |
| `src/scenes/OrdersLifecycleScene.tsx` | New — order detail, status flow, payment |
| `src/scenes/OrdersOutroScene.tsx` | Copy FinancesOutroScene pattern, change text |
| `public/voiceover/orders-*.wav` | Generated via Gemini TTS + buildWav() |

**Root.tsx:** Register `PetraOrdersTutorial` composition.

---

## No-Overlap Check

| Topic | Covered here | Covered in other tutorial |
|-------|-------------|--------------------------|
| Price list setup | ❌ (reference only) | Finances ✅ |
| WhatsApp payment request (deep) | ❌ (mention only) | Finances ✅ |
| Payments list / tracking | ❌ | Finances ✅ |
| Customer profile / pet card | ❌ (selection only) | Customers ✅ |
| Order types + auto-connections | ✅ unique | — |
| Hub concept (orders connect everything) | ✅ unique | — |
| Order status lifecycle | ✅ unique | — |
| Boarding auto-creation from order | ✅ unique | — |
| Training program auto-creation | ✅ unique | — |

---

## Design Rules (from workflow memory)
- Sidebar: `PetraSidebar` text-only, no emojis
- Intro logo: `petra-icon.png` 44px + white "PETRA" span
- Outro logo: `petra-icon.png` 88px only (no petra-logo.png)
- Outro subtitle: white (not orange)
- Audio buffer: `+0.5s` per scene (not +2.0)
- WAV generation: always wrap Gemini PCM output with `buildWav()`
- Animation timing: spread across full voiceover duration
- Browser reference: connect to live Petra app for exact UI match on scenes 3–7
