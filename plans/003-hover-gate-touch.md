# 003 — Gate hover lifts behind real-pointer devices

- **Status**: DONE (fix/landing-motion)
- **Commit**: 968bd105
- **Severity**: MEDIUM
- **Category**: Accessibility / Physicality
- **Estimated scope**: 2 files, ~10 lines

## Problem

Hover transforms fire on touch devices (a tap triggers `:hover` and it sticks until the user taps elsewhere). Most landing traffic arrives from mobile ads, so cards and buttons get stuck "lifted":

```css
/* src/app/globals.css:437 */
.lp-press:hover { transform: translateY(-1px); }
/* src/app/globals.css:442 */
.lp-card:hover { transform: translateY(-3px); }
```

```tsx
// src/app/landing/page.tsx:459 — audience card screenshot
className="object-cover object-right-top transition-transform duration-500 group-hover:scale-[1.03]"
```

## Target

```css
@media (hover: hover) and (pointer: fine) {
  .lp-press:hover { transform: translateY(-1px); }
  .lp-card:hover { transform: translateY(-3px); }
}
```

Keep `.lp-press:active { transform: scale(0.97); transition-duration: 90ms; }` **outside** the media query — press feedback must work on touch.

For `page.tsx:459` use a Tailwind arbitrary variant:

```
[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]
```

## Repo conventions to follow

- Landing motion lives in the "Landing: Apple-style fluid motion" block of `globals.css` (~line 426).
- The reduced-motion override at `globals.css:474` (`.lp-press:hover, .lp-card:hover { transform: none; }`) stays as is.

## Steps

1. `globals.css`: move the two `:hover` rules into the media query shown above. Place the `:active` rule after the media query so it keeps winning on press.
2. `page.tsx:459`: replace `group-hover:scale-[1.03]` with the arbitrary variant above.

## Boundaries

- Do NOT touch the AccessibilityButton / WhatsAppFAB (plan 005 covers them).
- Do NOT change durations here (plan 004 does).

## Verification

- **Mechanical**: `next build` succeeds; generated CSS contains `@media (hover:hover) and (pointer:fine)` around the group-hover scale.
- **Feel check**: mobile emulation (375px, touch) → tap a feature card and a CTA: no lift sticks after the tap; the CTA still presses down to 0.97. Desktop mouse: hover lift unchanged.
- **Done when**: no hover transform applies on a touch-only device.
