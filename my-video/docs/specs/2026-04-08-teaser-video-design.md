# Petra Teaser Video — Design Spec

## Goal

A 30-second marketing teaser video for Petra, no voiceover, rhythmic editing, targeting Israeli pet-service business owners (groomers, trainers, boarding). Shows pain points → app screens as solutions. CTA: free signup. Usable on both the Petra website (hero background loop) and social media (Reels/Stories).

---

## Decisions Made

| Question | Choice |
|----------|--------|
| Duration | 30 seconds |
| Structure | Pain + solution per scene — every scene = 1 pain overlay → app screen reveal |
| Opening | 2 pain lines on black → Petra logo flash on orange → scenes |
| Pain display style | Text overlay directly on the app screen (C) |
| Modules shown | CRM (leads), Calendar (appointments), Boarding board, Orders+payments, Online booking |

---

## Scene-by-Scene Timeline

### Scene 1 — Chaos opening (0–2s, 60 frames)
- Black background
- 2 red pain lines flash in rapid succession (typewriter or cut-in):
  - "לידים נופלים בין הכסאות"
  - "תורים נשכחים ברגע האחרון"
- Fast cuts, ~1s each

### Scene 2 — Logo bridge (2–4s, 60 frames)
- Solid orange background (#ea580c)
- Petra logo (petra-icon.png, 72px) + "PETRA" text
- Single subtitle: "הפתרון כאן"
- Fades in fast, holds briefly

### Scene 3 — CRM / Leads (4–9s, 150 frames)
- App screen: new simplified Kanban leads mock (3 columns: חדש / בטיפול / סגור, 2–3 lead cards each)
- Pain overlay at start (~1.5s): "לידים נופלים בין הכסאות ✗" in red, fades out
- App screen animates in (cards appear in columns)
- Benefit tag fades in: "כל ליד במקום אחד ✓"

### Scene 4 — Calendar / Appointments (9–14s, 150 frames)
- App screen: weekly calendar with appointment cards
- Pain overlay: "תורים נשכחים ברגע האחרון ✗"
- Benefit tag: "תזכורות WhatsApp אוטומטיות ✓"

### Scene 5 — Boarding board (14–19s, 150 frames)
- App screen: boarding room grid (visual room layout)
- Pain overlay: "מי בא? מי יצא? איזה חדר? ✗"
- Benefit tag: "לוח פנסיון בזמן אמת ✓"

### Scene 6 — Orders + payments (19–24s, 150 frames)
- App screen: order creation modal / payment confirmation
- Pain overlay: "מי שילם? מי חייב? ✗"
- Benefit tag: "הזמנה + חשבונית בלחיצה ✓"

### Scene 7 — Online booking (24–28s, 120 frames)
- App screen: customer-facing booking page (public /book/ view)
- Pain overlay: "הלקוחות מחכים לאישור ידני ✗"
- Benefit tag: "הזמנות אונליין 24/7 ✓"

### Scene 8 — CTA (28–30s, 60 frames)
- Clean orange background
- Large bold text: "נסו פטרה חינם"
- Subtitle: "petra-app.com"
- Petra logo bottom center
- Subtle pulse animation on the main text

---

## Visual Language

### Pain overlay style (confirmed: option C)
- Appears at start of each app scene for ~1.5s then fades out
- Semi-transparent dark overlay on top of the blurred/revealed app screen
- Text: bold, white + red ✗ symbol, RTL, centered
- Font: same as app UI — Segoe UI / system Hebrew
- Transition: fade out the overlay (not the app screen)

### App screens
- Realistic mock of Petra UI (same components as tutorial videos: PetraSidebar + content)
- Sidebar visible, active section highlighted in orange
- Key data animates in (cards, rows, badges) after the pain overlay fades

### Benefit tags
- Appear after the pain fade (~2s into scene)
- Small green pill badge: "✓ כל ליד במקום אחד"
- Bottom-right of the app screen area, slides up into position

### Typography
- Pain lines: 22–24px, bold, white (#fff) with red ✗, RTL
- Benefit tags: 13px, green (#16a34a), rounded pill
- CTA: 48px, extra-bold, white on orange

### Pacing
- 30fps throughout
- Scene transitions: hard cut (no crossfade) — keeps energy high
- Pain overlay duration per scene: 45 frames (1.5s)
- App animation: starts frame 45 of each scene

### Background music
- Upbeat, no vocals, energetic
- Volume: low (0.12 from frame 10 to ~870, fade out last 30 frames)
- Same approach as tutorial videos (interpolate-based volume envelope)

---

## File Structure

```
src/
  TeaserVideo.tsx              — root composition + calculateMetadata
  scenes/teaser/
    TeaserChaosScene.tsx       — Scene 1: black + 2 pain lines
    TeaserLogoScene.tsx        — Scene 2: orange logo bridge
    TeaserCRMScene.tsx         — Scene 3: leads kanban
    TeaserCalendarScene.tsx    — Scene 4: weekly calendar
    TeaserBoardingScene.tsx    — Scene 5: boarding room grid
    TeaserOrdersScene.tsx      — Scene 6: order + payment
    TeaserBookingScene.tsx     — Scene 7: online booking page
    TeaserCTAScene.tsx         — Scene 8: CTA
  components/teaser/
    PainOverlay.tsx            — reusable: dark overlay + pain text, fades out
    BenefitTag.tsx             — reusable: green pill badge, slides up
```

No voiceover — no audio config file, no TTS generation step.

Background music: `public/bg-music.mp3` (same file used in all tutorial videos).

---

## Composition

- Name: `PetraTeaserVideo`
- Dimensions: 1280×720 (16:9)
- FPS: 30
- Duration: 900 frames (30s)
- Register in `src/Root.tsx` alongside existing compositions

---

## Reuse Strategy

- `PetraSidebar` — reuse directly (text-only, no emojis)
- App screen mocks — build new simplified versions for each scene (not full tutorial scenes — simpler, faster to read at a glance)
- Pain + benefit components — new shared components (`PainOverlay`, `BenefitTag`)
- Outro/logo assets — reuse `public/petra-icon.png`
